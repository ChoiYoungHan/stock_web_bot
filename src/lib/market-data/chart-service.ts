import { getYahooFinance } from "@/lib/yahoo-finance-client";
import type { CandleBar, ChartResponse } from "@/types/fundamentals";
import { chartFetchPlan, type ChartTimeframeId, type YahooChartInterval } from "@/types/chart-timeframe";
import { bundleSequentialCandles } from "@/lib/chart/candle-time";

function toDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateKeyInTimeZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

type IntradayMergeInterval = "1m" | "5m";

function resolveIntradayMergeInterval(): IntradayMergeInterval {
  const v = process.env.YAHOO_INTRADAY_INTERVAL?.trim().toLowerCase();
  return v === "1m" ? "1m" : "5m";
}

function intradayMergePeriodStart(interval: IntradayMergeInterval): Date {
  const d = new Date();
  if (interval === "1m") {
    d.setTime(d.getTime() - 26 * 60 * 60 * 1000);
  } else {
    d.setTime(d.getTime() - 4 * 24 * 60 * 60 * 1000);
  }
  return d;
}

type RawChartBar = {
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

function aggregateIntradayForSession(sessionKey: string, quotes: RawChartBar[], timeZone: string): CandleBar | null {
  const dayBars = quotes.filter(
    (q) =>
      q.open != null &&
      q.high != null &&
      q.low != null &&
      q.close != null &&
      dateKeyInTimeZone(q.date, timeZone) === sessionKey,
  );
  if (!dayBars.length) return null;
  dayBars.sort((a, b) => a.date.getTime() - b.date.getTime());
  const first = dayBars[0]!;
  const last = dayBars[dayBars.length - 1]!;
  let high = -Infinity;
  let low = Infinity;
  let vol = 0;
  for (const b of dayBars) {
    high = Math.max(high, b.high!);
    low = Math.min(low, b.low!);
    vol += b.volume ?? 0;
  }
  return {
    time: sessionKey,
    open: first.open!,
    high,
    low,
    close: last.close!,
    volume: vol > 0 ? vol : undefined,
  };
}

function latestSessionKeyFromIntraday(quotes: RawChartBar[], timeZone: string): string | null {
  let max = "";
  for (const q of quotes) {
    if (q.open == null) continue;
    const k = dateKeyInTimeZone(q.date, timeZone);
    if (k > max) max = k;
  }
  return max || null;
}

function mergeLatestSessionIntradayIntoDaily(
  daily: CandleBar[],
  intradayQuotes: RawChartBar[],
  exchangeTimezone: string,
): CandleBar[] {
  if (!daily.length || !intradayQuotes.length) return daily;
  const tz = exchangeTimezone || "UTC";
  const sessionKey = latestSessionKeyFromIntraday(intradayQuotes, tz);
  if (!sessionKey) return daily;
  const merged = aggregateIntradayForSession(sessionKey, intradayQuotes, tz);
  if (!merged) return daily;

  const out = [...daily];
  const idx = out.findIndex((c) => c.time === sessionKey);
  if (idx >= 0) {
    out[idx] = merged;
    return out;
  }
  const last = out[out.length - 1]!;
  if (last.time < sessionKey) {
    out.push(merged);
    return out;
  }
  if (last.time === sessionKey) {
    out[out.length - 1] = merged;
    return out;
  }
  return daily;
}

async function fetchIntradaySessionBars(
  yahooSymbol: string,
  interval: IntradayMergeInterval,
): Promise<{ quotes: RawChartBar[]; exchangeTimezoneName: string }> {
  const yahoo = getYahooFinance();
  const period1 = intradayMergePeriodStart(interval);
  const period2 = new Date();

  const result = await yahoo.chart(yahooSymbol, {
    period1,
    period2,
    interval,
  });

  const quotes: RawChartBar[] = [];
  for (const q of result.quotes) {
    if (q.open == null || q.high == null || q.low == null || q.close == null || q.date == null) continue;
    quotes.push({
      date: q.date instanceof Date ? q.date : new Date(q.date as unknown as string),
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume ?? null,
    });
  }

  const exchangeTimezoneName =
    (result.meta as { exchangeTimezoneName?: string }).exchangeTimezoneName ?? "UTC";

  return { quotes, exchangeTimezoneName };
}

function parseQuoteDate(q: { date: Date | string | null }): Date | null {
  if (q.date == null) return null;
  return q.date instanceof Date ? q.date : new Date(String(q.date));
}

/** 일봉·주봉: 캘린더 문자열 */
function rawQuotesToDailyLikeCandles(quotes: RawChartBar[]): CandleBar[] {
  const candles: CandleBar[] = [];
  for (const q of quotes) {
    if (q.open == null || q.high == null || q.low == null || q.close == null) continue;
    const dt = parseQuoteDate(q);
    if (!dt) continue;
    candles.push({
      time: toDayString(dt),
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume ?? undefined,
    });
  }
  return candles;
}

/** 분~시간봉: Unix 초 (차트 라이브러리 호환) */
function rawQuotesToIntradayCandles(quotes: RawChartBar[]): CandleBar[] {
  const candles: CandleBar[] = [];
  for (const q of quotes) {
    if (q.open == null || q.high == null || q.low == null || q.close == null) continue;
    const dt = parseQuoteDate(q);
    if (!dt) continue;
    candles.push({
      time: Math.floor(dt.getTime() / 1000),
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume ?? undefined,
    });
  }
  return candles;
}

async function fetchChartDailyMerged(yahooSymbol: string): Promise<ChartResponse> {
  const yahoo = getYahooFinance();
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 1);

  const mergeIv = resolveIntradayMergeInterval();

  const [dailyResult, intra] = await Promise.all([
    yahoo.chart(yahooSymbol, {
      period1,
      interval: "1d",
    }),
    fetchIntradaySessionBars(yahooSymbol, mergeIv).catch((e) => {
      console.warn("[chart-service] intraday merge fetch failed:", yahooSymbol, e);
      return null as { quotes: RawChartBar[]; exchangeTimezoneName: string } | null;
    }),
  ]);

  const candles = rawQuotesToDailyLikeCandles(dailyResult.quotes as RawChartBar[]);

  const tz =
    intra?.exchangeTimezoneName ??
    (dailyResult.meta as { exchangeTimezoneName?: string }).exchangeTimezoneName ??
    "UTC";

  const merged =
    intra && intra.quotes.length ? mergeLatestSessionIntradayIntoDaily(candles, intra.quotes, tz) : candles;

  return {
    yahooSymbol: dailyResult.meta.symbol,
    currency: dailyResult.meta.currency,
    candles: merged,
    timeframe: "1d",
  };
}

