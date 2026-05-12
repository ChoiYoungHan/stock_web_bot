"use client";

import type { MarketTab } from "@/types/stock";

const TABS: { id: MarketTab; label: string; hint: string }[] = [
  { id: "domestic", label: "국내장", hint: "KOSPI/KOSDAQ 상위 500" },
  { id: "us", label: "미국장", hint: "S&P 500" },
];

interface MarketTabsProps {
  value: MarketTab;
  onChange: (tab: MarketTab) => void;
}

export function MarketTabs({ value, onChange }: MarketTabsProps) {
  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div
        role="tablist"
        aria-label="시장 선택"
        className="flex w-full gap-1 rounded-xl border border-card-border bg-card/60 p-1 sm:w-auto"
      >
        {TABS.map((tab) => {
          const selected = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.id)}
              className={`min-h-11 flex-1 rounded-lg px-4 py-2 text-sm font-medium transition sm:min-w-[8.5rem] ${
                selected
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:bg-card-border/40 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted sm:text-right">
        {TABS.find((t) => t.id === value)?.hint}
      </p>
    </div>
  );
}
