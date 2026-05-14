import "server-only";

import { getYahooFinance } from "@/lib/yahoo-finance-client";
import { chunkArray, mapWithConcurrency } from "@/lib/utils/promise-pool";

export type YahooQuoteLike = {
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
const QUOTE_CHUNK_CONCURRENCY = Math.max(1, Math.min(6, Number(process.env.SCANNER_QUOTE_CONCURRENCY ?? 3)));

/**
 * Yahoo `quote`는 심볼 수 제한이 있어 청크로 나누고, 청크 간에는 제한적 병렬로 호출합니다.
 */
export async function fetchYahooQuoteMap(symbols: string[]): Promise<Map<string, YahooQuoteLike>> {
  const yahoo = getYahooFinance();
  const quoteByKey = new Map<string, YahooQuoteLike>();
  if (symbols.length === 0) return quoteByKey;

  const chunks = chunkArray(symbols, QUOTE_CHUNK);
  await mapWithConcurrency(chunks, QUOTE_CHUNK_CONCURRENCY, async (chunk) => {
    try {
      const quotes = await yahoo.quote(chunk);
      const list = Array.isArray(quotes) ? quotes : [quotes];
      for (const raw of list) {
        const q = raw as YahooQuoteLike;
        const sym = String(q.symbol ?? "").toUpperCase();
        if (sym) quoteByKey.set(sym, q);
      }
    } catch (e) {
      console.warn("[yahoo-batch-quote] quote chunk 실패:", chunk.slice(0, 5), e);
    }
  });

  return quoteByKey;
}
