"use client";

import { useEffect, useRef } from "react";
import type { ScannerStock } from "@/types/stock";

function stockKey(s: ScannerStock): string {
  return `${s.market}:${s.symbol}`;
}

export function useStrategyScanNotifications(opts: {
  enabled: boolean;
  /** 정렬된 전략 id 조합 — 선택이 바뀌면 이전 매칭 집합을 리셋 */
  strategyKey: string;
  /** 필터 결과 식별자(정렬된 symbol 키) — 내용이 같으면 문자열 동일 */
  filteredKey: string;
  filteredRows: ScannerStock[];
  marketLabel: string;
}): void {
  const { enabled, strategyKey, filteredKey, filteredRows, marketLabel } = opts;
  const primedRef = useRef(false);
  const prevRef = useRef<Set<string>>(new Set());
  const lastStrategyKeyRef = useRef<string>("");
  const rowsRef = useRef(filteredRows);
  rowsRef.current = filteredRows;

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof Notification === "undefined") {
      return;
    }

    if (!strategyKey) {
      primedRef.current = false;
      prevRef.current = new Set();
      lastStrategyKeyRef.current = "";
      return;
    }

    const rows = rowsRef.current;

    if (lastStrategyKeyRef.current !== strategyKey) {
      lastStrategyKeyRef.current = strategyKey;
      prevRef.current = new Set(rows.map(stockKey));
      primedRef.current = true;
      return;
    }

    const nowKeys = new Set(rows.map(stockKey));

    if (!primedRef.current) {
      prevRef.current = nowKeys;
      primedRef.current = true;
      return;
    }

    const prev = prevRef.current;
    const newcomers = rows.filter((r) => !prev.has(stockKey(r)));
    prevRef.current = nowKeys;

    if (newcomers.length === 0 || Notification.permission !== "granted") {
      return;
    }

    const title = `[${marketLabel}] 전략 신규 포착 ${newcomers.length}건`;
    const body = newcomers
      .slice(0, 8)
      .map((r) => `${r.symbol} ${r.name}`)
      .join(" · ");
    try {
      new Notification(title, { body, tag: "stock-scanner-strategy" });
    } catch {
      /* ignore */
    }
  }, [enabled, strategyKey, filteredKey, marketLabel]);
}
