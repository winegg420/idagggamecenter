// Quiz Tactics — Claude API ile soru üretimi
// Çağrı: POST, header "x-cron-secret: <CRON_SECRET>"
// Gerekli secret'lar: ANTHROPIC_API_KEY, CRON_SECRET
// (SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY otomatik sağlanır)
//
// ============================================================================
// NEDEN YENİDEN YAZILDI (denetimde bulunan iki kök neden)
//
// 1) HEDEF_HAVUZ = 200 TOPLAM havuz eşiğiydi. Havuzda 11.422 soru olduğu için
//    fonksiyon her çağrıda "Havuz dolu" deyip çıkıyordu — saatlik cron aylardır
//    hiçbir şey üretmiyordu. Eşik artık KATEGORİ BAŞINA.
//
// 2) Kategori enum'ı 7 değerdi: ["genel","tarih","cografya","bilim","sanat",
//    "spor","edebiyat"]. Gerçek kategoriler 10 ve arada sinema/muzik/teknoloji
//    YOKTU — o üç kategoriye hiç soru üretilmiyordu. Ayrıca "genel" değeri
//    get_categories tarafından gizleniyor (genel + karisik birleştirilmiş),
//    yani oraya üretilen soru oyuncuya HİÇ görünmezdi.
//
// "karisik" bir kategori DEĞİL, "kategori seçme" filtresidir (bkz.
// get_categories: `kategori not in ('genel','karisik')`). Enum'a konmadı.
// ============================================================================

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

import { KATEGORILER, normalize, nedenGecersiz, type Soru } from "./kalite.ts";
import {
  ceviriIstemi, ceviriSemasi, geriKontrolIstemi, geriKontrolSemasi, karar,
  type CeviriCiktisi, type DilKurali, type GeriKontrolCiktisi, type KaynakSoru,
} from "./ceviri.ts";

// ============================================================================
// ÇEVİRİ HATTI (Aşama 2C, Bölüm D) — ayrıntı ve kurallar ceviri.ts başında.
// Yeni üretilen her soru hedef dillere (oyun_ayarlari.ceviri_hedef_diller)
// bağlamla çevrilir, makine kontrollerinden ve GERİ KONTROLDEN geçer; geçemeyen
// ceviri_atlanan'a sebebiyle yazılır. Süre yetmezse soru çevirisiz kalır ve
// ceviri_uyari_raporu()'nda görünür; geriye dönük çalıştırma onu işler:
//   POST {"mod":"ceviri","dil":"en","adet":20}              → bekleyenleri çevirir ve yazar
//   POST {"mod":"ceviri","dil":"en","adet":10,"kuru":true}  → çevirisi OLAN rastgele sorularda
//        hattı çalıştırır, HİÇBİR ŞEY YAZMAZ (kalite ölçümü)
// ============================================================================

type Istemci = ReturnType<typeof createClient>;

async function ayarOku<T>(supabase: Istemci, anahtar: string, varsayilan: T): Promise<T> {
  try {
    const { data, error } = await supabase.from("oyun_ayarlari").select("deger").eq("anahtar", anahtar).maybeSingle();
    if (error || !data) return varsayilan;
    return (data.deger as T) ?? varsayilan;
  } catch {
    return varsayilan;
  }
}

async function dilKurallari(supabase: Istemci, diller: string[]): Promise<DilKurali[]> {
  if (!diller.length) return [];
  const { data, error } = await supabase
    .from("ceviri_dil_kurallari")
    .select("dil, ad, kurallar, ondalik, binlik, sozluk, atilacak")
    .eq("aktif", true)
    .in("dil", diller);
  if (error) throw new Error("ceviri_dil_kurallari okunamadı: " + error.message);
  return (data ?? []) as DilKurali[];
}

