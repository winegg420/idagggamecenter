# BİLDİM — Revize paketi #2 (Görev 5)

> Bağlam sıkışırsa **önce bu dosyayı oku**, ilk işaretsiz maddeden devam et.
> Kaynak: 8 Eylül 2026 canlı test (idagg oturumu, Chrome).
>
> Migration'lar ve push kullanıcının kalıcı talimatı gereği bana ait.

## Durum notu
2, 5, 6, 7, 8 numaralı maddeler bir önceki oturumda (commit `e6d4aae`)
düzeltilmişti; kullanıcının testi o deploy yayılmadan önce yapılmış olabilir.
Her birini **canlı kodda yeniden doğrulayıp** sonucu yazacağım.

---

## Faz 1 — Kritik
- [x] 1.1 `.sayfa > *` animasyonu containing block yaratıyor → `position: fixed`
      modallar ekran dışında (top: -916px). Animasyonu transform'suz yap.
- [x] 1.2 Tüm modalleri tara ve `createPortal` ile `document.body`'ye bas
- [x] 1.3 DOĞRULAMA: her modal için rect ölç (sayfa kaydırılmışken de)
- [x] 3.1 "Hızlı Olan Kazanır" 5 kişilik, sistemde 3 bot var → kurulamıyor
- [x] 3.2 Grup maçı 5 kişilik seçeneği de aynı sorunda
- [x] 3.3 DOĞRULAMA: arkadaşsız hesapla iki mod da kurulabiliyor

## Faz 2 — Görsel
- [x] 4.1 Kaydırırken üstte beyaz flaş (backdrop-filter + animasyon repaint)
- [x] 4.2 DOĞRULAMA: ana sayfa/profil/lig hızlı kaydırmada ekran görüntüsü

## Faz 3 — Önceki oturumda yapılanları doğrula
- [x] 2.x Grup/hızlı maçta bot ilerleme kilidi (migration 066)
- [x] 5.x Manifest linki `/bildim.webmanifest`
- [x] 6.x Bildirimde kategori adı (migration 067)
- [x] 7.x Gizlilik metni takma ad düzeni
- [x] 8.x Ortak link stili / kontrast

## Kapanış
- [x] Build temiz, PROGRESS.md doğrulama tabloları, commit + push
