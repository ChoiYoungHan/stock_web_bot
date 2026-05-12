import type { ScannerStock } from "@/types/stock";

/**
 * 국내장 시세 소스 추상화.
 * - `yahoo`: Yahoo Finance 시세 — 기본 구현
 * - `kis`: 한국투자증권 Open API — 앱키/시크릿/계좌 연동 후 구현
 */
export type DomesticDataSourceId = "yahoo" | "kis";

export interface IDomesticQuoteScannerSource {
  readonly id: DomesticDataSourceId;
  getScannerRows(regime: import("@/types/quant").MarketRegime): Promise<ScannerStock[]>;
}
