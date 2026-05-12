"use client";

import type { FundamentalMetrics } from "@/types/fundamentals";
import { formatKoreanScaleNumber } from "@/utils/formatKoreanScale";

interface FundamentalsGridProps {
  metrics: FundamentalMetrics | undefined;
  loading: boolean;
}

function fmtRatio(n: number | null | undefined, suffix = ""): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(2)}${suffix}`;
}

function fmtPercent(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

export function FundamentalsGrid({ metrics, loading }: FundamentalsGridProps) {
  const cells: { label: string; value: string }[] = [
    { label: "PER (TTM)", value: fmtRatio(metrics?.trailingPE, "x") },
    { label: "선행 PER", value: fmtRatio(metrics?.forwardPE, "x") },
    { label: "PBR", value: fmtRatio(metrics?.priceToBook, "x") },
    { label: "ROE", value: fmtPercent(metrics?.returnOnEquity) },
    { label: "영업이익률", value: fmtPercent(metrics?.operatingMargins) },
    { label: "순이익률", value: fmtPercent(metrics?.profitMargins) },
    { label: "부채비율 (D/E)", value: fmtRatio(metrics?.debtToEquity, "x") },
    { label: "매출", value: formatKoreanScaleNumber(metrics?.revenue ?? null) },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-card-border bg-[#1a1a1a]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-lg border border-card-border bg-[#1a1a1a] p-3"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{c.label}</p>
          <p className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
