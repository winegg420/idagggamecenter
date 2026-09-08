# BİLDİM — Asenkron maç + heyecan + bildirim (Görev 6)

> Bağlam sıkışırsa **önce bu dosyayı oku**, ilk işaretsiz maddeden devam et.
> Migration ve push kalıcı talimat gereği bana ait.

## İstek
"Oyuncular aynı anda oynayamıyor, gecikme/kopma oluyor. Maç tek taraf için
devam etsin, diğeri sonradan oynasın. Yarım kalan müsabaka görünsün, tıklayıp
girilebilsin. Son 5 saniye sayı saysın, heyecan yaratsın (kızarma / kalp atışı).
Bildirim telefona ve oyun içi zile muhakkak gelsin."

## Mevcut durum (inceleme sonucu)
1v1 maç **senkron**: `matches.aktif_soru` ve `soru_baslangic` iki oyuncu için
ORTAK, süre 16 sn. Bağlantısı kopan/geç kalan taraf soruları kaçırıyor.

## Faz 1 — Asenkron 1v1
- [x] 1.1 Şema: oyuncu bazlı ilerleme + soru başlangıcı
- [x] 1.2 `get_match_question` kendi indeksini versin, ilk çekişte süre başlasın
- [x] 1.3 `submit_match_answer` kendi indeksi/süresiyle puanlasın ve ilerletsin
- [x] 1.4 Bitiş: iki taraf da bitirince; terk edilirse 24 saat sonra
- [x] 1.5 `bot_oyna` botu kendi indeksiyle oynatsın (insanı geçmesin)
- [x] 1.6 Mevcut aktif maçlar geriye dönük doldurulsun
- [x] 1.7 DOĞRULAMA: iki oyuncu farklı hızda oynasın, kimse kaçırmasın

## Faz 2 — Yarım kalan maçlar görünsün
- [x] 2.1 "Sıra sende" rozetiyle devam eden maçlar listesi
- [x] 2.2 Ana sayfada da kısayol

## Faz 3 — Son 5 saniye heyecanı
- [x] 3.1 Geri sayım rakamı + ekran kızarması / kalp atışı
- [x] 3.2 `prefers-reduced-motion` saygısı

## Faz 4 — Bildirim (telefon + zil)
- [x] 4.1 `bildirim_yaz` push'u da tetiklesin (tek kaynak)
- [x] 4.2 Sıra sana geçince bildirim
- [x] 4.3 DOĞRULAMA

## Kapanış
- [x] Build temiz, PROGRESS.md, commit + push
