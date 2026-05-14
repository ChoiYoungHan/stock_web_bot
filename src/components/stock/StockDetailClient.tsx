"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { MarketTab } from "@/types/stock";
import type { ChartTimeframeId } from "@/types/chart-timeframe";
import { useStockFundamentals } from "@/hooks/useStockFundamentals";
import { useStockChart } from "@/hooks/useStockChart";
import { useMarketRegime } from "@/hooks/useMarketRegime";
import { buildTechnicalAnalysisNarrative } from "@/lib/market-data/technical-analysis-comment";
import {
  DEFAULT_CHART_INDICATORS,
  loadChartIndicatorConfig,
  type ChartIndicatorConfig,
} from "@/types/chart-indicators";
import { computeQuantSnapshot, buildExpertTechnicalParagraph } from "@/utils/analysis";
import { AIEngineStrip } from "./AIEngineStrip";
import { StockChartPanel } from "./StockChartPanel";
import { FundamentalsGrid } from "./FundamentalsGrid";
import { IndicatorSettingsModal } from "./IndicatorSettingsModal";

interface StockDetailClientProps {
  symbol: string;
  market: MarketTab;
}

export function StockDetailClient({ symbol, market }: StockDetailClientProps) {
  const [timeframe, setTimeframe] = useState<ChartTimeframeId>("1d");
  const { data, isPending, isError } = useStockFundamentals(symbol, market);
  const chartQ = useStockChart(symbol, market, timeframe);
  const chartDailyQ = useStockChart(symbol, market, "1d", { enabled: timeframe !== "1d" });
  const regimeQ = useMarketRegime(market);
  const [indicatorOpen, setIndicatorOpen] = useState(false);
  const [indicatorConfig, setIndicatorConfig] = useState<ChartIndicatorConfig>(DEFAULT_CHART_INDICATORS);

  useEffect(() => {
    setIndicatorConfig(loadChartIndicatorConfig());
  }, []);

  const marketLabel =
    market === "domestic"
      ? "국내장 (KOSPI/KOSDAQ 상위 500)"
      : market === "crypto"
        ? "코인 (빗썸 KRW · 거래대금 상위)"
        : "미국장 (S&P 500)";
  const snap = data?.snapshot;
  const up = (snap?.changePercent ?? 0) >= 0;

  const quant = useMemo(() => {
    const candles =
      timeframe === "1d" ? chartQ.data?.candles : (chartDailyQ.data?.candles ?? chartQ.data?.candles);
    const regime = regimeQ.data ?? "neutral";
    if (!candles?.length || !snap) return null;
    const last = candles[candles.length - 1]!;
    const vols = candles.map((c) => c.volume ?? 0).filter((v) => v > 0);
    const avg10 =
      vols.length >= 10
        ? vols.slice(-10).reduce((a, b) => a + b, 0) / 10
        : vols.length > 0
          ? vols.reduce((a, b) => a + b, 0) / vols.length
          : snap.price * 1e-6;

    return computeQuantSnapshot({
      candles,
      lastPrice: snap.price,
      lastVolume: last.volume ?? 0,
      avgVolume10: avg10 > 0 ? avg10 : 1,
      regime,
      market,
    });
  }, [chartQ.data, chartDailyQ.data, timeframe, regimeQ.data, snap, market]);

  const technicalText = useMemo(() => {
    const candles =
      timeframe === "1d" ? chartQ.data?.candles : (chartDailyQ.data?.candles ?? chartQ.data?.candles);
    if (!candles?.length) return "";
    const closes = candles.map((c) => c.close);
    const indicatorBlock = buildTechnicalAnalysisNarrative(closes, snap?.price, indicatorConfig);
    if (!quant) return indicatorBlock;
    const expert = buildExpertTechnicalParagraph(quant);
    return `${expert}\n${indicatorBlock}`;
  }, [chartQ.data, chartDailyQ.data, timeframe, snap?.price, indicatorConfig, quant]);

  return (
    <main className="mx-auto min-h-dvh max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{marketLabel}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{snap?.name ?? symbol}</h1>
            <span className="font-mono text-sm text-muted">{symbol}</span>
          </div>
          {snap && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="font-mono text-xl font-semibold tabular-nums">
                {market === "domestic" || market === "crypto"
                  ? `${snap.price.toLocaleString("ko-KR")}원`
                  : `${snap.currency} ${snap.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-sm font-semibold ${
                  up ? "bg-positive/15 text-positive" : "bg-negative/15 text-negative"
                }`}
              >
                {up ? "+" : ""}
                {snap.changePercent.toFixed(2)}%
              </span>
              {quant != null && (
                <span className="rounded-md border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-xs font-semibold text-accent">
                  퀀트 {quant.score}점 · 신뢰도 {quant.confidence}%
                </span>
              )}
            </div>
          )}
        </div>
        <Link
          href={`/?market=${encodeURIComponent(market)}`}
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-card-border bg-[#1a1a1a] px-4 text-sm font-medium text-foreground transition hover:border-accent/50 hover:text-accent"
        >
          ← 대시보드
        </Link>
      </div>

      {isError && (
        <p className="mb-4 rounded-lg border border-negative/30 bg-negative/10 px-4 py-3 text-sm text-negative">
          종목 스냅샷을 불러오지 못했습니다. 심볼·시장을 확인하거나 잠시 후 다시 시도해 주세요.
        </p>
      )}

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-5 lg:items-start lg:gap-6">
        <div className="flex flex-col gap-6 lg:col-span-3">
          <AIEngineStrip
            technical={technicalText}
            fundamental={data?.narratives.fundamental ?? ""}
            loadingTechnical={chartQ.isPending || chartDailyQ.isPending || regimeQ.isPending}
            loadingFundamental={isPending}
          />
          <section
            aria-label="실시간 차트"
            className="rounded-xl border border-card-border bg-[#1a1a1a] p-4"
          >
            <h2 className="text-sm font-semibold text-foreground">차트</h2>
            <div className="mt-4">
              <StockChartPanel
                symbol={symbol}
                market={market}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
                indicatorConfig={indicatorConfig}
                onOpenIndicatorSettings={() => setIndicatorOpen(true)}
              />
            </div>
          </section>
        </div>

        <section
          aria-label="재무제표 및 밸류에이션"
          className="rounded-xl border border-card-border bg-[#1a1a1a] p-4 lg:col-span-2"
        >
          <h2 className="text-sm font-semibold text-foreground">핵심 재무 지표</h2>
          <div className="mt-4">
            <FundamentalsGrid metrics={data?.metrics} loading={isPending} />
          </div>
        </section>
      </div>

      <IndicatorSettingsModal
        open={indicatorOpen}
        onClose={() => setIndicatorOpen(false)}
        config={indicatorConfig}
        onSave={setIndicatorConfig}
      />
    </main>
  );
}
