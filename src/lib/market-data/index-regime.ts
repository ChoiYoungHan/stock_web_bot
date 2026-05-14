import { getYahooFinance } from "@/lib/yahoo-finance-client";
import type { MarketTab } from "@/types/stock";
import { classifyIndexRegime } from "@/utils/analysis";
import type { MarketRegime } from "@/types/quant";
import { fetchBithumbCandlestick } from "@/lib/market-data/bithumb-public";

const INDEX_YAHOO: Record<Exclude<MarketTab, "crypto">, string> = {
  domestic: "^KS11",
  us: "^GSPC",
};

export async function fetchIndexCloseSeries(market: MarketTab): Promise<number[]> {
  if (market === "crypto") {
    const candles = await fetchBithumbCandlestick("BTC", "24h");
    return candles.map((c) => c.close);
  }
  const sym = INDEX_YAHOO[market];
  const yahoo = getYahooFinance();
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 2);
  const result = await yahoo.chart(sym, { period1, interval: "1d" });
  const closes: number[] = [];
  for (const q of result.quotes) {
    if (q.close != null) closes.push(q.close);
  }
  return closes;
}

export async function resolveMarketRegime(market: MarketTab): Promise<MarketRegime> {
  try {
    const closes = await fetchIndexCloseSeries(market);
    return classifyIndexRegime(closes);
  } catch {
    return "neutral";
  }
}
