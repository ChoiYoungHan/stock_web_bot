"use client";

import { useState } from "react";
import type { MarketTab } from "@/types/stock";
import type { ScannerStrategyId } from "@/types/quant";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MarketTabs } from "@/components/dashboard/MarketTabs";
import { StrategyPicker } from "@/components/dashboard/StrategyPicker";
import { ScannerGrid } from "@/components/dashboard/ScannerGrid";

export default function HomePage() {
  const [market, setMarket] = useState<MarketTab>("domestic");
  const [strategies, setStrategies] = useState<Set<ScannerStrategyId>>(new Set());

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:gap-8 lg:px-10">
      <DashboardHeader />
      <MarketTabs value={market} onChange={setMarket} />
      <StrategyPicker selected={strategies} onChange={setStrategies} />
      <ScannerGrid market={market} selectedStrategies={strategies} />
    </main>
  );
}
