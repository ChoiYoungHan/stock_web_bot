import "server-only";

import type { CandleBar } from "@/types/fundamentals";
import type { ChartTimeframeId } from "@/types/chart-timeframe";

const BASE = "https://api.bithumb.com";

export interface BithumbTickerRow {
  opening_price: string;
  closing_price: string;
  min_price: string;
  max_price: string;
  units_traded: string;
  acc_trade_value: string;
  acc_trade_value_24H: string;
  fluctate_rate_24H: string;
  units_traded_24H?: string;
}

/** 빗썸 캔들 한 줄: [timestamp_ms, open, close, high, low, volume] (문자열 숫자) */
type BithumbCandleRow = [number, string, string, string, string, string];

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** 차트 타임프레임 → 빗썸 `chart_intervals` */
export function bithumbChartInterval(tf: ChartTimeframeId): string {
  switch (tf) {
    case "1m":
      return "1m";
    case "5m":
      return "5m";
    case "15m":
      return "15m";
    case "1h":
      return "1h";
    case "4h":
      return "4h";
    case "1d":
      return "24h";
    case "1wk":
      return "1w";
    default:
      return "24h";
  }
}

function candleTimeValue(ms: number, interval: string): CandleBar["time"] {
  const intraday = /^(1m|3m|5m|10m|15m|30m|1h|4h|6h|12h)$/.test(interval);
  if (intraday) return Math.floor(ms / 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function parseBithumbCandleRows(rows: BithumbCandleRow[], interval: string): CandleBar[] {
  const out: CandleBar[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const [ts, o, c, h, l, v] = row;
    const ms = typeof ts === "number" ? ts : Number(ts);
    if (!Number.isFinite(ms)) continue;
    out.push({
      time: candleTimeValue(ms, interval),
      open: num(o),
      high: num(h),
      low: num(l),
      close: num(c),
      volume: num(v),
    });
  }
  return out;
}

export async function fetchBithumbCandlestick(orderCurrency: string, interval: string): Promise<CandleBar[]> {
  const cur = orderCurrency.trim().toUpperCase();
  const url = `${BASE}/public/candlestick/${cur}_KRW/${encodeURIComponent(interval)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Bithumb candle HTTP ${res.status} ${cur}`);
  const j = (await res.json()) as { status?: string; data?: BithumbCandleRow[] };
  if (j.status !== "0000" || !Array.isArray(j.data)) {
    throw new Error(`Bithumb candle ${cur}/${interval}: status=${j.status}`);
  }
  return parseBithumbCandleRows(j.data, interval);
}

/** KRW 마켓 전종목 시세 (Public) */
export async function fetchBithumbAllKrwTickers(): Promise<Record<string, BithumbTickerRow>> {
  const res = await fetch(`${BASE}/public/ticker/ALL_KRW`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Bithumb ALL_KRW HTTP ${res.status}`);
  const j = (await res.json()) as { status?: string; data?: Record<string, BithumbTickerRow | string> };
  if (j.status !== "0000" || !j.data || typeof j.data !== "object") {
    throw new Error(`Bithumb ALL_KRW: status=${j.status}`);
  }
  const out: Record<string, BithumbTickerRow> = {};
  for (const [k, v] of Object.entries(j.data)) {
    if (k === "date" || !v || typeof v !== "object") continue;
    const row = v as BithumbTickerRow;
    if (typeof row.closing_price === "string") out[k] = row;
  }
  return out;
}

export async function fetchBithumbSingleTicker(orderCurrency: string): Promise<BithumbTickerRow> {
  const cur = orderCurrency.trim().toUpperCase();
  const res = await fetch(`${BASE}/public/ticker/${cur}_KRW`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Bithumb ticker HTTP ${res.status} ${cur}`);
  const j = (await res.json()) as { status?: string; data?: BithumbTickerRow };
  if (j.status !== "0000" || !j.data || typeof j.data !== "object") {
    throw new Error(`Bithumb ticker ${cur}: status=${j.status}`);
  }
  return j.data;
}

export function rankCryptoSymbolsByTradeValue24h(
  tickers: Record<string, BithumbTickerRow>,
  topN: number,
): string[] {
  const scored = Object.entries(tickers).map(([sym, row]) => ({
    sym,
    tv: num(row.acc_trade_value_24H),
  }));
  scored.sort((a, b) => b.tv - a.tv);
  return scored.filter((x) => x.tv > 0).slice(0, topN).map((x) => x.sym);
}
