import { useCallback, useEffect, useState } from "react";
import Ikon from "../components/Ikon.jsx";
import { hataMesaji } from "../lib/hata.js";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import Maskot from "../components/Maskot.jsx";
import { y } from "../lib/yol.js";
import DavetKodu from "../components/DavetKodu.jsx";
import { facebookArkadasOnerileri, facebookDavetAc } from "../lib/facebookArkadas.js";

const DOSTLUK_SECIMI = `id, requester, addressee, durum,
  req:profiles!friendships_requester_fkey(id, gorunen_ad, gorunen_avatar, gorunum, puan),
  add:profiles!friendships_addressee_fkey(id, gorunen_ad, gorunen_avatar, gorunum, puan)`;

export default function FriendsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [dostluklar, setDostluklar] = useState([]);
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState(null);
  const [bilgi, setBilgi] = useState(null);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [calisiyor, setCalisiyor] = useState(false);
  // Arkadaş silme geri alınamaz: tek dokunuşla değil, onaylı iki adımda.
  const [silOnay, setSilOnay] = useState(null);

  const yukle = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("friendships")
        .select(DOSTLUK_SECIMI)
        .or(`requester.eq.${user.id},addressee.eq.${user.id}`);
      if (error) throw error;
      setDostluklar(data ?? []);
    } catch (e) {
      setHata(hataMesaji(e, "Arkadaş listesi yüklenemedi."));
    }
  }, [user.id]);

  useEffect(() => {
    yukle();
    const kanal = supabase
      .channel("dostluklar")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, yukle)
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [yukle]);

  // Kullanıcı adıyla arama KALDIRILDI (gerçek ad sızdırıyordu).
  // Facebook arkadaş önerileri. İzin/belirteç yoksa boş kalır, bölüm gizlenir.
  const [fbOnerileri, setFbOnerileri] = useState([]);
  useEffect(() => {
    let aktif = true;
    facebookArkadasOnerileri()
      .then((l) => { if (aktif) setFbOnerileri(l); })
      .catch((e) => console.error("[Bildim] facebook onerileri:", e));
    return () => { aktif = false; };
  }, []);

  /** Öneriden arkadaşlık isteği gönder. */
  const fbArkadasEkle = async (hedefId) => {
    setHata(null);
    setCalisiyor(true);
    try {
      const { error } = await supabase.rpc("send_friend_request", { p_target: hedefId });
      if (error) throw error;
      setFbOnerileri((l) => l.filter((o) => o.user_id !== hedefId));
      setBilgi("Arkadaşlık isteği gönderildi.");
    } catch (e) {
      setHata(hataMesaji(e, "İstek gönderilemedi."));
    } finally {
      setCalisiyor(false);
    }
  };

  // Arkadaş eklemenin tek yolu davet kodu / davet linki.
  const kodlaEkle = async (girilen) => {
    setHata(null);
    setBilgi(null);
    const temiz = (girilen ?? kod).trim().toUpperCase();
    if (temiz.length !== 8) {
      setHata("Davet kodu 8 karakter olmalı.");
      return;
    }
    setCalisiyor(true);
    try {
      const { data, error } = await supabase.rpc("arkadas_davet_kodu_ile_ekle", {
        p_kod: temiz,
      });
      if (error) throw error;
      const sonuc = Array.isArray(data) ? data[0] : data;
      const ad = sonuc?.gorunen_ad ?? "Oyuncu";
      const mesajlar = {
        istek_gonderildi: `${ad} kişisine arkadaşlık isteği gönderildi`,
        arkadas_oldu: `${ad} artık arkadaşın!`,
        zaten_arkadas: `${ad} zaten arkadaşın.`,
      };
      setBilgi(mesajlar[sonuc?.durum] ?? "İstek gönderildi");
      setKod("");
      yukle();
    } catch (e) {
      setHata(hataMesaji(e, "Davet kodu kullanılamadı."));
    } finally {
      setCalisiyor(false);
    }
  };

  const davetLinki = profile?.davet_kodu
    ? window.location.origin + y(`/davet/${profile.davet_kodu}`)
    : null;

  const linkPaylas = async () => {
    if (!davetLinki) return;
    const mesaj = `Quiz Square'de benimle yarış — bu linkle beni arkadaş ekleyebilirsin: ${davetLinki}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Quiz Square", text: mesaj });
      } else {
        await navigator.clipboard.writeText(mesaj);
        setKopyalandi(true);
        setTimeout(() => setKopyalandi(false), 2500);
      }
    } catch {
      /* kullanıcı vazgeçti */
    }
  };

  const cevapla = async (fId, kabul) => {
    try {
      const { error } = await supabase.rpc("respond_friend_request", {
        p_id: fId,
        p_kabul: kabul,
      });
      if (error) throw error;
      yukle();
    } catch (e) {
      setHata(hataMesaji(e, "İşlem yapılamadı."));
    }
  };

  const cikar = async (fId) => {
    try {
      const { error } = await supabase.rpc("remove_friend", { p_id: fId });
      if (error) throw error;
      yukle();
    } catch (e) {
      setHata(hataMesaji(e, "Arkadaş çıkarılamadı."));
    }
  };

  const meydanOku = async (hedefId) => {
    setHata(null);
    try {
      const { error, data } = await supabase.rpc("create_challenge", { p_rakip: hedefId });
      if (error) throw error;
      if (data) navigate(y("/meydan"));
    } catch (e) {
      setHata(hataMesaji(e, "Meydan okuma başlatılamadı."));
    }
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
      <div className="baslik">Arkadaşlar</div>
      {hata && <div className="hata-kutu">{hata}</div>}
      {bilgi && <div className="bd-bilgi-kutu">{bilgi}</div>}

      {/* ---------- Davet ---------- */}
      <div className="kart bd-davet-kart">
        <div className="bd-kat-baslik">
          <span>Davet kodun</span>
        </div>
        {/* Kodun kendisi düğme: dokununca YALNIZ kod panoya gider. */}
        <DavetKodu kod={profile?.davet_kodu} />
        <button className="btn" onClick={linkPaylas} disabled={!davetLinki}>
          {kopyalandi ? "Kopyalandı" : "Davet linkini paylaş"}
        </button>
        {/* Facebook'ta "tüm arkadaşlarını davet et" MÜMKÜN DEĞİL (2014'ten
            beri kapalı); onun yerine paylaşım diyaloğu açılır. */}
        <button
          className="btn ikincil"
          disabled={!davetLinki}
          onClick={() => facebookDavetAc(davetLinki)}
        >
          Facebook'ta paylaş
        </button>
      </div>

      {/* ---------- Facebook arkadaşların ----------
          `user_friends` izni App Review ister; onay yoksa liste boş döner
          ve bu bölüm HİÇ ÇİZİLMEZ (giriş akışı etkilenmez). */}
      {fbOnerileri.length > 0 && (
        <div className="kart">
          <div className="bd-kat-baslik">
            <span>Facebook arkadaşların Quiz Square'de</span>
          </div>
          {fbOnerileri.map((o) => (
            <div key={o.user_id} className="liste-satir">
              <Avatar profile={o} boyut={38} />
              <div className="bilgi">
                <div className="isim">{o.gorunen_ad}</div>
                <div className="detay">Facebook arkadaşın</div>
              </div>
              <button
                className="btn kucuk"
                disabled={calisiyor}
                onClick={() => fbArkadasEkle(o.user_id)}
              >
                Ekle
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="kart">
        <div className="bd-kat-baslik">
          <span>Davet koduyla ekle</span>
        </div>
        <div className="bd-kod-satir">
          <input
            type="text"
            className="bd-kod-giris"
            placeholder="8 haneli kod"
            maxLength={8}
            value={kod}
            onChange={(e) => setKod(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && kodlaEkle()}
          />
          <button
            className="btn kucuk"
            disabled={calisiyor || kod.trim().length !== 8}
            onClick={() => kodlaEkle()}
          >
            {calisiyor ? "…" : "Ekle"}
          </button>
        </div>
      </div>

      {gelenIstekler.length > 0 && (
        <>
          <div className="baslik">Gelen istekler</div>
          {gelenIstekler.map((f) => (
            <div key={f.id} className="liste-satir">
              <Avatar profile={f.req} />
              <div className="bilgi">
                <div className="isim">{f.req?.gorunen_ad}</div>
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
        <div className="bd-bos-durum">
          <Maskot poz="selam" boyut={86} />
          <p>Henüz arkadaşın yok — davet linkini paylaş, birlikte yarışın.</p>
          <button className="btn" onClick={linkPaylas} disabled={!davetLinki}>
            Davet linkini paylaş
          </button>
        </div>
      )}
      {arkadaslar.map((f) => {
        const p = digerProfil(f);
        return (
          <div key={f.id} className="liste-satir">
            <Avatar profile={p} />
            <div className="bilgi">
              <div className="isim">{p?.gorunen_ad}</div>
              <div className="detay"><Ikon ad="yildiz" boyut={13} /> {p?.puan} puan</div>
            </div>
            <button
              className="btn kucuk"
              onClick={() => meydanOku(p.id)}
              aria-label={(p?.gorunen_ad ?? "Arkadaşına") + " meydan oku"}
              title="Meydan oku"
            >
              <Ikon ad="kilic" boyut={17} />
            </button>
            {silOnay === f.id ? (
              <>
                <button
                  className="btn kucuk tehlike"
                  onClick={() => { setSilOnay(null); cikar(f.id); }}
                >
                  Sil
                </button>
                <button className="btn kucuk ikincil" onClick={() => setSilOnay(null)}>
                  Vazgeç
                </button>
              </>
            ) : (
              <button
                className="btn kucuk ikincil"
                onClick={() => setSilOnay(f.id)}
                aria-label={(p?.gorunen_ad ?? "Arkadaşını") + " arkadaşlıktan çıkar"}
                title="Arkadaşlıktan çıkar"
              >
                <Ikon ad="carpi" boyut={16} />
              </button>
            )}
          </div>
        );
      })}

      {gidenIstekler.length > 0 && (
        <>
          <div className="baslik" style={{ marginTop: 14 }}>
            Bekleyen istekler
          </div>
          {gidenIstekler.map((f) => (
            <div key={f.id} className="liste-satir">
              <Avatar profile={f.add} />
              <div className="bilgi">
                <div className="isim">{f.add?.gorunen_ad}</div>
                <div className="detay">cevap bekleniyor…</div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
