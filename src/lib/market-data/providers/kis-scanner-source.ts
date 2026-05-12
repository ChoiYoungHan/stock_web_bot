import type { ScannerStock } from "@/types/stock";
import type { IDomesticQuoteScannerSource } from "./domestic-data-source";
import { readKisEnv } from "./kis-yahoo-types";

/**
 * 한국투자증권 REST 연동 스텁.
 * OAuth 토큰 발급 및 tr_id별 호출을 붙이면 `getScannerRows`를 완성할 수 있습니다.
 */
export class KisDomesticScannerSource implements IDomesticQuoteScannerSource {
  readonly id = "kis" as const;

  async getScannerRows(regime: import("@/types/quant").MarketRegime): Promise<ScannerStock[]> {
    void regime;
    const cfg = readKisEnv();
    if (!cfg) {
      throw new Error("KIS_APP_KEY / KIS_APP_SECRET 이 설정되지 않았습니다.");
    }

    // TODO: POST /oauth2/token → Bearer
    // TODO: domestic-stock/v1/quotations/inquire-price-2 등으로 복수 종목 조회
    void cfg;
    throw new Error(
      "KIS 국내 시세 스캐너가 아직 구현되지 않았습니다. DOMESTIC_DATA_SOURCE=yahoo 로 전환하거나 fetch 로직을 연결하세요.",
    );
  }
}
