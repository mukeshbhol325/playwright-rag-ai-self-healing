/** Actions the healing layer understands (must match the Python service). */
export type HealAction = 'click' | 'fill' | 'select' | 'check' | 'wait';

export interface HealRequest {
  test_name: string;
  action: HealAction;
  failed_selector: string;
  error: string;
  page_url: string;
  dom: string;
}

export interface HealCandidate {
  selector: string;
  confidence: number;
  reason: string;
  source: 'memory' | 'heuristic' | 'llm';
}

export interface HealResponse {
  candidates: HealCandidate[];
  strategy: string;
  retrieved_cases: number;
}

export interface FeedbackRequest {
  test_name: string;
  failed_selector: string;
  healed_selector: string;
  success: boolean;
  page_url: string;
  reason?: string;
}

export interface FailureReport {
  test_name: string;
  file: string;
  status: string;
  error: string;
  duration_ms: number;
  retry: number;
  failed_selector?: string | null;
  page_url?: string;
}

export interface FailureAnalysis {
  category: string;
  summary: string;
  suggested_fix: string;
  similar_cases: { summary: string; score: number }[];
  used_llm: boolean;
}

export type HealingStatus = 'healed' | 'failed' | 'skipped';

/** One healing attempt, attached to the test result and read by the reporter. */
export interface HealingEvent {
  testName: string;
  locatorKey: string;
  action: HealAction;
  originalSelector: string;
  healedSelector?: string;
  confidence?: number;
  source?: HealCandidate['source'];
  strategy?: string;
  status: HealingStatus;
  reason?: string;
  pageUrl: string;
  durationMs: number;
  timestamp: string;
}

export interface Customer {
  firstName: string;
  lastName: string;
  email: string;
  address1: string;
  city: string;
  postcode: string;
  country: string;
}
