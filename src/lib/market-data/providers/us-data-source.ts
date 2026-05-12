import type { ScannerStock } from "@/types/stock";

/**
 * 미국장(S&P 500 유니버스) 시세 소스.
 * Yahoo Finance `quote` 다건 호출로 yfinance 스타일 스냅샷을 구성합니다.
 */
export interface IUsSp500ScannerSource {
  getScannerRows(regime: import("@/types/quant").MarketRegime): Promise<ScannerStock[]>;
}
