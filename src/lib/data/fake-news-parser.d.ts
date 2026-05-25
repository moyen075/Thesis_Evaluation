export interface ParsedFactorScore {
  factorKey: string;
  factorLabel: string;
  score: number;
  maxScore: number;
  reason: string;
  rawLabel: string;
}

export interface ParsedAIEvaluation {
  agent: "GEMINI" | "LLAMA";
  totalScore: number;
  rawFeedback: string;
  factors: ParsedFactorScore[];
  correctiveFeedback: Array<Record<string, string>>;
  improvementFeedback: Array<Record<string, string>>;
  warnings: string[];
}

export interface ParsedFakeNewsRecord {
  filePath: string;
  paragraphId: string;
  paragraphText: string;
  legacyInitialScore: number | null;
  rawYaml: Record<string, unknown>;
  aiEvaluations: ParsedAIEvaluation[];
  warnings: string[];
}

export function parseFactorScores(feedback: string): {
  factors: ParsedFactorScore[];
  warnings: string[];
};
export function parseAIEvaluation(
  agent: "GEMINI" | "LLAMA",
  value: unknown
): ParsedAIEvaluation;
export function parseFakeNewsYamlFile(filePath: string): ParsedFakeNewsRecord;
export function parseFakeNewsDirectory(directoryPath: string): ParsedFakeNewsRecord[];
export function summarizeParsedDataset(records: ParsedFakeNewsRecord[]): {
  paragraphCount: number;
  aiEvaluationCount: number;
  factorScoreCount: number;
  warnings: string[];
};