/** Yapılandırılmış çıktılı tek çağrı; hata/ret/kesilme → throw (çağıran yakalar). */
async function jsonCagri<T>(anthropic: Anthropic, istem: { system: string; user: string }, sema: object): Promise<T> {
  const yanit = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system: istem.system,
    messages: [{ role: "user", content: istem.user }],
    output_config: { format: { type: "json_schema", schema: sema } },
  });
  if (yanit.stop_reason === "refusal") throw new Error("model reddetti");
  if (yanit.stop_reason === "max_tokens") throw new Error("yanıt kesildi (max_tokens)");
  const metin = yanit.content.find((b) => b.type === "text");
  if (!metin || metin.type !== "text") throw new Error("modelden metin gelmedi");
  return JSON.parse(metin.text) as T;
}

type HatOzeti = {
  dil: string; toplam: number; yazilan: number; atlanan: Record<string, number>;
  geri_kontrol_yakaladi: number; makine_yakaladi: number; cevrilemez: number;
  hata: string[]; ornekler: unknown[];
};

/**
 * Bir dil için hat: parti parti ÇEVİR → makine kontrolü → GERİ KONTROL → yaz / atla.
 * kuru=true: hiçbir şey yazılmaz; `mevcut` alanı varsa örneklere eklenir (karşılaştırma).
 */
