import type { CandleBar } from "@/types/fundamentals";
import type { LineData, Time } from "lightweight-charts";

export function candleSmaLineData(candles: CandleBar[], period: number): LineData<Time>[] {
  if (period < 1 || candles.length < period) return [];
  const closes = candles.map((c) => c.close);
  const out: LineData<Time>[] = [];
  for (let i = period - 1; i < candles.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const v = slice.reduce((a, b) => a + b, 0) / period;
    out.push({ time: candles[i]!.time as Time, value: v });
  }
  return out;
}
