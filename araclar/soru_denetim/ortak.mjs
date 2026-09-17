// Soru denetim hattı — ortak: veritabanına Supabase CLI (devDependency) üzerinden bağlanır, yeni paket gerekmez.
// Bağlantı şifresi .env.local › SUPABASE_DB_PASSWORD (git'e girmez).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

export const KOK = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../..");
export const KLASOR = path.join(KOK, ".tmp", "soru_denetim");
const PROJE = "zfpnxzybcpkxsotwdsey";
const HOST = "aws-1-eu-central-1.pooler.supabase.com";

function sifre() {
  const dosya = path.join(KOK, ".env.local");
  if (!fs.existsSync(dosya)) throw new Error(".env.local bulunamadı (SUPABASE_DB_PASSWORD gerekli)");
  const satir = fs.readFileSync(dosya, "utf8").split(/\r?\n/).find((l) => l.startsWith("SUPABASE_DB_PASSWORD="));
  const deger = satir?.slice("SUPABASE_DB_PASSWORD=".length).trim();
  if (!deger) throw new Error(".env.local içinde SUPABASE_DB_PASSWORD yok");
  return deger;
}

/** SQL çalıştırır, satırları döner. Uzun metinler dosyayla gider (komut satırına girmez). */
export function sorgu(sql) {
  fs.mkdirSync(KLASOR, { recursive: true });
  const gecici = path.join(KLASOR, `_sorgu_${process.pid}.sql`);
  fs.writeFileSync(gecici, sql);   // CLI tek komut kabul eder (hazır ifade)
  const url = `postgresql://postgres.${PROJE}:${encodeURIComponent(sifre())}@${HOST}:5432/postgres`;
  try {
    const cikti = execFileSync(process.execPath,
      [path.join(KOK, "node_modules", "supabase", "dist", "supabase.js"), "db", "query", "--db-url", url, "-o", "json", "-f", gecici],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024 });
    const bas = cikti.indexOf("{");
    if (bas < 0) throw new Error("Beklenmeyen CLI çıktısı: " + cikti.slice(0, 300));
    return JSON.parse(cikti.slice(bas)).rows ?? [];
  } catch (e) {
    const ayrinti = (e.stderr || e.stdout || e.message || "").toString().replace(encodeURIComponent(sifre()), "***");
    throw new Error("Veritabanı sorgusu başarısız: " + ayrinti.slice(0, 1500));
  } finally {
    try { fs.unlinkSync(gecici); } catch (e) { console.warn("[soru_denetim] geçici dosya silinemedi:", e.message); }
  }
}

/** JSON'u SQL'e güvenli gömmek için benzersiz dolar-tırnak etiketi. */
export function jsonSabit(deger) {
  const metin = JSON.stringify(deger);
  let etiket;
  do { etiket = "j" + crypto.randomBytes(6).toString("hex"); } while (metin.includes(`$${etiket}$`));
  return `$${etiket}$${metin}$${etiket}$::jsonb`;
}
