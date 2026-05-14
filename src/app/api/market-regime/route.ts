import { NextResponse } from "next/server";
import { resolveMarketRegime } from "@/lib/market-data/index-regime";
import { parseMarketTabParam } from "@/lib/market-data/market-tab";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = parseMarketTabParam(searchParams.get("market"));

  try {
    const regime = await resolveMarketRegime(market);
    return NextResponse.json({ market, regime });
  } catch (err) {
    console.error("[api/market-regime]", err);
    return NextResponse.json({ market, regime: "neutral" as const }, { status: 200 });
  }
}
