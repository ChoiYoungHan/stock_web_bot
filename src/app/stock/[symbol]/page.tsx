import { StockDetailClient } from "@/components/stock/StockDetailClient";
import type { MarketTab } from "@/types/stock";
import { parseMarketTabParam } from "@/lib/market-data/market-tab";

interface StockDetailPageProps {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ market?: string }>;
}

function parseMarket(raw: string | undefined): MarketTab {
  return parseMarketTabParam(raw ?? null);
}

export default async function StockDetailPage({ params, searchParams }: StockDetailPageProps) {
  const { symbol: rawSymbol } = await params;
  const { market: rawMarket } = await searchParams;
  const symbol = decodeURIComponent(rawSymbol);
  const market = parseMarket(rawMarket);

  return <StockDetailClient symbol={symbol} market={market} />;
}
