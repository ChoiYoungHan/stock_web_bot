import { NextResponse } from "next/server";
import { SCANNER_STRATEGY_OPTIONS, type ScannerStrategyId } from "@/types/quant";
import { buildScannerPayload } from "@/lib/market-data/scanner-service";
import { parseMarketTabParam } from "@/lib/market-data/market-tab";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_STRATEGIES = new Set<string>(SCANNER_STRATEGY_OPTIONS.map((o) => o.id));

function parseStrategies(param: string | null): ScannerStrategyId[] | undefined {
  if (!param?.trim()) return undefined;
  const parts = param.split(",").map((s) => s.trim()).filter(Boolean);
  const ids = parts.filter((p): p is ScannerStrategyId => VALID_STRATEGIES.has(p));
  return ids.length ? ids : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const market = parseMarketTabParam(searchParams.get("market"));
  const strategyIds = parseStrategies(searchParams.get("strategies"));

  try {
    const payload = await buildScannerPayload(market, { strategyIds });
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/scanner]", err);
    return NextResponse.json(
      { error: "스캐너 데이터를 가져오지 못했습니다.", market },
      { status: 502 },
    );
  }
}
