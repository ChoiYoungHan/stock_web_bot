import { useQuery } from "@tanstack/react-query";
import type { MarketTab } from "@/types/stock";
import type { StockDetailBundle } from "@/types/fundamentals";

async function fetchFundamentals(symbol: string, market: MarketTab): Promise<StockDetailBundle> {
  const q = new URLSearchParams({ symbol, market });
  const res = await fetch(`/api/fundamentals?${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error("fundamentals fetch failed");
  return (await res.json()) as StockDetailBundle;
}

export function useStockFundamentals(symbol: string, market: MarketTab) {
  return useQuery({
    queryKey: ["stock-fundamentals", market, symbol],
    queryFn: () => fetchFundamentals(symbol, market),
    staleTime: 300_000,
    refetchInterval: 300_000,
  });
}
