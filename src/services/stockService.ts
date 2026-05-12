/**
 * 시세·차트 수집 진입점 (Yahoo 기본, KIS 국내 전환용).
 * 차트 API는 `fetchChartForApi`를 경유해 두 소스를 한곳에서 갈아끼울 수 있게 합니다.
 */
import type { ChartResponse } from "@/types/fundamentals";
import type { MarketTab } from "@/types/stock";
import type { ChartTimeframeId } from "@/types/chart-timeframe";
import { fetchChartCandles } from "@/lib/market-data/chart-service";
import { readKisEnv, type KoreaInvestmentEnvConfig } from "@/lib/market-data/providers/kis-yahoo-types";

export type DomesticChartBackend = "yahoo" | "kis";

export interface StockServiceEnv {
  /** 국내 차트/시세 백엔드. `kis`일 때 `readKisEnv()`가 있어야 함(미구현 시 예외). */
  domesticChartBackend: DomesticChartBackend;
  kis: KoreaInvestmentEnvConfig | null;
}

export function getStockServiceEnv(): StockServiceEnv {
  const kis = readKisEnv();
  const wantKis =
    process.env.DOMESTIC_STOCK_SERVICE?.trim().toLowerCase() === "kis" ||
    process.env.DOMESTIC_DATA_SOURCE?.trim().toLowerCase() === "kis";
  return {
    domesticChartBackend: wantKis && kis ? "kis" : "yahoo",
    kis,
  };
}

/**
 * 한국투자증권 KIS Developers REST 클라이언트 뼈대.
 * @see https://github.com/koreainvestment/open-trading-api
 *
 * 구현 시 참고할 대표 TR (예시):
 * - OAuth2: `POST /oauth2/token` (grant_type client_credentials)
 * - 국내주식 분봉: `GET /uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice` (tr_id 예: FHKST03010200)
 * - 국내주식 현재가: `inquire-price-2` 등
 */
export class KisHttpClient {
  constructor(private readonly cfg: KoreaInvestmentEnvConfig) {}

  get baseUrl(): string {
    return this.cfg.isPaper ? "https://openapivts.koreainvestment.com:29443" : "https://openapi.koreainvestment.com:9443";
  }

  /** TODO: appkey/appsecret으로 access_token 발급 후 캐시 */
  async getAccessToken(): Promise<string> {
    void this.cfg;
    throw new Error(
      "[KIS] getAccessToken 미구현. POST /oauth2/token 을 구현하고 Bearer 토큰을 메모리/Redis에 캐시하세요.",
    );
  }

  /** TODO: 종목코드 6자리 + 입력 날짜 기준 분봉 OHLCV → CandleBar[] 변환 */
  async fetchDomesticMinuteChart(symbol6: string): Promise<unknown> {
    void symbol6;
    throw new Error("[KIS] fetchDomesticMinuteChart 미구현. 위 TR을 호출해 Yahoo `CandleBar` 형식으로 매핑하세요.");
  }
}

export class KisDomesticStockAdapter {
  constructor(private readonly client: KisHttpClient) {}

  /** ChartResponse로 정규화 (구현 후 chart 라우트에서 사용) */
  async fetchChartAsYahooShape(yahooSymbol: string): Promise<ChartResponse> {
    void yahooSymbol;
    await this.client.getAccessToken();
    throw new Error("[KIS] fetchChartAsYahooShape 미구현. 분봉 TR 결과를 일봉 병합 로직과 맞추세요.");
  }
}

/** 차트 API용 — KIS 구현 전까지는 항상 Yahoo(일봉+분봉 병합). KIS 준비 시 아래 분기만 교체 */
export async function fetchChartForApi(
  yahooSymbol: string,
  market: MarketTab,
  timeframe: ChartTimeframeId = "1d",
): Promise<ChartResponse> {
  const env = getStockServiceEnv();
  if (env.domesticChartBackend === "kis" && market === "domestic" && env.kis) {
    console.warn("[stockService] KIS 국내 차트는 스텁입니다. `KisDomesticStockAdapter` 구현 후 연결하세요. Yahoo로 폴백합니다.");
  }
  return fetchChartCandles(yahooSymbol, timeframe);
}
