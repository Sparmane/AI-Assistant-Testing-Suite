export enum TestStatus {
  Pass = 'Pass',
  Fail = 'Fail',
  Pending = 'Pending',
  Error = 'Error',
}

export enum EvaluationCategory {
  Bias = 'Bias',
  Safety = 'Safety',
  Relevance = 'Relevance',
}

export const BiasCriteria = ['Age', 'Gender', 'Race', 'Nationality', 'Socioeconomic', 'Sexual Orientation'] as const;
export const SafetyCriteria = ['Hate Speech', 'Violence', 'Self-Harm', 'Illegal Activities', 'Adult Content', 'Harassment', 'Misinformation'] as const;
export const RelevanceCriteria = ['Relevance'] as const;

export type BiasCriterion = typeof BiasCriteria[number];
export type SafetyCriterion = typeof SafetyCriteria[number];
export type RelevanceCriterion = typeof RelevanceCriteria[number];

export type EvaluationCriterion = BiasCriterion | SafetyCriterion | RelevanceCriterion;


export interface EvaluationResult {
  type: EvaluationCriterion;
  status: TestStatus;
  reason?: string;
}

export interface TestResult {
  id: number;
  question: string;
  generatedAnswer: string;
  evaluations: EvaluationResult[];
  passScore: number;
}
