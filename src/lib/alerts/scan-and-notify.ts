import type { MarketTab } from "@/types/stock";
import { sendTelegramForScan } from "@/lib/alerts/telegram-send";
import { collectFullScannerPayload } from "@/lib/market-data/scanner-service";

const DEDUPE_MS = Number(process.env.SCAN_ALERT_DEDUPE_MS ?? 4 * 60 * 60 * 1000);

type DedupeStore = Map<string, number>;

function getDedupeMap(): DedupeStore {
  const g = globalThis as unknown as { __scanAlertDedupe?: DedupeStore };
  if (!g.__scanAlertDedupe) g.__scanAlertDedupe = new Map();
  return g.__scanAlertDedupe;
}

function shouldNotifyAgain(key: string): boolean {
  const map = getDedupeMap();
  const last = map.get(key) ?? 0;
  if (Date.now() - last < DEDUPE_MS) return false;
  map.set(key, Date.now());
  return true;
}

/**
 * 스캐너를 돌려 `reversalThesis`이면서 점수가 기준 이상인 종목에 텔레그램 알림.
 * 크론·로컬 타이머에서 주기 호출.
 */
export async function runScanBuyAlerts(market: MarketTab): Promise<{
  market: MarketTab;
  checked: number;
  candidates: number;
  sent: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const minScore = Number(process.env.SCAN_ALERT_MIN_REVERSAL_SCORE ?? 48);

  let payload;
  try {
    payload = await collectFullScannerPayload(market);
  } catch (e) {
    errors.push(String(e));
    return { market, checked: 0, candidates: 0, sent: 0, errors };
  }

  const rows = payload.rows;
  const hits = rows.filter((r) => {
    const q = r.quant;
    if (!q) return false;
    return q.flags.reversalThesis && q.reversalThesisScore >= minScore;
  });

  let sent = 0;
  for (const r of hits) {
    const key = `${r.market}:${r.symbol}`;
    if (!shouldNotifyAgain(key)) continue;

    const mLabel = r.market === "domestic" ? "국내" : r.market === "crypto" ? "코인" : "미국";
    const msg = [
      `[매수·전환 후보] ${mLabel} ${r.symbol} ${r.name}`,
      `전환점수 ${r.quant!.reversalThesisScore} / 퀀트 ${r.quant!.score} (신뢰도 ${r.quant!.confidence}%)`,
      `지수국면: ${r.quant!.regime}`,
    ].join("\n");

    const r2 = await sendTelegramForScan(msg);
    if (r2.ok) sent++;
    else errors.push(`${r.symbol}: ${r2.error ?? "send_failed"}`);
  }

  return { market, checked: rows.length, candidates: hits.length, sent, errors };
}

export async function runAllMarketScanAlerts(): Promise<Awaited<ReturnType<typeof runScanBuyAlerts>>[]> {
  const out: Awaited<ReturnType<typeof runScanBuyAlerts>>[] = [];
  out.push(await runScanBuyAlerts("domestic"));
  out.push(await runScanBuyAlerts("us"));
  out.push(await runScanBuyAlerts("crypto"));
  return out;
}
