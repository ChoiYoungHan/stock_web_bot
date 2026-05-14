import type { MarketTab, ScannerStock } from "@/types/stock";
import type { MarketRegime, ScannerStrategyId, QuantSnapshot } from "@/types/quant";
import { getMockScannerRows } from "@/lib/mock-scanner";
import { KisDomesticScannerSource } from "./providers/kis-scanner-source";
import { YahooDomesticScannerSource } from "./providers/yahoo-domestic-scanner";
import { YahooUsSp500ScannerSource } from "./providers/yahoo-us-sp500-scanner";
import { BithumbCryptoScannerSource } from "./providers/bithumb-crypto-scanner";
import { readKisEnv } from "./providers/kis-yahoo-types";
import { resolveMarketRegime } from "@/lib/market-data/index-regime";
import { getDomesticScannerMappings, type DomesticYahooMapping } from "@/lib/market-data/domestic-symbols";
import { rowPassesStrategyAnd } from "@/utils/analysis";

export type ScannerDataSourceTag = "yahoo" | "kis" | "mock" | "bithumb";

export interface ScannerPayload {
  market: MarketTab;
  updatedAt: number;
  rows: ScannerStock[];
  source: ScannerDataSourceTag;
  marketRegime: MarketRegime;
}

export interface BuildScannerPayloadOptions {
  /** 비어 있으면 대시보드 기본(전환 점수 컷 + 상위 N). 지정 시 해당 전략 AND 필터 후 상한 적용 */
  strategyIds?: ScannerStrategyId[];
}

function allowMockFallback(): boolean {
  return process.env.SCANNER_FALLBACK_MOCK === "1" || process.env.SCANNER_FALLBACK_MOCK === "true";
}

/** Edge에서는 파일을 읽지 않습니다(`fs` 미지원). Node 런타임에서만 `SCANNER_DOMESTIC_UNIVERSE_PATH` 적용. */
function tryLoadDomesticUniverseFile(filePath: string): DomesticYahooMapping[] | null {
  if (process.env.NEXT_RUNTIME === "edge") return null;
  try {
    // Edge 번들에 `fs` 정적 import가 섞이지 않도록 런타임 require만 사용합니다.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const raw = fs.readFileSync(abs, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data) || data.length === 0) return null;
    const out: DomesticYahooMapping[] = [];
    for (const row of data) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const local = typeof r.local === "string" ? r.local.trim() : "";
      const yahoo = typeof r.yahoo === "string" ? r.yahoo.trim() : "";
      if (local.length === 6 && yahoo.includes(".")) out.push({ local, yahoo });
    }
    return out.length ? out : null;
  } catch (e) {
    console.warn("[scanner] SCANNER_DOMESTIC_UNIVERSE_PATH 로드 실패:", e);
    return null;
  }
}

async function resolveDomesticMappingsForScanner(): Promise<DomesticYahooMapping[]> {
  const fileEnv = process.env.SCANNER_DOMESTIC_UNIVERSE_PATH?.trim();
  if (fileEnv) {
    const fromFile = tryLoadDomesticUniverseFile(fileEnv);
    if (fromFile) return fromFile;
  }
  return getDomesticScannerMappings();
}

function enrichMockRows(rows: ScannerStock[], regime: MarketRegime): ScannerStock[] {
  return rows.map((r, i) => {
    const flags = {
      liquidityOk: i !== 7,
      oversoldBounce: i % 3 === 0,
      macdGoldenCross: i % 4 === 0,
      volumeSurge: i % 2 === 0,
      bbLowerSupport: i === 1 || i === 5,
      strongBullishClose: i === 0,
      dojiReversal: i === 3,
      maSlopeBullish: i < 5,
      bullishDivergence: i === 2,
      nearSwingLow: i % 5 !== 1,
      trendBreakUp: i % 3 === 1,
      reversalThesis: i % 4 !== 0,
      liquidityTopTier: i === 0,
    };
    const score =
      (flags.liquidityOk ? 12 : 0) +
      (flags.oversoldBounce ? 16 : 0) +
      (flags.macdGoldenCross ? 22 : 0) +
      (flags.volumeSurge ? 14 : 0) +
      (flags.bbLowerSupport ? 14 : 0) +
      (flags.strongBullishClose ? 10 : 0) +
      (flags.dojiReversal ? 8 : 0) +
      (flags.maSlopeBullish ? 12 : 0) +
      (flags.bullishDivergence ? 18 : 0) +
      (flags.liquidityTopTier ? 10 : 0);
    const reversalThesisScore = Math.min(
      100,
      (flags.nearSwingLow ? 22 : 0) +
        (flags.trendBreakUp ? 28 : 0) +
        (flags.oversoldBounce ? 18 : 0) +
        (flags.bullishDivergence ? 16 : 0) +
        (flags.bbLowerSupport ? 14 : 0),
    );
    const quant: QuantSnapshot = {
      score,
      confidence: Math.min(96, 48 + (score % 40)),
      regime,
      flags,
      rationale: ["데모 멀티팩터 시뮬레이션."],
      reversalThesisScore,
    };
    return { ...r, quant };
  });
}

async function getDomesticRowsWithSource(
  regime: MarketRegime,
): Promise<{ rows: ScannerStock[]; source: ScannerDataSourceTag }> {
  const preferKis =
    process.env.DOMESTIC_DATA_SOURCE === "kis" || process.env.DOMESTIC_DATA_SOURCE === "KIS";

  if (preferKis && readKisEnv()) {
    try {
      const rows = await new KisDomesticScannerSource().getScannerRows(regime);
      return { rows, source: "kis" };
    } catch (err) {
      console.warn("[scanner] KIS domestic source failed, falling back to Yahoo:", err);
    }
  }

  const domesticMap = await resolveDomesticMappingsForScanner();
  const rows = await new YahooDomesticScannerSource(domesticMap).getScannerRows(regime);
  return { rows, source: "yahoo" };
}

