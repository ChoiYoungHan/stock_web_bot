import type { CandleBar } from "@/types/fundamentals";
import type { ChartIndicatorConfig } from "@/types/chart-indicators";
import { computeRSISeries } from "@/lib/market-data/technical-indicators";
import { scannerBuySignalsAtBarIndex } from "@/lib/analysis/quant-signals";
import type { SeriesMarker, Time } from "lightweight-charts";

/** 같은 유형 마커 사이 최소 봉 간격(과밀 표시 완화) */
const MIN_BARS_BUY = 22;
const MIN_BARS_SELL = 16;

/**
 * 차트 타점: 과매도·볼밴·다이버전스 기반 매수(B), RSI 과매수 역통과 매도(S).
 * SMA 교차 마커는 밀도가 높아 제외. 연속 신호는 최소 간격으로만 표시.
 */
export function buildPineStyleMarkers(candles: CandleBar[], cfg: ChartIndicatorConfig): SeriesMarker<Time>[] {
  if (candles.length < 10) return [];

  const closes = candles.map((c) => c.close);
  const rsi = computeRSISeries(closes, cfg.rsiPeriod);

  const markers: SeriesMarker<Time>[] = [];
  let lastBuyIdx = -MIN_BARS_BUY;
  let lastSellIdx = -MIN_BARS_SELL;

  for (let i = 1; i < candles.length; i++) {
    const t = candles[i]!.time as Time;
    const r0 = rsi[i - 1];
    const r1 = rsi[i];

    const buy = scannerBuySignalsAtBarIndex(candles, i);
    if ((buy.oversoldBounce || buy.bbLowerSupport || buy.bullishDivergence) && i - lastBuyIdx >= MIN_BARS_BUY) {
      lastBuyIdx = i;
      markers.push({
        time: t,
        position: "belowBar",
        color: "#22c55e",
        shape: "arrowUp",
        text: "B",
      });
    }

    if (r0 != null && r1 != null) {
      if (r0 > cfg.signalRsiSell && r1 <= cfg.signalRsiSell && i - lastSellIdx >= MIN_BARS_SELL) {
        lastSellIdx = i;
        markers.push({
          time: t,
          position: "aboveBar",
          color: "#ef4444",
          shape: "arrowDown",
          text: "S",
        });
      }
    }
  }

  return markers;
}
