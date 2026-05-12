/** 조·억·만 표기 (통화 종류 무관하게 동일 규모만 표시. 단위 명시는 라벨/힌트로 구분). */
export function formatKoreanScaleNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const v = Math.abs(value);
  if (v >= 1e12) return `${sign}${(v / 1e12).toFixed(2)}조`;
  if (v >= 1e8) return `${sign}${(v / 1e8).toFixed(2)}억`;
  if (v >= 1e4) return `${sign}${(v / 1e4).toFixed(2)}만`;
  return `${sign}${v.toLocaleString()}`;
}
