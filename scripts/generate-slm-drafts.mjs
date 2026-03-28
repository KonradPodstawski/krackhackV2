import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const promptVersion = '1.0.0';

function parseArgs(argv) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      result[key] = 'true';
      continue;
    }

    result[key] = next;
    index += 1;
  }

  return result;
}

function extractJsonObject(text) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {}

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Model response does not contain a JSON object.');
  }

  return JSON.parse(trimmed.slice(start, end + 1));
}

function assertString(name, value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${name}: expected non-empty string.`);
  }
}

function assertStringArray(name, value) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    throw new Error(`Invalid ${name}: expected non-empty array of strings.`);
  }
}

function buildSpecHash(spec) {
  return createHash('sha256').update(JSON.stringify(spec)).digest('hex').slice(0, 16);
}

function buildPrompt(spec) {
  const sourceStepIds = spec.steps.map((step) => step.id);

  return [
    'Pracujesz jako lokalny copilota Process-to-Automation.',
    'Masz wyłącznie uporządkowaną specyfikację procesu. Nie wolno Ci wymyślać nowych systemów, triggerów, danych wejściowych, wyjątków ani zmian kolejności workflow.',
    'Twoja rola to poprawić narrację biznesową i doprecyzować demo workflow bez naruszania deterministycznego rdzenia.',
    'Zwróć WYŁĄCZNIE poprawny JSON, bez markdown i bez komentarzy.',
    '',
    'Wymagany format JSON:',
    '{',
    '  "businessSummary": "jedno zwarte streszczenie biznesowe po polsku",',
    '  "whyNow": ["3-5 krótkich punktów"],',
    '  "explainer": ["3-5 punktów tłumaczących dlaczego workflow ma sens"],',
    '  "demoNarrative": ["3-5 punktów jak pokazać demo"],',
    '  "refinedWorkflowSteps": [',
    '    {',
    '      "id": "dokładnie jedno z dozwolonych id",',
    '      "label": "krótka nazwa kroku do demo",',
    '      "purpose": "po co krok istnieje",',
    '      "successSignal": "jak poznać, że krok się udał"',
    '    }',
    '  ],',
    '  "rolloutRisks": ["2-4 ryzyka wdrożeniowe"],',
    '  "humanReviewNotes": ["2-4 uwagi dla review człowieka"],',
    '  "operatorPitch": "krótki pitch dla jury lub operatora" ',
    '}',
    '',
    `Dozwolone step ids i kolejność: ${JSON.stringify(sourceStepIds)}`,
    'Pole refinedWorkflowSteps musi mieć dokładnie tę samą liczbę kroków, te same ids i tę samą kolejność co w specyfikacji wejściowej.',
    'Nie wolno zmieniać znaczenia triggera, validations, exceptions, human checkpoints ani systems.',
    '',
    'Specyfikacja wejściowa:',
    JSON.stringify(spec, null, 2)
  ].join('\n');
}

function validateDraftShape(rawDraft, spec, providerName, modelName) {
  assertString('businessSummary', rawDraft.businessSummary);
  assertStringArray('whyNow', rawDraft.whyNow);
  assertStringArray('explainer', rawDraft.explainer);
  assertStringArray('demoNarrative', rawDraft.demoNarrative);
  assertStringArray('rolloutRisks', rawDraft.rolloutRisks);
  assertStringArray('humanReviewNotes', rawDraft.humanReviewNotes);
  assertString('operatorPitch', rawDraft.operatorPitch);

  if (!Array.isArray(rawDraft.refinedWorkflowSteps) || rawDraft.refinedWorkflowSteps.length !== spec.steps.length) {
    throw new Error(`Invalid refinedWorkflowSteps for ${spec.candidateKey}: wrong step count.`);
  }

  const refinedWorkflowSteps = rawDraft.refinedWorkflowSteps.map((step, index) => {
    if (!step || typeof step !== 'object') {
      throw new Error(`Invalid refinedWorkflowSteps[${index}] for ${spec.candidateKey}.`);
    }

    const sourceStep = spec.steps[index];

    if (step.id !== sourceStep.id) {
      throw new Error(
        `Invalid step id order for ${spec.candidateKey}: expected ${sourceStep.id}, got ${String(step.id)}.`
      );
    }

    assertString(`refinedWorkflowSteps[${index}].label`, step.label);
    assertString(`refinedWorkflowSteps[${index}].purpose`, step.purpose);
    assertString(`refinedWorkflowSteps[${index}].successSignal`, step.successSignal);

    return {
      id: sourceStep.id,
      label: step.label.trim(),
      purpose: step.purpose.trim(),
      successSignal: step.successSignal.trim()
    };
  });

  return {
    version: '1.0.0',
    promptVersion,
    candidateKey: spec.candidateKey,
    specHash: buildSpecHash(spec),
    model: {
      provider: providerName,
      name: modelName,
      temperature: 0,
      seed: 0
    },
    businessSummary: rawDraft.businessSummary.trim(),
    whyNow: rawDraft.whyNow.map((item) => item.trim()),
    explainer: rawDraft.explainer.map((item) => item.trim()),
    demoNarrative: rawDraft.demoNarrative.map((item) => item.trim()),
    refinedWorkflowSteps,
    rolloutRisks: rawDraft.rolloutRisks.map((item) => item.trim()),
    humanReviewNotes: rawDraft.humanReviewNotes.map((item) => item.trim()),
    operatorPitch: rawDraft.operatorPitch.trim()
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text}`);
  }

  return response.json();
}

