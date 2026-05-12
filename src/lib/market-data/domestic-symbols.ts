import defaultKospi200 from "@/data/domestic-kospi200.json";

/** 로컬 6자리 종목코드 → Yahoo Finance 티커(거래소 접미사) */
export interface DomesticYahooMapping {
  local: string;
  yahoo: string;
}

/** 레거시·테스트용 최소 맵 */
export const DOMESTIC_SCANNER_MAP: DomesticYahooMapping[] = [
  { local: "005930", yahoo: "005930.KS" },
  { local: "000660", yahoo: "000660.KS" },
  { local: "035420", yahoo: "035420.KS" },
  { local: "035720", yahoo: "035720.KS" },
  { local: "005380", yahoo: "005380.KS" },
  { local: "006400", yahoo: "006400.KS" },
  { local: "051910", yahoo: "051910.KS" },
  { local: "068270", yahoo: "068270.KQ" },
  { local: "207940", yahoo: "207940.KQ" },
  { local: "012330", yahoo: "012330.KS" },
];

export function domesticMappingsFromEnv(): DomesticYahooMapping[] | null {
  const raw = process.env.SCANNER_DOMESTIC_SYMBOLS?.trim();
  if (!raw) return null;
  const pairs = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const out: DomesticYahooMapping[] = [];
  for (const p of pairs) {
    const [local, yahoo] = p.split(":").map((x) => x.trim());
    if (local && yahoo) out.push({ local, yahoo });
  }
  return out.length ? out : null;
}

/**
 * 우선순위: `SCANNER_DOMESTIC_SYMBOLS`(로컬:야후 쌍) → 기본 KOSPI 200 스냅샷.
 * 외부 JSON 전체 교체는 `SCANNER_DOMESTIC_UNIVERSE_PATH` — `scanner-service`에서 로드합니다.
 */
export function getDomesticScannerMappings(): DomesticYahooMapping[] {
  const fromPairs = domesticMappingsFromEnv();
  if (fromPairs) return fromPairs;
  return defaultKospi200 as DomesticYahooMapping[];
}
