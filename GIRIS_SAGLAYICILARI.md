# Facebook ve X (Twitter) girişini açma — adım adım

> Bu iş **kodla açılamaz.** Sağlayıcı ayarı Supabase'in kimlik servisinde tutulur;
> veritabanında yer almaz (auth şemasında yapılandırma tablosu yoktur) ve
> Management API için erişim tokeni gerekir. Kod tarafı hazırdır — aşağıdaki
> adımlar tamamlanınca düğmeler çalışır, ek geliştirme gerekmez.
>
> Son ölçüm (10 Eylül 2026, `auth/v1/settings` ucundan):
> **AÇIK:** `google` · `email` · `anonymous_users` (misafir girişi artık açık —
> canlıda uçtan uca denendi: hesap açılıyor, takma ad ekranı geliyor)
> **KAPALI:** `apple` · `facebook` · `twitter` · ve diğer 20 sağlayıcı
>
> ```bash
> curl -s -H "apikey: <anon>" https://zfpnxzybcpkxsotwdsey.supabase.co/auth/v1/settings
> ```

---

## 0. URL yapılandırması — 10 Eylül 2026'da yeniden ölçüldü

> **Bu bölümün eski hâli aşılmıştır.** Aşağıdaki uyarı geçerliydi:
> *"Site URL `bildim.vercel.app`; girişlerin çalışmasının tek nedeni onun 307
> yönlendirmesi, o alias kalkarsa tüm girişler kırılır."*
> **Alias gerçekten kalktı** (`bildim.vercel.app` → 404 `DEPLOYMENT_NOT_FOUND`),
> ama arada panel de güncellenmiş: girişler kırılmadı.

**Yeni durum:**

| Alan | Ölçülen değer |
|---|---|
| Site URL | `https://quizsquare.vercel.app` ✔ (11 Eylül 2026'da güncellendi; eskiden `quizador.pages.dev` idi) |
| `bildim.vercel.app` | **ÖLÜ** — 404. Kimseye verilmemeli, listeden çıkarılabilir. |

Ölçüm yöntemi (panele girmeden, dışarıdan):

```bash
curl -sSI https://zfpnxzybcpkxsotwdsey.supabase.co/auth/v1/callback | grep -i location
# location: https://quizador.pages.dev/?error=invalid_request&error_code=bad_oauth_callback
```

Geçersiz bir callback isteğinde Supabase kullanıcıyı Site URL'e düşürür; başlık
onu ele verir.

**Geriye kalan tek kontrol:** hub (`idagg-game-center.vercel.app`) Redirect URLs
listesinde mi? Değilse hub'da giriş yapan oyuncu Quizador sitesine düşer. İzin
listesi dışarıdan okunamaz — doğrulama yalnız Google dönüşünde yapılıyor
(authorize adımı `redirect_to`'yu olduğu gibi taşıyor, ölçüldü), o yüzden
panelden bakmak gerekir. Listede şunlar olmalı:

- `https://quizsquare.vercel.app/**` ← asıl site (eski `quizador.*` adresleri kapatıldı)
- `https://idagg-game-center.vercel.app/**` ← hub

Uygulama tarafındaki yedek (`src/lib/girisHedefi.js`) derin bağlantıyı yine de
korur, ama asıl düzeltme panel tarafındadır.

---

## 1. X (Twitter)

**Portal:** https://developer.x.com → Projects & Apps → uygulama oluştur

1. **User authentication settings → Set up**
   - App permissions: **Read**
   - Type of App: **Web App**
   - Callback URI / Redirect URL:
     `https://zfpnxzybcpkxsotwdsey.supabase.co/auth/v1/callback`
   - Website URL: `https://idagg-game-center.vercel.app`
   - Terms of service: `https://idagg-game-center.vercel.app/kosullar`
   - Privacy policy: `https://idagg-game-center.vercel.app/gizlilik`
2. **"Request email address from users"** kutusunu işaretle.
   X bu kutuyu ancak yukarıdaki iki yasal adres doluyken açtırır — ikisi de
   artık yayında.
3. **Keys and tokens** → API Key ve API Secret Key'i kopyala.
4. Supabase → Authentication → Providers → **Twitter** → Enable
   → API Key + API Secret Key yapıştır → Save.

**Not:** Supabase'in `twitter` sağlayıcısı OAuth 1.0a kullanır; ihtiyacın olan
alanlar Client ID/Secret değil **API Key / API Secret**'tir.

---

## 2. Facebook

**Portal:** https://developers.facebook.com → Uygulama oluştur → tür: **Consumer**

1. Ürünlerden **Facebook Login** ekle → Settings:
   - Valid OAuth Redirect URIs:
     `https://zfpnxzybcpkxsotwdsey.supabase.co/auth/v1/callback`
   - Client OAuth Login: açık · Web OAuth Login: açık
2. **App Settings → Basic**:
   - Privacy Policy URL: `https://idagg-game-center.vercel.app/gizlilik`
   - User Data Deletion: `https://idagg-game-center.vercel.app/gizlilik`
     (hesap silme profil sayfasından yapılıyor; politika bunu anlatıyor)
   - App Domains: `idagg-game-center.vercel.app`
3. **App ID** ve **App Secret**'i kopyala.
4. Supabase → Authentication → Providers → **Facebook** → Enable
   → App ID + App Secret → Save.
5. Uygulamayı **Live** moda al (üstteki Development/Live anahtarı).
   Development modunda yalnız uygulamada rolü olan hesaplar giriş yapabilir.

**Dikkat:** `email` izninin uygulamada rolü olmayan kişiler için çalışması
Meta'nın **Advanced Access** onayına bağlıdır ve çoğu durumda **İşletme
Doğrulaması (Business Verification)** ister. Bu, birkaç gün sürebilen bir
süreçtir — yayın planını buna göre yap. `email` gelmezse kullanıcı yine giriş
yapar; profil takma adı e-postasız da üretilir.

---

## 3. Misafir girişi

Supabase → Authentication → Providers → en altta **"Allow anonymous sign-ins"**
→ aç. Başka bir şey gerekmez; düğme zaten yerinde.

Anonim kullanıcılar için Supabase'in oran sınırlamasını (rate limit) da
gözden geçir: Authentication → Rate Limits.

---

## 4. Açtıktan sonra doğrulama

Her sağlayıcı için bu iki kontrolü yap:

```bash
# 302 dönmeli (400 = hâlâ kapalı)
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://zfpnxzybcpkxsotwdsey.supabase.co/auth/v1/authorize?provider=facebook"
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://zfpnxzybcpkxsotwdsey.supabase.co/auth/v1/authorize?provider=twitter"
```

Sonra tarayıcıda: çıkış yap → davet linkiyle gir
(`/bildim/davet/<kod>`) → Facebook/X ile giriş yap → **davet sayfasına**
dönmelisin, ana sayfaya değil. Ana sayfaya düşüyorsan 0. adımdaki
Redirect URLs eksiktir.

---

## Kod tarafında hazır olanlar

- `src/pages/Login.jsx` — üç sağlayıcı düğmesi, Facebook için
  `public_profile,email` kapsamı, sağlayıcı kapalıyken Türkçe açıklama
  ("Facebook girişi şu an kapalı…") — teknik hata metni sızmıyor.
- `handle_new_user` tetikleyicisi e-postasız hesaba da takma ad üretir
  (X e-posta vermezse kayıt yine tamamlanır).
- `src/lib/girisHedefi.js` — giriş sonrası derin bağlantı geri yüklenir.
- Yasal metinler giriş duvarının önünde: `/gizlilik`, `/kosullar`.
