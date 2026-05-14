import "server-only";

import type { ScannerStock } from "@/types/stock";
import type { MarketRegime } from "@/types/quant";
import { buildScannerTechnicalSnapshot } from "@/lib/market-data/scanner-technical-snapshot";
import { buildSignalsFromClosesAndQuote } from "@/lib/market-data/technical-analysis-comment";
import { computeQuantSnapshot } from "@/utils/analysis";
import { resolveDisplayStockName } from "@/utils/stockUtils";
import { mapWithConcurrency } from "@/lib/utils/promise-pool";
import {
  fetchBithumbAllKrwTickers,
  fetchBithumbCandlestick,
  rankCryptoSymbolsByTradeValue24h,
  type BithumbTickerRow,
} from "@/lib/market-data/bithumb-public";

function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function cryptoScannerTopN(): number {
  const v = Number(process.env.CRYPTO_SCANNER_TOP_N ?? 70);
  if (Number.isNaN(v)) return 70;
  return Math.max(20, Math.min(120, v));
}

const ROW_CONCURRENCY = Math.max(2, Math.min(12, Number(process.env.SCANNER_CANDLE_CONCURRENCY ?? 10)));

export class BithumbCryptoScannerSource {
  async getScannerRows(regime: MarketRegime): Promise<ScannerStock[]> {
    const tickers = await fetchBithumbAllKrwTickers();
    const symbols = rankCryptoSymbolsByTradeValue24h(tickers, cryptoScannerTopN());
    if (symbols.length === 0) return [];

    const rows = await mapWithConcurrency(symbols, ROW_CONCURRENCY, async (sym) => {
      const t: BithumbTickerRow = tickers[sym]!;
      let candles = [] as Awaited<ReturnType<typeof fetchBithumbCandlestick>>;
      try {
        candles = await fetchBithumbCandlestick(sym, "24h");
      } catch (e) {
        console.warn(`[BithumbCryptoScanner] 캔들 실패 ${sym}`, e);
      }

      const closes = candles.map((c) => c.close);
      const vols = candles.map((c) => c.volume ?? 0).filter((v) => v > 0);
      const lastVol = vols.length ? vols[vols.length - 1]! : num(t.units_traded);
      const avg10 =
        vols.length >= 10
          ? vols.slice(-10).reduce((a, b) => a + b, 0) / 10
          : vols.length > 0
            ? vols.reduce((a, b) => a + b, 0) / vols.length
            : Math.max(lastVol, 1e-12);

      const price = num(t.closing_price);
      const changePercent = num(t.fluctate_rate_24H);
      const quoteCtx = {
        regularMarketVolume: lastVol,
        averageDailyVolume10Day: avg10,
      };
      const { signals, signalSummary } = buildSignalsFromClosesAndQuote(closes, quoteCtx);
      const technical = closes.length >= 35 ? buildScannerTechnicalSnapshot(closes) : undefined;

      const name = resolveDisplayStockName(undefined, "crypto", sym);
      const tradeValue = num(t.acc_trade_value_24H);

      const quant = computeQuantSnapshot({
        candles,
        lastPrice: price,
        lastVolume: lastVol,
        avgVolume10: avg10 > 0 ? avg10 : 1,
        regime,
        market: "crypto",
      });

      return {
        symbol: sym,
        name,
        market: "crypto" as const,
        price,
        changePercent,
        signals,
        signalSummary,
        lastVolume: lastVol,
        tradeValue,
        technical,
        quant,
      } satisfies ScannerStock;
    });

    return rows.filter((r) => r.price > 0);
  }
}