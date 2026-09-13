// ============================================================
// SENKRON MAÇ TESTİ — "rakip benden önce geçti" hatası
//
// Sahibi arkadaşıyla oynarken bulmuştu: hızlı cevaplayan oyuncu sonraki
// soruya rakibinden önce geçiyordu. Sunucu suçsuzdu (üç RPC de senkronu
// koruyor); kayma istemcideki GERİ BİLDİRİM PENCERESİNDEYDİ — pencere
// herkesin KENDİ cevap anından sayılıyordu.
//
// Bu test o hesabı React'siz yeniden kurar: iki oyuncu aynı soruyu
// farklı saniyelerde cevaplar, sunucu ilerlemeyi ikisine de aynı anda
// bildirir, sonraki sorunun ne zaman ekrana geldiğine bakılır.
//
// Çalıştır: node bildim/_test/mac-senkron-test.mjs
// ============================================================
const GB_MS = 1000;

/** Düzeltmeden ÖNCEKİ hesap: pencere kendi cevap anından sayılıyordu. */
function eskiHesap(simdi, kendiCevapAni) {
  return Math.max(0, GB_MS - (simdi - kendiCevapAni));
}

/** Düzeltmeden SONRAKİ hesap: senkronda pencere ilerlemenin görüldüğü
 *  andan sayılır; effect zaten o an çalışıyor. */
function yeniHesap(senkron, kendiIndeks, simdi, kendiCevapAni) {
  return senkron
    ? (kendiIndeks === 0 ? 0 : GB_MS)
    : Math.max(0, GB_MS - (simdi - kendiCevapAni));
}

let hata = 0;
const kontrol = (kosul, ad) => {
  if (kosul) { console.log("  ✓", ad); return; }
  console.error("  ✗", ad);
  hata++;
};

// ---- Senaryo: 3. soru. Hızlı oyuncu 2. sn'de, yavaş 14. sn'de cevaplıyor.
// Sunucu ikinci cevapta ilerletiyor (advance_match), ilerleme ikisine de
// aynı anda ulaşıyor: t = 14000.
const soruBasi = 0;
const hizliCevap = soruBasi + 2000;
const yavasCevap = soruBasi + 14000;
const ilerlemeAni = yavasCevap;   // sunucu burada ilerletti

console.log("1. Düzeltmeden ÖNCE (hatanın kendisi)");
{
  const hizliGecis = ilerlemeAni + eskiHesap(ilerlemeAni, hizliCevap);
  const yavasGecis = ilerlemeAni + eskiHesap(ilerlemeAni, yavasCevap);
  const fark = yavasGecis - hizliGecis;
  console.log(`     hızlı ${hizliGecis} ms · yavaş ${yavasGecis} ms · fark ${fark} ms`);
  kontrol(fark > 0, "eski hesapta hızlı oyuncu ÖNCE geçiyor (hata üretiliyor)");
  kontrol(fark === GB_MS, "fark tam GB_MS kadar (" + GB_MS + " ms)");
}

console.log("2. Düzeltmeden SONRA");
{
  const hizliGecis = ilerlemeAni + yeniHesap(true, 3, ilerlemeAni, hizliCevap);
  const yavasGecis = ilerlemeAni + yeniHesap(true, 3, ilerlemeAni, yavasCevap);
  console.log(`     hızlı ${hizliGecis} ms · yavaş ${yavasGecis} ms`);
  kontrol(hizliGecis === yavasGecis, "iki oyuncu sonraki soruyu AYNI anda görüyor");
}

console.log("3. Cevap anı ne olursa olsun eşitlik bozulmuyor");
{
  const anlar = [0, 500, 3000, 7500, 12000, 15000];
  const gecisler = anlar.map((a) => ilerlemeAni + yeniHesap(true, 5, ilerlemeAni, a));
  kontrol(new Set(gecisler).size === 1, "6 farklı cevap anı → tek geçiş anı");
}

console.log("4. İlk soruda bekleme yok (maç gecikmeden başlar)");
{
  kontrol(yeniHesap(true, 0, 0, 0) === 0, "kendiIndeks 0 → pencere 0 ms");
}

console.log("5. ESKİ ASENKRON maçlar bozulmadı");
{
  const a = yeniHesap(false, 3, 5000, 4500);
  const b = eskiHesap(5000, 4500);
  kontrol(a === b, "senkron=false iken davranış eskisiyle birebir aynı");
}

console.log(hata === 0 ? "\nSONUÇ: TEMİZ" : `\nSONUÇ: ${hata} hata`);
process.exit(hata === 0 ? 0 : 1);
