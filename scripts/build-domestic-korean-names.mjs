/**
 * 네이버 금융 종목 메인 og:title → 한글명 맵 생성 (KOSPI200 유니버스).
 * node scripts/build-domestic-korean-names.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const kospi = JSON.parse(fs.readFileSync(path.join(root, "src/data/domestic-kospi200.json"), "utf8"));
const locals = [...new Set(kospi.map((r) => r.local))];

const DELAY_MS = 400;

async function nameFromNaver(code) {
  const url = `https://finance.naver.com/item/main.naver?code=${code}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
  if (!m) return null;
  let t = m[1]
    .replace(/\s*-\s*Npay 증권.*$/i, "")
    .replace(/\s*:\s*Npay 증권.*$/i, "")
    .replace(/\s*-\s*네이버\s*증권.*$/i, "")
    .trim();
  return t || null;
}

async function main() {
  const out = {};
  for (let i = 0; i < locals.length; i++) {
    const code = locals[i];
    process.stderr.write(`\r${i + 1}/${locals.length} ${code}…`);
    try {
      const name = await nameFromNaver(code);
      if (name) out[code] = name;
    } catch (e) {
      console.error(`\nfail ${code}`, e);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  process.stderr.write("\n");
  const outPath = path.join(root, "src/data/domestic-korean-names.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 0));
  console.error("wrote", outPath, "keys", Object.keys(out).length, "/", locals.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
