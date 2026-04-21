/**
 * In-memory diagnostics for the last CV → LLM extraction attempt.
 * Never stores API keys; payload previews are length-capped.
 */

const PREFIX_MAX = 2048

export type CvExtractionParseStage =
  | 'pending'
  | 'success'
  | 'noBrace'
  | 'unbalanced'
  | 'jsonParse'
  | 'zod'
  | 'noCandidates'
  | 'clientTimeout'
  | 'unknown'

export interface CvExtractionCandidateSummary {
  /** e.g. text | reasoningText | toolCall:0 */
  source: string
  length: number
  /** First PREFIX_MAX chars, for diffing against server logs without dumping full PII */
  prefixPreview: string
  /** Small fingerprint of full string (for equality checks) */
  contentHashHex: string
}

export interface CvExtractionUsageSnapshot {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export interface CvExtractionDebugSnapshot {
  startedAtIso: string
  pdfTextMs?: number
  pdfTextCharCount?: number
  llmStartedAtIso?: string
  llmFinishedAtIso?: string
  provider?: string
  model?: string
  baseUrlHost?: string
  skipStructuredObject?: boolean
  finishReason?: string
  rawFinishReason?: string
  truncated?: boolean
  usage?: CvExtractionUsageSnapshot
  candidateSummaries?: CvExtractionCandidateSummary[]
  winningCandidateSource?: string
  /** Seconds — client `AbortSignal` + matching `generateText` timeout */
  extractionTimeoutSec?: number
  parseStage: CvExtractionParseStage
  lastParseError?: string
  finalErrorMessage?: string
  errorCauseChain?: string[]
}

let snapshot: CvExtractionDebugSnapshot | null = null

/** djb2 over full string — cheap fingerprint without storing entire response */
export function hashStringDjb2(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h, 33) ^ s.charCodeAt(i)
  }
  return (h >>> 0).toString(16)
}

export function safePrefix(s: string, maxLen: number = PREFIX_MAX): string {
  if (s.length <= maxLen) return s
  return s.slice(0, maxLen) + '…'
}

export function hostFromBaseUrl(baseUrl: string | undefined): string | undefined {
  if (!baseUrl?.trim()) return undefined
  try {
    return new URL(baseUrl).host
  } catch {
    return undefined
  }
}

export function errorCauseChain(err: unknown): string[] {
  const out: string[] = []
  let e: unknown = err
  let depth = 0
  const max = 8
  while (e instanceof Error && depth < max) {
    out.push(e.message)
    e = e.cause
    depth++
  }
  if (depth < max && e != null && typeof e !== 'object') {
    out.push(String(e))
  }
  return out
}

/** Clears and starts a new snapshot (call when a CV upload / extraction flow begins). */
export function resetCvExtractionDebug(): void {
  snapshot = {
    startedAtIso: new Date().toISOString(),
    parseStage: 'pending',
  }
}

/** Merges fields into the current snapshot (creates one if missing). */
export function patchCvExtractionDebug(partial: Partial<CvExtractionDebugSnapshot>): void {
  if (!snapshot) {
    resetCvExtractionDebug()
  }
  snapshot = { ...snapshot!, ...partial }
}

/** Returns the last snapshot, or null if none was started. */
export function getCvExtractionDebugSnapshot(): Readonly<CvExtractionDebugSnapshot> | null {
  return snapshot
}
