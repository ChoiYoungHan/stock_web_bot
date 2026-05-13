export interface ChartIndicatorConfig {
  /** 단순이동평균 기간 (차트 오버레이, 최대 4개 권장) */
  maPeriods: number[];
  /** 볼린저 중심 기간 */
  bbPeriod: number;
  /** 볼린저 표준편차 배수 */
  bbStdMult: number;
  /** RSI 기간 */
  rsiPeriod: number;
  /** RSI 과매도 역통과(매수 시그널) 기준 */
  signalRsiBuy: number;
  /** RSI 과매수 역통과(매도 시그널) 기준 */
  signalRsiSell: number;
  /** (차트 마커 미사용) 이전 SMA 돌파 시그널 기간 — 설정 호환용 */
  signalMaCrossPeriod: number;
}

export const DEFAULT_CHART_INDICATORS: ChartIndicatorConfig = {
  maPeriods: [5, 20, 60, 120],
  bbPeriod: 20,
  bbStdMult: 2,
  rsiPeriod: 14,
  signalRsiBuy: 30,
  signalRsiSell: 70,
  signalMaCrossPeriod: 20,
};

const STORAGE_KEY = "chart-indicator-config-v1";

export function loadChartIndicatorConfig(): ChartIndicatorConfig {
  if (typeof window === "undefined") return DEFAULT_CHART_INDICATORS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CHART_INDICATORS;
    const p = JSON.parse(raw) as Partial<ChartIndicatorConfig>;
    return {
      maPeriods: Array.isArray(p.maPeriods) && p.maPeriods.length ? p.maPeriods.map(Number).filter((n) => n > 0) : DEFAULT_CHART_INDICATORS.maPeriods,
      bbPeriod: typeof p.bbPeriod === "number" && p.bbPeriod > 1 ? p.bbPeriod : DEFAULT_CHART_INDICATORS.bbPeriod,
      bbStdMult: typeof p.bbStdMult === "number" && p.bbStdMult > 0 ? p.bbStdMult : DEFAULT_CHART_INDICATORS.bbStdMult,
      rsiPeriod: typeof p.rsiPeriod === "number" && p.rsiPeriod > 1 ? p.rsiPeriod : DEFAULT_CHART_INDICATORS.rsiPeriod,
      signalRsiBuy: typeof p.signalRsiBuy === "number" ? p.signalRsiBuy : DEFAULT_CHART_INDICATORS.signalRsiBuy,
      signalRsiSell: typeof p.signalRsiSell === "number" ? p.signalRsiSell : DEFAULT_CHART_INDICATORS.signalRsiSell,
      signalMaCrossPeriod:
        typeof p.signalMaCrossPeriod === "number" && p.signalMaCrossPeriod > 1
          ? p.signalMaCrossPeriod
          : DEFAULT_CHART_INDICATORS.signalMaCrossPeriod,
    };
  } catch {
    return DEFAULT_CHART_INDICATORS;
  }
}

export function saveChartIndicatorConfig(c: ChartIndicatorConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}
