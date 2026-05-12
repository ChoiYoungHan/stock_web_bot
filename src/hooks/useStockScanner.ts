import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { MarketTab, ScannerStock } from "@/types/stock";
import type { ScannerStrategyId } from "@/types/quant";

const STALE_MS = 4 * 60 * 1000;
const REFETCH_MS = 5 * 60 * 1000;

export interface StockScannerPayload {
  market: MarketTab;
  updatedAt: number;
  rows: ScannerStock[];
  source: "yahoo" | "kis" | "mock";
  marketRegime: import("@/types/quant").MarketRegime;
}

function strategiesQueryKey(selected: Set<ScannerStrategyId>): string {
  return [...selected].sort().join(",");
}

async function fetchScanner(
  market: MarketTab,
  selectedStrategies: Set<ScannerStrategyId>,
): Promise<StockScannerPayload> {
  const sk = strategiesQueryKey(selectedStrategies);
  const q = sk ? `&strategies=${encodeURIComponent(sk)}` : "";
  const res = await fetch(`/api/scanner?market=${market}${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error("scanner fetch failed");
  return (await res.json()) as StockScannerPayload;
}

export function useStockScanner(market: MarketTab, selectedStrategies: Set<ScannerStrategyId>) {
  const strategyKey = strategiesQueryKey(selectedStrategies);
  return useQuery({
    queryKey: ["stock-scanner", market, strategyKey],
    queryFn: () => fetchScanner(market, selectedStrategies),
    staleTime: STALE_MS,
    gcTime: 15 * 60 * 1000,
    refetchInterval: REFETCH_MS,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
}
