# BİLDİM — Yayın öncesi revize (Görev 4)

> Bağlam sıkışırsa **önce bu dosyayı oku**, ilk işaretsiz maddeden devam et.
> Kaynak: 8 Eylül 2026, canlı sitede Chrome ile sayfa sayfa test.
>
> **Not:** Kullanıcının kalıcı talimatı gereği migration'lar bana ait —
> yazılır, provası alınır, canlıya uygulanır, geçmişe kaydedilir.
> `git push` / deploy YAPILMAZ.
>
> (Soru kütüphanesi görevi `BILDIM_GOREV4_sorular_tamamlandi.md` dosyasında.)

## Varsayılan kararlar
- Botlar liglerde **görünür** (boş lig ölü duruyor), satırda küçük 🤖 rozeti.
- Eşleştirme 8 sn'de rakip bulamazsa bota düşer ve bunu ekranda söyler.
- Maç ekranında alt sekme çubuğu yok; çıkış sol üstte "✕".
- Faz 3'teki görsel yön birebir uygulanır, alternatif üretilmez.

---

## Faz 1 — Çalışmayan / hatalı şeyler
- [x] 1.1 `hizli_mod_cevap` "column reference dogru is ambiguous" (migration 064)
- [x] 1.2 Maç ekranında C/D şıkları joker çubuğunun altında kalıyor
- [x] 1.3 Hızlı Mod "BAŞLA" butonu tabbar altında kalıyor (tüm sayfalarda alt boşluk)
- [x] 1.4 "Hemen Oyna" modalı görünmüyor → portal + tam ekran + bota düşme mesajı
- [x] 1.5 Devam eden maça girişte rakip ilerlemesi bilgisi + bot ilerleme kontrolü
- [x] 1.6 Lig boş: `toplam_mac` geriye dönük hesap, botlar dahil, tek RPC
- [x] 1.7 Puan çipi tıklanınca profile gitsin
- [x] 1.8 Turnuva lobisinde botlar görünsün
- [x] 1.9 Kategori kartlarındaki "%0 çözüldü" küçültülsün
- [x] 1.10 Emoji baloncuğu skor tablosunu itmesin (absolute + pointer-events:none)
- [x] 1.11 Sohbet/emoji satırı küçültülsün
- [x] 1.12 Header tam genişlik + blur (sert kenar gitsin)
- [x] 1.13 Build temiz + commit

## Faz 2 — Yayın için eksikler
- [x] 2.1 TWA/Bubblewrap: manifest, assetlinks, imza talimatı, ikon/splash
- [x] 2.2 `store/` mağaza varlıkları (metinler, ekran görüntüsü listesi, özellik grafiği)
- [x] 2.3 Reklam: 3 maçta bir geçiş, ilk 3 maç reklamsız, günde en fazla 10
- [x] 2.4 Onboarding: 3 kartlık tanıtım → takma ad → avatar → şehir
- [x] 2.5 Boş durumlar tamamlansın
- [x] 2.6 Hata durumları: Türkçe mesaj + "Tekrar dene", ham SQL asla görünmesin
- [x] 2.7 Performans: font display=swap, büyük chunk'lar lazy
- [x] 2.8 Gizlilik metni takma ad düzenine göre düzeltilsin
- [x] 2.9 Build temiz + commit

## Faz 3 — Radikal kozmetik ("panel" değil "oyun")
- [ ] 3.1 Yeni görsel dil: zemin, renk, yüzey (kart yok), tipografi, ikon, maskot
- [ ] 3.2a Ana sayfa
- [ ] 3.2b Maç ekranı
- [ ] 3.2c Sonuç ekranı
- [ ] 3.2d Lig
- [ ] 3.2e Meydan Oku
- [ ] 3.2f Profil
- [ ] 3.2g Alt sekme çubuğu + mikro etkileşim
- [ ] 3.3 Mobil 390px gözden geçirme, dokunma hedefi ≥44px, kontrast ≥4.5
- [ ] 3.4 Build temiz + commit

## Faz 4 — Kapanış
- [ ] 4.1 Build temiz, bu dosya dolu
- [ ] 4.2 PROGRESS.md: kararlar, migration sırası, Bubblewrap komutları, manuel işler
