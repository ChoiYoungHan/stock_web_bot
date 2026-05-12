import type { AnalysisSignal } from "@/types/stock";
import type { ChartIndicatorConfig } from "@/types/chart-indicators";
import {
  computeBollinger,
  computeMACDSnapshot,
  computeRSI,
  computeSMA,
} from "@/lib/market-data/technical-indicators";

export interface QuoteVolumeContext {
  regularMarketVolume?: number;
  averageDailyVolume10Day?: number;
}

function bollingerZone(pctB: number): string {
  if (pctB >= 0.95) return "상단 밴드 제약 구간";
  if (pctB >= 0.62) return "상단 밴드 쪽";
  if (pctB <= 0.05) return "하단 밴드 제약 구간";
  if (pctB <= 0.38) return "하단 밴드 쪽";
  return "밴드 중심부";
}

function rsiRemark(rsi: number, oversold: number, overbought: number): string {
  if (rsi < oversold) return "과매도 레벨";
  if (rsi <= oversold + 8) return "과매도 인접";
  if (rsi > overbought) return "과매수 레벨";
  if (rsi >= overbought - 8) return "과매수 인접";
  return "중립 레인지";
}

/** 스캐너 카드: 고정 파라미터(14·20·2σ) */
export function buildSignalsFromClosesAndQuote(closes: number[], quoteCtx: QuoteVolumeContext): {
  signals: AnalysisSignal[];
  signalSummary: string;
} {
  const MIN = 35;
  if (closes.length < MIN) {
    return {
      signals: ["rsi"],
      signalSummary: `일봉 ${closes.length}개: RSI·볼린저 산출 최소 구간(${MIN}봉) 미충족.`,
    };
  }

  const last = closes.at(-1) ?? 0;
  const rsiVal = computeRSI(closes, 14);
  const bb = computeBollinger(closes, 20, 2);
  const sma20 = computeSMA(closes, 20);
  const sma60 = computeSMA(closes, 60);
  const signals: AnalysisSignal[] = [];
  const vol = quoteCtx.regularMarketVolume ?? 0;
  const avg10 = quoteCtx.averageDailyVolume10Day ?? (vol || 1);
  if (vol > avg10 * 1.25 && avg10 > 0) signals.push("volume");

  if (rsiVal != null) {
    if (rsiVal < 35 || rsiVal > 65) signals.push("rsi");
  }

  if (bb && (bb.pctB < 0.15 || bb.pctB > 0.85)) signals.push("bollinger");

  if (last && sma20) {
    const devPct = Math.abs((last / sma20) * 100 - 100);
    if (devPct >= 2.5) signals.push("ma_cross");
  }
  if (last && sma60 && sma20 && sma20 > sma60 && last >= sma20) {
    signals.push("ma_cross");
  }

  let uniq = Array.from(new Set(signals));
  if (uniq.length === 0 && bb) uniq = ["bollinger"];
  if (uniq.length === 0 && rsiVal != null) uniq = ["rsi"];
  uniq = uniq.slice(0, 4);

  const sentences: string[] = [];
  if (rsiVal != null) {
    sentences.push(`RSI(14)=${rsiVal.toFixed(0)} (${rsiRemark(rsiVal, 30, 70)}).`);
  }
  if (bb) {
    sentences.push(`볼린저(20, 2σ) %B ${(bb.pctB * 100).toFixed(0)}% — ${bollingerZone(bb.pctB)}.`);
  }
  if (last && sma20) {
    const dev = ((last / sma20) * 100 - 100).toFixed(2);
    const nearLower = bb && last <= bb.lower * 1.01;
    sentences.push(`20일 SMA 대비 이격 ${dev}%. ${nearLower ? "하단 밴드·SMA 병행 점검." : "밴드·SMA 병행 점검."}`);
  }

  const macd = computeMACDSnapshot(closes);
  if (macd != null) {
    const h = macd.histogram;
    const rel = last ? Math.abs(h / last) * 100 : 0;
    sentences.push(`MACD 히스토그램 ${h.toExponential(3)} (종가 대비 스케일 약 ${rel.toFixed(4)}%).`);
  }

  if (uniq.includes("volume") && vol && avg10) {
    sentences.push(`거래량 10일 평균 대비 ${((vol / avg10) * 100).toFixed(0)}%.`);
  }

  return {
    signals: uniq,
    signalSummary: sentences.join(" "),
  };
}

function linearSlopeCloses(closes: number[]): number {
  if (closes.length < 5) return 0;
  const slice = closes.slice(-25);
  const m = slice.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < m; i++) {
    sumX += i;
    sumY += slice[i]!;
    sumXY += i * slice[i]!;
    sumXX += i * i;
  }
  const denom = m * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (m * sumXY - sumX * sumY) / denom;
}

/** 상세 화면용: 추세 방향·가격 vs 이평만 짧게 서술 */
export function buildTechnicalAnalysisNarrative(
  closes: number[],
  currentPrice: number | undefined,
  cfg: ChartIndicatorConfig,
): string {
  if (closes.length < cfg.bbPeriod + 5) {
    return `일봉 ${closes.length}개로는 추세·밴드 요약이 제한됩니다.`;
  }

  const price = currentPrice ?? closes.at(-1) ?? 0;
  const slope = linearSlopeCloses(closes);
  const slopePct = closes.at(-1) ? (slope / Math.abs(closes.at(-1)!)) * 100 : 0;
  let trendKo = "횡보에 가깝습니다";
  if (slopePct > 0.04) trendKo = "완만한 상승 추세입니다";
  else if (slopePct < -0.04) trendKo = "완만한 하락 추세입니다";

  const rsiVal = computeRSI(closes, cfg.rsiPeriod);
  const bb = computeBollinger(closes, cfg.bbPeriod, cfg.bbStdMult);
  const sma20 = computeSMA(closes, 20);

  const parts: string[] = [];
  parts.push(`최근 종가 기준 추세선(선형 근사)은 ${trendKo}.`);
  if (sma20 != null && price) {
    const rel = ((price / sma20) * 100 - 100).toFixed(1);
    parts.push(`현재가는 20일 이평선 대비 약 ${rel}% 위치입니다.`);
  }
  if (rsiVal != null) {
    parts.push(`RSI(${cfg.rsiPeriod})는 ${rsiVal.toFixed(0)}으로 ${rsiRemark(rsiVal, cfg.signalRsiBuy, cfg.signalRsiSell)} 구간입니다.`);
  }
  if (bb) {
    parts.push(`볼린저 밴드상 가격은 ${bollingerZone(bb.pctB)}에 있습니다.`);
  }

  return parts.join(" ");
}
