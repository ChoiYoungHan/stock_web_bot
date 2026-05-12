import { NextResponse } from "next/server";
import type { MarketTab } from "@/types/stock";
import { fetchStockDetailBundle } from "@/lib/market-data/fundamentals-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseMarket(value: string | null): MarketTab {
  return value === "us" ? "us" : "domestic";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim();
  const market = parseMarket(searchParams.get("market"));

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  try {
    const bundle = await fetchStockDetailBundle(symbol, market);
    return NextResponse.json(bundle);
  } catch (err) {
    console.error("[api/fundamentals]", err);
    return NextResponse.json({ error: "fundamentals fetch failed" }, { status: 502 });
  }
}
