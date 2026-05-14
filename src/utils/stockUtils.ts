import type { MarketTab } from "@/types/stock";
import domesticKoreanNamesData from "@/data/domestic-korean-names.json";

/**
 * 소수 종목만 수동 보정(데이터 JSON보다 우선).
 * @see domestic-korean-names.json — `npm run build:korean-names`로 KOSPI200 전체 갱신
 */
export const DOMESTIC_KOREAN_NAMES: Record<string, string> = {
  "005930": "삼성전자",
  "000660": "SK하이닉스",
  "035420": "네이버",
  "035720": "카카오",
  "005380": "현대차",
  "006400": "삼성SDI",
  "051910": "LG화학",
  "068270": "셀트리온",
  "207940": "삼성바이오로직스",
  "012330": "현대모비스",
};

const DOMESTIC_NAMES_FROM_FILE = domesticKoreanNamesData as Record<string, string>;

function domesticKoreanDisplayName(localSix: string): string | undefined {
  const manual = DOMESTIC_KOREAN_NAMES[localSix];
  if (manual) return manual;
  return DOMESTIC_NAMES_FROM_FILE[localSix];
}

function normalizeSixDigit(symbol: string): string {
  const digits = symbol.replace(/\D/g, "").slice(-6);
  return digits.padStart(6, "0");
}

function stripCorporateSuffixEnglish(name: string): string {
  return name
    .replace(/\s*-?\s*ADR\s*$/i, "")
    .replace(/\s*,?\s*\bInc\.?\b\s*$/i, "")
    .replace(/\s*,?\s*\bCorp\.?\b\s*$/i, "")
    .replace(/\s*,?\s*\bCorporation\b\s*$/i, "")
    .replace(/\s*,?\s*\bPLC\b\s*$/i, "")
    .replace(/\s*,?\s*\bLtd\.?\s*$/i, "")
    .replace(/\s*,?\s*\bLP\b\s*$/i, "")
    .replace(/\s*,\s*(The|The\s\w+)\s*$/i, "")
    .trim();
}

/** 불필요한 거래소·티커 패턴 제거 */
export function sanitizeRawQuoteName(raw: string | undefined | null): string {
  if (raw == null) return "";
  let s = String(raw).replace(/\u00a0/g, " ").trim();
  s = s.replace(/\.KS$/i, "").replace(/\.KQ$/i, "");
  s = s.replace(/^(\d{6})\s*([-–:&.]?\s*)/, "").trim();
  s = stripCorporateSuffixEnglish(s);
  return s.replace(/\s{2,}/g, " ").trim();
}

function hasHangul(text: string): boolean {
  return /[\uAC00-\uD7A3]/.test(text);
}

/**
 * 카드·상세 타이틀용 종목 표시명. 국내는 `domestic-korean-names.json`·수동 매핑 우선.
 */
export function resolveDisplayStockName(
  rawShortOrLongName: string | undefined,
  market: MarketTab,
  localSymbol: string,
): string {
  const raw = sanitizeRawQuoteName(rawShortOrLongName);

  if (market === "crypto") {
    const s = localSymbol.trim().toUpperCase();
    if (raw.length > 0) return raw.length > 64 ? `${raw.slice(0, 61)}…` : raw;
    return `${s}/KRW`;
  }

  const local = market === "domestic" ? normalizeSixDigit(localSymbol) : localSymbol.split(".")[0]!.toUpperCase();

  if (market === "domestic") {
    const mapped = domesticKoreanDisplayName(local);
    if (mapped) return mapped;
    if (raw && hasHangul(raw)) return raw;
    return raw || local;
  }

  if (raw.length > 0) return raw.length > 64 ? `${raw.slice(0, 61)}…` : raw;
  return local;
}
