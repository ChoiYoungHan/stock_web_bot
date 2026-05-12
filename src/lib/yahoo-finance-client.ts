import YahooFinance from "yahoo-finance2";

const g = globalThis as unknown as { __yahooFinance?: InstanceType<typeof YahooFinance> };

export function getYahooFinance(): InstanceType<typeof YahooFinance> {
  if (!g.__yahooFinance) {
    g.__yahooFinance = new YahooFinance();
  }
  return g.__yahooFinance;
}
