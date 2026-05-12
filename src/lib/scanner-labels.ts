import type { AnalysisSignal } from "@/types/stock";

const LABELS: Record<AnalysisSignal, string> = {
  ma_cross: "이평선",
  rsi: "RSI",
  bollinger: "볼린저",
  volume: "거래량",
  macd: "MACD",
};

export function signalLabel(signal: AnalysisSignal): string {
  return LABELS[signal];
}
