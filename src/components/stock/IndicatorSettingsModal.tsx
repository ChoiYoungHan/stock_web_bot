"use client";

import type { ChartIndicatorConfig } from "@/types/chart-indicators";
import { saveChartIndicatorConfig } from "@/types/chart-indicators";

interface IndicatorSettingsModalProps {
  open: boolean;
  onClose: () => void;
  config: ChartIndicatorConfig;
  onSave: (c: ChartIndicatorConfig) => void;
}

export function IndicatorSettingsModal({ open, onClose, config, onSave }: IndicatorSettingsModalProps) {
  if (!open) return null;

  const submit = (form: FormData) => {
    const maRaw = String(form.get("maPeriods") ?? "");
    const maPeriods = maRaw
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => n > 0 && n < 500);
    const next: ChartIndicatorConfig = {
      maPeriods: maPeriods.length ? maPeriods : config.maPeriods,
      bbPeriod: Math.max(2, parseInt(String(form.get("bbPeriod")), 10) || config.bbPeriod),
      bbStdMult: Math.max(0.1, parseFloat(String(form.get("bbStdMult"))) || config.bbStdMult),
      rsiPeriod: Math.max(2, parseInt(String(form.get("rsiPeriod")), 10) || config.rsiPeriod),
      signalRsiBuy: parseFloat(String(form.get("signalRsiBuy"))) || config.signalRsiBuy,
      signalRsiSell: parseFloat(String(form.get("signalRsiSell"))) || config.signalRsiSell,
      signalMaCrossPeriod: Math.max(2, parseInt(String(form.get("signalMaCrossPeriod")), 10) || config.signalMaCrossPeriod),
    };
    saveChartIndicatorConfig(next);
    onSave(next);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="indicator-modal-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-card-border bg-[#1a1a1a] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="indicator-modal-title" className="text-base font-semibold text-foreground">
          지표 설정
        </h2>
        <p className="mt-1 text-xs text-muted">
          SMA 기간(쉼표 구분), 볼린저, RSI, 시그널 임계값. 저장 시 차트·기술적 분석에 반영됩니다.
        </p>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          <label className="block text-xs text-muted">
            SMA 기간
            <input
              name="maPeriods"
              defaultValue={config.maPeriods.join(", ")}
              className="mt-1 w-full rounded-lg border border-card-border bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-foreground"
            />
          </label>
          <label className="block text-xs text-muted">
            볼린저 기간
            <input
              name="bbPeriod"
              type="number"
              min={2}
              defaultValue={config.bbPeriod}
              className="mt-1 w-full rounded-lg border border-card-border bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-foreground"
            />
          </label>
          <label className="block text-xs text-muted">
            볼린저 σ
            <input
              name="bbStdMult"
              type="number"
              step="0.1"
              min={0.5}
              defaultValue={config.bbStdMult}
              className="mt-1 w-full rounded-lg border border-card-border bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-foreground"
            />
          </label>
          <label className="block text-xs text-muted">
            RSI 기간
            <input
              name="rsiPeriod"
              type="number"
              min={2}
              defaultValue={config.rsiPeriod}
              className="mt-1 w-full rounded-lg border border-card-border bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-foreground"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted">
              RSI 매수 역통과
              <input
                name="signalRsiBuy"
                type="number"
                step="0.5"
                defaultValue={config.signalRsiBuy}
                className="mt-1 w-full rounded-lg border border-card-border bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-foreground"
              />
            </label>
            <label className="block text-xs text-muted">
              RSI 매도 역통과
              <input
                name="signalRsiSell"
                type="number"
                step="0.5"
                defaultValue={config.signalRsiSell}
                className="mt-1 w-full rounded-lg border border-card-border bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-foreground"
              />
            </label>
          </div>
          <label className="block text-xs text-muted">
            종가·SMA 돌파 시그널 기간
            <input
              name="signalMaCrossPeriod"
              type="number"
              min={2}
              defaultValue={config.signalMaCrossPeriod}
              className="mt-1 w-full rounded-lg border border-card-border bg-[#0a0a0a] px-3 py-2 font-mono text-sm text-foreground"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-card-border px-4 py-2 text-sm text-foreground"
            >
              취소
            </button>
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
