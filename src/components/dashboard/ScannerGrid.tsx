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

function ScannerLoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[200] flex cursor-wait items-center justify-center bg-black/55 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="scanner-loading-title"
    >
      <div className="pointer-events-none flex max-w-sm flex-col items-center gap-5 rounded-2xl border border-card-border bg-[#121212] px-12 py-10 shadow-2xl">
        <div
          className="h-12 w-12 animate-spin rounded-full border-[3px] border-card-border border-t-accent"
          aria-hidden
        />
        <p id="scanner-loading-title" className="text-center text-base font-medium text-foreground">
          데이터를 가져오고 있습니다..
        </p>
      </div>
    </div>
  );
}

export function ScannerGrid({ market, selectedStrategies }: ScannerGridProps) {
  const { data, isPending, isFetching, isError, dataUpdatedAt } = useStockScanner(market, selectedStrategies);

  const rows = data?.rows;

  const filteredSafe = useMemo(() => {
    if (!rows) return [] as ScannerStock[];
    return rows.filter((r) => rowPassesStrategyAnd(selectedStrategies, r));
  }, [rows, selectedStrategies]);

  if (isError && rows == null) {
    return (
      <p className="rounded-xl border border-negative/30 bg-negative/10 px-4 py-6 text-center text-sm text-negative">
        스캐너 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
    );
  }

  const safeRows = rows ?? [];
  const isInitialLoad = isPending && rows == null;
  const dataMatchesTab = data != null && data.market === market;
  /** 탭 전환·첫 로드: 전체 로딩. 동일 시장 5분 백그라운드 갱신은 오버레이 없음 */
  const showBlockingOverlay =
    isFetching && (!(data != null && data.market === market) || isInitialLoad);
  const showContent = !isInitialLoad && (!showBlockingOverlay || dataMatchesTab);

  const updated = new Date(dataUpdatedAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const regimeLabel =
    data?.marketRegime === "bull" ? "상승" : data?.marketRegime === "bear" ? "하락" : "중립";

  return (
    <>
      {showBlockingOverlay ? <ScannerLoadingOverlay /> : null}
      {showContent ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-muted">
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
      ) : null}
    </>
  );
}
