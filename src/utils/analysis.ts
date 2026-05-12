import type { MarketRegime, QuantFlags, QuantScoreInput, QuantSnapshot, ScannerStrategyId } from "@/types/quant";
import type { MarketTab } from "@/types/stock";
import {
  computeBollinger,
  computeMACDHistogramSeries,
  computeRSI,
  computeRSISeries,
  computeSMA,
} from "@/lib/market-data/technical-indicators";
import {
  SCANNER_RSI_PERIOD,
  detectBbLowerSupportBullishAtEnd,
  detectBullishDivergenceDeep,
  detectNearSwingLow,
  detectOversoldBounceStrict,
  detectShortTrendBreakUp,
} from "@/lib/analysis/quant-signals";

export { SCANNER_STRATEGY_OPTIONS } from "@/types/quant";

const WEIGHTS_BASE: Record<
  "liquidity" | "oversoldBounce" | "macdGolden" | "volumeSurge" | "bbSupport" | "strongBull" | "doji" | "maSlope" | "divergence",
  number
> = {
  liquidity: 12,
  oversoldBounce: 16,
  macdGolden: 22,
  volumeSurge: 14,
  bbSupport: 14,
  strongBull: 10,
  doji: 8,
  maSlope: 12,
  divergence: 18,
};

function weightsForRegime(regime: MarketRegime): typeof WEIGHTS_BASE {
  if (regime === "bear") {
    return {
      ...WEIGHTS_BASE,
      oversoldBounce: 24,
      maSlope: 8,
      divergence: 20,
    };
  }
  if (regime === "bull") {
    return {
      ...WEIGHTS_BASE,
      maSlope: 18,
      oversoldBounce: 12,
    };
  }
  return { ...WEIGHTS_BASE };
}

/**
 * 지수 종가 기준: 20일 SMA의 약 5거래일 전 대비 기울기(%)로 국면 분류.
 * 국내 ^KS11, 미국 ^GSPC 등 동일 규칙 적용.
 */
export function classifyIndexRegime(indexCloses: number[]): MarketRegime {
  if (indexCloses.length < 30) return "neutral";
  const smaNow = computeSMA(indexCloses, 20);
  const laggedCloses = indexCloses.slice(0, Math.max(0, indexCloses.length - 5));
  const smaLag = computeSMA(laggedCloses, 20);
  if (smaNow == null || smaLag == null || smaLag <= 0) return "neutral";
  const slopePct = ((smaNow - smaLag) / smaLag) * 100;
  if (slopePct > 0.1) return "bull";
  if (slopePct < -0.1) return "bear";
  return "neutral";
}

function tradeValueThreshold(market: MarketTab): number {
  return market === "domestic" ? 2e9 : 2e6;
}

function smaAtEnd(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const s = values.slice(-period);
  return s.reduce((a, b) => a + b, 0) / period;
}

function volumeSurgeRatio(regime: MarketRegime): number {
  return regime === "bear" ? 2.0 : 1.45;
}

function macdGoldenCrossRecent(hist: number[], lookback = 5): boolean {
  if (hist.length < lookback + 2) return false;
  const slice = hist.slice(-lookback - 1);
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1]! < 0 && slice[i]! >= 0) return true;
  }
  return false;
}

function lastBarBollingerLower(closes: number[]): { lower: number; close: number } | null {
  if (closes.length < 21) return null;
  const bb = computeBollinger(closes, 20, 2);
  if (!bb) return null;
  return { lower: bb.lower, close: closes[closes.length - 1]! };
}

function isDoji(open: number, high: number, low: number, close: number): boolean {
  const range = high - low;
  if (range <= 0) return false;
  const body = Math.abs(close - open);
  return body / range < 0.12;
}

function isStrongBullish(open: number, high: number, low: number, close: number): boolean {
  const range = high - low;
  if (range <= 0 || close <= open) return false;
  const body = close - open;
  return body / range >= 0.62 && (high - close) / range <= 0.12;
}

