import type { MarketTab } from "@/types/stock";
import { getDomesticScannerMappings } from "./domestic-symbols";

export function resolveYahooSymbol(symbol: string, market: MarketTab): string {
  const trimmed = symbol.trim();
  if (market === "us") {
    return trimmed.includes(".") ? trimmed : trimmed.toUpperCase();
  }
  if (trimmed.includes(".")) return trimmed;
  const hit = getDomesticScannerMappings().find((m) => m.local === trimmed);
  if (hit) return hit.yahoo;
  return `${trimmed}.KS`;
}

export function localSymbolFromYahoo(yahooSymbol: string, market: MarketTab): string {
  if (market === "us") return yahooSymbol.split(".")[0]!.toUpperCase();
  const base = yahooSymbol.replace(/\.(KS|KQ)$/i, "");
  const hit = getDomesticScannerMappings().find((m) => m.yahoo === yahooSymbol);
  return hit?.local ?? base;
}
