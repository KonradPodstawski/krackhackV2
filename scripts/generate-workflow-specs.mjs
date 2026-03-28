import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.join(repoRoot, 'public/data/automation-candidates.json');
const outputPath = path.join(repoRoot, 'public/data/workflow-specs.json');

const explainableWeights = {
  activeHours: 0.32,
  clipboardOps: 0.27,
  userCount: 0.18,
  passiveSharePct: 0.13,
  instances: 0.1
};

const indirectSignals = [
  'use teams',
  'teams ios',
  'outlook',
  'call - microsoft teams',
  'browsing',
  'google chrome',
  'chrome',
  'working on kyp-backend',
  'develop kyp-frontend',
  'java development'
];

const evidenceSources = [
  'Activity Sequence Export',
  'Activity Heatmap Export',
  'PRM Export',
  'Process Distribution Export',
  'Tool Use Export',
  'BPMN model',
  'PDD variant preview'
];

function candidateKey(item) {
  return `${item.application}__${item.processStep}`;
}

function normalizeMetric(value, min, max) {
  if (max <= min) {
    return value > 0 ? 1 : 0;
  }

  return (value - min) / (max - min);
}

function isDirectAutomationFit(item) {
  if (item.classification !== 'operational') {
    return false;
  }

  const label = `${item.application} ${item.processStep}`.toLowerCase();
  return !indirectSignals.some((token) => label.includes(token));
}

function buildExplainableCandidates(items) {
  const operational = items.filter((item) => item.classification === 'operational');
  const keys = Object.keys(explainableWeights);
  const ranges = Object.fromEntries(
    keys.map((key) => {
      const values = operational.map((item) => item[key]);
      return [key, { min: Math.min(...values), max: Math.max(...values) }];
    })
  );

  return operational
    .map((candidate) => {
      const directFit = isDirectAutomationFit(candidate);
      const fitMultiplier = directFit ? 1 : 0.58;
      const explainableScore = Number(
        (
          keys.reduce((accumulator, key) => {
            const range = ranges[key];
            return (
              accumulator +
              normalizeMetric(candidate[key], range.min, range.max) * explainableWeights[key] * 100
            );
          }, 0) * fitMultiplier
        ).toFixed(1)
      );

      return {
        candidate,
        directFit,
        fitMultiplier,
        explainableScore
      };
    })
    .sort(
      (a, b) =>
        b.explainableScore - a.explainableScore ||
        Number(b.directFit) - Number(a.directFit) ||
        b.candidate.clipboardOps - a.candidate.clipboardOps ||
        b.candidate.activeHours - a.candidate.activeHours ||
        b.candidate.userCount - a.candidate.userCount ||
        a.candidate.application.localeCompare(b.candidate.application) ||
        a.candidate.processStep.localeCompare(b.candidate.processStep)
    );
}

