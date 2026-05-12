import "server-only";

import type { ScannerStock } from "@/types/stock";
import type { MarketRegime } from "@/types/quant";
import { fetchAnalysisCandles } from "@/lib/market-data/chart-service";
import { buildScannerTechnicalSnapshot } from "@/lib/market-data/scanner-technical-snapshot";
import { buildSignalsFromClosesAndQuote } from "@/lib/market-data/technical-analysis-comment";
import { getYahooFinance } from "@/lib/yahoo-finance-client";
import type { DomesticYahooMapping } from "@/lib/market-data/domestic-symbols";
import { localSymbolFromYahoo } from "@/lib/market-data/resolve-yahoo-symbol";
import type { IDomesticQuoteScannerSource } from "./domestic-data-source";
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

const QUOTE_CHUNK = Math.max(20, Math.min(120, Number(process.env.SCANNER_QUOTE_CHUNK_SIZE ?? 80)));
const ROW_CONCURRENCY = Math.max(2, Math.min(24, Number(process.env.SCANNER_CANDLE_CONCURRENCY ?? 10)));

/** Edge 번들에 `fs`가 섞이지 않도록, 유니버스 맵은 호출 측(`scanner-service`)에서만 준비합니다. */
export class YahooDomesticScannerSource implements IDomesticQuoteScannerSource {
  readonly id = "yahoo" as const;

  constructor(private readonly domesticMap: DomesticYahooMapping[]) {}

  async getScannerRows(regime: MarketRegime): Promise<ScannerStock[]> {
    const map = this.domesticMap;
    const ySymbols = map.map((m) => m.yahoo);
    const yahoo = getYahooFinance();

    const quoteByYahoo = new Map<string, YahooQuoteLike>();
    for (const chunk of chunkArray(ySymbols, QUOTE_CHUNK)) {
      try {
        const quotes = await yahoo.quote(chunk);
        const list = Array.isArray(quotes) ? quotes : [quotes];
        for (const raw of list) {
          const q = raw as YahooQuoteLike;
          const sym = String(q.symbol ?? "").toUpperCase();
          if (sym) quoteByYahoo.set(sym, q);
        }
      } catch (e) {
        console.warn("[YahooDomesticScanner] quote chunk 실패:", chunk.slice(0, 5), e);
      }
    }

    const rows = await mapWithConcurrency(map, ROW_CONCURRENCY, async (m) => {
      const ySym = m.yahoo;
      const local = m.local;
      const q = quoteByYahoo.get(ySym.toUpperCase()) ?? {};

      let candles = [] as Awaited<ReturnType<typeof fetchAnalysisCandles>>;
      try {
        candles = await fetchAnalysisCandles(ySym, 130);
      } catch (e) {
        console.warn(`[YahooDomesticScanner] 일봉 조회 실패 ${ySym}`, e);
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
      const ySymResolved = String(q.symbol ?? ySym);
      const localResolved = localSymbolFromYahoo(ySymResolved, "domestic") || local;

      const name = resolveDisplayStockName(String(rawName ?? ""), "domestic", localResolved);

      const lastVol = q.regularMarketVolume ?? 0;
      const avg10Raw = q.averageDailyVolume10Day;
      const avg10 = avg10Raw != null && avg10Raw > 0 ? avg10Raw : lastVol > 0 ? lastVol : 1;

      const quant = computeQuantSnapshot({
        candles,
        lastPrice: price,
        lastVolume: lastVol,
        avgVolume10: avg10,
        regime,
        market: "domestic",
      });

      const tradeValue = price > 0 && lastVol > 0 ? price * lastVol : 0;

      return {
        symbol: localResolved,
        name,
        market: "domestic" as const,
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
