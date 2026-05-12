import { NextResponse } from "next/server";
import { sendTelegramRaw } from "@/lib/alerts/telegram-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type TelegramPayload = {
  botToken?: string;
  chatId?: string;
};

type AlertBody = {
  message: string;
  /** 선택: 클라이언트/서버에서 텔레그램으로 전달 시 사용 */
  telegram?: TelegramPayload;
};

/**
 * 알림 게이트웨이 스텁. 메시지 검증 후 텔레그램 봇 API 호출 구조만 제공합니다.
 * 실제 전송은 `TELEGRAM_ALERT_ENABLED=true` 일 때만 수행합니다.
 */
export async function POST(request: Request) {
  let body: AlertBody;
  try {
    body = (await request.json()) as AlertBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json({ ok: false, error: "message_required" }, { status: 400 });
  }

  const text = body.message.slice(0, 4000);
  const allowSend = process.env.TELEGRAM_ALERT_ENABLED === "1" || process.env.TELEGRAM_ALERT_ENABLED === "true";

  const token =
    body.telegram?.botToken?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  const chatId =
    body.telegram?.chatId?.trim() || process.env.TELEGRAM_CHAT_ID?.trim() || "";

  if (allowSend && token && chatId) {
    const sent = await sendTelegramRaw(text, token, chatId);
    if (!sent.ok) {
      return NextResponse.json(
        { ok: false, error: "telegram_send_failed", detail: sent.error ?? "" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, channel: "telegram" });
  }

  return NextResponse.json({
    ok: true,
    channel: "noop",
    hint: "Set TELEGRAM_ALERT_ENABLED=true and TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID to enable delivery.",
  });
}