function buildSpecTemplate(item, directFit) {
  const label = `${item.application} ${item.processStep}`.toLowerCase();

  if (label.includes('excel') || label.includes('sheet')) {
    return {
      workflowKind: 'spreadsheet_sync',
      title: 'Spreadsheet-to-system synchronization',
      automationShape: 'capture -> validate -> enrich -> upsert -> confirm',
      objective: 'Zastap reczne kopiowanie danych z arkusza powtarzalnym zapisem do systemu docelowego.',
      nextAction: 'Uzgodnij jeden workbook/table jako punkt wejscia i ustal klucz idempotencji na rekordzie.',
      trigger: {
        mode: 'event_driven',
        type: 'row_change',
        source: item.application,
        condition: 'Nowy lub zmieniony rekord w monitorowanym arkuszu.'
      },
      systems: [item.application, 'System of record', 'Audit log'],
      inputs: [
        { name: 'record_id', source: item.application, required: true, purpose: 'klucz idempotencji dla rekordu' },
        { name: 'changed_fields', source: item.application, required: true, purpose: 'lista zmienionych pol' },
        { name: 'operator_id', source: item.application, required: false, purpose: 'slad operatora dla audytu' }
      ],
      steps: [
        { id: 'capture_change', kind: 'capture', system: item.application, name: 'Capture row change', description: 'Odczytaj tylko nowe lub zmienione rekordy.' },
        { id: 'validate_required', kind: 'validation', system: 'Rule engine', name: 'Validate required fields', description: 'Sprawdz pola obowiazkowe i format danych.' },
        { id: 'enrich_reference', kind: 'enrichment', system: 'Reference data', name: 'Enrich with master data', description: 'Dopelnij rekord danymi slownikowymi lub mapowaniem.' },
        { id: 'upsert_target', kind: 'writeback', system: 'System of record', name: 'Upsert target record', description: 'Zapisz rekord deterministycznie z kluczem idempotencji.' },
        { id: 'notify_exception', kind: 'notification', system: 'Notification channel', name: 'Notify only on exception', description: 'Powiadom wlasciciela tylko gdy rekord wymaga decyzji.' },
        { id: 'store_audit', kind: 'audit', system: 'Audit log', name: 'Store audit trail', description: 'Zapisz wynik, decyzje i identyfikator zapisu.' }
      ],
      validations: [
        'Pola obowiazkowe nie moga byc puste.',
        'Nie wolno duplikowac rekordu z tym samym record_id.',
        'Mapowanie do systemu docelowego musi byc jednoznaczne.'
      ],
      exceptions: [
        'Brak wymaganych danych wejsciowych.',
        'Konflikt duplikatow.',
        'Blad zapisu do systemu docelowego.'
      ],
      outputs: [
        'Zaktualizowany rekord w systemie docelowym.',
        'Status synchronizacji zapisany przy rekordzie zrodlowym.',
        'Wpis audytowy z wynikiem wykonania.'
      ],
      humanCheckpoints: [
        'Operator zatwierdza tylko rekordy oznaczone jako exception.',
        'Wlasciciel procesu zatwierdza mapowanie pol przed rolloutem.'
      ],
      implementationNotes: [
        'Trigger pozostaje event-driven, bez batchowego pollingu czasowego.',
        'Write-back musi byc idempotentny po record_id.',
        'Arkusz nie powinien byc jedynym source of truth.'
      ]
    };
  }

  if (label.includes('youtrack') || label.includes('update') || label.includes('progress')) {
    return {
      workflowKind: 'ticket_status_enrichment',
      title: 'Ticket status and progress copilot',
      automationShape: 'detect -> collect context -> validate -> write back',
      objective: 'Zautomatyzuj techniczne aktualizacje statusu i uzupelnianie ticketow bez automatyzowania decyzji merytorycznych.',
      nextAction: 'Zdefiniuj liste dozwolonych transition rules i minimalny evidence pack dla update ticketu.',
      trigger: {
        mode: 'event_driven',
        type: 'status_event',
        source: item.application,
        condition: 'Zmiana statusu, milestone lub sygnal delivery dla ticketu.'
      },
      systems: [item.application, 'Build / SCM context', 'Audit log'],
      inputs: [
        { name: 'issue_id', source: item.application, required: true, purpose: 'identyfikator sprawy' },
        { name: 'status_signal', source: 'Delivery context', required: true, purpose: 'sygnal zmiany etapu prac' },
        { name: 'supporting_evidence', source: 'Comments / builds / commits', required: false, purpose: 'kontekst do update statusu' }
      ],
      steps: [
        { id: 'detect_change', kind: 'capture', system: item.application, name: 'Detect issue change', description: 'Wykryj ticket wymagajacy technicznego updateu.' },
        { id: 'collect_context', kind: 'enrichment', system: 'Delivery context', name: 'Collect execution context', description: 'Pobierz relewantne komentarze, buildy i milestone.' },
        { id: 'validate_transition', kind: 'validation', system: 'Rule engine', name: 'Validate transition rules', description: 'Sprawdz, czy przejscie statusu jest dozwolone.' },
        { id: 'write_update', kind: 'writeback', system: item.application, name: 'Write structured update', description: 'Zapisz ustrukturyzowany update ticketu.' },
        { id: 'escalate_low_confidence', kind: 'notification', system: 'Notification channel', name: 'Escalate low confidence cases', description: 'Przekaz sprawy niejednoznaczne do czlowieka.' },
        { id: 'store_audit', kind: 'audit', system: 'Audit log', name: 'Store audit record', description: 'Zapisz kto, kiedy i dlaczego zainicjowal update.' }
      ],
      validations: [
        'Issue musi istniec i byc aktywne.',
        'Przejscie statusu musi byc zgodne z matryca workflow.',
        'Automatyczny update nie moze nadpisywac otwartych blockerow.'
      ],
      exceptions: [
        'Niejednoznaczny evidence pack.',
        'Przejscie statusu poza dozwolona sciezka.',
        'Blad zapisu do systemu ticketowego.'
      ],
      outputs: [
        'Zaktualizowany ticket.',
        'Dopisany komentarz lub changelog.',
        'Audit trail dla wykonanej akcji.'
      ],
      humanCheckpoints: [
        'Wlasciciel sprawy zatwierdza przypadki z niska pewnoscia.',
        'Statusy typu blocked / cancelled pozostaja reczne.'
      ],
      implementationNotes: [
        'Automatyzujemy statusy i wpisy, nie decyzje produktowe.',
        'Idempotencja powinna byc oparta o issue_id + event_id.',
        'Write-back tylko po przejsciu walidacji transition rules.'
      ]
    };
  }

  if (label.includes('sharepoint') || label.includes('shared files') || label.includes('document')) {
    return {
      workflowKind: 'document_routing',
      title: 'Document routing and metadata sync',
      automationShape: 'watch -> classify -> route -> sync -> audit',
      objective: 'Ogranicz reczne przekladanie dokumentow i dopinanie statusow miedzy folderami oraz systemami.',
      nextAction: 'Uzgodnij minimalny standard metadanych i docelowe kolejki odbioru dokumentow.',
      trigger: {
        mode: 'event_driven',
        type: 'file_change',
        source: item.application,
        condition: 'Nowy lub zmieniony dokument w monitorowanej bibliotece.'
      },
      systems: [item.application, 'Task system', 'Audit log'],
      inputs: [
        { name: 'document_id', source: item.application, required: true, purpose: 'identyfikator dokumentu' },
        { name: 'metadata', source: item.application, required: true, purpose: 'zestaw metadanych do klasyfikacji' },
        { name: 'routing_target', source: 'Routing rules', required: false, purpose: 'docelowa kolejka lub folder' }
      ],
      steps: [
        { id: 'watch_library', kind: 'capture', system: item.application, name: 'Watch library change', description: 'Wykryj dodanie lub modyfikacje dokumentu.' },
        { id: 'classify_document', kind: 'decision', system: 'Routing rules', name: 'Classify document', description: 'Wyznacz typ dokumentu i docelowa sciezke obiegu.' },
        { id: 'validate_metadata', kind: 'validation', system: 'Rule engine', name: 'Validate metadata', description: 'Sprawdz komplet wymaganych metadanych.' },
        { id: 'route_document', kind: 'writeback', system: item.application, name: 'Route document', description: 'Przenies lub przypisz dokument do odpowiedniej kolejki.' },
        { id: 'sync_status', kind: 'writeback', system: 'Task system', name: 'Sync downstream status', description: 'Zaktualizuj status powiazanej sprawy lub zadania.' },
        { id: 'store_audit', kind: 'audit', system: 'Audit log', name: 'Store audit trail', description: 'Zapisz trase dokumentu i wynik klasyfikacji.' }
      ],
      validations: [
        'Dokument musi miec jednoznacznego wlasciciela albo kolejke.',
        'Minimalny zestaw metadanych musi byc uzupelniony.',
        'Nie wolno przekierowac pliku do wielu kolejek bez jawnej reguly.'
      ],
      exceptions: [
        'Brak metadanych.',
        'Nieznany typ dokumentu.',
        'Konflikt routingu.'
      ],
      outputs: [
        'Dokument w docelowej kolejce.',
        'Zaktualizowany status obiegu.',
        'Audit trail klasyfikacji i routingu.'
      ],
      humanCheckpoints: [
        'Czlowiek decyduje tylko przy nieznanym typie dokumentu.',
        'Zmiana reguly routingu wymaga kontroli biznesowej.'
      ],
      implementationNotes: [
        'Najpierw ustal slownik typow dokumentow.',
        'Routing powinien byc w pelni event-driven po zmianie pliku.',
        'Metadane musza miec wlasciwosci wymagane przed write-back.'
      ]
    };
  }

  if (label.includes('note') || label.includes('presentation') || label.includes('powerpoint') || label.includes('word')) {
    return {
      workflowKind: 'template_output_assembly',
      title: 'Template-based content assembly',
      automationShape: 'collect -> assemble -> review -> publish',
      objective: 'Przyspiesz skladanie artefaktow powtarzalnych bez automatyzowania finalnej odpowiedzialnosci autora.',
      nextAction: 'Wybierz jeden szablon docelowy i zdefiniuj stabilne zrodla danych do uzupelniania.',
      trigger: {
        mode: 'event_driven',
        type: 'artifact_request',
        source: item.application,
        condition: 'Pojawia sie nowy request na standardowy dokument lub prezentacje.'
      },
      systems: [item.application, 'Source systems', 'Review queue'],
      inputs: [
        { name: 'template_id', source: item.application, required: true, purpose: 'wybrany szablon wyjsciowy' },
        { name: 'business_inputs', source: 'Source systems', required: true, purpose: 'ustrukturyzowane dane do wypelnienia tresci' },
        { name: 'request_id', source: 'Request queue', required: true, purpose: 'identyfikator zlecenia i audytu' }
      ],
      steps: [
        { id: 'collect_inputs', kind: 'capture', system: 'Source systems', name: 'Collect structured inputs', description: 'Pobierz tylko pola wymagane przez szablon.' },
        { id: 'validate_template_data', kind: 'validation', system: 'Rule engine', name: 'Validate template inputs', description: 'Sprawdz komplet i zgodnosc danych z szablonem.' },
        { id: 'assemble_draft', kind: 'writeback', system: item.application, name: 'Assemble draft artifact', description: 'Wygeneruj szkic artefaktu z gotowego szablonu.' },
        { id: 'route_for_review', kind: 'notification', system: 'Review queue', name: 'Route for focused review', description: 'Przekaz szkic tylko do recenzji roznic i wyjatkow.' },
        { id: 'publish_output', kind: 'writeback', system: item.application, name: 'Publish approved output', description: 'Opublikuj finalny artefakt po review.' },
        { id: 'store_audit', kind: 'audit', system: 'Audit log', name: 'Store generation audit', description: 'Zapisz wersje, zrodla i wynik recenzji.' }
      ],
      validations: [
        'Szablon musi byc wersjonowany.',
        'Wszystkie pola wymagane przez szablon musza byc uzupelnione.',
        'Brak danych blokuje publikacje i kieruje sprawę do review.'
      ],
      exceptions: [
        'Niezgodnosc danych z szablonem.',
        'Brak jednego z wymaganych wejsc.',
        'Odrzucenie szkicu podczas review.'
      ],
      outputs: [
        'Wypelniony draft artefaktu.',
        'Finalny dokument lub prezentacja po review.',
        'Historia wersji i audyt danych wejsciowych.'
      ],
      humanCheckpoints: [
        'Czlowiek zatwierdza finalna publikacje.',
        'Zmiany tresci merytorycznej pozostaja po stronie autora.'
      ],
      implementationNotes: [
        'Wejscia musza byc stabilne i wersjonowane.',
        'Automatyzujemy skladanie, nie finalna odpowiedzialnosc za tresc.',
        'Identyfikator request_id powinien spinac caly audit trail.'
      ]
    };
  }

  if (label.includes('build and develop local environment') || label.includes('shell scripting') || label.includes('installers')) {
    return {
      workflowKind: 'developer_enablement',
      title: 'Developer enablement workflow',
      automationShape: 'request -> provision -> verify -> hand over',
      objective: 'Zautomatyzuj bootstrap i walidacje srodowiska zamiast recznego powtarzania setupu.',
      nextAction: 'Spisz minimalny profil setupu i liste weryfikacji, ktore mozna uruchomic bez udzialu operatora.',
      trigger: {
        mode: 'event_driven',
        type: 'setup_request',
        source: item.application,
        condition: 'Pojawia sie nowy request na przygotowanie lub odtworzenie srodowiska.'
      },
      systems: [item.application, 'Package manager', 'Verification checks'],
      inputs: [
        { name: 'profile_id', source: 'Request form', required: true, purpose: 'profil srodowiska do przygotowania' },
        { name: 'target_machine', source: 'Request form', required: true, purpose: 'host docelowy lub workspace' },
        { name: 'requested_tools', source: 'Catalog', required: false, purpose: 'opcjonalne dodatki do profilu' }
      ],
      steps: [
        { id: 'capture_request', kind: 'capture', system: 'Request form', name: 'Capture setup request', description: 'Zarejestruj profil i zakres setupu.' },
        { id: 'provision_dependencies', kind: 'writeback', system: 'Package manager', name: 'Provision dependencies', description: 'Zainstaluj zaleznosci w stalej kolejnosci.' },
        { id: 'run_checks', kind: 'validation', system: 'Verification checks', name: 'Run verification checks', description: 'Zweryfikuj wersje, PATH i dzialanie narzedzi.' },
        { id: 'generate_remediation', kind: 'decision', system: 'Rule engine', name: 'Generate remediation guidance', description: 'Przygotuj instrukcje naprawcze dla failujacych krokow.' },
        { id: 'hand_over_environment', kind: 'notification', system: 'Notification channel', name: 'Hand over ready environment', description: 'Przekaz wynik przygotowania do uzytkownika.' },
        { id: 'store_audit', kind: 'audit', system: 'Audit log', name: 'Store setup audit', description: 'Zapisz wykonane akcje i wynik weryfikacji.' }
      ],
      validations: [
        'Kazda zaleznosc musi miec przypieta wersje lub kanał.',
        'Checklista walidacyjna musi przejsc przed handoffem.',
        'Setup nie moze nadpisywac lokalnych danych bez potwierdzenia.'
      ],
      exceptions: [
        'Brak uprawnien do instalacji.',
        'Konflikt wersji zaleznosci.',
        'Niezgodnosc konfiguracji hosta.'
      ],
      outputs: [
        'Gotowe srodowisko pracy.',
        'Raport weryfikacji i ewentualna remediacja.',
        'Audit trail instalacji.'
      ],
      humanCheckpoints: [
        'Uzytkownik zatwierdza destrukcyjne zmiany lokalne.',
        'Wyjatki infrastrukturalne sa eskalowane poza workflow.'
      ],
      implementationNotes: [
        'Bootstrap i checki sa lepszym targetem niz sama praca developerska.',
        'Stan srodowiska powinien byc weryfikowany po faktach, nie na timerach.',
        'Kazdy krok powinien byc restartowalny i idempotentny.'
      ]
    };
  }

  if (!directFit) {
    return {
      workflowKind: 'adjacent_automation_only',
      title: 'Adjacent automation around knowledge work',
      automationShape: 'observe -> collect metadata -> update side systems',
      objective: 'Nie automatyzuj samej pracy wiedzy. Automatyzuj tylko statusy, metadane i artefakty wokol niej.',
      nextAction: 'Wydziel konkretne sygnaly uboczne, ktore mozna zapisac bez ingerencji w prace ekspercką.',
      trigger: {
        mode: 'event_driven',
        type: 'adjacent_signal',
        source: item.application,
        condition: 'Pojawia sie sygnal uboczny z pracy eksperckiej, np. zmiana statusu, build, komentarz lub artefakt.'
      },
      systems: [item.application, 'Task system', 'Notification channel'],
      inputs: [
        { name: 'work_item_id', source: item.application, required: true, purpose: 'identyfikator obiektu roboczego' },
        { name: 'adjacent_signal', source: item.application, required: true, purpose: 'sygnal uboczny do zapisania w systemach satelitarnych' }
      ],
      steps: [
        { id: 'capture_signal', kind: 'capture', system: item.application, name: 'Capture adjacent signal', description: 'Pobierz tylko sygnaly uboczne bez ingerencji w glowna prace.' },
        { id: 'validate_scope', kind: 'validation', system: 'Rule engine', name: 'Validate automation scope', description: 'Sprawdz, czy sygnal nie dotyczy decyzji merytorycznej.' },
        { id: 'update_side_systems', kind: 'writeback', system: 'Task system', name: 'Update side systems', description: 'Zapisz status, metadane lub linki do artefaktow.' },
        { id: 'store_audit', kind: 'audit', system: 'Audit log', name: 'Store audit trail', description: 'Zapisz wykonane aktualizacje i powod automatyzacji.' }
      ],
      validations: [
        'Workflow nie moze podejmowac decyzji eksperckich.',
        'Automatyzowany sygnal musi byc jednoznaczny i obserwowalny.',
        'Zakres write-back musi byc ograniczony do systemow satelitarnych.'
      ],
      exceptions: [
        'Sygnał wymaga decyzji merytorycznej.',
        'Brak jednoznacznego identyfikatora obiektu roboczego.'
      ],
      outputs: [
        'Zaktualizowane systemy satelitarne.',
        'Audit trail zmian ubocznych.'
      ],
      humanCheckpoints: [
        'Kazdy przypadek poza zdefiniowanym zakresem pozostaje reczny.'
      ],
      implementationNotes: [
        'To jest swiadomie workflow watchlist, nie target do pelnej automatyzacji.',
        'Najpierw trzeba wyizolowac stabilne sygnaly uboczne.'
      ]
    };
  }

  return {
    workflowKind: 'generic_operational_step',
    title: 'Operational step copilot',
    automationShape: 'observe -> validate -> write back -> audit',
    objective: 'Zautomatyzuj powtarzalny krok operacyjny w oparciu o jawny trigger i kontrolowany write-back.',
    nextAction: 'Potwierdz trigger, minimalne wejscia i docelowy system zapisu przed budowa PoC.',
    trigger: {
      mode: 'event_driven',
      type: 'state_change',
      source: item.application,
      condition: 'Obserwowany krok wchodzi w stan gotowy do obslugi automatycznej.'
    },
    systems: [item.application, 'Target system', 'Audit log'],
    inputs: [
      { name: 'case_id', source: item.application, required: true, purpose: 'identyfikator instancji procesu' },
      { name: 'payload', source: item.application, required: true, purpose: 'dane potrzebne do wykonania kroku' },
      { name: 'operator_context', source: item.application, required: false, purpose: 'kontekst operatora dla audytu' }
    ],
    steps: [
      { id: 'observe_ready_state', kind: 'capture', system: item.application, name: 'Observe ready state', description: 'Wykryj moment, w ktorym krok jest gotowy do obslugi.' },
      { id: 'validate_business_rules', kind: 'validation', system: 'Rule engine', name: 'Validate business rules', description: 'Sprawdz warunki wejscia i dopuszczalnosc operacji.' },
      { id: 'write_result', kind: 'writeback', system: 'Target system', name: 'Write result', description: 'Zapisz wynik operacji w systemie docelowym.' },
      { id: 'notify_on_exception', kind: 'notification', system: 'Notification channel', name: 'Notify on exception', description: 'Powiadom operatora tylko przy wyjatku.' },
      { id: 'store_audit', kind: 'audit', system: 'Audit log', name: 'Store audit', description: 'Zapisz kto, kiedy i jaki wynik zostal osiagniety.' }
    ],
    validations: [
      'Trigger musi byc jednoznaczny i oparty na stanie, nie na czasie.',
      'Write-back musi byc idempotentny po case_id lub record_id.',
      'Brak wymaganych danych blokuje wykonanie kroku.'
    ],
    exceptions: [
      'Brak danych wejsciowych.',
      'Konflikt stanu docelowego.',
      'Blad zapisu do systemu docelowego.'
    ],
    outputs: [
      'Zaktualizowany stan sprawy.',
      'Audit trail operacji.'
    ],
    humanCheckpoints: [
      'Operator zatwierdza tylko przypadki wyjatkowe.'
    ],
    implementationNotes: [
      'Preferowany jest trigger event-driven.',
      'Najpierw ustal minimalny zakres write-back i zasady rollbacku.',
      'Workflow powinien byc restartowalny bez duplikacji skutkow.'
    ]
  };
}

