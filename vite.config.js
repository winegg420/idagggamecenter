import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// ============================================================
// BİLDİM MODU EKLENTİSİ
//
// Aynı depo iki site yayınlıyor. Kod tarafını src/main.jsx seçiyor; ama
// index.html, manifest, robots ve sitemap statik dosyalar — onları da moda
// göre uyarlamak gerekiyor. Bu eklenti YALNIZ VITE_MOD=bildim iken devreye
// girer; hub derlemesi (Vercel) hiç etkilenmez.
//
// Site adresi VITE_SITE_URL ile verilir (Cloudflare panelinden). Verilmezse
// robots'a Sitemap satırı yazılmaz ve sitemap üretilmez — yanlış adres
// yayınlamaktansa hiç yayınlamamak doğrusu.
// ============================================================
function bildimModuEklentisi(mod, siteUrl) {
  const aktif = mod === "bildim";
  return {
    name: "bildim-modu",
    apply: "build",

    // ---- index.html: başlık, paylaşım kartı, manifest, tema ----
    transformIndexHtml(html) {
      if (!aktif) return html;
      const ad = "Quizador — Bilgi Yarışması";
      const aciklama =
        "Türkçe bilgi yarışması: 1v1 meydan okuma, günlük turnuvalar, şehir ve ülke ligleri. Binlerce soru, ücretsiz.";
      const gorsel = siteUrl ? `${siteUrl}/bildim-icon-512.png` : "/bildim-icon-512.png";
      let c = html;
      c = c.replace(/<title>[\s\S]*?<\/title>/, `<title>${ad}</title>`);
      c = c.replace(/(<meta name="description" content=")[^"]*(")/, `$1${aciklama}$2`);
      c = c.replace(/(<meta property="og:site_name" content=")[^"]*(")/, `$1Quizador$2`);
      c = c.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${ad}$2`);
      c = c.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${aciklama}$2`);
      c = c.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${ad}$2`);
      c = c.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${aciklama}$2`);
      c = c.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${gorsel}$2`);
      c = c.replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${gorsel}$2`);
      c = c.replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/, `$1Quizador$2`);
      c = c.replace(/(<link rel="manifest" href=")[^"]*(")/, `$1/bildim.webmanifest$2`);
      c = c.replace(/(<link rel="icon" type="image\/png" href=")[^"]*(")/, `$1/bildim-icon-192.png$2`);
      c = c.replace(/(<link rel="apple-touch-icon" href=")[^"]*(")/, `$1/bildim-icon-192.png$2`);
      if (siteUrl) {
        c = c.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${siteUrl}/$2`);
        // Yinelenen içerik: aynı oyun hub'da /bildim altında da duruyor.
        c = c.replace(/<\/head>/, `  <link rel="canonical" href="${siteUrl}/" />\n  </head>`);
      }
      return c;
    },

    // ---- statik dosyalar: manifest / robots / sitemap ----
    writeBundle(secenekler) {
      if (!aktif) return;
      const kok = secenekler.dir || "dist";
      const yaz = (ad, icerik) => {
        try {
          fs.writeFileSync(path.join(kok, ad), icerik);
        } catch (e) {
          this.warn(`${ad} yazılamadı: ${e.message}`);
        }
      };

      // Manifest: start_url ve kısayollar /bildim önekinden arındırılır.
      try {
        const my = path.join(kok, "bildim.webmanifest");
        const m = JSON.parse(fs.readFileSync(my, "utf8"));
        const sil = (u) => (typeof u === "string" ? u.replace(/^\/bildim/, "") || "/" : u);
        m.start_url = sil(m.start_url);
        m.scope = "/";
        if (Array.isArray(m.shortcuts)) m.shortcuts = m.shortcuts.map((k) => ({ ...k, url: sil(k.url) }));
        fs.writeFileSync(my, JSON.stringify(m, null, 2));
      } catch (e) {
        this.warn(`bildim.webmanifest uyarlanamadı: ${e.message}`);
      }

      // robots.txt
      yaz(
        "robots.txt",
        "User-agent: *\nAllow: /\n" + (siteUrl ? `\nSitemap: ${siteUrl}/sitemap.xml\n` : "")
      );

      // sitemap.xml — yalnız giriş gerektirmeyen adresler
      if (siteUrl) {
        const yollar = [["/", "1.0"], ["/gizlilik", "0.3"], ["/kosullar", "0.3"]];
        yaz(
          "sitemap.xml",
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
            yollar
              .map(([y, p]) => `  <url><loc>${siteUrl}${y}</loc><priority>${p}</priority></url>`)
              .join("\n") +
            "\n</urlset>\n"
        );
      } else {
        // Adres bilinmiyorsa hub'ın sitemap'ini yayınlamak yanlış olur.
        try {
          fs.rmSync(path.join(kok, "sitemap.xml"), { force: true });
        } catch {
          /* yoksa sorun değil */
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // İki kaynak birden okunur:
  //   • .env.bildim dosyası  → yerelde `npm run build:bildim` (her işletim sisteminde)
  //   • gerçek ortam değişkeni → Cloudflare Pages paneli (öncelikli)
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  const uygulamaModu = env.VITE_MOD || "";
  const siteUrl = (env.VITE_SITE_URL || "").replace(/\/+$/, "");
  return {
  plugins: [react(), bildimModuEklentisi(uygulamaModu, siteUrl)],

  build: {
    rollupOptions: {
      output: {
        // Satıcı kodunu ayır: uygulama her deploy'da değişse de bu parçalar
        // tarayıcı önbelleğinde kalır; ilk açılışta indirilen paket küçülür.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router")) return "router";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("scheduler")
          ) {
            return "react";
          }
          if (
            id.includes("@supabase") ||
            id.includes("postgrest") ||
            id.includes("realtime-js") ||
            id.includes("gotrue") ||
            id.includes("storage-js") ||
            id.includes("functions-js")
          ) {
            return "supabase";
          }
          // Geri kalan satıcı kodu Rollup'un kendi bölmesinde kalır: lazy
          // yüklenen oyunların ağır bağımlılıkları (three.js gibi) ilk
          // açılış paketine sızmasın.
          return undefined;
        },
      },
    },
  },
};
});
