import type { CandleBar } from "@/types/fundamentals";
import type { ChartIndicatorConfig } from "@/types/chart-indicators";
import { computeRSISeries } from "@/lib/market-data/technical-indicators";
import { scannerBuySignalsAtBarIndex } from "@/lib/analysis/quant-signals";
import type { SeriesMarker, Time } from "lightweight-charts";

function rollingSMAAtIndex(closes: number[], i: number, period: number): number | null {
  if (i + 1 < period) return null;
  const slice = closes.slice(i - period + 1, i + 1);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Pine Script 스타일: RSI 과매도·과매수, SMA 상·하향 돌파.
 * 매수(B) 마커는 스캐너와 동일한 정밀 신호(과매도 반등·볼밴 지지·상승 다이버전스)와 동기화.
 */
export function buildPineStyleMarkers(candles: CandleBar[], cfg: ChartIndicatorConfig): SeriesMarker<Time>[] {
  if (candles.length < 10) return [];

  const closes = candles.map((c) => c.close);
  const rsi = computeRSISeries(closes, cfg.rsiPeriod);
  const pMa = cfg.signalMaCrossPeriod;

  const markers: SeriesMarker<Time>[] = [];

  for (let i = 1; i < candles.length; i++) {
    const t = candles[i]!.time as Time;
    const r0 = rsi[i - 1];
    const r1 = rsi[i];

    const buy = scannerBuySignalsAtBarIndex(candles, i);
    if (buy.oversoldBounce || buy.bbLowerSupport || buy.bullishDivergence) {
      const parts: string[] = [];
      if (buy.oversoldBounce) parts.push("RSI");
      if (buy.bbLowerSupport) parts.push("BB");
      if (buy.bullishDivergence) parts.push("DIV");
      markers.push({
        time: t,
        position: "belowBar",
        color: "#22c55e",
        shape: "arrowUp",
        text: parts.length ? `B·${parts.join("+")}` : "B",
      });
    }

    if (r0 != null && r1 != null) {
      if (r0 > cfg.signalRsiSell && r1 <= cfg.signalRsiSell) {
        markers.push({
          time: t,
          position: "aboveBar",
          color: "#ef4444",
          shape: "arrowDown",
          text: "S",
        });
      }
    }

    const sma0 = rollingSMAAtIndex(closes, i - 1, pMa);
    const sma1 = rollingSMAAtIndex(closes, i, pMa);
    const c0 = closes[i - 1]!;
    const c1 = closes[i]!;

    if (sma0 != null && sma1 != null) {
      if (c0 <= sma0 && c1 > sma1) {
        markers.push({
          time: t,
          position: "belowBar",
          color: "#38bdf8",
          shape: "circle",
          text: "MA↑",
        });
      }

      if (c0 >= sma0 && c1 < sma1) {
        markers.push({
          time: t,
          position: "aboveBar",
          color: "#f97316",
          shape: "circle",
          text: "MA↓",
        });
      }
    }
  }

  return markers;
}
