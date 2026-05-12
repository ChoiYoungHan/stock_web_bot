import type { CandleBar } from "@/types/fundamentals";
import { computeBollinger, computeRSISeries } from "@/lib/market-data/technical-indicators";

/** 스캐너·차트 마커 공통: RSI(14) 기준 */
export const SCANNER_RSI_PERIOD = 14;

function linearSlope(values: number[]): number {
  const m = values.length;
  if (m < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < m; i++) {
    sumX += i;
    sumY += values[i]!;
    sumXY += i * values[i]!;
    sumXX += i * i;
  }
  const denom = m * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (m * sumXY - sumX * sumY) / denom;
}

/**
 * 과매도 반등(강화): (1) 최근 구간에서 RSI≤30 경험 후 현재 RSI≥35
 * (2) 최근 5일 중 저점이 마지막 전일에 형성되고 종가 기준 V자 반등 + 마지막 양봉.
 */
export function detectOversoldBounceStrict(rsiSeries: (number | null)[], candles: CandleBar[]): boolean {
  const n = candles.length;
  if (n < 16 || rsiSeries.length !== n) return false;

  let wasDeepOversold = false;
  for (let i = Math.max(0, n - 14); i < n; i++) {
    const r = rsiSeries[i];
    if (r != null && r <= 30) wasDeepOversold = true;
  }
  const lastR = rsiSeries[n - 1];
  const pathRsiHeadUp = wasDeepOversold && lastR != null && lastR >= 35;

  const win = 5;
  const start = n - win;
  let minIdx = start;
  let minLow = candles[start]!.low;
  for (let i = start; i < n; i++) {
    if (candles[i]!.low < minLow) {
      minLow = candles[i]!.low;
      minIdx = i;
    }
  }
  const last = candles[n - 1]!;
  const pathV =
    minIdx <= n - 2 &&
    last.close > candles[minIdx]!.close * 1.003 &&
    last.close > last.open;

  return pathRsiHeadUp || pathV;
}

/** 볼린저 하단 지지(강화): 하단 밴드 터치(저가) + 양봉 마감 */
export function detectBbLowerSupportBullishAtEnd(candles: CandleBar[]): boolean {
  const closes = candles.map((c) => c.close);
  if (candles.length < 21) return false;
  const bb = computeBollinger(closes, 20, 2);
  if (!bb) return false;
  const last = candles[candles.length - 1]!;
  const touchedLower = last.low <= bb.lower * 1.003;
  const bullishClose = last.close > last.open;
  return touchedLower && bullishClose;
}

/**
 * 상승 다이버전스(정밀): 가격 저점 하향 vs RSI 저점 상향.
 * 10~15봉 구간을 둘로 나누어 스윙 저점을 잡고, 구간별 RSI 추세(선형 기울기)로 확인.
 */
export function detectBullishDivergenceDeep(closes: number[], rsiSeries: (number | null)[]): boolean {
  const n = closes.length;
  if (n < 18 || rsiSeries.length !== n) return false;

  const a0 = n - 15;
  const a1 = n - 10;
  const b0 = n - 6;
  const b1 = n - 1;
  if (a0 < 0) return false;

  function argminClose(lo: number, hi: number): number {
    let idx = lo;
    let v = closes[lo]!;
    for (let i = lo; i <= hi; i++) {
      if (closes[i]! < v) {
        v = closes[i]!;
        idx = i;
      }
    }
    return idx;
  }

  const iA = argminClose(a0, a1);
  const iB = argminClose(b0, b1);
  if (iB <= iA) return false;

  const priceA = closes[iA]!;
  const priceB = closes[iB]!;
  const rA = rsiSeries[iA];
  const rB = rsiSeries[iB];
  if (rA == null || rB == null) return false;

  const priceLowerLow = priceB < priceA * 0.997;
  const rsiHigherLow = rB > rA + 2;

  const rsiSegOld = rsiSeries.slice(a0, a1 + 1).filter((x): x is number => x != null);
  const rsiSegNew = rsiSeries.slice(b0, b1 + 1).filter((x): x is number => x != null);
  if (rsiSegOld.length < 4 || rsiSegNew.length < 4) {
    return priceLowerLow && rsiHigherLow;
  }
  const slopeOld = linearSlope(rsiSegOld);
  const slopeNew = linearSlope(rsiSegNew);
  const trendOk = slopeOld < -0.12 && slopeNew > -0.08;

  return priceLowerLow && rsiHigherLow && trendOk;
}

/** `endIdx`까지의 구간을 스캐너 최종봉으로 보았을 때 매수 신호(과매도·볼밴·다이버전스) */

/** 최근 N봉 저가대 근접(저점 추정 보조) */
export function detectNearSwingLow(
  candles: CandleBar[],
  closes: number[],
  lookback = 20,
  tolerance = 0.045,
): boolean {
  if (closes.length < lookback + 2 || candles.length < lookback + 2) return false;
  const loSlice = candles.slice(-lookback).map((c) => c.low);
  const minLow = Math.min(...loSlice);
  const lastClose = closes[closes.length - 1]!;
  if (minLow <= 0) return false;
  return lastClose <= minLow * (1 + tolerance);
}

/**
 * 짧은 하락·횡보 구간 저항을 위로 돌파(추세 꺾음·반등 시도).
 * - 최근 5봉(직전 구간) 최고 종가를 종가가 돌파하거나
 * - 전일대비 5일 SMA 아래→위로 재진입
 */
export function detectShortTrendBreakUp(closes: number[]): boolean {
  const n = closes.length;
  if (n < 12) return false;
  const last = closes[n - 1]!;
  let peakPrev = -Infinity;
  for (let i = n - 7; i <= n - 2; i++) {
    peakPrev = Math.max(peakPrev, closes[i]!);
  }
  if (last > peakPrev * 1.0015) return true;

  const sma = (from: number, len: number) => {
    const s = closes.slice(from, from + len);
    if (s.length < len) return null;
    return s.reduce((a, b) => a + b, 0) / len;
  };
  const sma5Now = sma(n - 5, 5);
  const sma5Prev = sma(n - 6, 5);
  if (sma5Now == null || sma5Prev == null) return false;
  const prevClose = closes[n - 2]!;
  if (prevClose < sma5Prev * 0.998 && last >= sma5Now * 0.998) return true;

  return false;
}

export function scannerBuySignalsAtBarIndex(candles: CandleBar[], endIdx: number): {
  oversoldBounce: boolean;
  bbLowerSupport: boolean;
  bullishDivergence: boolean;
} {
  if (endIdx < 20 || endIdx >= candles.length) {
    return { oversoldBounce: false, bbLowerSupport: false, bullishDivergence: false };
  }
  const sub = candles.slice(0, endIdx + 1);
  const closes = sub.map((c) => c.close);
  const rsi = computeRSISeries(closes, SCANNER_RSI_PERIOD);
  return {
    oversoldBounce: detectOversoldBounceStrict(rsi, sub),
    bbLowerSupport: detectBbLowerSupportBullishAtEnd(sub),
    bullishDivergence: detectBullishDivergenceDeep(closes, rsi),
  };
}