function isConnectionError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return error instanceof TypeError || /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH/i.test(message);
}

async function generateDraftViaOllama(baseUrl, modelName, spec) {
  const payload = await requestJson(new URL('/api/chat', baseUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      stream: false,
      format: 'json',
      options: {
        temperature: 0,
        top_p: 1,
        seed: 0
      },
      messages: [
        {
          role: 'system',
          content:
            'You are a deterministic local assistant. Use only the provided structured workflow spec and return valid JSON.'
        },
        {
          role: 'user',
          content: buildPrompt(spec)
        }
      ]
    })
  });

  const rawContent = payload?.message?.content;

  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    throw new Error(`Ollama returned empty content for ${spec.candidateKey}.`);
  }

  const rawDraft = extractJsonObject(rawContent);
  return validateDraftShape(rawDraft, spec, 'ollama', modelName);
}

async function generateDraftViaLlamaCpp(baseUrl, modelName, spec) {
  const payload = await requestJson(new URL('/v1/chat/completions', baseUrl), {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      temperature: 0,
      top_p: 1,
      seed: 0,
      messages: [
        {
          role: 'system',
          content:
            'You are a deterministic local assistant. Use only the provided structured workflow spec and return valid JSON.'
        },
        {
          role: 'user',
          content: buildPrompt(spec)
        }
      ]
    })
  });

  const rawContent = payload?.choices?.[0]?.message?.content;

  if (typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    throw new Error(`llama.cpp returned empty content for ${spec.candidateKey}.`);
  }

  const rawDraft = extractJsonObject(rawContent);
  return validateDraftShape(rawDraft, spec, 'llama-cpp', modelName);
}

async function detectOllama(baseUrl, modelName) {
  try {
    const payload = await requestJson(new URL('/api/tags', baseUrl));
    const models = payload?.models ?? [];
    const modelNames = models.map((item) => item.name);

    if (modelNames.length === 0) {
      throw new Error('Ollama is up, but no models are available.');
    }

    if (modelName && !modelNames.includes(modelName)) {
      throw new Error(`Model ${modelName} is not available in Ollama. Installed: ${modelNames.join(', ')}`);
    }

    return {
      runtime: {
        provider: 'ollama',
        baseUrl,
        modelName: modelName ?? modelNames[0]
      },
      error: null
    };
  } catch (error) {
    if (isConnectionError(error)) {
      return { runtime: null, error: null };
    }

    return { runtime: null, error };
  }
}

