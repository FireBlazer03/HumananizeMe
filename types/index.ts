export type ImperfectionLevel = 'subtle' | 'moderate' | 'realistic';
export type BurstinessMode = 'mild' | 'strong' | 'aggressive';

export interface HumanizerSettings {
  imperfectionLevel: ImperfectionLevel;
  burstinessMode: BurstinessMode;
}

export interface PassResult {
  passName: string;
  text: string;
  changesCount: number;
}

export interface HumanizerResult {
  originalText: string;
  finalText: string;
  passes: PassResult[];
  totalChanges: number;
}

export interface SignalBreakdown {
  name: string;
  score: number;
  maxScore: number;
  detail: string;
}

export interface DetectionReport {
  aiVocabHits: string[];
  chatbotArtifacts: string[];
  significanceInflation: number;
  emDashCount: number;
  sentenceLengthVariance: number;
  burstinessLabel: 'Low (AI-like)' | 'Medium' | 'High';
  passiveVoiceCount: number;
  hasEmojis: boolean;
  hasCurlyQuotes: boolean;
  estimatedAIScore: number;
  signals: SignalBreakdown[];
}

export interface PipelineStep {
  id: number;
  label: string;
  status: 'pending' | 'active' | 'complete';
}
