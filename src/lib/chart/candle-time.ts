import type { CandleBar } from "@/types/fundamentals";

/** lightweight-charts: 일봉은 YYYY-MM-DD, 분봉 이하는 Unix 초 */
export function candleTimeToUnix(c: CandleBar): number {
  if (typeof c.time === "number" && Number.isFinite(c.time)) return c.time;
  const s = String(c.time);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return Math.floor(new Date(`${s}T12:00:00Z`).getTime() / 1000);
  }
  return Math.floor(new Date(s).getTime() / 1000);
}

/** 연속한 `groupSize`개의 봉을 하나로 묶음(4시간 = 1시간×4). */
export function bundleSequentialCandles(candles: CandleBar[], groupSize: number): CandleBar[] {
  if (groupSize < 2 || candles.length < groupSize) return [];
  const sorted = [...candles].sort((a, b) => candleTimeToUnix(a) - candleTimeToUnix(b));
  const out: CandleBar[] = [];
  for (let i = 0; i + groupSize <= sorted.length; i += groupSize) {
    const g = sorted.slice(i, i + groupSize);
    const t0 = g[0]!;
    const tLast = g[groupSize - 1]!;
    let high = -Infinity;
    let low = Infinity;
    let vol = 0;
    for (const c of g) {
      high = Math.max(high, c.high);
      low = Math.min(low, c.low);
      vol += c.volume ?? 0;
    }
    out.push({
      time: t0.time,
      open: t0.open,
      high,
      low,
      close: tLast.close,
      volume: vol > 0 ? vol : undefined,
    });
  }
  return out;
}
