// Quiz Square — Claude API ile soru üretimi
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

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
    .select("id");

  if (error) {
    return Response.json({ hata: error.message }, { status: 500 });
  }

  return Response.json({
    uretildi: eklenen?.length ?? 0,
    hedefKategori,
    kategoriYeniToplam: sayimlar[hedefKategori] + (eklenen?.length ?? 0),
    hedef: KATEGORI_HEDEFI,
    elenen,
  });
});
