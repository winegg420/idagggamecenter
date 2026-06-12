import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "../components/Avatar.jsx";
import RankBadge from "../components/RankBadge.jsx";
import { rutbeBul, sonrakiRutbe } from "../lib/ranks.js";

export default function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [duzenle, setDuzenle] = useState(false);
  const [yeniAd, setYeniAd] = useState("");
  const [hata, setHata] = useState(null);
  const [rozetler, setRozetler] = useState([]);
  const [kazanilan, setKazanilan] = useState(new Set());
  const [kopyalandi, setKopyalandi] = useState(false);

  useEffect(() => {
    supabase.from("badges").select("*").then(({ data }) => setRozetler(data ?? []));
    supabase
      .from("user_badges")
      .select("badge_id")
      .eq("user_id", user.id)
      .then(({ data }) => setKazanilan(new Set((data ?? []).map((b) => b.badge_id))));
  }, [user.id]);

  if (!profile) return <div className="yukleniyor">Yükleniyor…</div>;

  const r = rutbeBul(profile.puan);
  const sonraki = sonrakiRutbe(profile.puan);
  const ilerleme = sonraki
    ? Math.min(100, ((profile.puan - r.min) / (sonraki.min - r.min)) * 100)
    : 100;

  const kaydet = async () => {
    setHata(null);
    const ad = yeniAd.trim();
    if (ad.length < 3) {
      setHata("Kullanıcı adı en az 3 karakter olmalı.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ username: ad })
      .eq("id", user.id);
    if (error) {
      setHata(
        error.code === "23505" ? "Bu kullanıcı adı alınmış." : error.message
      );
    } else {
      setDuzenle(false);
      refreshProfile(user.id);
    }
  };

  return (
    <div>
      <div className="kart" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <Avatar profile={profile} boyut={84} />
        </div>

        {duzenle ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 280, margin: "0 auto" }}>
            <input
              type="text"
              placeholder="Yeni kullanıcı adı"
              value={yeniAd}
              onChange={(e) => setYeniAd(e.target.value)}
            />
            {hata && <div className="hata-kutu">{hata}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn kucuk" onClick={kaydet}>Kaydet</button>
              <button className="btn kucuk ikincil" onClick={() => setDuzenle(false)}>Vazgeç</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{profile.username}</div>
            <button
              className="alt-yazi"
              style={{ background: "none", border: "none", cursor: "pointer", marginTop: 2 }}
              onClick={() => {
                setYeniAd(profile.username);
                setDuzenle(true);
              }}
            >
              ✏️ adı düzenle
            </button>
          </>
        )}

        <div style={{ marginTop: 12 }}>
          <RankBadge puan={profile.puan} />
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 18 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>⭐ {profile.puan}</div>
            <div className="alt-yazi">Puan</div>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>🏆 {profile.sampiyonluk}</div>
            <div className="alt-yazi">Şampiyonluk</div>
          </div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900 }}>🔥 {profile.seri ?? 0}</div>
            <div className="alt-yazi">Günlük Seri</div>
          </div>
        </div>
      </div>

      {sonraki && (
        <div className="kart">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              Sonraki rütbe: {sonraki.ikon} {sonraki.ad}
            </span>
            <span className="alt-yazi">
              {profile.puan}/{sonraki.min}
            </span>
          </div>
          <div className="soru-sayac">
            <div
              className="dolgu"
              style={{
                width: `${ilerleme}%`,
                background: `linear-gradient(90deg, ${r.renk}, ${sonraki.renk})`,
              }}
            />
          </div>
        </div>
      )}

      <div className="kart" style={{ textAlign: "center" }}>
        <div className="baslik">🎁 Arkadaşını Davet Et</div>
        <div className="alt-yazi" style={{ marginBottom: 12 }}>
          Davet linkinle gelen her arkadaş için <b>ikiniz de +50 puan</b> kazanırsınız!
          {profile.davet_sayisi > 0 && (
            <> Şu ana kadar {profile.davet_sayisi} kişi davet ettin. 🎉</>
          )}
        </div>
        <button
          className="btn"
          onClick={async () => {
            const link = `${window.location.origin}/?davet=${user.id}`;
            const mesaj = `Bildim!'de benimle yarışmaya var mısın? 🧠 Bu linkle gel, ikimiz de +50 puan kazanalım: ${link}`;
            if (navigator.share) {
              try {
                await navigator.share({ title: "Bildim!", text: mesaj });
              } catch { /* vazgeçti */ }
            } else {
              await navigator.clipboard.writeText(mesaj);
              setKopyalandi(true);
              setTimeout(() => setKopyalandi(false), 2500);
            }
          }}
        >
          {kopyalandi ? "✅ Kopyalandı!" : "📤 Davet Linkini Paylaş"}
        </button>
      </div>

      <div className="kart">
        <div className="baslik">
          🏅 Rozetler ({kazanilan.size}/{rozetler.length})
        </div>
        <div className="rozet-grid">
          {rozetler.map((r) => {
            const var_mi = kazanilan.has(r.id);
            return (
              <div key={r.id} className={`rozet ${var_mi ? "" : "kilitli"}`}>
                <div className="rozet-ikon">{var_mi ? r.ikon : "🔒"}</div>
                <div className="rozet-ad">{r.ad}</div>
                <div className="rozet-aciklama">{r.aciklama}</div>
              </div>
            );
          })}
        </div>
      </div>

      <button className="btn tehlike" onClick={signOut}>
        Çıkış Yap
      </button>
    </div>
  );
}
