<script lang="ts">
  import { onMount } from 'svelte';
  import BpmnViewer from './lib/components/BpmnViewer.svelte';
  import CandidateTable from './lib/components/CandidateTable.svelte';
  import EChart from './lib/components/EChart.svelte';
  import KpiCard from './lib/components/KpiCard.svelte';
  import SectionCard from './lib/components/SectionCard.svelte';
  import { clampText, formatHours, formatNumber, formatPercent } from './lib/format';
  import type {
    AppRecord,
    AutomationCandidate,
    BpmnTaskMetric,
    ClipboardFlowApp,
    ClipboardFlowStep,
    DashboardData,
    HeadcountPoint,
    PddVariantPreview,
    ProcessDistributionPoint,
    Transition
  } from './lib/types';

  type OpportunityPlaybook = {
    title: string;
    subtitle: string;
    automationShape: string;
    workflow: string[];
    caution: string;
    candidate: AutomationCandidate;
  };

  type WatchItem = {
    title: string;
    note: string;
    recommendation: string;
    candidate: AutomationCandidate;
  };

  type VariantSnapshot = {
    variantNumber: number;
    leadApplication: string;
    leadStep: string;
    coverageLabel: string;
    visibleMinutes: number;
    visibleManualOps: number;
    visibleRows: number;
  };

  const challengeCapabilities = [
    'realny przebieg procesu',
    'warianty i odstepstwa',
    'waskie gardla i context switching',
    'manualne handoffy i copy-paste',
    'priorytety automatyzacji',
    'workflow gotowy do demo'
  ] as const;

  const palette = ['#0b5d5b', '#c65d2e', '#17324d', '#c89b37', '#708238', '#7d5a50'];
  const axisColor = '#6a7688';
  const gridColor = 'rgba(22, 50, 77, 0.12)';

  let loading = true;
  let error = '';
  let data: DashboardData | null = null;
  let selectedPddVariant = 1;
  let transitionMode: 'steps' | 'applications' = 'steps';

  const endpoints = {
    overview: '/data/overview.json',
    headcount: '/data/headcount.json',
    processDistribution: '/data/process-distribution.json',
    toolUsageAggregated: '/data/tool-usage-aggregated.json',
    toolUsageOverTime: '/data/tool-usage-over-time.json',
    prmViews: '/data/prm-views.json',
    topSteps: '/data/top-steps.json',
    topApplications: '/data/top-applications.json',
    stepTransitions: '/data/step-transitions.json',
    appTransitions: '/data/app-transitions.json',
    clipboardHeatmapApps: '/data/clipboard-heatmap-apps.json',
    clipboardHeatmapSteps: '/data/clipboard-heatmap-steps.json',
    bpmnTaskMetrics: '/data/bpmn-task-metrics.json',
    automationCandidates: '/data/automation-candidates.json',
    pddVariantsPreview: '/data/pdd-variants-preview.json',
    bpmnXml: '/data/process-model.bpmn'
  };

  async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }

    return response.json() as Promise<T>;
  }

  async function fetchText(url: string): Promise<string> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }

    return response.text();
  }

  onMount(async () => {
    try {
      const [
        overview,
        headcount,
        processDistribution,
        toolUsageAggregated,
        toolUsageOverTime,
        prmViews,
        topSteps,
        topApplications,
        stepTransitions,
        appTransitions,
        clipboardHeatmapApps,
        clipboardHeatmapSteps,
        bpmnTaskMetrics,
        automationCandidates,
        pddVariantsPreview,
        bpmnXml
      ] = await Promise.all([
        fetchJson<DashboardData['overview']>(endpoints.overview),
        fetchJson<DashboardData['headcount']>(endpoints.headcount),
        fetchJson<DashboardData['processDistribution']>(endpoints.processDistribution),
        fetchJson<DashboardData['toolUsageAggregated']>(endpoints.toolUsageAggregated),
        fetchJson<DashboardData['toolUsageOverTime']>(endpoints.toolUsageOverTime),
        fetchJson<DashboardData['prmViews']>(endpoints.prmViews),
        fetchJson<DashboardData['topSteps']>(endpoints.topSteps),
        fetchJson<DashboardData['topApplications']>(endpoints.topApplications),
        fetchJson<DashboardData['stepTransitions']>(endpoints.stepTransitions),
        fetchJson<DashboardData['appTransitions']>(endpoints.appTransitions),
        fetchJson<DashboardData['clipboardHeatmapApps']>(endpoints.clipboardHeatmapApps),
        fetchJson<DashboardData['clipboardHeatmapSteps']>(endpoints.clipboardHeatmapSteps),
        fetchJson<DashboardData['bpmnTaskMetrics']>(endpoints.bpmnTaskMetrics),
        fetchJson<DashboardData['automationCandidates']>(endpoints.automationCandidates),
        fetchJson<DashboardData['pddVariantsPreview']>(endpoints.pddVariantsPreview),
        fetchText(endpoints.bpmnXml)
      ]);

      data = {
        overview,
        headcount,
        processDistribution,
        toolUsageAggregated,
        toolUsageOverTime,
        prmViews,
        topSteps,
        topApplications,
        stepTransitions,
        appTransitions,
        clipboardHeatmapApps,
        clipboardHeatmapSteps,
        bpmnTaskMetrics,
        automationCandidates,
        pddVariantsPreview,
        bpmnXml
      };
    } catch (err) {
      console.error(err);
      error = 'Nie udalo sie zaladowac danych dashboardu.';
    } finally {
      loading = false;
    }
  });

  function sum(values: number[]): number {
    return values.reduce((acc, value) => acc + value, 0);
  }

  function currentVariant(items: PddVariantPreview[]): PddVariantPreview | undefined {
    return items.find((variant) => variant.variantNumber === selectedPddVariant);
  }

  function formatRange(start: string, end: string): string {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
  }

  function formatCoverageLabel(measured: number | null, expected: number | null): string {
    if (measured == null || expected == null) {
      return 'brak';
    }

    return `${formatNumber(measured)} / ${formatNumber(expected)}`;
  }

  function isDirectAutomationFit(item: AutomationCandidate): boolean {
    if (item.classification !== 'operational') {
      return false;
    }

    const label = `${item.application} ${item.processStep}`.toLowerCase();
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

    return !indirectSignals.some((token) => label.includes(token));
  }

  function buildAutomationPlaybook(item: AutomationCandidate): OpportunityPlaybook {
    const label = `${item.application} ${item.processStep}`.toLowerCase();

    if (label.includes('excel') || label.includes('sheet')) {
      return {
        title: 'Structured data sync from spreadsheet work',
        subtitle: `${item.application} / ${item.processStep}`,
        automationShape: 'capture -> validate -> sync -> confirm',
        workflow: [
          'Trigger on new or changed row',
          'Validate mandatory fields and duplicates',
          'Enrich with master data or reference tables',
          'Write outcome back to system of record',
          'Notify owner only on exception'
        ],
        caution: 'Excel powinien zostac warstwa wejscia lub kontroli, nie jedynym zrodlem prawdy.',
        candidate: item
      };
    }

    if (label.includes('youtrack') || label.includes('update') || label.includes('progress')) {
      return {
        title: 'Ticket update and status enrichment copilot',
        subtitle: `${item.application} / ${item.processStep}`,
        automationShape: 'detect -> collect context -> draft -> write back',
        workflow: [
          'Detect issue change or delivery milestone',
          'Collect facts from commits, logs or comments',
          'Draft progress update with status and blockers',
          'Write structured update back to ticket',
          'Escalate only when confidence is low'
        ],
        caution: 'Automatyzuj aktualizacje i statusy, nie decyzje merytoryczne wlasciciela sprawy.',
        candidate: item
      };
    }

    if (label.includes('sharepoint') || label.includes('shared files') || label.includes('document')) {
      return {
        title: 'Document routing and metadata synchronization',
        subtitle: `${item.application} / ${item.processStep}`,
        automationShape: 'watch -> classify -> route -> sync',
        workflow: [
          'Watch for new or modified files',
          'Extract metadata and classify document',
          'Route file to owner, folder or queue',
          'Sync status to task system',
          'Track exceptions and missing metadata'
        ],
        caution: 'Najpierw ustal stabilny model metadanych, inaczej workflow zacznie powielac chaos.',
        candidate: item
      };
    }

    if (label.includes('note') || label.includes('presentation') || label.includes('powerpoint') || label.includes('word')) {
      return {
        title: 'Content assembly and template-based output',
        subtitle: `${item.application} / ${item.processStep}`,
        automationShape: 'collect -> assemble -> review -> publish',
        workflow: [
          'Collect structured inputs from source systems',
          'Assemble draft from approved template',
          'Insert charts, metrics and narrative blocks',
          'Request focused human review',
          'Publish final artifact to target workspace'
        ],
        caution: 'Dobrze dziala tylko wtedy, gdy wejscia maja ustalony schemat i wersjonowanie.',
        candidate: item
      };
    }

    if (label.includes('build and develop local environment') || label.includes('shell scripting') || label.includes('installers')) {
      return {
        title: 'Developer enablement and self-service setup',
        subtitle: `${item.application} / ${item.processStep}`,
        automationShape: 'request -> provision -> verify -> hand over',
        workflow: [
          'Capture setup request and required profile',
          'Provision dependencies in deterministic order',
          'Run verification checks and environment diff',
          'Generate remediation steps for failed checks',
          'Hand over a ready-to-work environment'
        ],
        caution: 'Tu lepiej automatyzowac bootstrap i walidacje niz sama prace developerska.',
        candidate: item
      };
    }

    return {
      title: 'Operational step copilot with human approval',
      subtitle: `${item.application} / ${item.processStep}`,
      automationShape: 'observe -> prefill -> validate -> submit',
      workflow: [
        'Observe stable trigger in the current step',
        'Prefill data from adjacent systems',
        'Validate against business rules',
        'Submit change into target application',
        'Store audit trail and exception state'
      ],
      caution: 'Najpierw potwierdz stabilny trigger i idempotentny zapis, dopiero potem zamykaj petle end-to-end.',
      candidate: item
    };
  }

  function watchRecommendation(item: AutomationCandidate): string {
    const label = `${item.application} ${item.processStep}`.toLowerCase();

    if (label.includes('teams') || label.includes('outlook') || label.includes('call')) {
      return 'To raczej nosnik wspolpracy. Automatyzuj aktualizacje, wpisy i handoffy obok komunikacji.';
    }

    if (label.includes('backend') || label.includes('frontend') || label.includes('java development')) {
      return 'To praca wiedzy. Szukaj automatyzacji scaffoldingu, buildow, statusow i danych wokol developmentu.';
    }

    if (label.includes('browsing') || label.includes('chrome')) {
      return 'Krok jest zbyt ogolny. Najpierw trzeba rozbic go na konkretne taski i miejsca przepisywania danych.';
    }

    return 'Wysoki wolumen nie oznacza od razu dobrej automatyzacji. Najpierw ustal trigger i granice odpowiedzialnosci czlowiek - system.';
  }

  function buildWatchItem(item: AutomationCandidate): WatchItem {
    return {
      title: `${item.application} / ${item.processStep}`,
      note: `${formatHours(item.activeHours)} aktywnie, ${formatNumber(item.userCount)} users, score ${item.score.toFixed(1)}`,
      recommendation: watchRecommendation(item),
      candidate: item
    };
  }

  function parseDurationSummary(value: string): number {
    const hours = Number(value.match(/(\d+)h/)?.[1] ?? 0);
    const minutes = Number(value.match(/(\d+)m/)?.[1] ?? 0);
    const seconds = Number(value.match(/(\d+)s/)?.[1] ?? 0);

    return hours * 60 + minutes + seconds / 60;
  }

  function parseManualOps(value: string): number {
    const copy = Number(value.match(/copy:\s*(\d+)/i)?.[1] ?? 0);
    const cut = Number(value.match(/cut:\s*(\d+)/i)?.[1] ?? 0);
    const paste = Number(value.match(/paste:\s*(\d+)/i)?.[1] ?? 0);

    return copy + cut + paste;
  }

  function summarizeVariant(variant: PddVariantPreview): VariantSnapshot {
    const visibleMinutes = sum(variant.rows.map((row) => parseDurationSummary(row[3] ?? '')));
    const visibleManualOps = sum(variant.rows.map((row) => parseManualOps(row[5] ?? '')));
    const leadRow = variant.rows[0] ?? [];

    return {
      variantNumber: variant.variantNumber,
      leadApplication: leadRow[1] ?? 'n/a',
      leadStep: leadRow[2] ?? 'n/a',
      coverageLabel: leadRow[4] ?? 'n/a',
      visibleMinutes,
      visibleManualOps,
      visibleRows: variant.rows.length
    };
  }

  function buildHeadcountOptions(items: HeadcountPoint[]) {
    return {
      color: [palette[0], palette[3], palette[1]],
      tooltip: { trigger: 'axis' },
      legend: { top: 0, textStyle: { color: axisColor } },
      grid: { left: 56, right: 56, top: 56, bottom: 36 },
      xAxis: {
        type: 'category',
        data: items.map((item) => item.date),
        axisLabel: { color: axisColor },
        axisLine: { lineStyle: { color: gridColor } }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Users',
          nameTextStyle: { color: axisColor },
          axisLabel: { color: axisColor },
          splitLine: { lineStyle: { color: gridColor } }
        },
        {
          type: 'value',
          name: 'Coverage %',
          max: 100,
          nameTextStyle: { color: axisColor },
          axisLabel: { color: axisColor },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          type: 'bar',
          name: 'Measured',
          barMaxWidth: 18,
          data: items.map((item) => item.measuredUsers)
        },
        {
          type: 'bar',
          name: 'Expected',
          barMaxWidth: 18,
          itemStyle: { opacity: 0.42 },
          data: items.map((item) => item.expectedUsers)
        },
        {
          type: 'line',
          name: 'Coverage %',
          smooth: true,
          yAxisIndex: 1,
          symbolSize: 7,
          data: items.map((item) => item.coveragePct ?? 0)
        }
      ]
    };
  }

  function buildProcessMixOptions(items: ProcessDistributionPoint[]) {
    const keys = items.length > 0 ? Object.keys(items[0]).filter((key) => key !== 'date') : [];

    return {
      color: palette,
      tooltip: { trigger: 'axis' },
      legend: { top: 0, textStyle: { color: axisColor } },
      grid: { left: 56, right: 24, top: 56, bottom: 36 },
      xAxis: {
        type: 'category',
        data: items.map((item) => String(item.date)),
        axisLabel: { color: axisColor },
        axisLine: { lineStyle: { color: gridColor } }
      },
      yAxis: {
        type: 'value',
        name: 'Hours',
        nameTextStyle: { color: axisColor },
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: gridColor } }
      },
      series: keys.map((key) => ({
        type: 'line',
        name: key,
        smooth: true,
        stack: 'processes',
        areaStyle: { opacity: 0.14 },
        symbol: 'none',
        lineStyle: { width: 2 },
        data: items.map((item) => Number(item[key] ?? 0))
      }))
    };
  }

  function buildApplicationLandscapeOptions(items: AppRecord[]) {
    const top = items.slice(0, 18);
    const maxClipboard = Math.max(...top.map((item) => item.clipboardOps), 1);

    return {
      color: [palette[0]],
      tooltip: {
        formatter: (params: { data: [number, number, number, number, string] }) => {
          const [activeHours, passiveShare, clipboardOps, userCount, application] = params.data;

          return [
            `<strong>${application}</strong>`,
            `Active: ${formatHours(activeHours)}`,
            `Passive share: ${formatPercent(passiveShare)}`,
            `Clipboard ops: ${formatNumber(clipboardOps)}`,
            `Users: ${formatNumber(userCount)}`
          ].join('<br/>');
        }
      },
      grid: { left: 56, right: 36, top: 32, bottom: 44 },
      xAxis: {
        type: 'value',
        name: 'Active hours',
        nameTextStyle: { color: axisColor },
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: gridColor } }
      },
      yAxis: {
        type: 'value',
        name: 'Passive share %',
        nameTextStyle: { color: axisColor },
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: gridColor } }
      },
      visualMap: {
        min: 0,
        max: maxClipboard,
        dimension: 2,
        right: 0,
        top: 'middle',
        itemHeight: 120,
        calculable: true,
        text: ['Clipboard', ''],
        textStyle: { color: axisColor },
        inRange: {
          color: ['#d8e3df', '#c89b37', '#c65d2e']
        }
      },
      series: [
        {
          type: 'scatter',
          data: top.map((item) => [
            item.activeHours,
            item.passiveSharePct,
            item.clipboardOps,
            item.userCount,
            item.application
          ]),
          label: {
            show: true,
            color: '#17324d',
            formatter: (params: { data: [number, number, number, number, string] }) => {
              const [, , clipboardOps, userCount, application] = params.data;
              return clipboardOps > 1500 || userCount > 25 ? clampText(application, 18) : '';
            },
            position: 'top'
          },
          symbolSize: (value: number[]) => Math.max(14, Math.sqrt(value[3]) * 4),
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 1.4,
            opacity: 0.92
          }
        }
      ]
    };
  }

  function buildClipboardHeatmapOptions(items: ClipboardFlowApp[]) {
    const crossAppFlows = items.filter((item) => item.sourceApplication !== item.targetApplication);
    const appStrength = new Map<string, number>();

    for (const flow of crossAppFlows) {
      appStrength.set(flow.sourceApplication, (appStrength.get(flow.sourceApplication) ?? 0) + flow.count);
      appStrength.set(flow.targetApplication, (appStrength.get(flow.targetApplication) ?? 0) + flow.count);
    }

    const topApps = [...appStrength.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);

    const pairs = new Map<string, number>();

    for (const flow of crossAppFlows) {
      if (!topApps.includes(flow.sourceApplication) || !topApps.includes(flow.targetApplication)) {
        continue;
      }

      pairs.set(`${flow.sourceApplication}__${flow.targetApplication}`, flow.count);
    }

    const matrix = topApps.flatMap((source, sourceIndex) =>
      topApps.map((target, targetIndex) => [
        sourceIndex,
        targetIndex,
        pairs.get(`${source}__${target}`) ?? 0
      ])
    );

    const maxValue = Math.max(...matrix.map(([, , value]) => Number(value)), 1);

    return {
      tooltip: {
        position: 'top',
        formatter: (params: { data: [number, number, number] }) => {
          const [sourceIndex, targetIndex, count] = params.data;
          return `${topApps[sourceIndex]} -> ${topApps[targetIndex]}<br/>${formatNumber(count)} copy/paste`;
        }
      },
      grid: { left: 118, right: 32, top: 20, bottom: 64 },
      xAxis: {
        type: 'category',
        data: topApps,
        axisLabel: { color: axisColor, interval: 0, rotate: 30 },
        axisLine: { lineStyle: { color: gridColor } }
      },
      yAxis: {
        type: 'category',
        data: topApps,
        axisLabel: { color: axisColor },
        axisLine: { lineStyle: { color: gridColor } }
      },
      visualMap: {
        min: 0,
        max: maxValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 10,
        textStyle: { color: axisColor },
        inRange: {
          color: ['#f6efe5', '#d4c0a3', '#c89b37', '#c65d2e', '#8a3f2d']
        }
      },
      series: [
        {
          type: 'heatmap',
          data: matrix,
          label: {
            show: true,
            color: '#17324d',
            formatter: (params: { data: [number, number, number] }) => {
              return params.data[2] > maxValue * 0.42 ? formatNumber(params.data[2]) : '';
            }
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.15)'
            }
          }
        }
      ]
    };
  }

  function wouldCreateCycle(adjacency: Map<string, Set<string>>, source: string, target: string): boolean {
    if (source === target) {
      return true;
    }

    const stack = [target];
    const visited = new Set<string>([target]);

    while (stack.length > 0) {
      const node = stack.pop();

      if (!node) {
        continue;
      }

      if (node === source) {
        return true;
      }

      for (const next of adjacency.get(node) ?? []) {
        if (visited.has(next)) {
          continue;
        }

        visited.add(next);
        stack.push(next);
      }
    }

    return false;
  }

  function selectAcyclicTransitions(items: Transition[], limit = 20): Transition[] {
    const sorted = [...items]
      .filter((item) => item.source !== item.target)
      .sort(
        (a, b) =>
          b.count - a.count ||
          b.userCount - a.userCount ||
          a.source.localeCompare(b.source) ||
          a.target.localeCompare(b.target)
      );

    const adjacency = new Map<string, Set<string>>();
    const selected: Transition[] = [];

    for (const item of sorted) {
      if (selected.length >= limit) {
        break;
      }

      if (wouldCreateCycle(adjacency, item.source, item.target)) {
        continue;
      }

      if (!adjacency.has(item.source)) {
        adjacency.set(item.source, new Set());
      }

      adjacency.get(item.source)?.add(item.target);
      selected.push(item);
    }

    return selected;
  }

  function buildTransitionSankeyOptions(items: Transition[]) {
    const filtered = selectAcyclicTransitions(items, 20);
    const nodeNames = new Set<string>();

    for (const item of filtered) {
      nodeNames.add(item.source);
      nodeNames.add(item.target);
    }

    return {
      color: palette,
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'sankey',
          nodeAlign: 'justify',
          draggable: false,
          emphasis: { focus: 'adjacency' },
          label: {
            color: '#17324d',
            fontSize: 12,
            formatter: (params: { name: string }) => clampText(params.name, 34)
          },
          data: [...nodeNames].map((name) => ({
            name,
            itemStyle: {
              borderWidth: 0,
              color: '#dbe7e2'
            }
          })),
          links: filtered.map((item) => ({
            source: item.source,
            target: item.target,
            value: item.count
          })),
          lineStyle: {
            color: 'gradient',
            curveness: 0.5,
            opacity: 0.45
          }
        }
      ]
    };
  }

  function buildAutomationPortfolioOptions(items: AutomationCandidate[]) {
    const top = items.filter((item) => item.classification === 'operational').slice(0, 18);
    const maxScore = Math.max(...top.map((item) => item.score), 1);

    return {
      tooltip: {
        formatter: (params: { data: [number, number, number, number, string, string, number] }) => {
          const [activeHours, clipboardOps, userCount, passiveShare, processStep, application, score] = params.data;

          return [
            `<strong>${processStep}</strong>`,
            `${application}`,
            `Score: ${score.toFixed(1)}`,
            `Active: ${formatHours(activeHours)}`,
            `Clipboard: ${formatNumber(clipboardOps)}`,
            `Users: ${formatNumber(userCount)}`,
            `Passive share: ${formatPercent(passiveShare)}`
          ].join('<br/>');
        }
      },
      grid: { left: 56, right: 48, top: 28, bottom: 48 },
      xAxis: {
        type: 'value',
        name: 'Active hours',
        nameTextStyle: { color: axisColor },
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: gridColor } }
      },
      yAxis: {
        type: 'value',
        name: 'Clipboard ops',
        nameTextStyle: { color: axisColor },
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: gridColor } }
      },
      visualMap: {
        min: 0,
        max: maxScore,
        dimension: 6,
        right: 0,
        top: 'middle',
        itemHeight: 120,
        calculable: true,
        text: ['Opportunity score', ''],
        textStyle: { color: axisColor },
        inRange: {
          color: ['#dfe7e0', '#c89b37', '#c65d2e', '#0b5d5b']
        }
      },
      series: [
        {
          type: 'scatter',
          data: top.map((item) => [
            item.activeHours,
            item.clipboardOps,
            item.userCount,
            item.passiveSharePct,
            item.processStep,
            item.application,
            item.score
          ]),
          label: {
            show: true,
            color: '#17324d',
            formatter: (params: { data: [number, number, number, number, string, string, number] }) => {
              return params.data[6] >= 24 ? clampText(params.data[4], 22) : '';
            },
            position: 'top'
          },
          symbolSize: (value: number[]) => Math.max(16, Math.sqrt(value[2]) * 5),
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 1.4,
            opacity: 0.95
          }
        }
      ]
    };
  }

  function buildTopStepsBarOptions(items: DashboardData['topSteps']) {
    const top = items.slice(0, 10).reverse();

    return {
      color: [palette[2]],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: { left: 188, right: 24, top: 16, bottom: 24 },
      xAxis: {
        type: 'value',
        name: 'Active hours',
        nameTextStyle: { color: axisColor },
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: gridColor } }
      },
      yAxis: {
        type: 'category',
        data: top.map((item) => clampText(item.processStep, 34)),
        axisLabel: { color: axisColor }
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 18,
          data: top.map((item) => item.activeHours),
          itemStyle: {
            borderRadius: [0, 10, 10, 0]
          }
        }
      ]
    };
  }

  function buildBpmnTaskPressureOptions(items: BpmnTaskMetric[]) {
    const top = [...items]
      .sort((a, b) => (b.activeDuration ?? 0) - (a.activeDuration ?? 0))
      .slice(0, 8)
      .reverse();

    return {
      color: [palette[1]],
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: { left: 170, right: 24, top: 12, bottom: 24 },
      xAxis: {
        type: 'value',
        name: 'Active hours',
        nameTextStyle: { color: axisColor },
        axisLabel: { color: axisColor },
        splitLine: { lineStyle: { color: gridColor } }
      },
      yAxis: {
        type: 'category',
        data: top.map((item) => clampText(item.name, 30)),
        axisLabel: { color: axisColor }
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 16,
          data: top.map((item) => (item.activeDuration ?? 0) / 3600000),
          itemStyle: {
            borderRadius: [0, 10, 10, 0]
          }
        }
      ]
    };
  }

  $: leadProcesses = data
    ? data.overview.dominantProcesses
        .slice(0, 2)
        .map((process) => process.name)
        .join(' + ')
    : '';

  $: operationalCandidates = data
    ? data.automationCandidates.filter((candidate) => candidate.classification === 'operational')
    : [];

  $: playbooks = data
    ? operationalCandidates
        .filter((candidate) => isDirectAutomationFit(candidate))
        .slice(0, 3)
        .map((candidate) => buildAutomationPlaybook(candidate))
    : [];

  $: watchlist = data
    ? data.automationCandidates
        .filter((candidate) => !isDirectAutomationFit(candidate))
        .slice(0, 4)
        .map((candidate) => buildWatchItem(candidate))
    : [];

  $: selectedVariant = data ? currentVariant(data.pddVariantsPreview) : undefined;
  $: variantSnapshots = data ? data.pddVariantsPreview.slice(0, 6).map((variant) => summarizeVariant(variant)) : [];
  $: transitionItems = data ? (transitionMode === 'steps' ? data.stepTransitions : data.appTransitions) : [];
  $: clipboardCrossFlows = data
    ? data.clipboardHeatmapSteps
        .filter((flow) => flow.sourceApplication !== flow.targetApplication)
        .slice(0, 6)
    : [];
  $: crossAppClipboardTotal = data
    ? sum(
        data.clipboardHeatmapApps
          .filter((flow) => flow.sourceApplication !== flow.targetApplication)
          .map((flow) => flow.count)
      )
    : 0;
  $: contextSwitchTotal = data
    ? sum(data.appTransitions.filter((flow) => flow.source !== flow.target).map((flow) => flow.count))
    : 0;
  $: strongCandidateCount = data
    ? operationalCandidates.filter((candidate) => candidate.score >= 20).length
    : 0;
  $: dominantWorkloadShare = data
    ? (sum(data.overview.dominantProcesses.slice(0, 2).map((process) => process.hours)) /
        data.overview.totalTrackedHours) *
      100
    : 0;