async function cevirHatti(o: {
  supabase: Istemci; anthropic: Anthropic; kural: DilKurali; sorular: (KaynakSoru & { mevcut_soru?: string })[];
  parti: number; esik: number; kuru: boolean; bitisMs: number;
}): Promise<HatOzeti> {
  const oz: HatOzeti = { dil: o.kural.dil, toplam: o.sorular.length, yazilan: 0, atlanan: {}, geri_kontrol_yakaladi: 0, makine_yakaladi: 0, cevrilemez: 0, hata: [], ornekler: [] };
  for (let bas = 0; bas < o.sorular.length; bas += o.parti) {
    if (Date.now() > o.bitisMs) { oz.hata.push(`süre sınırı: ${o.sorular.length - bas} soru sonraya kaldı`); break; }
    const grup = o.sorular.slice(bas, bas + o.parti);
    let ceviriler: CeviriCiktisi[] = [];
    let cevaplar: GeriKontrolCiktisi[] = [];
    try {
      ceviriler = (await jsonCagri<{ ceviriler: CeviriCiktisi[] }>(o.anthropic, ceviriIstemi(o.kural, grup), ceviriSemasi)).ceviriler ?? [];
      // Geri kontrole yalnız çevrilebilir olanlar gider; Türkçe ve doğru indeks GÖNDERİLMEZ.
      const aday = ceviriler
        .filter((c) => c.cevrilebilir && Array.isArray(c.secenekler) && c.secenekler.length)
        .map((c) => ({ no: c.no, soru: c.soru, secenekler: c.secenekler.map((s) => s.metin) }));
      if (aday.length) {
        cevaplar = (await jsonCagri<{ cevaplar: GeriKontrolCiktisi[] }>(o.anthropic, geriKontrolIstemi(o.kural, aday), geriKontrolSemasi)).cevaplar ?? [];
      }
    } catch (e) {
      // Geçici API hatası: soru atlanmış SAYILMAZ, sonraki çalıştırmada yeniden denenir.
      oz.hata.push(`parti ${bas / o.parti + 1}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    for (let no = 0; no < grup.length; no++) {
      const q = grup[no];
      const c = ceviriler.find((x) => x.no === no);
      const gk = cevaplar.find((x) => x.no === no);
      const k = karar(q, c, gk, o.kural, o.esik);
      if (!k.tamam) {
        oz.atlanan[k.kod] = (oz.atlanan[k.kod] ?? 0) + 1;
        if (k.kod.startsWith("geri_kontrol")) oz.geri_kontrol_yakaladi++;
        else if (k.kod === "cevrilemez") oz.cevrilemez++;
        else oz.makine_yakaladi++;
      }
      if (o.kuru) {
        oz.ornekler.push({ id: q.id, kaynak: q.soru, dogru: q.dogru_cevap, mevcut: q.mevcut_soru, sonuc: k.tamam ? { soru: k.soru, secenekler: k.secenekler } : { kod: k.kod, neden: k.neden, ayrinti: k.ayrinti }, geri_kontrol: gk ?? null });
        continue;
      }
      try {
        if (k.tamam) {
          const { error } = await o.supabase.from("question_translations")
            .upsert({ question_id: q.id, dil: o.kural.dil, soru: k.soru, secenekler: k.secenekler }, { onConflict: "question_id,dil" });
          if (error) {
            // qt_dogrula tetikleyicisi reddetti → kalıcı sorun, atlanır
            oz.atlanan["db_dogrulama"] = (oz.atlanan["db_dogrulama"] ?? 0) + 1; oz.makine_yakaladi++;
            await o.supabase.from("ceviri_atlanan").upsert({ question_id: q.id, dil: o.kural.dil, kod: "db_dogrulama", neden: error.message.slice(0, 300) }, { onConflict: "question_id,dil" });
          } else oz.yazilan++;
        } else {
          const { error } = await o.supabase.from("ceviri_atlanan")
            .upsert({ question_id: q.id, dil: o.kural.dil, kod: k.kod, neden: k.neden, ayrinti: k.ayrinti ?? null }, { onConflict: "question_id,dil" });
          if (error) oz.hata.push(`atlanan yazılamadı (${q.id}): ${error.message}`);
        }
      } catch (e) {
        oz.hata.push(`yazma (${q.id}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return oz;
}

/** Kategori başına hedef aktif soru sayısı. Altındaki kategoriye üretilir. */
const KATEGORI_HEDEFI = 1000;
/** Her çağrıda üretilecek soru sayısı. */
const PARTI_BOYU = 15;

const questionSchema = {
  type: "object",
  properties: {
    sorular: {
      type: "array",
      items: {
        type: "object",
        properties: {
          soru: { type: "string" },
          secenekler: { type: "array", items: { type: "string" } },
          dogru_cevap: { type: "integer", enum: [0, 1, 2, 3] },
          kategori: { type: "string", enum: [...KATEGORILER] },
        },
        required: ["soru", "secenekler", "dogru_cevap", "kategori"],
        additionalProperties: false,
      },
    },
  },
  required: ["sorular"],
  additionalProperties: false,
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const baslangic = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Gövde isteğe bağlı: cron boş gönderir (üretim), elle tetikleme {"mod":"ceviri",…}
  let govde: { mod?: string; dil?: string; adet?: number; kuru?: boolean } = {};
  try { govde = await req.json(); } catch { govde = {}; }

  const ceviriAyarlari = async () => ({
    parti: Math.max(1, Number(await ayarOku(supabase, "ceviri_parti_boyu", 10))),
    esik: Number(await ayarOku(supabase, "ceviri_benzerlik_esigi", 0.9)),
    sureSn: Number(await ayarOku(supabase, "ceviri_sure_siniri_sn", 100)),
    diller: (await ayarOku<string[]>(supabase, "ceviri_hedef_diller", ["en"])) ?? [],
  });

  // --- GERİYE DÖNÜK / KURU ÇEVİRİ (elle tetiklenir) --------------------------
  if (govde?.mod === "ceviri") {
    try {
      const anahtarC = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anahtarC) return Response.json({ hata: "ANTHROPIC_API_KEY tanımlı değil" }, { status: 500 });
      const ay = await ceviriAyarlari();
      const [kural] = await dilKurallari(supabase, [String(govde.dil ?? "en")]);
      if (!kural) return Response.json({ hata: `aktif dil kuralı yok: ${govde.dil}` }, { status: 400 });
      const adet = Math.max(1, Math.min(Number(govde.adet ?? ay.parti), 50));
      const { data, error } = await supabase.rpc(govde.kuru ? "ceviri_ornek_sorular" : "ceviri_bekleyen_sorular", { p_dil: kural.dil, p_adet: adet });
      if (error) return Response.json({ hata: error.message }, { status: 500 });
      const ozet = await cevirHatti({
        supabase, anthropic: new Anthropic({ apiKey: anahtarC }), kural, sorular: data ?? [],
        parti: ay.parti, esik: ay.esik, kuru: !!govde.kuru, bitisMs: baslangic + ay.sureSn * 1000,
      });
      return Response.json({ mod: "ceviri", kuru: !!govde.kuru, ...ozet });
    } catch (e) {
      return Response.json({ hata: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  // --- Hangi kategori en aç? -----------------------------------------------
  const sayimlar: Record<string, number> = {};
  for (const k of KATEGORILER) {
    const { count } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("aktif", true)
      .eq("kategori", k);
    sayimlar[k] = count ?? 0;
  }

  let hedefKategori: string | null = null;
  let enAz = Number.POSITIVE_INFINITY;
  for (const k of KATEGORILER) {
    if (sayimlar[k] < KATEGORI_HEDEFI && sayimlar[k] < enAz) {
      enAz = sayimlar[k];
      hedefKategori = k;
    }
  }

  if (!hedefKategori) {
    return Response.json({
      uretildi: 0,
      mesaj: "Tüm kategoriler hedefte",
      hedef: KATEGORI_HEDEFI,
      sayimlar,
    });
  }

  // --- Tekrarı önle: HEDEF KATEGORİNİN tüm soruları --------------------------
  // (Eskiden yalnız en yeni 300 soru veriliyordu ve kategori ayrımı yoktu.)
  const { data: mevcut } = await supabase
    .from("questions")
    .select("soru")
    .eq("kategori", hedefKategori)
    .limit(5000);

  const mevcutMetinler = (mevcut ?? []).map((q) => q.soru as string);
  const mevcutNorm = new Set(mevcutMetinler.map(normalize));
  // İstem uzamasın diye modele en fazla 400 örnek gösteriliyor; asıl eleme
  // aşağıda normalize edilmiş küme ile SUNUCUDA yapılıyor.
  const ornekListe = mevcutMetinler.slice(-400).join("\n");

  const anahtar = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anahtar) {
    return Response.json(
      { hata: "ANTHROPIC_API_KEY tanımlı değil", hedefKategori, sayimlar },
      { status: 500 },
    );
  }
  const anthropic = new Anthropic({ apiKey: anahtar });

  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    system:
      "Türkçe, doğruluğundan %100 emin olduğun bilgi yarışması soruları üret. " +
      "ZORLUK: meraklı bir yetişkinin bilebileceği ama düşünmeden veremeyeceği " +
      "seviyede olsun. İlkokul düzeyi genel bilgi SORMA (kaç mevsim vardır, " +
      "kalp ne işe yarar, X ülkesinin başkenti gibi). Tanımı sormak yerine " +
      "ayrıntıyı, ilişkiyi ya da istisnayı sor. " +
      "4 şık olsun ve şıklar birbirinden net ayrılsın. " +
      "Şıklardan yalnızca biri kesin doğru olmalı; diğerleri makul ama kesinlikle yanlış çeldiriciler olmalı. " +
      // Havuz denetiminde ölçülen kök neden: model doğru cevabı uzun ve
      // özenli, çeldiricileri tek kelimeyle yazıyordu. Sonuç: "soruyu
      // okumadan en uzun şıkkı seç" %68,1 kazanıyordu (rastlantı ~%25).
      "ŞIK UZUNLUĞU KRİTİK: dört şık da birbirine yakın uzunlukta ve aynı " +
      "dilbilgisi kalıbında yazılmalı. Doğru şık diğerlerinden uzun OLMAMALI — " +
      "uzunluk cevabı ele vermemeli. Çeldiriciyi tek kelimeyle geçiştirme; " +
      "doğru cevapla aynı ayrıntı düzeyinde yaz. Konuyu bilmeyen biri " +
      "yalnızca şıkların biçimine bakarak doğruyu ayırt edememeli. " +
      "Çeldiriciler gerçekten makul olmalı: açıkça saçma ya da alakasız " +
      "seçenek koyma. " +
      "Cevap sorunun metninde geçmesin. " +
      // Bir soruda şıklar "Attar / Sadi / Hafız / Cami" (dördü de İranlı
      // şair) idi; otomatik çeviri "Cami"yi ibadethane sanıp "Mosque"
      // yazınca şık anlamsızlaştı. Kural hem üretimde hem çeviride geçerli.
      "ÖZEL İSİMLER ASLA ÇEVRİLMEZ: kişi, yer, eser ve marka adlarını " +
      "uluslararası yazımıyla bırak (şair Cami → Jami, Mosque DEĞİL; " +
      "Kaz Dağları → Kaz Mountains, Goose Mountains DEĞİL). " +
      "'Aşağıdakilerden hangisi yanlıştır/değildir' gibi OLUMSUZ kalıplar KULLANMA. " +
      "Zamana bağlı bilgi sorma (şu anki, günümüzde, en son, kaç yaşında gibi) — " +
      "cevap yıllar sonra da aynı kalmalı. " +
      "Türkçe karakterleri ve noktalamayı doğru kullan.",
    messages: [
      {
        role: "user",
        content:
          `${PARTI_BOYU} adet yeni soru üret. HEPSİ "${hedefKategori}" kategorisinde olsun.\n\n` +
          `Bu kategoride daha önce sorulmuş sorular (BUNLARI VE ÇOK BENZERLERİNİ TEKRAR SORMA):\n${ornekListe}`,
      },
    ],
    output_config: {
      format: { type: "json_schema", schema: questionSchema },
    },
  });

  if (response.stop_reason === "refusal") {
    return Response.json({ hata: "Model isteği reddetti" }, { status: 502 });
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) {
    return Response.json({ hata: "Modelden metin alınamadı" }, { status: 502 });
  }

  const parsed = JSON.parse(textBlock.text) as { sorular: Soru[] };

  // --- Kalite + tekrar elemesi (SUNUCUDA) -----------------------------------
  const elenen: Record<string, number> = {};
  const partiNorm = new Set<string>();
  const gecerli: Soru[] = [];

  for (const q of parsed.sorular ?? []) {
    const sebep = nedenGecersiz(q);
    if (sebep) {
      elenen[sebep] = (elenen[sebep] ?? 0) + 1;
      continue;
    }
    const n = normalize(q.soru);
    if (mevcutNorm.has(n)) {
      elenen["havuzda zaten var"] = (elenen["havuzda zaten var"] ?? 0) + 1;
      continue;
    }
    if (partiNorm.has(n)) {
      elenen["parti içi tekrar"] = (elenen["parti içi tekrar"] ?? 0) + 1;
      continue;
    }
    partiNorm.add(n);
    gecerli.push(q);
  }

  if (gecerli.length === 0) {
    return Response.json({ uretildi: 0, mesaj: "Tümü elendi", hedefKategori, elenen });
  }

  const { data: eklenen, error } = await supabase
    .from("questions")
    .upsert(
      gecerli.map((q) => ({
        soru: q.soru.trim(),
        secenekler: q.secenekler.map((s) => String(s).trim()),
        dogru_cevap: q.dogru_cevap,
        // Kategori modelden DEĞİL, sunucudan: parti tek kategori için istendi.
        kategori: hedefKategori,
      })),
      { onConflict: "soru", ignoreDuplicates: true },
    )
    .select("id, soru, secenekler, dogru_cevap, kategori");

  if (error) {
    return Response.json({ hata: error.message }, { status: 500 });
  }

  // --- Yeni sorular hedef dillere (hata soruyu kaybettirmez; çevirisiz kalır, raporda görünür)
  const ceviri: unknown[] = [];
  try {
    const ay = await ceviriAyarlari();
    for (const kural of await dilKurallari(supabase, ay.diller)) {
      if (Date.now() > baslangic + ay.sureSn * 1000) { ceviri.push({ dil: kural.dil, ertelendi: "süre sınırı" }); continue; }
      ceviri.push(await cevirHatti({
        supabase, anthropic, kural, sorular: (eklenen ?? []) as KaynakSoru[],
        parti: ay.parti, esik: ay.esik, kuru: false, bitisMs: baslangic + ay.sureSn * 1000,
      }));
    }
  } catch (e) {
    ceviri.push({ hata: e instanceof Error ? e.message : String(e) });
  }

  return Response.json({
    uretildi: eklenen?.length ?? 0,
    hedefKategori,
    kategoriYeniToplam: sayimlar[hedefKategori] + (eklenen?.length ?? 0),
    hedef: KATEGORI_HEDEFI,
    elenen,
    ceviri,
  });
});
