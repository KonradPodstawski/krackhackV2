export type Overview = {
  datasetLabel: string;
  timeRange: { start: string; end: string };
  rawSequenceRows: number;
  uniqueUsers: number;
  uniqueProcessSteps: number;
  uniqueApplications: number;
  uniqueStepInstances: number;
  totalTrackedHours: number;
  totalActiveHours: number;
  totalPassiveHours: number;
  latestMeasuredUsers: number | null;
  latestExpectedUsers: number | null;
  latestCoveragePct: number | null;
  dominantProcesses: Array<{ name: string; hours: number }>;
  notes: string[];
};

export type HeadcountPoint = {
  date: string;
  measuredUsers: number;
  notMeasuredUsers: number;
  expectedUsers: number;
  coveragePct: number | null;
};

export type ProcessDistributionPoint = {
  date: string;
  [key: string]: string | number;
};

export type ToolUsage = {
  application: string;
  totalHours: number;
  activeHours: number;
  passiveHours: number;
  passiveSharePct: number;
};

export type PrmView = {
  application: string;
  view: string;
  totalHours: number;
  activeHours: number;
  passiveHours: number;
  passiveSharePct: number;
};

export type StepRecord = {
  processStep: string;
  activeHours: number;
  totalHours: number;
  passiveHours: number;
  passiveSharePct: number;
  clipboardOps: number;
  clicks: number;
  textEntries: number;
  instances: number;
  userCount: number;
  applications: string[];
};

export type AppRecord = {
  application: string;
  activeHours: number;
  totalHours: number;
  passiveHours: number;
  passiveSharePct: number;
  clipboardOps: number;
  clicks: number;
  textEntries: number;
  instances: number;
  userCount: number;
  stepCount: number;
};

export type Transition = {
  source: string;
  target: string;
  count: number;
  userCount: number;
};

export type ClipboardFlowApp = {
  sourceApplication: string;
  targetApplication: string;
  count: number;
};

export type ClipboardFlowStep = {
  sourceApplication: string;
  sourceStep: string;
  targetApplication: string;
  targetStep: string;
  count: number;
};

export type BpmnTaskMetric = {
  id: string;
  name: string;
  occurrences?: number;
  totalDuration?: number;
  passiveDuration?: number;
  activeDuration?: number;
  averageDuration?: number;
  copyCount?: number;
  pasteCount?: number;
  cutCount?: number;
  fte?: number;
  taskSwitchCount?: number;
  activityChangeCount?: number;
};

export type AutomationCandidate = {
  application: string;
  processStep: string;
  score: number;
  activeHours: number;
  passiveSharePct: number;
  clipboardOps: number;
  userCount: number;
  instances: number;
  classification: 'operational' | 'communication_or_navigation';
  reasoning: string[];
};

export type PddVariantPreview = {
  variantNumber: number;
  header: string[];
  rows: string[][];
};

export type WorkflowSpecTrigger = {
  mode: 'event_driven';
  type: string;
  source: string;
  condition: string;
};

export type WorkflowSpecInput = {
  name: string;
  source: string;
  required: boolean;
  purpose: string;
};

export type WorkflowSpecStep = {
  id: string;
  kind: 'capture' | 'validation' | 'enrichment' | 'decision' | 'writeback' | 'notification' | 'audit';
  system: string;
  name: string;
  description: string;
};

export type WorkflowSpecEvidence = {
  activeHours: number;
  clipboardOps: number;
  userCount: number;
  passiveSharePct: number;
  instances: number;
  explainableScore: number;
  sourceScore: number;
  fitMultiplier: number;
  sourceReasoning: string[];
};

export type WorkflowSpec = {
  version: '1.0.0';
  candidateKey: string;
  priorityRank: number;
  priorityBand: 'P1' | 'P2' | 'P3' | 'Watchlist';
  eligibility: 'recommended' | 'watchlist';
  workflowKind: string;
  title: string;
  processStep: string;
  application: string;
  automationShape: string;
  objective: string;
  nextAction: string;
  trigger: WorkflowSpecTrigger;
  systems: string[];
  inputs: WorkflowSpecInput[];
  steps: WorkflowSpecStep[];
  validations: string[];
  exceptions: string[];
  outputs: string[];
  humanCheckpoints: string[];
  implementationNotes: string[];
  evidenceSources: string[];
  evidence: WorkflowSpecEvidence;
};

export type SlmDraftModel = {
  provider: 'ollama' | 'llama-cpp';
  name: string;
  temperature: number;
  seed: number;
};

export type SlmDraftStep = {
  id: string;
  label: string;
  purpose: string;
  successSignal: string;
};

export type SlmDraft = {
  version: '1.0.0';
  promptVersion: '1.0.0';
  candidateKey: string;
  specHash: string;
  model: SlmDraftModel;
  businessSummary: string;
  whyNow: string[];
  explainer: string[];
  demoNarrative: string[];
  refinedWorkflowSteps: SlmDraftStep[];
  rolloutRisks: string[];
  humanReviewNotes: string[];
  operatorPitch: string;
};

export type DashboardData = {
  overview: Overview;
  headcount: HeadcountPoint[];
  processDistribution: ProcessDistributionPoint[];
  toolUsageAggregated: ToolUsage[];
  toolUsageOverTime: ProcessDistributionPoint[];
  prmViews: PrmView[];
  topSteps: StepRecord[];
  topApplications: AppRecord[];
  stepTransitions: Transition[];
  appTransitions: Transition[];
  clipboardHeatmapApps: ClipboardFlowApp[];
  clipboardHeatmapSteps: ClipboardFlowStep[];
  bpmnTaskMetrics: BpmnTaskMetric[];
  automationCandidates: AutomationCandidate[];
  workflowSpecs: WorkflowSpec[];
  slmDrafts: SlmDraft[];
  pddVariantsPreview: PddVariantPreview[];
  bpmnXml: string;
};
