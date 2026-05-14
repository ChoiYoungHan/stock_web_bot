import "server-only";

import type { ScannerStock } from "@/types/stock";
import type { MarketRegime } from "@/types/quant";
import sp500Symbols from "@/data/sp500-symbols.json";
import { fetchAnalysisCandles } from "@/lib/market-data/chart-service";
import { buildScannerTechnicalSnapshot } from "@/lib/market-data/scanner-technical-snapshot";
import { buildSignalsFromClosesAndQuote } from "@/lib/market-data/technical-analysis-comment";
import { fetchYahooQuoteMap, type YahooQuoteLike } from "@/lib/market-data/yahoo-batch-quote";
import type { IUsSp500ScannerSource } from "./us-data-source";
import { resolveDisplayStockName } from "@/utils/stockUtils";
import { computeQuantSnapshot } from "@/utils/analysis";
import { mapWithConcurrency } from "@/lib/utils/promise-pool";

function normalizeYahooUsInput(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (s === "BRK.B") return "BRK-B";
  if (s === "BF.B") return "BF-B";
  return s;
}

function tickerFromYahooSymbol(ySym: string): string {
  const base = ySym.split(".")[0] ?? ySym;
  return base.toUpperCase();
}

function usScannerTickers(): string[] {
  const raw = process.env.SCANNER_US_SYMBOLS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => normalizeYahooUsInput(s))
      .filter(Boolean)
      .slice(0, 600);
  }
  return (sp500Symbols as string[]).map(normalizeYahooUsInput);
}

const ROW_CONCURRENCY = Math.max(2, Math.min(24, Number(process.env.SCANNER_CANDLE_CONCURRENCY ?? 10)));
const SCANNER_ANALYSIS_BARS = Math.max(80, Math.min(160, Number(process.env.SCANNER_ANALYSIS_MAX_BARS ?? 110)));

export class YahooUsSp500ScannerSource implements IUsSp500ScannerSource {
  async getScannerRows(regime: MarketRegime): Promise<ScannerStock[]> {
    const tickers = usScannerTickers();
    if (tickers.length === 0) return [];

    const quoteByKey = await fetchYahooQuoteMap(tickers);

    const rows = await mapWithConcurrency(tickers, ROW_CONCURRENCY, async (ticker) => {
      const q = quoteByKey.get(ticker.toUpperCase()) ?? ({} as YahooQuoteLike);
      const ySym = String(q.symbol ?? ticker);

      let candles = [] as Awaited<ReturnType<typeof fetchAnalysisCandles>>;
      try {
        candles = await fetchAnalysisCandles(ySym, { maxBars: SCANNER_ANALYSIS_BARS, light: true });
      } catch (e) {
        console.warn(`[YahooUsScanner] 일봉 조회 실패 ${ySym}`, e);
      }

      const closes = candles.map((c) => c.close);
      const quoteCtx = {
        regularMarketVolume: q.regularMarketVolume,
        averageDailyVolume10Day: q.averageDailyVolume10Day,
      };
      const { signals, signalSummary } = buildSignalsFromClosesAndQuote(closes, quoteCtx);
      const technical = closes.length >= 35 ? buildScannerTechnicalSnapshot(closes) : undefined;

      const price = q.regularMarketPrice ?? 0;
      const changePercent = q.regularMarketChangePercent ?? 0;
      const rawName = q.shortName ?? q.longName ?? q.displayName;
      const displayTicker = tickerFromYahooSymbol(ySym);

      const name = resolveDisplayStockName(String(rawName ?? ""), "us", displayTicker);

      const lastVol = q.regularMarketVolume ?? 0;
      const avg10Raw = q.averageDailyVolume10Day;
      const avg10 = avg10Raw != null && avg10Raw > 0 ? avg10Raw : lastVol > 0 ? lastVol : 1;

      const quant = computeQuantSnapshot({
        candles,
        lastPrice: price,
        lastVolume: lastVol,
        avgVolume10: avg10,
        regime,
        market: "us",
      });

      const tradeValue = price > 0 && lastVol > 0 ? price * lastVol : 0;

      return {
        symbol: displayTicker,
        name,
        market: "us" as const,
        price,
        changePercent,
        signals,
        signalSummary,
        technical,
        quant,
        lastVolume: lastVol,
        tradeValue,
      };
    });

    return rows.filter((r) => r.price > 0 || (r.quant?.score ?? 0) > 0);
  }
}
