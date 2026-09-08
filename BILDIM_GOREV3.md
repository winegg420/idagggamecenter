# BİLDİM — Görev 3: Yayın öncesi hatalar + büyük kozmetik revizyon

> Bağlam sıkışırsa **önce bu dosyayı oku**, ilk işaretsiz maddeden devam et.
> Kurallar: Türkçe; minimal değişiklik; eski CSS sınıflarını silme; try-catch;
> puanlama/RLS mantığına dokunma. Kapsam **yalnız Bildim**.
> Push/deploy YOK. (Migration'lar görev sonunda otomatik uygulanır — kalıcı tercih.)
>
> **Numara notu:** 055 zaten `seri_hatirlatma` olarak kullanıldı ve uygulandı.
> Bu görevin migration'ları **056** (kategori birleştirme) ve **057** (soru kalitesi).

## Faz 0 — Hazırlık
- [x] `BILDIM_GOREV3.md` oluşturuldu
- [x] CLAUDE.md, PROGRESS.md, `bildim/` altı, `src/styles.css` okundu

## Faz 1 — Hatalar
- [x] 1.1 Lig: kendi satırı listede varsa altta ikinci kez sabitlenmesin (yalnız ilk 100 dışındaysa)
- [x] 1.2 Kategoriler: `genel` + `karisik` → `genel_kultur`'a taşı (migration 056), `get_categories` bu ikisini döndürmesin, tek "Karışık = tüm kategoriler" seçeneği kalsın
- [x] 1.3 Kategori kartında "%0 çözüldü" küçük ve gri
- [x] 1.4 Meydan okuma: bota meydan okuyunca doğrudan `/bildim/mac/:id`; insanda toast + bekleyenlere kaydır
- [x] 1.5 Bot maçı: bot cevapları oyuncunun ilerlemesine bağlansın (soru indeksi ≤ oyuncunun indeksi, 2–6 sn gecikme)
- [x] 1.6 Skor tablosunda rakip puanı canlı artsın
- [x] 1.7 Soru kalitesi taraması + migration 057 (`aktif = false` ile pasife alma) + rapor
- [x] 1.8 Maç/hızlı mod/turnuva soru ekranlarında alt sekme çubuğu gizlensin
- [x] 1.9 Joker çubuğu ekranın altına sabitlensin
- [x] 1.10 Emoji baloncukları absolute (layout'u itmesin)
- [x] 1.11 Turnuva sayfası: sayaç + nasıl oynanır (3 madde) + son turnuva ilk 3 + katılan sayısı
- [x] 1.12 `npm run build` temiz + PROGRESS + commit

## Faz 2 — Kozmetik: oyun kimliği
- [ ] 2.1 `bildim/styles/tema.css`: renk/yarıçap/gölge/tipografi tokenları
- [ ] 2.2 Arka plan: radyal gradient + doku + bulanık renk lekeleri (CSS, görsel dosya yok)
- [ ] 2.3 Kartlar zeminden ayrışsın (yüzey + iç parlaklık + gölge, her kart kenarlıklı değil)
- [ ] 2.4 Baykuş maskotu inline SVG (selam / düşünüyor / kutluyor)
- [ ] 2.5 Ana sayfa: hero tek kompozisyon (maskot + ad + rütbe + puan + seri)
- [ ] 2.6 "HEMEN OYNA" tek büyük buton (nabız animasyonu)
- [ ] 2.7 Mod kartları kendi renk temalarıyla (mor/turuncu/mavi/altın) + slogan
- [ ] 2.8 Lig özeti 3'lü kutu + günlük görevler ilerleme halkalı
- [ ] 2.9 Soru ekranı: büyük kart, zaman çubuğu yeşil→sarı→kırmızı, dolgun şıklar, 150 ms ölçek, doğruda konfeti, yanlışta sarsıntı
- [ ] 2.10 Skor tablosu: iki avatar karşı karşıya "VS"
- [ ] 2.11 Lig: podyum (1. ortada yüksek) + segment kontrol sekmeler + bayrak/rütbe ikonu
- [ ] 2.12 Boş durumlar: maskot + tek cümle + eylem butonu
- [ ] 2.13 Sayfa geçişi fade+slide 150 ms, puan sayacı, `prefers-reduced-motion`
- [ ] 2.14 Mobil 390px gözden geçirme; dokunma ≥44px; kontrast ≥4.5
- [ ] 2.15 Eski CSS sınıfları silinmedi
- [ ] 2.16 `npm run build` temiz + PROGRESS + commit

## Faz 3 — Kapanış
- [ ] 3.1 `npm run build` temiz
- [ ] 3.2 Migration'lar uygulandı (056 → 057) ve doğrulandı
- [ ] 3.3 PROGRESS.md: kararlar, migration sırası, pasife alınan soru sayısı
- [ ] 3.4 Tüm kutular dolu + son commit
