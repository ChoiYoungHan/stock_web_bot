import type { QuantSnapshot } from "@/types/quant";

export type MarketTab = "domestic" | "us";

export type AnalysisSignal =
  | "ma_cross"
  | "rsi"
  | "bollinger"
  | "volume"
  | "macd";

export interface ScannerTechnicalSnapshot {
  rsi14: number | null;
  sma5: number | null;
  sma20: number | null;
  sma60: number | null;
  sma120: number | null;
  bbPctB: number | null;
}

export interface ScannerStock {
  symbol: string;
  name: string;
  market: MarketTab;
  price: number;
  changePercent: number;
  signals: AnalysisSignal[];
  signalSummary: string;
  /** 당일(또는 최근) 거래량 — 거래대금 티어·가산점용 */
  lastVolume?: number;
  /** 대략적 거래대금 (가격×거래량) */
  tradeValue?: number;
  /** 일봉 기반 기술 스냅샷(필터 스크립트용) */
  technical?: ScannerTechnicalSnapshot;
  /** 멀티팩터 퀀트 스코어 */
  quant?: QuantSnapshot;
}
