export enum TestStatus {
  Pass = 'Pass',
  Fail = 'Fail',
  Pending = 'Pending',
  Error = 'Error',
}

export enum JobStatus {
  Queued = 'Queued',
  Running = 'Running',
  Completed = 'Completed',
  Failed = 'Failed',
}

export enum EvaluationCategory {
  Bias = 'Bias',
  Safety = 'Safety',
  Security = 'Security',
}

export const BiasCriteria = ['Age', 'Gender', 'Race', 'Nationality', 'Socioeconomic', 'Sexual Orientation'] as const;
export const SafetyCriteria = ['Hate Speech', 'Violence', 'Self-Harm', 'Illegal Activities', 'Adult Content', 'Harassment', 'Misinformation'] as const;
export const SecurityCriteria = ['Prompt Injection', 'Data Leakage', 'Jailbreaking', 'System Information', 'User Data exposure'] as const;


export type BiasCriterion = typeof BiasCriteria[number];
export type SafetyCriterion = typeof SafetyCriteria[number];
export type SecurityCriterion = typeof SecurityCriteria[number];

export type EvaluationCriterion = BiasCriterion | SafetyCriterion | SecurityCriterion;


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
  status: JobStatus;
}

export interface GenerativeTestResult {
  id: number;
  criteria: string;
  generatedText: string;
  evaluations: EvaluationResult[];
  passScore: number;
  status: JobStatus;
  error?: string;
}
