/** 명시 토큰으로 전송(스캔·수동 알림 공통). */
export async function sendTelegramRaw(
  text: string,
  token: string,
  chatId: string,
): Promise<{ ok: boolean; error?: string }> {
  const t = token.trim();
  const c = chatId.trim();
  if (!t || !c) {
    return { ok: false, error: "missing_telegram_env" };
  }
  const url = `https://api.telegram.org/bot${t}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: c, text: text.slice(0, 4000), disable_web_page_preview: true }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return { ok: false, error: err.slice(0, 200) };
  }
  return { ok: true };
}

async function postTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() ?? "";
  return sendTelegramRaw(text, token, chatId);
}

/** 수동 `/api/alert` — TELEGRAM_ALERT_ENABLED 게이트 */
export async function sendTelegramMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  const allow =
    process.env.TELEGRAM_ALERT_ENABLED === "1" ||
    process.env.TELEGRAM_ALERT_ENABLED === "true" ||
    process.env.TELEGRAM_ALERT_ENABLED === undefined;
  if (!allow) {
    return { ok: false, error: "telegram_alert_disabled" };
  }
  return postTelegram(text);
}

/** 5분 스캔 알림 — 서버에 봇 토큰이 있으면 기본 전송(TELEGRAM_SCAN_ALERTS=false 만 끔) */
export async function sendTelegramForScan(text: string): Promise<{ ok: boolean; error?: string }> {
  if (process.env.TELEGRAM_SCAN_ALERTS === "0" || process.env.TELEGRAM_SCAN_ALERTS === "false") {
    return { ok: false, error: "scan_alerts_disabled" };
  }
  return postTelegram(text);
}
