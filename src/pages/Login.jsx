import { useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [gonderildi, setGonderildi] = useState(false);
  const [hata, setHata] = useState(null);

  const sosyalGiris = async (provider) => {
    setHata(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setHata(error.message);
  };

  const epostaGiris = async (e) => {
    e.preventDefault();
    setHata(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) setHata(error.message);
    else setGonderildi(true);
  };

  return (
    <div className="giris">
      <div className="buyuk-logo">Bildim!</div>
      <div className="slogan">
        Her gün 10:00 ve 22:00'de büyük turnuva.
        <br />
        7/24 meydan okumalar. Sen de yerini al! 🔥
      </div>

      {hata && <div className="hata-kutu">{hata}</div>}

      <button className="sosyal-btn" onClick={() => sosyalGiris("google")}>
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
        Google ile devam et
      </button>
      <button className="sosyal-btn" onClick={() => sosyalGiris("facebook")}>
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#1877F2" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07z"/></svg>
        Facebook ile devam et
      </button>
      <button className="sosyal-btn" onClick={() => sosyalGiris("twitter")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.24 2.25h3.31l-7.23 8.26L22.83 21.75h-6.66l-5.22-6.82-5.97 6.82H1.66l7.73-8.84L1.17 2.25h6.83l4.72 6.24 5.52-6.24zm-1.16 17.52h1.83L7.02 4.13H5.06l12.02 15.64z"/></svg>
        X (Twitter) ile devam et
      </button>

      <div className="ayrac">veya</div>

      {gonderildi ? (
        <div className="kart" style={{ maxWidth: 340, textAlign: "center" }}>
          📬 Giriş bağlantısı <b>{email}</b> adresine gönderildi. E-postanı kontrol et!
        </div>
      ) : (
        <form onSubmit={epostaGiris} style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            placeholder="E-posta adresin"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" className="btn ikincil">
            E-posta ile giriş bağlantısı al
          </button>
        </form>
      )}
    </div>
  );
}
