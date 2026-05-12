import { NextResponse } from "next/server";
import type { MarketTab } from "@/types/stock";
import { resolveMarketRegime } from "@/lib/market-data/index-regime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseMarket(value: string | null): MarketTab {
  return value === "us" ? "us" : "domestic";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = parseMarket(searchParams.get("market"));

  try {
    const regime = await resolveMarketRegime(market);
    return NextResponse.json({ market, regime });
  } catch (err) {
    console.error("[api/market-regime]", err);
    return NextResponse.json({ market, regime: "neutral" as const }, { status: 200 });
  }
}
