import { getYahooFinance } from "@/lib/yahoo-finance-client";
import type { MarketTab } from "@/types/stock";
import { classifyIndexRegime } from "@/utils/analysis";
import type { MarketRegime } from "@/types/quant";

const INDEX_YAHOO: Record<MarketTab, string> = {
  domestic: "^KS11",
  us: "^GSPC",
};

export async function fetchIndexCloseSeries(market: MarketTab): Promise<number[]> {
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