async function fetchYahooSingleWindow(
  yahooSymbol: string,
  interval: YahooChartInterval,
  period1: Date,
  period2: Date,
  maxBars: number,
  timeframe: ChartTimeframeId,
  useDayStringTime: boolean,
): Promise<ChartResponse> {
  const yahoo = getYahooFinance();
  const result = await yahoo.chart(yahooSymbol, {
    period1,
    period2,
    interval,
  });

  const raw = result.quotes as RawChartBar[];
  let candles = useDayStringTime ? rawQuotesToDailyLikeCandles(raw) : rawQuotesToIntradayCandles(raw);
  candles.sort((a, b) => {
    const ta = typeof a.time === "number" ? a.time : new Date(a.time as string).getTime() / 1000;
    const tb = typeof b.time === "number" ? b.time : new Date(b.time as string).getTime() / 1000;
    return ta - tb;
  });
  if (candles.length > maxBars) candles = candles.slice(-maxBars);

  return {
    yahooSymbol: result.meta.symbol,
    currency: result.meta.currency,
    candles,
    timeframe,
  };
}

async function fetchFourHourFromHourly(yahooSymbol: string): Promise<ChartResponse> {
  const now = new Date();
  const period1 = new Date(now.getTime() - 730 * 86400000);
  const yahoo = getYahooFinance();
  const result = await yahoo.chart(yahooSymbol, {
    period1,
    period2: now,
    interval: "1h",
  });
  const hourly = rawQuotesToIntradayCandles(result.quotes as RawChartBar[]);
  const bundled = bundleSequentialCandles(hourly, 4);
  const maxBars = 2000;
  const candles = bundled.length > maxBars ? bundled.slice(-maxBars) : bundled;
  return {
    yahooSymbol: result.meta.symbol,
    currency: result.meta.currency,
    candles,
    timeframe: "4h",
  };
}

