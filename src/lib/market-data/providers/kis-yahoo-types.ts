/**
 * 한국투자증권 Open API 연동 시 사용할 설정 키(서버 전용).
 * @see https://github.com/koreainvestment/open-trading-api
 *
 * DOMESTIC_DATA_SOURCE=kis 일 때 아래 값이 있으면 KIS 클라이언트를 시도하고,
 * 실패 시 Yahoo 파이프라인으로 폴백합니다.
 */
export interface KoreaInvestmentEnvConfig {
  appKey: string;
  appSecret: string;
  accountNo?: string;
  accountProductCode?: string;
  isPaper?: boolean;
}

export function readKisEnv(): KoreaInvestmentEnvConfig | null {
  const appKey = process.env.KIS_APP_KEY?.trim();
  const appSecret = process.env.KIS_APP_SECRET?.trim();
  if (!appKey || !appSecret) return null;
  return {
    appKey,
    appSecret,
    accountNo: process.env.KIS_ACCOUNT_NO?.trim(),
    accountProductCode: process.env.KIS_ACCOUNT_PRODUCT_CODE?.trim() ?? "01",
    isPaper: process.env.KIS_USE_PAPER === "1" || process.env.KIS_USE_PAPER === "true",
  };
}