function maSlopeBullish(closes: number[], regime: MarketRegime): boolean {
  if (closes.length < 28) return false;
  const sma5Now = smaAtEnd(closes, 5);
  const sma5Lag = smaAtEnd(closes.slice(0, -5), 5);
  const sma20Now = smaAtEnd(closes, 20);
  const sma20Lag = smaAtEnd(closes.slice(0, -5), 20);
  if (sma5Now == null || sma5Lag == null || sma20Now == null || sma20Lag == null) return false;
  const g5 = ((sma5Now - sma5Lag) / sma5Lag) * 100;
  const g20 = ((sma20Now - sma20Lag) / sma20Lag) * 100;
  const th = regime === "bear" ? 0.35 : 0.22;
  return g5 > th && g20 > th * 0.6;
}

export function quantCaptureHashtags(flags: QuantFlags): string[] {
  const tags: string[] = [];
  if (flags.reversalThesis) tags.push("#전환후보");
  if (flags.nearSwingLow) tags.push("#저점근접");
  if (flags.trendBreakUp) tags.push("#추세전환");
  if (flags.oversoldBounce) tags.push("#과매도반등");
  if (flags.macdGoldenCross) tags.push("#MACD골든");
  if (flags.volumeSurge) tags.push("#거래량급증");
  if (flags.bbLowerSupport) tags.push("#볼밴지지");
  if (flags.strongBullishClose) tags.push("#강한양봉");
  if (flags.dojiReversal) tags.push("#도지반전");
  if (flags.maSlopeBullish) tags.push("#이평정배열");
  if (flags.bullishDivergence) tags.push("#상승다이버전스");
  if (flags.liquidityOk) tags.push("#유동성통과");
  if (flags.liquidityTopTier) tags.push("#거래대금상위");
  return tags;
}