/**
 * 차트용 OHLCV. `timeframe`에 따라 Yahoo 허용 구간·간격을 맞추고, 가능한 한 `period2=현재`에 가깝게 조회합니다.
 * (Yahoo·종목별로 분봉 최장 구간이 더 짧을 수 있음.)
 */
export async function fetchChartCandles(
  yahooSymbol: string,
  timeframe: ChartTimeframeId = "1d",
): Promise<ChartResponse> {
  const plan = chartFetchPlan(timeframe);

  if (plan.kind === "daily_merge_intraday") {
    return fetchChartDailyMerged(yahooSymbol);
  }

  if (plan.kind === "yahoo_1h_then_bundle4") {
    return fetchFourHourFromHourly(yahooSymbol);
  }

  const useDayString = plan.interval === "1d" || plan.interval === "1wk";
  return fetchYahooSingleWindow(
    yahooSymbol,
    plan.interval,
    plan.period1,
    plan.period2,
    plan.maxBars,
    timeframe,
    useDayString,
  );
}

/** 지표 계산 전용 종가 배열(RSI 등 샘플 확보 위해 24개월) */
export async function fetchDailyClosePrices(yahooSymbol: string): Promise<number[]> {
  const yahoo = getYahooFinance();
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 2);

  const result = await yahoo.chart(yahooSymbol, {
    period1,
    interval: "1d",
  });

  const closes: number[] = [];
  for (const q of result.quotes) {
    if (q.close != null) closes.push(q.close);
  }
  return closes;
}

/** 스캐너 등에서 `fetchAnalysisCandles` 옵션으로 사용 */
export type FetchAnalysisCandlesOptions = {
  maxBars?: number;
  /**
   * `true`: 일봉만 조회(분봉 병합 생략). 유니버스 대량 스캔 시 Yahoo 호출·지연을 크게 줄임.
   * 상세 차트·종목 페이지는 기본(full) 유지.
   */
  light?: boolean;
};

/** OHLCV 일봉 (퀀트 스코어링·패턴용, 최근 maxBars) — 기본은 최신 세션 분봉 집계로 보정 */
export async function fetchAnalysisCandles(
  yahooSymbol: string,
  maxBarsOrOpts?: number | FetchAnalysisCandlesOptions,
): Promise<CandleBar[]> {
  let maxBars = 130;
  let light = false;
  if (typeof maxBarsOrOpts === "number") {
    maxBars = maxBarsOrOpts;
  } else if (maxBarsOrOpts != null && typeof maxBarsOrOpts === "object") {
    if (typeof maxBarsOrOpts.maxBars === "number") maxBars = maxBarsOrOpts.maxBars;
    if (maxBarsOrOpts.light === true) light = true;
  }

  const yahoo = getYahooFinance();
  const period1 = new Date();
  period1.setFullYear(period1.getFullYear() - 2);

  if (light) {
    const dailyResult = await yahoo.chart(yahooSymbol, {
      period1,
      interval: "1d",
    });
    const candles = rawQuotesToDailyLikeCandles(dailyResult.quotes as RawChartBar[]);
    if (candles.length > maxBars) return candles.slice(-maxBars);
    return candles;
  }

  const mergeIv = resolveIntradayMergeInterval();

  const [dailyResult, intra] = await Promise.all([
    yahoo.chart(yahooSymbol, {
      period1,
      interval: "1d",
    }),
    fetchIntradaySessionBars(yahooSymbol, mergeIv).catch((e) => {
      console.warn("[chart-service] intraday fetch failed (analysis):", yahooSymbol, e);
      return null as { quotes: RawChartBar[]; exchangeTimezoneName: string } | null;
    }),
  ]);

  const candles = rawQuotesToDailyLikeCandles(dailyResult.quotes as RawChartBar[]);

  const tz =
    intra?.exchangeTimezoneName ??
    (dailyResult.meta as { exchangeTimezoneName?: string }).exchangeTimezoneName ??
    "UTC";

  const merged =
    intra && intra.quotes.length ? mergeLatestSessionIntradayIntoDaily(candles, intra.quotes, tz) : candles;

  if (merged.length > maxBars) return merged.slice(-maxBars);
  return merged;
}
