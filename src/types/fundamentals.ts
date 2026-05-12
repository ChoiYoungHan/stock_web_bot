export interface StockSnapshot {
  name: string;
  symbol: string;
  price: number;
  changePercent: number;
  currency: string;
}

export interface FundamentalMetrics {
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  returnOnEquity: number | null;
  profitMargins: number | null;
  operatingMargins: number | null;
  debtToEquity: number | null;
  revenue: number | null;
  revenueCurrency: string | null;
}

export interface AnalysisNarratives {
  /** 서버는 비워 두고, 상세 화면에서 일봉·지표 설정으로 클라이언트가 채움 */
  technical?: string;
  fundamental: string;
}

export interface StockDetailBundle {
  snapshot: StockSnapshot;
  metrics: FundamentalMetrics;
  narratives: AnalysisNarratives;
}

export interface CandleBar {
  /** 일·주봉: `YYYY-MM-DD`, 분봉~시간봉: Unix 타임스탬프(초, UTC) */
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartResponse {
  yahooSymbol: string;
  currency: string;
  candles: CandleBar[];
  /** API가 해석한 타임프레임 id */
  timeframe?: string;
}