</script>

{#if loading}
  <main class="app-shell">
    <div class="empty-state">Ladowanie dashboardu...</div>
  </main>
{:else if error || !data}
  <main class="app-shell">
    <div class="empty-state empty-state--error">{error || 'Brak danych.'}</div>
  </main>
{:else}
  <main class="app-shell">
    <header class="hero">
      <div class="hero__content">
        <div class="eyebrow">Process-to-Automation Copilot</div>
        <h1>Od event logu do shortlisty automatyzacji gotowej na demo.</h1>
        <p class="hero__lead">
          Dashboard odpowiada bezposrednio na brief z PDF: rekonstruuje rzeczywisty przebieg procesu,
          pokazuje warianty i odstepstwa, izoluje reczne handoffy oraz zamienia je w priorytety
          automatyzacji i uproszczone workflow do demonstracji.
        </p>

        <div class="hero__capabilities">
          {#each challengeCapabilities as capability}
            <span class="capability-pill">{capability}</span>
          {/each}
        </div>
      </div>

      <aside class="brief-card">
        <div class="brief-card__eyebrow">Brief fit</div>
        <h2>{data.overview.datasetLabel}</h2>

        <div class="brief-stats">
          <div>
            <span>Window</span>
            <strong>{formatRange(data.overview.timeRange.start, data.overview.timeRange.end)}</strong>
          </div>
          <div>
            <span>Coverage</span>
            <strong>{formatCoverageLabel(data.overview.latestMeasuredUsers, data.overview.latestExpectedUsers)}</strong>
          </div>
          <div>
            <span>Dominant workload</span>
            <strong>{leadProcesses}</strong>
          </div>
          <div>
            <span>Lead play</span>
            <strong>{playbooks[0]?.title ?? 'n/a'}</strong>
          </div>
        </div>

        <ul class="brief-notes">
          {#each data.overview.notes as note}
            <li>{note}</li>
          {/each}
        </ul>
      </aside>
    </header>

    <section class="kpi-grid kpi-grid--wide">
      <KpiCard
        title="Tracked workload"
        value={formatHours(data.overview.totalTrackedHours)}
        subtitle={`${formatHours(data.overview.totalActiveHours)} active / ${formatHours(data.overview.totalPassiveHours)} passive`}
      />
      <KpiCard
        title="Measured coverage"
        value={formatCoverageLabel(data.overview.latestMeasuredUsers, data.overview.latestExpectedUsers)}
        subtitle={`coverage ${formatPercent(data.overview.latestCoveragePct)}`}
      />
      <KpiCard
        title="Cross-app handoffs"
        value={formatNumber(crossAppClipboardTotal)}
        subtitle="copy-paste miedzy systemami"
      />
      <KpiCard
        title="Context switches"
        value={formatNumber(contextSwitchTotal)}
        subtitle="przejscia miedzy aplikacjami"
      />
      <KpiCard
        title="Automation-ready steps"
        value={formatNumber(strongCandidateCount)}
        subtitle="operational score >= 20"
      />
      <KpiCard
        title="Dominant workload share"
        value={formatPercent(dominantWorkloadShare)}
        subtitle="dwa najwieksze strumienie pracy"
      />
    </section>

    <div class="two-col">
      <SectionCard
        title="Recommended automation plays"
        description="Sekcja odpowiada na najwazniejszy element briefu: nie tylko wskazac, co boli, ale tez zamienic to w workflow do demonstracji."
      >
        <div class="playbook-grid">
          {#each playbooks as playbook, index}
            <article class="playbook-card">
              <div class="playbook-card__topline">
                <div class="playbook-rank">0{index + 1}</div>
                <div>
                  <h3>{playbook.title}</h3>
                  <p>{playbook.subtitle}</p>
                </div>
              </div>

              <div class="metric-pills">
                <span>{playbook.automationShape}</span>
                <span>score {playbook.candidate.score.toFixed(1)}</span>
                <span>{formatHours(playbook.candidate.activeHours)} active</span>
                <span>{formatNumber(playbook.candidate.clipboardOps)} clipboard</span>
                <span>{formatNumber(playbook.candidate.userCount)} users</span>
              </div>

              <ul class="reason-list">
                {#each playbook.candidate.reasoning as reason}
                  <li>{reason}</li>
                {/each}
              </ul>

              <div class="workflow-strip">
                {#each playbook.workflow as step}
                  <div class="workflow-step">{step}</div>
                {/each}
              </div>

              <div class="playbook-card__caution">{playbook.caution}</div>
            </article>
          {/each}
        </div>
      </SectionCard>

      <SectionCard
        title="High volume does not always mean automate now"
        description="To sa aktywnosci, ktore wygladaja na wazne lub kosztowne, ale czesto sa tylko nosnikiem pracy albo praca wiedzy."
      >
        <div class="watchlist">
          {#each watchlist as item}
            <article class="watch-card">
              <h3>{item.title}</h3>
              <p class="watch-card__meta">{item.note}</p>
              <p>{item.recommendation}</p>
            </article>
          {/each}
        </div>
      </SectionCard>
    </div>

    <div class="two-col">
      <SectionCard
        title="Coverage and measurement completeness"
        description="Headcount coverage nie jest pelny, wiec insighty trzeba czytac z poprawka na reprezentatywnosc probki."
      >
        <EChart options={buildHeadcountOptions(data.headcount)} height={320} />
      </SectionCard>

      <SectionCard
        title="Operational load by process family"
        description="To odpowiada na pytanie, gdzie proces zyje naprawde - nie tylko w modelu BPMN, ale w rozkladzie czasu dzien po dniu."
      >
        <EChart options={buildProcessMixOptions(data.processDistribution)} height={320} />
      </SectionCard>
    </div>

    <div class="two-col">
      <SectionCard
        title="Application landscape"
        description="Kazdy punkt pokazuje narzedzie jako polaczenie czasu aktywnego, pasywnosci, clipboardu i zasiegu w zespole."
      >
        <EChart options={buildApplicationLandscapeOptions(data.topApplications)} height={380} />
      </SectionCard>

      <SectionCard
        title="Manual handoff map"
        description="Najmocniejszy sygnal pod integracje lub RPA: reczne przenoszenie danych miedzy aplikacjami i krokami."
      >
        <div class="insight-split">
          <EChart options={buildClipboardHeatmapOptions(data.clipboardHeatmapApps)} height={380} />

          <div class="mini-list">
            <div class="mini-list__title">Top observed cross-app handoffs</div>
            {#each clipboardCrossFlows as flow}
              <div class="mini-list__item">
                <div class="mini-list__label">
                  <strong>{flow.sourceApplication}</strong>
                  <span>{clampText(flow.sourceStep, 26)}</span>
                </div>
                <div class="mini-list__arrow">to</div>
                <div class="mini-list__label">
                  <strong>{flow.targetApplication}</strong>
                  <span>{clampText(flow.targetStep, 26)}</span>
                </div>
                <div class="mini-list__value">{formatNumber(flow.count)}</div>
              </div>
            {/each}
          </div>
        </div>
      </SectionCard>
    </div>

    <div class="two-col">
      <SectionCard
        title="Observed execution path"
        description="Tak wyglada rzeczywisty przeplyw pracy po deduplikacji instancji krokow. To zderzenie modelu formalnego z operacyjna rzeczywistoscia."
      >
        <div slot="actions" class="segmented-control">
          <button class:active={transitionMode === 'steps'} on:click={() => (transitionMode = 'steps')}>Kroki</button>
          <button class:active={transitionMode === 'applications'} on:click={() => (transitionMode = 'applications')}>Aplikacje</button>
        </div>

        <EChart options={buildTransitionSankeyOptions(transitionItems)} height={420} />
      </SectionCard>

      <SectionCard
        title="Variant explorer"
        description="PDD daje biznesowy widok wariantow. Tutaj mozna szybko porownac dominujacy krok, coverage i ilosc recznych operacji."
      >
        <div slot="actions">
          <label class="variant-picker">
            Wariant
            <select bind:value={selectedPddVariant}>
              {#each data.pddVariantsPreview as variant}
                <option value={variant.variantNumber}>{variant.variantNumber}</option>
              {/each}
            </select>
          </label>
        </div>

        <div class="variant-grid">
          {#each variantSnapshots as snapshot}
            <button
              class:selected={snapshot.variantNumber === selectedPddVariant}
              class="variant-tile"
              on:click={() => (selectedPddVariant = snapshot.variantNumber)}
            >
              <div class="variant-tile__number">#{snapshot.variantNumber}</div>
              <div class="variant-tile__step">{snapshot.leadStep}</div>
              <div class="variant-tile__meta">{snapshot.leadApplication} - coverage {snapshot.coverageLabel}</div>
              <div class="variant-tile__stats">
                <span>{snapshot.visibleRows} visible steps</span>
                <span>{snapshot.visibleMinutes.toFixed(0)} min</span>
                <span>{formatNumber(snapshot.visibleManualOps)} manual ops</span>
              </div>
            </button>
          {/each}
        </div>

        {#if selectedVariant}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  {#each selectedVariant.header as headerCell}
                    <th>{headerCell}</th>
                  {/each}
                </tr>
              </thead>
              <tbody>
                {#each selectedVariant.rows as row}
                  <tr>
                    {#each row as cell}
                      <td>{cell}</td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </SectionCard>
    </div>

    <div class="two-col">
      <SectionCard
        title="Observed workload by deduplicated step"
        description="To nie sa raw eventy, tylko zlozone instancje krokow. Dzięki temu ranking nie zawyza czasu przez powtarzane event rows."
      >
        <EChart options={buildTopStepsBarOptions(data.topSteps)} height={420} />
      </SectionCard>

      <SectionCard
        title="Automation portfolio"
        description="Macierz pokazuje, gdzie jednoczesnie kumuluja sie czas aktywny, reczna praca, zasieg i score automatyzacji."
      >
        <EChart options={buildAutomationPortfolioOptions(data.automationCandidates)} height={420} />
      </SectionCard>
    </div>

    <SectionCard
      title="Priority backlog"
      description="Backlog zostawia tylko kroki operacyjne. To jest warstwa, z ktorej najlatwiej przejsc do konkretnego PoC lub demo workflow."
    >
      <CandidateTable items={operationalCandidates.slice(0, 12)} />
    </SectionCard>

    <div class="two-col two-col--wide">
      <SectionCard
        title="Reference BPMN model"
        description="Model formalny procesu zostaje jako punkt odniesienia dla tego, co odkryto w logach. Dzięki temu copilot ma i proces reality, i model targetowy."
      >
        <BpmnViewer xml={data.bpmnXml} />
      </SectionCard>

      <SectionCard
        title="BPMN task pressure"
        description="Metryki taskow z BPMN sa tu traktowane jako warstwa referencyjna do interpretacji workloadu i recznych operacji."
      >
        <EChart options={buildBpmnTaskPressureOptions(data.bpmnTaskMetrics)} height={250} />

        <div class="table-wrap table-wrap--compact">
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Occurrences</th>
                <th>Active</th>
                <th>Passive</th>
                <th>Clipboard</th>
                <th>FTE</th>
              </tr>
            </thead>
            <tbody>
              {#each [...data.bpmnTaskMetrics].sort((a, b) => (b.activeDuration ?? 0) - (a.activeDuration ?? 0)).slice(0, 10) as task}
                <tr>
                  <td>{task.name}</td>
                  <td>{formatNumber(task.occurrences)}</td>
                  <td>{formatHours((task.activeDuration ?? 0) / 3600000)}</td>
                  <td>{formatHours((task.passiveDuration ?? 0) / 3600000)}</td>
                  <td>{formatNumber((task.copyCount ?? 0) + (task.pasteCount ?? 0) + (task.cutCount ?? 0))}</td>
                  <td>{task.fte?.toFixed(3) ?? 'n/a'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  </main>
{/if}