async function detectLlamaCpp(baseUrl, modelName) {
  try {
    await requestJson(new URL('/health', baseUrl));
    const payload = await requestJson(new URL('/v1/models', baseUrl));
    const models = payload?.data ?? [];

    if (models.length === 0) {
      throw new Error(
        'llama.cpp server is running, but no model is loaded. The current process is in router mode. Start it with -m /path/to/model.gguf.'
      );
    }

    const modelIds = models.map((item) => item.id);

    if (modelName && !modelIds.includes(modelName)) {
      throw new Error(`Model ${modelName} is not loaded in llama.cpp. Loaded: ${modelIds.join(', ')}`);
    }

    return {
      runtime: {
        provider: 'llama-cpp',
        baseUrl,
        modelName: modelName ?? modelIds[0]
      },
      error: null
    };
  } catch (error) {
    if (isConnectionError(error)) {
      return { runtime: null, error: null };
    }

    return { runtime: null, error };
  }
}

async function resolveRuntime(args) {
  const requestedProvider = args.provider ?? 'auto';
  const requestedModel = args.model ?? process.env.OLLAMA_MODEL ?? process.env.LLAMA_CPP_MODEL ?? 'qwen3:4b';
  const explicitBaseUrl = args['base-url'] ?? process.env.OLLAMA_BASE_URL ?? process.env.LLAMA_CPP_BASE_URL;
  const baseUrls = explicitBaseUrl
    ? [explicitBaseUrl]
    : ['http://127.0.0.1:11434', 'http://127.0.0.1:8080'];
  let semanticError = null;

  for (const baseUrl of baseUrls) {
    if (requestedProvider === 'auto' || requestedProvider === 'ollama') {
      const result = await detectOllama(baseUrl, requestedModel);

      if (result.runtime) {
        return result.runtime;
      }

      if (result.error && !semanticError) {
        semanticError = result.error;
      }
    }

    if (requestedProvider === 'auto' || requestedProvider === 'llama-cpp') {
      const result = await detectLlamaCpp(baseUrl, requestedModel);

      if (result.runtime) {
        return result.runtime;
      }

      if (result.error && !semanticError) {
        semanticError = result.error;
      }
    }
  }

  if (semanticError) {
    throw semanticError;
  }

  if (requestedProvider === 'llama-cpp') {
    throw new Error(
      'Cannot use llama.cpp. Either the server is down or it is running without a loaded model. Start `llama-server -m /path/to/model.gguf` and retry.'
    );
  }

  if (requestedProvider === 'ollama') {
    throw new Error(
      'Cannot use Ollama. Start the local server or pass --base-url pointing to a running Ollama instance.'
    );
  }

  throw new Error(
    'No compatible local model runtime detected. Tried Ollama on 11434 and llama.cpp on 8080. Start one of them or pass --provider and --base-url.'
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(repoRoot, args.input ?? 'public/data/workflow-specs.json');
  const outputPath = path.resolve(repoRoot, args.output ?? 'public/data/slm-drafts.json');
  const limit = Number(args.limit ?? 3);
  const candidateKey = args['candidate-key'];

  const raw = await readFile(inputPath, 'utf8');
  const specs = JSON.parse(raw);

  const selectedSpecs = specs
    .filter((spec) => spec.eligibility === 'recommended')
    .filter((spec) => (candidateKey ? spec.candidateKey === candidateKey : true))
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 3);

  if (selectedSpecs.length === 0) {
    throw new Error('No workflow specs selected for SLM generation.');
  }

  const runtime = await resolveRuntime(args);

  const drafts = [];

  for (const spec of selectedSpecs) {
    console.log(`Generating SLM draft for ${spec.candidateKey} with ${runtime.provider}:${runtime.modelName}...`);
    const draft =
      runtime.provider === 'ollama'
        ? await generateDraftViaOllama(runtime.baseUrl, runtime.modelName, spec)
        : await generateDraftViaLlamaCpp(runtime.baseUrl, runtime.modelName, spec);
    drafts.push(draft);
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(drafts, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${drafts.length} SLM drafts to ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