export function computeQuantSnapshot(input: QuantScoreInput): QuantSnapshot {
  const { candles, lastPrice, lastVolume, avgVolume10, regime, market } = input;
  const emptyFlags: QuantFlags = {
    liquidityOk: false,
    oversoldBounce: false,
    macdGoldenCross: false,
    volumeSurge: false,
    bbLowerSupport: false,
    strongBullishClose: false,
    dojiReversal: false,
    maSlopeBullish: false,
    bullishDivergence: false,
    nearSwingLow: false,
    trendBreakUp: false,
    reversalThesis: false,
    liquidityTopTier: false,
  };

  if (!candles.length || lastPrice <= 0) {
    return {
      score: 0,
      confidence: 0,
      regime,
      flags: emptyFlags,
      rationale: [],
      reversalThesisScore: 0,
    };
  }
  const closes = candles.map((c) => c.close);
  const last = candles[candles.length - 1]!;

  const tradeValue = lastPrice * lastVolume;
  const liquidityOk = tradeValue >= tradeValueThreshold(market) && avgVolume10 > 0;

  const rsiSeries = computeRSISeries(closes, SCANNER_RSI_PERIOD);
  const rsiNow = rsiSeries[closes.length - 1] ?? computeRSI(closes, SCANNER_RSI_PERIOD);
  const oversoldBounce = detectOversoldBounceStrict(rsiSeries, candles);

  const hist = computeMACDHistogramSeries(closes);
  const macdGoldenCross = macdGoldenCrossRecent(hist, regime === "bear" ? 4 : 5);

  const volMult = volumeSurgeRatio(regime);
  const volumeSurge = avgVolume10 > 0 && lastVolume >= avgVolume10 * volMult;

  const bbLowerSupport = detectBbLowerSupportBullishAtEnd(candles);

  const strongBullishClose = isStrongBullish(last.open, last.high, last.low, last.close);
  const bbLast = lastBarBollingerLower(closes);
  const dojiReversal =
    isDoji(last.open, last.high, last.low, last.close) &&
    bbLast != null &&
    last.close <= bbLast.lower * 1.03;

  const maSlope = maSlopeBullish(closes, regime);
  const bullishDivergence = detectBullishDivergenceDeep(closes, rsiSeries);

  const nearSwingLow = detectNearSwingLow(candles, closes, 20, 0.045);
  const trendBreakUp = detectShortTrendBreakUp(closes);

  const setupSide =
    nearSwingLow ||
    oversoldBounce ||
    bbLowerSupport ||
    bullishDivergence ||
    dojiReversal ||
    (rsiNow != null && rsiNow < 40 && bbLast != null && last.close <= bbLast.lower * 1.06);
  const triggerSide =
    trendBreakUp || macdGoldenCross || oversoldBounce || strongBullishClose || volumeSurge;

  let reversalThesisScore = 0;
  if (nearSwingLow) reversalThesisScore += 22;
  if (trendBreakUp) reversalThesisScore += 28;
  if (oversoldBounce) reversalThesisScore += 18;
  if (bullishDivergence) reversalThesisScore += 16;
  if (bbLowerSupport) reversalThesisScore += 14;
  if (macdGoldenCross) reversalThesisScore += 12;
  if (volumeSurge) reversalThesisScore += 8;
  if (strongBullishClose) reversalThesisScore += 8;
  if (dojiReversal) reversalThesisScore += 6;
  if (maSlope && !nearSwingLow) reversalThesisScore -= 10;
  reversalThesisScore = Math.max(0, Math.min(100, reversalThesisScore));

  const reversalThesis =
    reversalThesisScore >= 46 && setupSide && triggerSide && (nearSwingLow || oversoldBounce || bbLowerSupport || bullishDivergence);
  const bearPenalty = regime === "bear" ? 0.88 : 1;
  const W = weightsForRegime(regime);

  let score = 0;
  const rationale: string[] = [];

  const add = (cond: boolean, w: number, msg: string) => {
    if (!cond) return;
    const pts = Math.round(w * bearPenalty);
    score += pts;
    rationale.push(msg);
  };

  add(liquidityOk, W.liquidity, `유동성 필터 충족(거래대금 기준).`);
  add(
    oversoldBounce,
    W.oversoldBounce,
    `과매도 반등: RSI(14) 30→35 이탈 또는 5일 V자·${rsiNow != null ? `현재 RSI ${rsiNow.toFixed(0)}` : "RSI —"}.`,
  );
  add(macdGoldenCross, W.macdGolden, `MACD 히스토그램 음→양 전환.`);
  add(volumeSurge, W.volumeSurge, `거래량 ${volMult.toFixed(2)}배 이상 급증.`);
  add(bbLowerSupport, W.bbSupport, `볼린저 하단 터치 후 양봉 마감(지지).`);
  add(strongBullishClose, W.strongBull, `강한 양봉 마감.`);
  add(dojiReversal, W.doji, `하단권 도지형 캔들.`);
  if (maSlope && nearSwingLow) {
    add(true, W.maSlope, `저점권에서 단기·중기 SMA 기울기 개선.`);
  } else if (maSlope) {
    add(true, Math.max(4, Math.round(W.maSlope * 0.5 * bearPenalty)), `단기·중기 SMA 상승(저점 신호 약해 가점 축소).`);
  }
  add(bullishDivergence, W.divergence, `가격 대비 RSI 상승 다이버전스(10~15봉 정밀).`);

  if (regime === "bear" && rsiNow != null && rsiNow < 30 && !oversoldBounce) {
    add(true, 5, `하락장 RSI 30 미만(추가 관찰).`);
  }

  if (nearSwingLow) {
    rationale.push(`최근 20일 저가대 근접(저점 추정 보조).`);
  }
  if (trendBreakUp) {
    rationale.push(`짧은 구간 저항 돌파 또는 5일선 재진입(추세 꺾음·반등 시도).`);
  }
  if (reversalThesis) {
    rationale.push(`저점·추세전환 후보로 분류(보조지표 조합).`);
  }

  const maxRaw =
    W.liquidity +
    W.oversoldBounce +
    W.macdGolden +
    W.volumeSurge +
    W.bbSupport +
    W.strongBull +
    W.doji +
    W.maSlope +
    W.divergence;
  const bearAllowance = regime === "bear" ? 5 : 0;
  const maxScore = Math.round((maxRaw + bearAllowance) * bearPenalty);
  const confidence =
    maxScore > 0 ? Math.min(99, Math.round((score / maxScore) * 100 + (liquidityOk ? 3 : 0))) : 0;

  return {
    score,
    confidence,
    regime,
    flags: {
      liquidityOk,
      oversoldBounce,
      macdGoldenCross,
      volumeSurge,
      bbLowerSupport,
      strongBullishClose,
      dojiReversal,
      maSlopeBullish: maSlope,
      bullishDivergence,
      nearSwingLow,
      trendBreakUp,
      reversalThesis,
      liquidityTopTier: false,
    },
    rationale,
    reversalThesisScore,
  };
}

