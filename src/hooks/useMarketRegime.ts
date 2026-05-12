import { useQuery } from "@tanstack/react-query";
import type { MarketTab } from "@/types/stock";
import type { MarketRegime } from "@/types/quant";

async function fetchRegime(market: MarketTab): Promise<MarketRegime> {
  const res = await fetch(`/api/market-regime?market=${market}`, { cache: "no-store" });
  if (!res.ok) return "neutral";
  const body = (await res.json()) as { regime?: MarketRegime };
  return body.regime ?? "neutral";
}

export function useMarketRegime(market: MarketTab) {
  return useQuery({
    queryKey: ["market-regime", market],
    queryFn: () => fetchRegime(market),
    staleTime: 60_000,
  });
}
