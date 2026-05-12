"use client";

import type { ScannerStrategyId } from "@/types/quant";
import { SCANNER_STRATEGY_OPTIONS } from "@/types/quant";

interface StrategyPickerProps {
  selected: Set<ScannerStrategyId>;
  onChange: (next: Set<ScannerStrategyId>) => void;
}

export function StrategyPicker({ selected, onChange }: StrategyPickerProps) {
  const toggle = (id: ScannerStrategyId) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <section className="rounded-xl border border-card-border bg-[#1a1a1a] p-4" aria-label="전략 선택">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-foreground">전략 선택</h2>
        <p className="text-[11px] text-muted">선택한 조건은 AND로 결합됩니다.</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {SCANNER_STRATEGY_OPTIONS.map((opt) => {
          const on = selected.has(opt.id);
          return (
            <label
              key={opt.id}
              className={`inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                on
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-card-border bg-[#0a0a0a] text-muted hover:border-accent/40 hover:text-foreground"
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() => toggle(opt.id)}
              />
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                  on ? "border-accent bg-accent" : "border-muted"
                }`}
                aria-hidden
              >
                {on ? <span className="text-[10px] leading-none text-white">✓</span> : null}
              </span>
              {opt.label}
            </label>
          );
        })}
      </div>
    </section>
  );
}
