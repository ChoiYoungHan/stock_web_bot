/**
 * KOSPI 200 구성표(위키)에서 6자리 코드를 추출해 Yahoo 티커 JSON을 생성합니다.
 * node scripts/build-domestic-kospi200.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

/** Yahoo 접미사가 .KQ인 종목(바이오·일부 이전 상장 등). 나머지 KOSPI 200 구성은 .KS */
const KQ_LOCAL = new Set(
  String(process.env.SCANNER_KOSDAQ_LOCAL_CODES ?? "068270,207940,373220")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

async function main() {
  const url =
    "https://en.wikipedia.org/w/api.php?action=parse&page=KOSPI_200&prop=wikitext&format=json";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`wiki ${res.status}`);
  const data = await res.json();
  const text = data?.parse?.wikitext?.["*"] ?? "";
  const sec = text.split("==Components==")[1]?.split("==See also==")[0] ?? text;
  const re = /\|\|\s*(\d{6})\s*\|\|/g;
  const locals = [];
  let m;
  while ((m = re.exec(sec)) !== null) {
    locals.push(m[1]);
  }
  const uniq = [...new Set(locals)];
  const rows = uniq.map((local) => ({
    local,
    yahoo: `${local}.${KQ_LOCAL.has(local) ? "KQ" : "KS"}`,
  }));
  const out = path.join(root, "src", "data", "domestic-kospi200.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(rows, null, 0));
  console.log("wrote", out, "count", rows.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
