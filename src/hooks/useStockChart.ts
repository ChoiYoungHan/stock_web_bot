import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { MarketTab } from "@/types/stock";
import type { ChartResponse } from "@/types/fundamentals";
import type { ChartTimeframeId } from "@/types/chart-timeframe";

async function fetchChart(symbol: string, market: MarketTab, timeframe: ChartTimeframeId): Promise<ChartResponse> {
  const q = new URLSearchParams({ symbol, market, timeframe });
  const res = await fetch(`/api/chart?${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error("chart fetch failed");
  return (await res.json()) as ChartResponse;
}

function chartQueryTuning(tf: ChartTimeframeId): { staleTime: number; refetchInterval: number | false } {
  switch (tf) {
    case "1m":
      return { staleTime: 15_000, refetchInterval: 30_000 };
    case "5m":
      return { staleTime: 20_000, refetchInterval: 45_000 };
    case "15m":
      return { staleTime: 30_000, refetchInterval: 60_000 };
    case "1h":
    case "4h":
      return { staleTime: 45_000, refetchInterval: 120_000 };
    case "1d":
    case "1wk":
    default:
      return { staleTime: 60_000, refetchInterval: 120_000 };
  }
}

export function useStockChart(
  symbol: string,
  market: MarketTab,
  timeframe: ChartTimeframeId,
  options?: { enabled?: boolean },
) {
  const { staleTime, refetchInterval } = chartQueryTuning(timeframe);
  const enabled = options?.enabled !== false;

  return useQuery({
    queryKey: ["stock-chart", market, symbol, timeframe],
    queryFn: () => fetchChart(symbol, market, timeframe),
    enabled,
    staleTime,
    gcTime: 60 * 60 * 1000,
    refetchInterval,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });
}
