import { getYahooFinance } from "@/lib/yahoo-finance-client";
import type { AnalysisNarratives, FundamentalMetrics, StockDetailBundle } from "@/types/fundamentals";
import type { MarketTab } from "@/types/stock";
import { resolveYahooSymbol } from "./resolve-yahoo-symbol";
import { resolveDisplayStockName } from "@/utils/stockUtils";

function num(n: unknown): number | null {
  if (n == null || typeof n !== "number" || Number.isNaN(n)) return null;
  return n;
}

function buildFundamentalNarrative(metrics: FundamentalMetrics): string {
  const ttm = metrics.trailingPE;
  const fwd = metrics.forwardPE;
  const pb = metrics.priceToBook;
  const roe = metrics.returnOnEquity;

  if (ttm == null && fwd == null && pb == null && roe == null) {
    return "공개된 PER·PBR·ROE 수치가 부족해 밸류에이션 총평을 내리기 어렵습니다.";
  }

  const hints: string[] = [];
  if (ttm != null && ttm > 0 && ttm < 12) hints.push(`PER(TTM) ${ttm.toFixed(1)}배로 업종 대비 낮은 편이라 저평가 가능성을 열어 둘 만합니다`);
  else if (ttm != null && ttm > 28) hints.push(`PER(TTM) ${ttm.toFixed(1)}배로 다소 높게 책정된 구간으로 보입니다`);
  else if (ttm != null) hints.push(`PER(TTM)은 ${ttm.toFixed(1)}배 수준입니다`);

  if (fwd != null && fwd > 0 && fwd < 14) hints.push(`선행 PER ${fwd.toFixed(1)}배는 기대 실적 대비 부담이 크지 않은 편입니다`);
  else if (fwd != null) hints.push(`선행 PER은 ${fwd.toFixed(1)}배입니다`);

  if (pb != null && pb > 0 && pb < 1) hints.push(`PBR ${pb.toFixed(2)}배로 장부가치 대비 할인 거래로 읽을 수 있습니다`);
  else if (pb != null && pb > 3.5) hints.push(`PBR ${pb.toFixed(2)}배로 자산가치 대비 프리미엄이 큽니다`);
  else if (pb != null) hints.push(`PBR은 ${pb.toFixed(2)}배입니다`);

  if (roe != null && roe > 0.12) hints.push(`ROE ${(roe * 100).toFixed(1)}%로 수익성은 양호한 편입니다`);
  else if (roe != null && roe < 0.05) hints.push(`ROE ${(roe * 100).toFixed(1)}%로 자본 대비 이익은 다소 약합니다`);
  else if (roe != null) hints.push(`ROE는 ${(roe * 100).toFixed(1)}%입니다`);

  const verdict =
    hints.some((h) => h.includes("저평가") || h.includes("할인") || h.includes("낮은 편"))
      ? "종합하면 지표만 놓고 보면 상대적으로 저평가 논의가 나올 수 있는 조합에 가깝습니다."
      : hints.some((h) => h.includes("높게") || h.includes("프리미엄"))
        ? "종합하면 밸류에이션 부담이 있다고 보는 편이 자연스럽습니다."
        : "종합하면 특이한 극단 밸류보다는 중간대에 가깝다고 볼 수 있습니다.";

  return `${hints.join(" · ")}. ${verdict}`;
}

export async function fetchStockDetailBundle(symbol: string, market: MarketTab): Promise<StockDetailBundle> {
  const ySym = resolveYahooSymbol(symbol, market);
  const yahoo = getYahooFinance();

  const [quote, summary] = await Promise.all([
    yahoo.quote(ySym),
    yahoo.quoteSummary(ySym, {
      modules: ["summaryDetail", "financialData", "defaultKeyStatistics", "price"],
    }),
  ]);

  const q = Array.isArray(quote) ? quote[0]! : quote;
  const price = num(q.regularMarketPrice) ?? 0;
  const changePercent = num(q.regularMarketChangePercent) ?? 0;
  const currency = String(q.currency ?? "USD");
  const rawName =
    (q.shortName as string | undefined) ??
    (q.longName as string | undefined) ??
    (q.displayName as string | undefined);

  const name = resolveDisplayStockName(rawName, market, symbol);

  const fd = summary.financialData;
  const dk = summary.defaultKeyStatistics;
  const sd = summary.summaryDetail;

  const metrics: FundamentalMetrics = {
    trailingPE: num(sd?.trailingPE ?? dk?.trailingPE),
    forwardPE: num(sd?.forwardPE ?? dk?.forwardPE),
    priceToBook: num(dk?.priceToBook ?? sd?.priceToBook),
    returnOnEquity: num(fd?.returnOnEquity ?? dk?.returnOnEquity),
    profitMargins: num(fd?.profitMargins),
    operatingMargins: num(fd?.operatingMargins),
    debtToEquity: num(fd?.debtToEquity),
    revenue: num(fd?.totalRevenue),
    revenueCurrency: fd?.financialCurrency ?? null,
  };

  const narratives: AnalysisNarratives = {
    technical: undefined,
    fundamental: buildFundamentalNarrative(metrics),
  };

  return {
    snapshot: {
      name,
      symbol,
      price,
      changePercent,
      currency,
    },
    metrics,
    narratives,
  };
}
