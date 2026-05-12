const FIVE_MIN = 5 * 60 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_SCAN_ALERT_LOOP !== "true" && process.env.ENABLE_SCAN_ALERT_LOOP !== "1") return;
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim() || !process.env.TELEGRAM_CHAT_ID?.trim()) {
    console.warn("[instrumentation] ENABLE_SCAN_ALERT_LOOP set but TELEGRAM_BOT_TOKEN/CHAT_ID missing.");
    return;
  }

  // Edge 번들에 스캐너/fs 의존성이 정적으로 묶이지 않도록 동적 import만 사용합니다.
  const { runAllMarketScanAlerts } = await import("@/lib/alerts/scan-and-notify");

  const tick = () => {
    void runAllMarketScanAlerts()
      .then((r) => console.log("[scan-alerts]", JSON.stringify(r)))
      .catch(console.error);
  };
  tick();
  setInterval(tick, FIVE_MIN);
  console.log("[instrumentation] Scan alert loop started (5m interval).");
}
