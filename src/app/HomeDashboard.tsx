"use client";

import { Suspense, useCallback, useLayoutEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { MarketTab } from "@/types/stock";
import type { ScannerStrategyId } from "@/types/quant";
import { parseMarketTabParam } from "@/lib/market-data/market-tab";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MarketTabs } from "@/components/dashboard/MarketTabs";
import { StrategyPicker } from "@/components/dashboard/StrategyPicker";
import { ScannerGrid } from "@/components/dashboard/ScannerGrid";

function HomeDashboardInner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const marketKey = searchParams.get("market") ?? "";

  const [market, setMarket] = useState<MarketTab>(() => parseMarketTabParam(marketKey || null));

  useLayoutEffect(() => {
    setMarket(parseMarketTabParam(marketKey || null));
  }, [marketKey]);

  const handleMarketChange = useCallback(
    (m: MarketTab) => {
      setMarket(m);
      router.replace(`/?market=${m}`, { scroll: false });
      void queryClient.invalidateQueries({ queryKey: ["stock-scanner", m], exact: false });
    },
    [router, queryClient],
  );

  const [strategies, setStrategies] = useState<Set<ScannerStrategyId>>(new Set());

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:gap-8 lg:px-10">
      <DashboardHeader />
      <MarketTabs value={market} onChange={handleMarketChange} />
      <StrategyPicker selected={strategies} onChange={setStrategies} />
      <ScannerGrid market={market} selectedStrategies={strategies} />
    </main>
  );
}

export function HomeDashboard() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:gap-8 lg:px-10">
          <DashboardHeader />
          <div className="h-28 animate-pulse rounded-xl border border-card-border bg-card/40" />
          <div className="h-24 animate-pulse rounded-xl border border-card-border bg-card/40" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl border border-card-border bg-card/50" />
            ))}
          </div>
        </main>
      }
    >
      <HomeDashboardInner />
    </Suspense>
  );
}
