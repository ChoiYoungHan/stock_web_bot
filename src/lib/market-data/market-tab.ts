import type { MarketTab } from "@/types/stock";

/** 쿼리 `market` → 탭. `coin` 별칭 허용 */
export function parseMarketTabParam(value: string | null | undefined): MarketTab {
  const v = value?.trim().toLowerCase();
  if (v === "us") return "us";
  if (v === "crypto" || v === "coin") return "crypto";
  return "domestic";
}
