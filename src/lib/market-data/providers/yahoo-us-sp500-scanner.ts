import "server-only";

import type { ScannerStock } from "@/types/stock";
import type { MarketRegime } from "@/types/quant";
import sp500Symbols from "@/data/sp500-symbols.json";
import { fetchAnalysisCandles } from "@/lib/market-data/chart-service";
import { buildScannerTechnicalSnapshot } from "@/lib/market-data/scanner-technical-snapshot";
import { buildSignalsFromClosesAndQuote } from "@/lib/market-data/technical-analysis-comment";
import { getYahooFinance } from "@/lib/yahoo-finance-client";
import type { IUsSp500ScannerSource } from "./us-data-source";
import { resolveDisplayStockName } from "@/utils/stockUtils";
import { computeQuantSnapshot } from "@/utils/analysis";
import { chunkArray, mapWithConcurrency } from "@/lib/utils/promise-pool";

type YahooQuoteLike = {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  averageDailyVolume10Day?: number;
  shortName?: string;
  longName?: string;
  displayName?: string;
};

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

const QUOTE_CHUNK = Math.max(20, Math.min(120, Number(process.env.SCANNER_QUOTE_CHUNK_SIZE ?? 80)));
const ROW_CONCURRENCY = Math.max(2, Math.min(24, Number(process.env.SCANNER_CANDLE_CONCURRENCY ?? 10)));

export class YahooUsSp500ScannerSource implements IUsSp500ScannerSource {
  async getScannerRows(regime: MarketRegime): Promise<ScannerStock[]> {
    const tickers = usScannerTickers();
    if (tickers.length === 0) return [];

    const yahoo = getYahooFinance();
    const quoteByKey = new Map<string, YahooQuoteLike>();

    for (const chunk of chunkArray(tickers, QUOTE_CHUNK)) {
      try {
        const quotes = await yahoo.quote(chunk);
        const list = Array.isArray(quotes) ? quotes : [quotes];
        for (const raw of list) {
          const q = raw as YahooQuoteLike;
          const sym = String(q.symbol ?? "").toUpperCase();
          if (sym) quoteByKey.set(sym, q);
        }
      } catch (e) {
        console.warn("[YahooUsScanner] quote chunk 실패:", chunk.slice(0, 5), e);
      }
    }

    const rows = await mapWithConcurrency(tickers, ROW_CONCURRENCY, async (ticker) => {
      const q = quoteByKey.get(ticker.toUpperCase()) ?? {};
      const ySym = String(q.symbol ?? ticker);

      let candles = [] as Awaited<ReturnType<typeof fetchAnalysisCandles>>;
      try {
        candles = await fetchAnalysisCandles(ySym, 130);
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
