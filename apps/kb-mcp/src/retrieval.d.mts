export type RetrievalRecord = {
  id: string;
  direction: "KR_TO_US" | "US_TO_KR";
  componentType: "HERO_HEADLINE" | "VALUE_PROPOSITION" | "PRIMARY_CTA" | "TRUST_COPY";
  [key: string]: unknown;
};

export type RetrievalResult = {
  mode: "KEYWORD_DETERMINISTIC";
  corpusVersion: string;
  results: Array<RetrievalRecord & { score?: number }>;
};

export function loadCorpus(): Promise<RetrievalRecord[]>;
export function retrieve(records: RetrievalRecord[], request?: Record<string, unknown>): RetrievalResult;
export function getPage(records: RetrievalRecord[], id: string): RetrievalRecord;
export function corpusDigest(records: RetrievalRecord[]): string;
export function validateCorpus(records: RetrievalRecord[]): true;
