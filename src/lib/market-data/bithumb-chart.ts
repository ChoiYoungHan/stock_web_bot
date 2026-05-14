import "server-only";

import type { ChartResponse } from "@/types/fundamentals";
import type { ChartTimeframeId } from "@/types/chart-timeframe";
import { bithumbChartInterval, fetchBithumbCandlestick } from "@/lib/market-data/bithumb-public";

const MAX_BARS: Record<ChartTimeframeId, number> = {
  "1m": 2000,
  "5m": 2000,
  "15m": 2000,
  "1h": 2000,
  "4h": 2000,
  "1d": 400,
  "1wk": 400,
};

export async function fetchBithumbChartResponse(symbol: string, timeframe: ChartTimeframeId): Promise<ChartResponse> {
  const sym = symbol.trim().toUpperCase();
  const interval = bithumbChartInterval(timeframe);
  let candles = await fetchBithumbCandlestick(sym, interval);
  const cap = MAX_BARS[timeframe] ?? 400;
  if (candles.length > cap) candles = candles.slice(-cap);
  return {
    yahooSymbol: `${sym}_KRW`,
    currency: "KRW",
    candles,
    timeframe,
  };
}
