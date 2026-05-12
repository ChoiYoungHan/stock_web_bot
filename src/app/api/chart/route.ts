import { NextResponse } from "next/server";
import type { MarketTab } from "@/types/stock";
import { parseChartTimeframe } from "@/types/chart-timeframe";
import { fetchChartForApi } from "@/services/stockService";
import { resolveYahooSymbol } from "@/lib/market-data/resolve-yahoo-symbol";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseMarket(value: string | null): MarketTab {
  return value === "us" ? "us" : "domestic";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim();
  const market = parseMarket(searchParams.get("market"));
  const timeframe = parseChartTimeframe(searchParams.get("timeframe"));

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const ySym = resolveYahooSymbol(symbol, market);
    const data = await fetchChartForApi(ySym, market, timeframe);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/chart]", err);
    return NextResponse.json({ error: "chart fetch failed" }, { status: 502 });
  }
}
