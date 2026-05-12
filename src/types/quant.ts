import type { CandleBar } from "@/types/fundamentals";
import type { MarketTab } from "@/types/stock";

export type MarketRegime = "bull" | "bear" | "neutral";

export type ScannerStrategyId =
  | "reversal_thesis"
  | "oversold_bounce"
  | "macd_golden"
  | "volume_surge"
  | "bb_support"
  | "strong_bull"
  | "doji_reversal"
  | "ma_slope"
  | "bullish_divergence";

export interface QuantFlags {
  liquidityOk: boolean;
  oversoldBounce: boolean;
  macdGoldenCross: boolean;
  volumeSurge: boolean;
  bbLowerSupport: boolean;
  strongBullishClose: boolean;
  dojiReversal: boolean;
  maSlopeBullish: boolean;
  bullishDivergence: boolean;
  /** 최근 구간 저가대 근접(저점 추정 보조) */
  nearSwingLow: boolean;
  /** 짧은 저항·이평 대비 위로 돌파(추세 꺾음) */
  trendBreakUp: boolean;
  /** 저점 추정 + 반등·전환 신호 동시 충족(스캐너·알림 핵심) */
  reversalThesis: boolean;
  /** 스캐너 유니버스 내 거래대금 상위 20% 티어(가산점 적용) */
  liquidityTopTier: boolean;
}

export interface QuantSnapshot {
  score: number;
  confidence: number;
  regime: MarketRegime;
  flags: QuantFlags;
  rationale: string[];
  /** 저점·추세전환 후보 점수(메인 정렬용, 0~100) */
  reversalThesisScore: number;
}

export interface QuantScoreInput {
  candles: CandleBar[];
  lastPrice: number;
  lastVolume: number;
  avgVolume10: number;
  regime: MarketRegime;
  market: MarketTab;
}

export const SCANNER_STRATEGY_OPTIONS: { id: ScannerStrategyId; label: string }[] = [
  { id: "reversal_thesis", label: "저점·추세전환 후보" },
  { id: "oversold_bounce", label: "과매도 반등" },
  { id: "macd_golden", label: "MACD 골든크로스" },
  { id: "volume_surge", label: "거래량 급증" },
  { id: "bb_support", label: "볼린저 하단 지지" },
  { id: "strong_bull", label: "강한 양봉" },
  { id: "doji_reversal", label: "도지 반전" },
  { id: "ma_slope", label: "이평 상승 기울기" },
  { id: "bullish_divergence", label: "상승 다이버전스" },
];
