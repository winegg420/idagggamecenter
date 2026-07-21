import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";

const DOSTLUK_SECIMI = `id, requester, addressee, durum,
  req:profiles!friendships_requester_fkey(id, username, avatar_url, puan),
  add:profiles!friendships_addressee_fkey(id, username, avatar_url, puan)`;

export default function FriendsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dostluklar, setDostluklar] = useState([]);
  const [arama, setArama] = useState("");
  const [sonuclar, setSonuclar] = useState([]);
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);

  const yukle = useCallback(async () => {
    const { data } = await supabase
      .from("friendships")
      .select(DOSTLUK_SECIMI)
      .or(`requester.eq.${user.id},addressee.eq.${user.id}`);
    setDostluklar(data ?? []);
  }, [user.id]);

  useEffect(() => {
    yukle();
    const kanal = supabase
      .channel("dostluklar")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, yukle)
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [yukle]);

  const aramaNo = useRef(0);
  const ara = async (q) => {
    setArama(q);
    const istek = ++aramaNo.current;
    if (q.trim().length < 2) {
      setSonuclar([]);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, puan")
      .ilike("username", `%${q.trim()}%`)
      .neq("id", user.id)
      .limit(8);
    // Geciken eski istek, daha yeni sonuçların üzerine yazmasın
    if (istek === aramaNo.current) setSonuclar(data ?? []);
  };

  const istekGonder = async (hedefId) => {
    setHata(null);
    const { error } = await supabase.rpc("send_friend_request", { p_target: hedefId });
    if (error) setHata(error.message);
    else {
      setBilgi("İstek gönderildi ✅");
      setArama("");
      setSonuclar([]);
      yukle();
    }
  };

  const cevapla = async (fId, kabul) => {
    await supabase.rpc("respond_friend_request", { p_id: fId, p_kabul: kabul });
    yukle();
  };

  const cikar = async (fId) => {
    await supabase.rpc("remove_friend", { p_id: fId });
    yukle();
  };

  const meydanOku = async (hedefId) => {
    setHata(null);
    const { error, data } = await supabase.rpc("create_challenge", { p_rakip: hedefId });
    if (error) setHata(error.message);
    else if (data) navigate("/meydan");
  };

  const digerProfil = (f) => (f.requester === user.id ? f.add : f.req);
  const gelenIstekler = dostluklar.filter(
    (f) => f.durum === "bekliyor" && f.addressee === user.id
  );
  const gidenIstekler = dostluklar.filter(
    (f) => f.durum === "bekliyor" && f.requester === user.id
  );
  const arkadaslar = dostluklar.filter((f) => f.durum === "arkadas");

  return (
    <div>
      <div className="baslik">👥 Arkadaşlar</div>
      {hata && <div className="hata-kutu">{hata}</div>}
      {bilgi && (
        <div className="kart" style={{ padding: 10, fontSize: 13 }}>
          {bilgi}
        </div>
      )}

      <div className="kart">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Oyuncu ara</div>
        <input
          type="text"
          placeholder="Kullanıcı adı…"
          value={arama}
          onChange={(e) => ara(e.target.value)}
        />
        {sonuclar.map((p) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <Avatar profile={p} boyut={34} />
            <span style={{ flex: 1, fontWeight: 600 }}>{p.username}</span>
            <button className="btn kucuk" onClick={() => istekGonder(p.id)}>
              ➕ Ekle
            </button>
          </div>
        ))}
      </div>

      {gelenIstekler.length > 0 && (
        <>
          <div className="baslik">📥 Gelen İstekler</div>
          {gelenIstekler.map((f) => (
            <div key={f.id} className="liste-satir">
              <Avatar profile={f.req} />
              <div className="bilgi">
                <div className="isim">{f.req?.username}</div>
                <div className="detay">arkadaşlık isteği gönderdi</div>
              </div>
              <button className="btn kucuk" onClick={() => cevapla(f.id, true)}>
                Kabul
              </button>
              <button className="btn kucuk tehlike" onClick={() => cevapla(f.id, false)}>
                Sil
              </button>
            </div>
          ))}
        </>
      )}

      <div className="baslik">Arkadaşların ({arkadaslar.length})</div>
      {arkadaslar.length === 0 && (
        <div className="alt-yazi" style={{ textAlign: "center", padding: 16 }}>
          Henüz arkadaşın yok. Yukarıdan oyuncu ara ve ekle!
        </div>
      )}
      {arkadaslar.map((f) => {
        const p = digerProfil(f);
        return (
          <div key={f.id} className="liste-satir">
            <Avatar profile={p} />
            <div className="bilgi">
              <div className="isim">{p?.username}</div>
              <div className="detay">⭐ {p?.puan} puan</div>
            </div>
            <button className="btn kucuk" onClick={() => meydanOku(p.id)}>
              ⚔️
            </button>
            <button className="btn kucuk ikincil" onClick={() => cikar(f.id)}>
              ✕
            </button>
          </div>
        );
      })}

      {gidenIstekler.length > 0 && (
        <>
          <div className="baslik" style={{ marginTop: 14 }}>
            📤 Bekleyen İstekler
          </div>
          {gidenIstekler.map((f) => (
            <div key={f.id} className="liste-satir">
              <Avatar profile={f.add} />
              <div className="bilgi">
                <div className="isim">{f.add?.username}</div>
                <div className="detay">cevap bekleniyor…</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