async function getCryptoRowsWithSource(regime: MarketRegime): Promise<{ rows: ScannerStock[]; source: ScannerDataSourceTag }> {
  const rows = await new BithumbCryptoScannerSource().getScannerRows(regime);
  return { rows, source: "bithumb" };
}

async function getUsRowsWithSource(regime: MarketRegime): Promise<{ rows: ScannerStock[]; source: ScannerDataSourceTag }> {
  const rows = await new YahooUsSp500ScannerSource().getScannerRows(regime);
  return { rows, source: "yahoo" };
}

function sortScannerRows(rows: ScannerStock[]): ScannerStock[] {
  return [...rows].sort((a, b) => {
    const ra = a.quant?.reversalThesisScore ?? 0;
    const rb = b.quant?.reversalThesisScore ?? 0;
    if (rb !== ra) return rb - ra;
    return (b.quant?.score ?? 0) - (a.quant?.score ?? 0);
  });
}

const TOP_TIER_BONUS = 12;

/** 동일 스캔 유니버스에서 거래대금 상위 20%에 가산점 및 플래그 부여 */
function applyTradeValueTopTier(rows: ScannerStock[]): ScannerStock[] {
  const values = rows.map((r) => r.tradeValue ?? 0).filter((v) => v > 0);
  if (values.length < 5) {
    return rows.map((r) => {
      if (!r.quant) return r;
      return {
        ...r,
        quant: {
          ...r.quant,
          flags: { ...r.quant.flags, liquidityTopTier: false },
        },
      };
    });
  }
  const sorted = [...values].sort((a, b) => a - b);
  const cutIdx = Math.floor((sorted.length - 1) * 0.8);
  const threshold = sorted[cutIdx] ?? 0;

  return rows.map((r) => {
    const tv = r.tradeValue ?? 0;
    const top = tv >= threshold && tv > 0;
    if (!r.quant) return r;
    if (!top) {
      return {
        ...r,
        quant: {
          ...r.quant,
          flags: { ...r.quant.flags, liquidityTopTier: false },
        },
      };
    }
    if (r.quant.flags.liquidityTopTier && r.quant.rationale.some((x) => x.includes("상위 20%"))) {
      return r;
    }
    return {
      ...r,
      quant: {
        ...r.quant,
        score: r.quant.score + TOP_TIER_BONUS,
        confidence: Math.min(99, r.quant.confidence + 2),
        flags: { ...r.quant.flags, liquidityTopTier: true },
        rationale: [...r.quant.rationale, "거래대금 상위 20% 유니버스 내 티어(가산점)."],
      },
    };
  });
}

function scannerMinReversalDisplayScore(): number {
  const v = Number(process.env.SCANNER_MIN_REVERSAL_DISPLAY_SCORE ?? 40);
  if (Number.isNaN(v)) return 40;
  return Math.max(0, Math.min(100, v));
}

function scannerDashboardTopN(): number {
  const v = Number(process.env.SCANNER_DASHBOARD_TOP_N ?? 20);
  if (Number.isNaN(v)) return 20;
  return Math.max(10, Math.min(100, v));
}

function scannerStrategyResultCap(): number {
  const v = Number(process.env.SCANNER_STRATEGY_RESULT_CAP ?? 50);
  if (Number.isNaN(v)) return 50;
  return Math.max(10, Math.min(200, v));
}

/** 전 유니버스 분석·정렬(텔레그램 스캔 등에서 사용). */
export async function collectFullScannerPayload(market: MarketTab): Promise<ScannerPayload> {
  const regime = await resolveMarketRegime(market);

  try {
    const { rows: rawRows, source } =
      market === "domestic"
        ? await getDomesticRowsWithSource(regime)
        : market === "crypto"
          ? await getCryptoRowsWithSource(regime)
          : await getUsRowsWithSource(regime);
    const tiered = applyTradeValueTopTier(rawRows);
    const rows = sortScannerRows(tiered);
    return {
      market,
      updatedAt: Date.now(),
      rows,
      source,
      marketRegime: regime,
    };
  } catch (err) {
    console.error("[scanner] primary source failed:", err);
    if (allowMockFallback()) {
      const rows = sortScannerRows(applyTradeValueTopTier(enrichMockRows(getMockScannerRows(market), regime)));
      return {
        market,
        updatedAt: Date.now(),
        rows,
        source: "mock",
        marketRegime: regime,
      };
    }
    throw err;
  }
}

function applyDashboardPresentation(sortedRows: ScannerStock[], strategyIds?: ScannerStrategyId[]): ScannerStock[] {
  const minRev = scannerMinReversalDisplayScore();
  const topN = scannerDashboardTopN();
  const stratCap = scannerStrategyResultCap();

  if (!strategyIds?.length) {
    return sortedRows.filter((r) => (r.quant?.reversalThesisScore ?? 0) >= minRev).slice(0, topN);
  }

  const sel = new Set(strategyIds);
  return sortedRows.filter((r) => rowPassesStrategyAnd(sel, r)).slice(0, stratCap);
}

/** 대시보드·API용: 전 유니버스 분석 후 기본 컷·상위 N 또는 전략 필터 적용 */
export async function buildScannerPayload(
  market: MarketTab,
  opts?: BuildScannerPayloadOptions,
): Promise<ScannerPayload> {
  const full = await collectFullScannerPayload(market);
  return {
    ...full,
    rows: applyDashboardPresentation(full.rows, opts?.strategyIds),
  };
}
