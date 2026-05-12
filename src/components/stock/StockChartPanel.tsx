"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  LineSeries,
  LineStyle,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type LineData,
  type MouseEventParams,
  type Time,
} from "lightweight-charts";
import type { MarketTab } from "@/types/stock";
import type { CandleBar } from "@/types/fundamentals";
import type { ChartIndicatorConfig } from "@/types/chart-indicators";
import type { ChartTimeframeId } from "@/types/chart-timeframe";
import { CHART_TIMEFRAME_OPTIONS } from "@/types/chart-timeframe";
import { useStockChart } from "@/hooks/useStockChart";
import { ChartToolbar } from "./ChartToolbar";
import { candleSmaLineData } from "@/lib/chart/sma-line-data";
import { buildPineStyleMarkers } from "@/lib/chart/pine-style-markers";

const MAX_TREND_LINES = 6;

const MA_COLORS = ["#60a5fa", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#fb7185"];

function toSeriesData(candles: CandleBar[]): CandlestickData<Time>[] {
  return candles.map((c) => ({
    time: c.time as Time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

function isOhlc(d: unknown): d is CandlestickData<Time> {
  return (
    typeof d === "object" &&
    d !== null &&
    "open" in d &&
    "high" in d &&
    "low" in d &&
    "close" in d
  );
}

function sortLinePoints<T extends Time>(
  a: LineData<T>,
  b: LineData<T>,
): [LineData<T>, LineData<T>] {
  const ta = typeof a.time === "string" ? a.time : Number(a.time);
  const tb = typeof b.time === "string" ? b.time : Number(b.time);
  return ta <= tb ? [a, b] : [b, a];
}

interface StockChartPanelProps {
  symbol: string;
  market: MarketTab;
  timeframe: ChartTimeframeId;
  onTimeframeChange: (tf: ChartTimeframeId) => void;
  indicatorConfig: ChartIndicatorConfig;
  onOpenIndicatorSettings: () => void;
}

export function StockChartPanel({
  symbol,
  market,
  timeframe,
  onTimeframeChange,
  indicatorConfig,
  onOpenIndicatorSettings,
}: StockChartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const overlayLinesRef = useRef<ISeriesApi<"Line">[]>([]);
  const trendLinesRef = useRef<ISeriesApi<"Line">[]>([]);
  const pendingRef = useRef<{ time: Time; value: number } | null>(null);
  const fitKeyRef = useRef<string | null>(null);

  const { data, isPending, isError } = useStockChart(symbol, market, timeframe);

  const [magnetOn, setMagnetOn] = useState(false);
  const [trendToolOn, setTrendToolOn] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a0a" },
        textColor: "#a3a3a3",
      },
      grid: {
        vertLines: { color: "#262626" },
        horzLines: { color: "#262626" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#2a2a2a" },
      timeScale: { borderColor: "#2a2a2a" },
      width: el.clientWidth,
      height: 320,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    const markers = createSeriesMarkers(series);

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = markers;

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      chart.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
      overlayLinesRef.current = [];
      trendLinesRef.current = [];
      pendingRef.current = null;
      fitKeyRef.current = null;
    };
  }, [symbol, market]);

  useEffect(() => {
    chartRef.current?.applyOptions({
      crosshair: {
        mode: magnetOn ? CrosshairMode.MagnetOHLC : CrosshairMode.Normal,
      },
    });
  }, [magnetOn]);

  useEffect(() => {
    if (!trendToolOn) pendingRef.current = null;
  }, [trendToolOn]);

  useEffect(() => {
    const chart = chartRef.current;
    const main = seriesRef.current;
    if (!chart || !main) return;

    const onClick = (param: MouseEventParams<Time>) => {
      if (!trendToolOn) return;
      if (param.time === undefined || param.point === undefined) return;
      const bar = param.seriesData.get(main);
      if (!isOhlc(bar)) return;

      let price = bar.close;

      if (magnetOn) {
        const candidates = [bar.open, bar.high, bar.low, bar.close] as number[];
        let best = bar.close;
        let bestDy = Infinity;
        for (const p of candidates) {
          const c = main.priceToCoordinate(p);
          if (c === null) continue;
          const dy = Math.abs(c - param.point!.y);
          if (dy < bestDy) {
            bestDy = dy;
            best = p;
          }
        }
        price = best;
      }

      const t = param.time;
      const pt = pendingRef.current;
      if (!pt) {
        pendingRef.current = { time: t, value: price };
        return;
      }

      pendingRef.current = null;
      const p1: LineData<Time> = { time: pt.time, value: pt.value };
      const p2: LineData<Time> = { time: t, value: price };
      const [left, right] = sortLinePoints(p1, p2);

      const lineSeries = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: false,
      });

      lineSeries.setData([left, right]);

      trendLinesRef.current.push(lineSeries);
      if (trendLinesRef.current.length > MAX_TREND_LINES) {
        const old = trendLinesRef.current.shift();
        if (old) chart.removeSeries(old);
      }
    };

    chart.subscribeClick(onClick);
    return () => {
      chart.unsubscribeClick(onClick);
    };
  }, [trendToolOn, magnetOn]);

  useEffect(() => {
    const chart = chartRef.current;
    const main = seriesRef.current;
    const markersApi = markersRef.current;
    if (!chart || !main || !data?.candles.length) return;

    const candles = data.candles;
    main.setData(toSeriesData(candles));

    for (const l of overlayLinesRef.current) {
      chart.removeSeries(l);
    }
    overlayLinesRef.current = [];

    const periods = [...new Set(indicatorConfig.maPeriods)]
      .filter((p) => p > 0)
      .sort((a, b) => a - b)
      .slice(0, 6);

    periods.forEach((period, idx) => {
      const lineData = candleSmaLineData(candles, period);
      if (!lineData.length) return;
      const ls = chart.addSeries(LineSeries, {
        color: MA_COLORS[idx % MA_COLORS.length],
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      ls.setData(lineData);
      overlayLinesRef.current.push(ls);
    });

    const { bbPeriod, bbStdMult } = indicatorConfig;
    const closes = candles.map((c) => c.close);
    const upper: LineData<Time>[] = [];
    const middle: LineData<Time>[] = [];
    const lower: LineData<Time>[] = [];

    for (let i = bbPeriod - 1; i < candles.length; i++) {
      const slice = closes.slice(i - bbPeriod + 1, i + 1);
      const mid = slice.reduce((a, b) => a + b, 0) / bbPeriod;
      const variance = slice.reduce((acc, v) => acc + (v - mid) ** 2, 0) / bbPeriod;
      const sd = Math.sqrt(variance);
      const t = candles[i]!.time as Time;
      middle.push({ time: t, value: mid });
      upper.push({ time: t, value: mid + bbStdMult * sd });
      lower.push({ time: t, value: mid - bbStdMult * sd });
    }

    if (middle.length) {
      const u = chart.addSeries(LineSeries, {
        color: "#64748b",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      u.setData(upper);
      overlayLinesRef.current.push(u);

      const m = chart.addSeries(LineSeries, {
        color: "#475569",
        lineWidth: 1,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      m.setData(middle);
      overlayLinesRef.current.push(m);

      const lo = chart.addSeries(LineSeries, {
        color: "#64748b",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      lo.setData(lower);
      overlayLinesRef.current.push(lo);
    }

    markersApi?.setMarkers(buildPineStyleMarkers(candles, indicatorConfig));

    const fitKey = `${symbol}-${market}-${timeframe}`;
    if (fitKeyRef.current !== fitKey) {
      fitKeyRef.current = fitKey;
      chart.timeScale().fitContent();
    }
  }, [data, indicatorConfig, symbol, market, timeframe]);

  const handleZoomIn = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const mid = (range.from + range.to) / 2;
    const span = (range.to - range.from) * 0.75;
    ts.setVisibleLogicalRange({ from: mid - span / 2, to: mid + span / 2 });
  };

  const handleZoomOut = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const range = ts.getVisibleLogicalRange();
    if (!range) return;
    const mid = (range.from + range.to) / 2;
    const span = (range.to - range.from) * 1.35;
    ts.setVisibleLogicalRange({ from: mid - span / 2, to: mid + span / 2 });
  };

  const clearTrendLines = () => {
    const chart = chartRef.current;
    if (!chart) return;
    for (const ln of trendLinesRef.current) {
      chart.removeSeries(ln);
    }
    trendLinesRef.current = [];
    pendingRef.current = null;
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {CHART_TIMEFRAME_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            title={opt.hint}
            onClick={() => onTimeframeChange(opt.id)}
            className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
              timeframe === opt.id
                ? "border-accent/70 bg-accent/15 text-accent"
                : "border-card-border bg-[#141414] text-muted hover:border-accent/40 hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] leading-snug text-muted">
        Yahoo Finance 기준. 분봉은 종목·시장에 따라 제공 최장 구간이 짧을 수 있습니다. 4시간은 1시간봉 4개 연속 묶음입니다.
      </p>
      <ChartToolbar
        magnetOn={magnetOn}
        trendToolOn={trendToolOn}
        onToggleMagnet={() => setMagnetOn((v) => !v)}
        onToggleTrend={() => setTrendToolOn((v) => !v)}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={() => chartRef.current?.timeScale().fitContent()}
        onOpenIndicators={onOpenIndicatorSettings}
      />
      {(trendToolOn || magnetOn) && (
        <p className="text-[11px] text-muted">
          {trendToolOn && "추세선: 두 번 클릭해 구간을 지정합니다. "}
          {magnetOn && "자석: OHLC 스냅. "}
          {trendToolOn && (
            <button
              type="button"
              onClick={clearTrendLines}
              className="ml-2 rounded border border-card-border px-2 py-0.5 text-[10px] text-foreground hover:border-accent"
            >
              추세선 삭제
            </button>
          )}
        </p>
      )}
      <div
        ref={containerRef}
        className="relative w-full min-h-[280px] overflow-hidden rounded-lg border border-card-border bg-[#0a0a0a] sm:min-h-[320px]"
      >
        {isPending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0a0a]/80 text-sm text-muted">
            차트 로딩…
          </div>
        )}
        {isError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0a0a]/90 px-4 text-center text-sm text-negative">
            차트 데이터를 불러오지 못했습니다.
          </div>
        )}
      </div>
    </div>
  );
}
