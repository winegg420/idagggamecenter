// Bildim! — Claude API ile soru üretimi
// Çağrı: POST, header "x-cron-secret: <CRON_SECRET>"
// Gerekli secret'lar: ANTHROPIC_API_KEY, CRON_SECRET
// (SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY otomatik sağlanır)

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const HEDEF_HAVUZ = 200; // aktif soru sayısı bu değerin altındaysa üret
const PARTI_BOYU = 15; // her çağrıda üretilecek soru sayısı

const questionSchema = {
  type: "object",
  properties: {
    sorular: {
      type: "array",
      items: {
        type: "object",
        properties: {
          soru: { type: "string" },
          secenekler: {
            type: "array",
            items: { type: "string" },
          },
          dogru_cevap: { type: "integer", enum: [0, 1, 2, 3] },
          kategori: {
            type: "string",
            enum: ["genel", "tarih", "cografya", "bilim", "sanat", "spor", "edebiyat"],
          },
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

  // Havuz yeterince doluysa üretme
  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("aktif", true);

  if ((count ?? 0) >= HEDEF_HAVUZ) {
    return Response.json({ uretildi: 0, mesaj: "Havuz dolu", havuz: count });
  }

  // Tekrarı önlemek için mevcut soruları al
  const { data: mevcut } = await supabase
    .from("questions")
    .select("soru")
    .order("created_at", { ascending: false })
    .limit(300);

  const mevcutListe = (mevcut ?? []).map((q) => q.soru).join("\n");

  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

  const response = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    system:
      "Türkçe, orta zorlukta, doğruluğundan %100 emin olduğun genel kültür soruları üret. " +
      "4 şık olsun. Daha önce sorulmuş sorular tekrar sorulmasın. " +
      "Şıklardan yalnızca biri kesin doğru olmalı, diğerleri makul ama kesinlikle yanlış çeldiriciler olmalı. " +
      "Tartışmalı, zamana bağlı değişen veya birden fazla doğru cevabı olabilecek sorulardan kaçın.",
    messages: [
      {
        role: "user",
        content:
          `${PARTI_BOYU} adet yeni genel kültür sorusu üret. Kategorileri dengeli dağıt.\n\n` +
          `Daha önce sorulmuş sorular (BUNLARI VE ÇOK BENZERLERİNİ TEKRAR SORMA):\n${mevcutListe}`,
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

  const parsed = JSON.parse(textBlock.text) as {
    sorular: Array<{
      soru: string;
      secenekler: string[];
      dogru_cevap: number;
      kategori: string;
    }>;
  };

  const gecerli = parsed.sorular.filter(
    (q) =>
      q.soru?.trim() &&
      Array.isArray(q.secenekler) &&
      q.secenekler.length === 4 &&
      q.dogru_cevap >= 0 &&
      q.dogru_cevap <= 3,
  );

  const { data: eklenen, error } = await supabase
    .from("questions")
    .upsert(
      gecerli.map((q) => ({
        soru: q.soru.trim(),
        secenekler: q.secenekler,
        dogru_cevap: q.dogru_cevap,
        kategori: q.kategori,
      })),
      { onConflict: "soru", ignoreDuplicates: true },
    )
    .select("id");

  if (error) {
    return Response.json({ hata: error.message }, { status: 500 });
  }

  return Response.json({
    uretildi: eklenen?.length ?? 0,
    havuz: (count ?? 0) + (eklenen?.length ?? 0),
  });
});
