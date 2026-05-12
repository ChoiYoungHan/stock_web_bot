import type { ScannerTechnicalSnapshot } from "@/types/stock";
import { computeBollinger, computeRSI, computeSMA } from "@/lib/market-data/technical-indicators";

export function buildScannerTechnicalSnapshot(closes: number[]): ScannerTechnicalSnapshot {
  const bb = computeBollinger(closes, 20, 2);
  return {
    rsi14: computeRSI(closes, 14),
    sma5: computeSMA(closes, 5),
    sma20: computeSMA(closes, 20),
    sma60: computeSMA(closes, 60),
    sma120: computeSMA(closes, 120),
    bbPctB: bb?.pctB ?? null,
  };
}
