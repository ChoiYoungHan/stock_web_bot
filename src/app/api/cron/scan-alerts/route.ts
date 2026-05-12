import { NextResponse } from "next/server";
import { runAllMarketScanAlerts } from "@/lib/alerts/scan-and-notify";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const h = request.headers.get("x-cron-secret");
  if (h === secret) return true;
  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;
  return false;
}

/** 5분마다 Vercel Cron 등에서 호출: 저점·추세전환 후보 텔레그램 알림 */
export async function GET(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const results = await runAllMarketScanAlerts();
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    console.error("[cron/scan-alerts]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
