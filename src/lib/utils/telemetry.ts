import { kvGet, kvSet } from '../db/kv'

const KV_KEY = 'telemetry'
const LEGACY_LS_KEY = 'job-forge-telemetry'

interface TelemetryShape {
  cvGenerationSuccessCount: number
  cvGenerationFailureCount: number
  regenerationCount: number
  keywordCoverageDeltas: number[]
  rewriteSuccessCount: number
  rewriteFailureCount: number
}

const DEFAULT_TELEMETRY: TelemetryShape = {
  cvGenerationSuccessCount: 0,
  cvGenerationFailureCount: 0,
  regenerationCount: 0,
  keywordCoverageDeltas: [],
  rewriteSuccessCount: 0,
  rewriteFailureCount: 0,
}

async function readTelemetry(): Promise<TelemetryShape> {
  let stored = await kvGet<Partial<TelemetryShape>>(KV_KEY)
  if (!stored) {
    const raw = localStorage.getItem(LEGACY_LS_KEY)
    if (raw) {
      stored = JSON.parse(raw) as Partial<TelemetryShape>
      await kvSet(KV_KEY, stored)
      localStorage.removeItem(LEGACY_LS_KEY)
    }
  }
  return { ...DEFAULT_TELEMETRY, ...stored }
}

async function updateTelemetry(mutate: (t: TelemetryShape) => void): Promise<void> {
  const t = await readTelemetry()
  mutate(t)
  await kvSet(KV_KEY, t)
}

export function trackCVGeneration(success: boolean): void {
  updateTelemetry((t) => {
    if (success) t.cvGenerationSuccessCount += 1
    else t.cvGenerationFailureCount += 1
    t.regenerationCount += 1
  }).catch(() => {})
}

export function trackKeywordCoverageDelta(delta: number): void {
  updateTelemetry((t) => {
    t.keywordCoverageDeltas.push(delta)
    t.keywordCoverageDeltas = t.keywordCoverageDeltas.slice(-50)
  }).catch(() => {})
}

export function trackRewrite(success: boolean): void {
  updateTelemetry((t) => {
    if (success) t.rewriteSuccessCount += 1
    else t.rewriteFailureCount += 1
  }).catch(() => {})
}