export function strategyMatches(row: { quant?: QuantSnapshot }, id: ScannerStrategyId): boolean {
  const q = row.quant;
  if (!q) return false;
  switch (id) {
    case "reversal_thesis":
      return q.flags.reversalThesis;
    case "oversold_bounce":
      return q.flags.oversoldBounce;
    case "macd_golden":
      return q.flags.macdGoldenCross;
    case "volume_surge":
      return q.flags.volumeSurge;
    case "bb_support":
      return q.flags.bbLowerSupport;
    case "strong_bull":
      return q.flags.strongBullishClose;
    case "doji_reversal":
      return q.flags.dojiReversal;
    case "ma_slope":
      return q.flags.maSlopeBullish;
    case "bullish_divergence":
      return q.flags.bullishDivergence;
    default:
      return false;
  }
}

export function rowPassesStrategyAnd(selected: Set<ScannerStrategyId>, row: { quant?: QuantSnapshot }): boolean {
  if (selected.size === 0) return true;
  for (const id of selected) {
    if (!strategyMatches(row, id)) return false;
  }
  return true;
}

export function buildExpertTechnicalParagraph(q: QuantSnapshot): string {
  const regimeKo =
    q.regime === "bull" ? "지수 국면은 상승 추세로 분류" : q.regime === "bear" ? "지수 국면은 하락 추세로 분류" : "지수 국면은 중립";
  const top = q.rationale.slice(0, 3).join(" ");
  const rationaleMore = q.rationale.length > 3 ? ` ${q.rationale.length - 3}개 부가 팩터가 동시에 정렬.` : "";
  if (!q.score) {
    return `${regimeKo}되었으며, 현재 일봉 패턴은 멀티팩터 상위 구간 진입 신호가 제한적입니다.`;
  }
  const confidenceTail =
    q.confidence >= 85
      ? " 기술적 반등 가능성이 높은 구간으로 판단됩니다."
      : q.confidence >= 65
        ? " 다수 팩터가 정렬된 구간입니다."
        : "";
  const combo =
    q.flags.bullishDivergence && q.flags.macdGoldenCross
      ? " RSI 상승 다이버전스와 MACD 골든크로스가 동시에 포착되었습니다."
      : "";
  const rev =
    q.flags.reversalThesis && q.reversalThesisScore != null
      ? ` 저점 부근·단기 하락선 이탈(전환) 가설 점수 ${q.reversalThesisScore}점이 함께 잡혔습니다.`
      : q.flags.nearSwingLow || q.flags.trendBreakUp
        ? ` 최근 스윙 저점 근접(${q.flags.nearSwingLow ? "예" : "아니오"})·단기 추세 상향 꺾임(${q.flags.trendBreakUp ? "예" : "아니오"}) 조합을 점검 중입니다.`
        : "";
  return `${regimeKo}되었습니다. 멀티팩터 종합점수 ${q.score}점, 신뢰도 ${q.confidence}%.${combo}${rev} ${top}${rationaleMore}${confidenceTail}`;
}