function resolvePriorityBand(score, directFit) {
  if (!directFit) {
    return 'Watchlist';
  }

  if (score >= 45) {
    return 'P1';
  }

  if (score >= 35) {
    return 'P2';
  }

  return 'P3';
}

async function main() {
  const raw = await readFile(inputPath, 'utf8');
  const items = JSON.parse(raw);
  const explainableCandidates = buildExplainableCandidates(items);

  const workflowSpecs = explainableCandidates.map((entry, index) => {
    const template = buildSpecTemplate(entry.candidate, entry.directFit);

    return {
      version: '1.0.0',
      candidateKey: candidateKey(entry.candidate),
      priorityRank: index + 1,
      priorityBand: resolvePriorityBand(entry.explainableScore, entry.directFit),
      eligibility: entry.directFit ? 'recommended' : 'watchlist',
      workflowKind: template.workflowKind,
      title: template.title,
      processStep: entry.candidate.processStep,
      application: entry.candidate.application,
      automationShape: template.automationShape,
      objective: template.objective,
      nextAction: template.nextAction,
      trigger: template.trigger,
      systems: template.systems,
      inputs: template.inputs,
      steps: template.steps,
      validations: template.validations,
      exceptions: template.exceptions,
      outputs: template.outputs,
      humanCheckpoints: template.humanCheckpoints,
      implementationNotes: template.implementationNotes,
      evidenceSources,
      evidence: {
        activeHours: entry.candidate.activeHours,
        clipboardOps: entry.candidate.clipboardOps,
        userCount: entry.candidate.userCount,
        passiveSharePct: entry.candidate.passiveSharePct,
        instances: entry.candidate.instances,
        explainableScore: entry.explainableScore,
        sourceScore: entry.candidate.score,
        fitMultiplier: entry.fitMultiplier,
        sourceReasoning: entry.candidate.reasoning
      }
    };
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(workflowSpecs, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${workflowSpecs.length} workflow specs to ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
