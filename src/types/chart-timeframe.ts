/** Yahoo chart 모듈과 동일한 interval 문자열 */
export type YahooChartInterval =
  | "1m"
  | "2m"
  | "5m"
  | "15m"
  | "30m"
  | "60m"
  | "90m"
  | "1h"
  | "1d"
  | "5d"
  | "1wk"
  | "1mo"
  | "3mo";

export type ChartTimeframeId = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1wk";

export const CHART_TIMEFRAME_OPTIONS: { id: ChartTimeframeId; label: string; hint: string }[] = [
  { id: "1m", label: "1분", hint: "최근 약 5일·지연 적음" },
  { id: "5m", label: "5분", hint: "최근 약 60일" },
  { id: "15m", label: "15분", hint: "최근 약 90일" },
  { id: "1h", label: "1시간", hint: "최근 약 2년" },
  { id: "4h", label: "4시간", hint: "1시간봉 4개 묶음·근사" },
  { id: "1d", label: "일봉", hint: "1년 + 장중 일봉 보정" },
  { id: "1wk", label: "주봉", hint: "최대 약 15년" },
];

const ALLOWED = new Set<ChartTimeframeId>(CHART_TIMEFRAME_OPTIONS.map((o) => o.id));

export function parseChartTimeframe(value: string | null | undefined): ChartTimeframeId {
  const v = value?.trim().toLowerCase();
  if (v === "1w" || v === "1wk" || v === "week") return "1wk";
  if (v && ALLOWED.has(v as ChartTimeframeId)) return v as ChartTimeframeId;
  return "1d";
}

export type FetchPlan =
  | { kind: "daily_merge_intraday" }
  | { kind: "yahoo_single"; interval: YahooChartInterval; period1: Date; period2: Date; maxBars: number }
  | { kind: "yahoo_1h_then_bundle4" };

export function chartFetchPlan(tf: ChartTimeframeId): FetchPlan {
  const now = new Date();
  const ms = (d: number) => new Date(now.getTime() - d);

  switch (tf) {
    case "1m":
      return {
        kind: "yahoo_single",
        interval: "1m",
        period1: ms(5 * 86400000),
        period2: now,
        maxBars: 2000,
      };
    case "5m":
      return {
        kind: "yahoo_single",
        interval: "5m",
        period1: ms(60 * 86400000),
        period2: now,
        maxBars: 2500,
      };
    case "15m":
      return {
        kind: "yahoo_single",
        interval: "15m",
        period1: ms(90 * 86400000),
        period2: now,
        maxBars: 2500,
      };
    case "1h":
      return {
        kind: "yahoo_single",
        interval: "1h",
        period1: ms(730 * 86400000),
        period2: now,
        maxBars: 2500,
      };
    case "4h":
      return { kind: "yahoo_1h_then_bundle4" };
    case "1d":
      return { kind: "daily_merge_intraday" };
    case "1wk": {
      const period1 = new Date(now);
      period1.setFullYear(period1.getFullYear() - 15);
      return {
        kind: "yahoo_single",
        interval: "1wk",
        period1,
        period2: now,
        maxBars: 1200,
      };
    }
    default:
      return { kind: "daily_merge_intraday" };
  }
}
