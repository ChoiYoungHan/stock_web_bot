/** Wilder RSI(period). */
export function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 5) return null;
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) changes.push(closes[i]! - closes[i - 1]!);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const ch = changes[i]!;
    if (ch >= 0) avgGain += ch;
    else avgLoss -= ch;
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < changes.length; i++) {
    const ch = changes[i]!;
    const gain = ch > 0 ? ch : 0;
    const loss = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** 각 종가 인덱스별 RSI(미정 구간은 null). 첫 유효값은 인덱스 `period`. */
export function computeRSISeries(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = closes.map(() => null);
  if (closes.length < period + 1) return result;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i]! - closes[i - 1]!);
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    const ch = changes[i]!;
    if (ch >= 0) avgGain += ch;
    else avgLoss -= ch;
  }
  avgGain /= period;
  avgLoss /= period;

  let rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result[period] = rsi;

  for (let j = period; j < changes.length; j++) {
    const ch = changes[j]!;
    const gain = ch > 0 ? ch : 0;
    const loss = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result[j + 1] = rsi;
  }

  return result;
}

export function computeSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function computeEMA(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let ema = values[0]!;
  for (let i = 0; i < values.length; i++) {
    ema = i === 0 ? values[i]! : values[i]! * k + ema * (1 - k);
    out.push(ema);
  }
  return out;
}

/** 볼린저(period, 표준편차 배수). 종가 기준.%B 포함 */
export function computeBollinger(
  closes: number[],
  period = 20,
  mult = 2,
): { upper: number; middle: number; lower: number; pctB: number } | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((acc, v) => acc + (v - middle) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = middle + mult * sd;
  const lower = middle - mult * sd;
  const last = closes[closes.length - 1]!;
  const width = upper - lower || 1e-9;
  const pctB = (last - lower) / width;
  return { upper, middle, lower, pctB };
}

/** 표준 MACD 라인 및 시그널 라인 마지막 값 */
export function computeMACDSnapshot(closes: number[]): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < 40) return null;
  const ema12Series = computeEMA(closes, 12);
  const ema26Series = computeEMA(closes, 26);
  const macdLine = ema12Series.map((v, i) => v - ema26Series[i]!);
  const signalSeries = computeEMA(macdLine, 9);
  const n = macdLine.length - 1;
  const macd = macdLine[n]!;
  const signal = signalSeries[n]!;
  return { macd, signal, histogram: macd - signal };
}

/** MACD 히스토그램 시계열 (골든크로스 탐지용) */
export function computeMACDHistogramSeries(closes: number[]): number[] {
  if (closes.length < 40) return [];
  const ema12Series = computeEMA(closes, 12);
  const ema26Series = computeEMA(closes, 26);
  const macdLine = ema12Series.map((v, i) => v - ema26Series[i]!);
  const signalSeries = computeEMA(macdLine, 9);
  return macdLine.map((m, i) => m - signalSeries[i]!);
}
