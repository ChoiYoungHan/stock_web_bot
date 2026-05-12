"use client";

import { useMemo } from "react";
import type { MarketTab, ScannerStock } from "@/types/stock";
import type { ScannerStrategyId } from "@/types/quant";
import { useStockScanner } from "@/hooks/useStockScanner";
import { rowPassesStrategyAnd } from "@/utils/analysis";
import { StockCard } from "./StockCard";

interface ScannerGridProps {
  market: MarketTab;
  selectedStrategies: Set<ScannerStrategyId>;
}

export function ScannerGrid({ market, selectedStrategies }: ScannerGridProps) {
  const { data, isPending, isFetching, isError, dataUpdatedAt } = useStockScanner(market, selectedStrategies);

  const rows = data?.rows;

  const filteredSafe = useMemo(() => {
    if (!rows) return [] as ScannerStock[];
    return rows.filter((r) => rowPassesStrategyAnd(selectedStrategies, r));
  }, [rows, selectedStrategies]);

  const showBlockingSkeleton = isPending && rows == null;

  if (showBlockingSkeleton) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-card-border bg-card/50"
          />
        ))}
      </div>
    );
  }

  if (isError && rows == null) {
    return (
      <p className="rounded-xl border border-negative/30 bg-negative/10 px-4 py-6 text-center text-sm text-negative">
        스캐너 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  const safeRows = rows ?? [];

  const updated = new Date(dataUpdatedAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const regimeLabel =
    data?.marketRegime === "bull" ? "상승" : data?.marketRegime === "bear" ? "하락" : "중립";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-muted">
        {isFetching && <span className="text-accent">데이터 갱신 중…</span>}
        <span>
          마지막 갱신 {updated} · 지수 국면 {regimeLabel} · 표시 {filteredSafe.length}/{safeRows.length}건(서버에서 전환
          점수 컷·상위만 전달) · 매수 알림은 텔레그램(5분 스캔)
        </span>
      </div>
      {filteredSafe.length === 0 ? (
        <p className="rounded-xl border border-card-border bg-[#1a1a1a] px-4 py-8 text-center text-sm text-muted">
          선택한 전략 조건을 만족하는 종목이 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {filteredSafe.map((stock) => (
            <StockCard key={`${stock.market}-${stock.symbol}`} stock={stock} />
          ))}
        </div>
      )}
    </div>
  );
}
