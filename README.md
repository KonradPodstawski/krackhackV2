# krakhack

Minimalny starter `Svelte + TypeScript + Tailwind CSS + Vite`, ustawiony pod mozliwie
powtarzalny lokalny development.

## Wymagania

- Node `24.3.0` z pliku `.nvmrc`
- npm `11.6.2`

## Start

```bash
nvm use
npm ci
npm run dev
```

## Skrypty

```bash
npm run dev
npm run check
npm run build
npm run preview
npm run generate:workflow-specs
npm run generate:slm-drafts -- --model qwen3:4b
npm run generate:slm-drafts -- --provider llama-cpp --base-url http://127.0.0.1:8080
```

## Artefakty procesu

- `public/data/workflow-specs.json` jest deterministycznym eksportem uporzadkowanych specyfikacji workflow
- generator czyta `public/data/automation-candidates.json` i buduje formalny draft triggerow, wejsc, walidacji, wyjatkow i outputow
- workflow-specs sa przygotowane jako stabilna warstwa pod dalszy dashboard, CLI albo SLM
- `public/data/slm-drafts.json` jest opcjonalna warstwa lokalnego SLM nad `workflow-specs.json`
- SLM nie liczy rankingu; dostaje gotowy spec i produkuje tylko business explanation oraz refined workflow draft
- domyslnie generator SLM probuje automatycznie wykryc `Ollama` pod `http://127.0.0.1:11434` albo `llama.cpp` pod `http://127.0.0.1:8080`
- dla `Ollama` mozna jawnie podac `--model qwen3:4b`
- dla `llama.cpp` serwer musi byc uruchomiony z zaladowanym modelem, a nie tylko w router mode

## Deterministycznosc

- wersje narzedzi sa przypiete przez `.nvmrc` i `packageManager`
- zaleznosci sa przypiete do exact versions
- powtarzalna instalacja powinna isc przez `npm ci`
- Tailwind dziala przez plugin Vite, bez dodatkowego `postcss.config`
