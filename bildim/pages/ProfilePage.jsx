import { useEffect, useState } from "react";
import Ikon from "../components/Ikon.jsx";
import { sesAcikMi, sesAyarla, sesTik } from "../lib/ses.js";
import Modal from "../components/Modal.jsx";
import { hataMesaji } from "../lib/hata.js";
import { Link } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import RankBadge from "../components/RankBadge.jsx";
import SayanSayi from "../components/SayanSayi.jsx";
import KonumSecici from "../components/KonumSecici.jsx";
import ProfilAyarlari from "../components/ProfilAyarlari.jsx";
import UstalikIzgarasi from "../components/UstalikIzgarasi.jsx";
import { bayrak, konumKilidiKalan, sureMetni } from "../lib/konum.js";
import { rutbeBul, sonrakiRutbe } from "../lib/ranks.js";
import { y } from "../lib/yol.js";
import {
  pushDestekleniyor,
  pushDurumu,
  bildirimleriAc,
  bildirimleriKapat,
} from "../lib/push.js";

export default function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [rozetler, setRozetler] = useState([]);
  const [kazanilan, setKazanilan] = useState(new Set());
  const [kopyalandi, setKopyalandi] = useState(false);
  const [bildirim, setBildirim] = useState("kapali");
  const [ses, setSes] = useState(() => sesAcikMi());
  const [bildirimHata, setBildirimHata] = useState(null);
  const [konumDuzenle, setKonumDuzenle] = useState(false);
  const [silOnay, setSilOnay] = useState(false);
  const [silMetin, setSilMetin] = useState("");
  const [silHata, setSilHata] = useState(null);
  const [siliniyor, setSiliniyor] = useState(false);
  // Hatalarım bankası özeti
  const [banka, setBanka] = useState(null);

  useEffect(() => {
    pushDurumu().then(setBildirim);
  }, []);

  // Hatalarım: öğrenilen / bankada bekleyen
  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("yanlis_bankam");
        if (error) throw error;
        const ilk = (data ?? [])[0];
        if (aktif && ilk) setBanka({ ogrenilen: ilk.ogrenilen ?? 0, bekleyen: ilk.bekleyen ?? 0 });
      } catch {
        /* migration bekliyor olabilir — bölüm gizli kalır */
      }
    })();
    return () => {
      aktif = false;
    };
  }, []);

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


  return (
    <div>
      <div className="bd-profil-ust">
        <Avatar profile={profile} boyut={92} />

        {/* Görünen ad artık takma addır; gerçek kullanıcı adı gösterilmez.
            Takma ad düzenlemesi aşağıdaki ProfilAyarlari kartındadır. */}
        <div className="bd-profil-ad">{profile.gorunen_ad}</div>

        <div style={{ marginTop: 12 }}>
          <RankBadge puan={profile.puan} />
        </div>
      </div>

      {/* İstatistikler: 3'lü plaka */}
      <div className="bd-istatistik-3">
        <div className="bd-istatistik">
          <span className="deger" style={{ color: "var(--bd-odul)" }}><SayanSayi deger={profile.puan} /></span>
          <span className="etiket">Puan</span>
        </div>
        <div className="bd-istatistik">
          <span className="deger">{profile.sampiyonluk}</span>
          <span className="etiket">Şampiyonluk</span>
        </div>
        <div className="bd-istatistik">
          <span className="deger">{profile.seri ?? 0}</span>
          <span className="etiket">Günlük Seri</span>
        </div>
      </div>

      <ProfilAyarlari />

      <UstalikIzgarasi />

      {/* ---------- Hatalarım bankası ---------- */}
      {banka && (
        <Link to={y("/calisma")} className="kart bd-profil-hatalarim">
          <span className="bd-mod-ikon hatalarim">
            <Ikon ad="kitap" boyut={20} />
          </span>
          <div className="bd-profil-hatalarim-metin">
            <div className="ad">Hatalarım</div>
            <div className="alt-yazi">
              Öğrenilen soru: <b>{banka.ogrenilen}</b> · Bankada: <b>{banka.bekleyen}</b>
            </div>
          </div>
          <span className="ok" aria-hidden="true">›</span>
        </Link>
      )}

      {/* ---------- Konum (şehir/ülke ligi) ---------- */}
      {konumDuzenle ? (
        <KonumSecici mod="kart" onKapat={() => setKonumDuzenle(false)} />
      ) : (
        <div className="kart bd-konum-ozet">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Yarıştığın şehir</div>
            <div className="alt-yazi">
              {profile.ulke
                ? `${bayrak(profile.ulke)} ${profile.sehir ?? "—"}`
                : "Henüz seçmedin — şehir ve ülke liglerine giremezsin."}
            </div>
            {konumKilidiKalan(profile.konum_degisti_at) > 0 && (
              <div className="alt-yazi">
                Değiştirmek için {sureMetni(konumKilidiKalan(profile.konum_degisti_at))} kaldı.
              </div>
            )}
          </div>
          <button className="btn kucuk ikincil" onClick={() => setKonumDuzenle(true)}>
            {profile.ulke ? "Değiştir" : "Seç"}
          </button>
        </div>
      )}

      {sonraki && (
        <div className="kart">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              Sonraki rütbe: <Ikon ad={sonraki.ikon} boyut={15} /> {sonraki.ad}
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

      {pushDestekleniyor() && bildirim !== "desteklenmiyor" && (
        <div className="kart" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="bd-ayar-ikon"><Ikon ad="zil" boyut={22} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Bildirimler</div>
            <div className="alt-yazi">
              {bildirim === "acik"
                ? "Açık"
                : bildirim === "engelli"
                  ? "Tarayıcı ayarlarından engellenmiş."
                  : "Kapalı"}
            </div>
            {bildirimHata && <div className="hata-kutu" style={{ marginTop: 6 }}>{bildirimHata}</div>}
          </div>
          {bildirim !== "engelli" && (
            <button
              className={`btn kucuk ${bildirim === "acik" ? "ikincil" : ""}`}
              onClick={async () => {
                setBildirimHata(null);
                try {
                  if (bildirim === "acik") {
                    await bildirimleriKapat();
                    setBildirim("kapali");
                  } else {
                    await bildirimleriAc();
                    setBildirim("acik");
                  }
                } catch (e) {
                  setBildirimHata(hataMesaji(e));
                  setBildirim(await pushDurumu());
                }
              }}
            >
              {bildirim === "acik" ? "Kapat" : "Aç"}
            </button>
          )}
        </div>
      )}

      {/* Maç sesleri: son 5 saniye tik'i, doğru/yanlış vuruşu, bitiş tonu */}
      <div className="kart" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="bd-ayar-ikon"><Ikon ad={ses ? "sesAcik" : "sesKapali"} boyut={22} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Oyun sesleri</div>
          <div className="alt-yazi">
            {ses ? "Açık" : "Kapalı"}
          </div>
        </div>
        <button
          className={`btn kucuk ${ses ? "ikincil" : ""}`}
          onClick={() => {
            const yeniDurum = !ses;
            sesAyarla(yeniDurum);
            setSes(yeniDurum);
            if (yeniDurum) sesTik(3); // örnek ses
          }}
        >
          {ses ? "Kapat" : "Aç"}
        </button>
      </div>

      <div className="kart" style={{ textAlign: "center" }}>
        <div className="baslik">Arkadaşını davet et</div>
        <div className="alt-yazi" style={{ marginBottom: 12 }}>
          Her davet için <b>ikiniz de +50 puan</b>.
          {profile.davet_sayisi > 0 && (
            <> Şu ana kadar {profile.davet_sayisi} kişi davet ettin.</>
          )}
        </div>
        <button
          className="btn"
          onClick={async () => {
            const link = `${window.location.origin}/?davet=${user.id}`;
            const mesaj = `Quizador'de benimle yarışmaya var mısın? Bu linkle gel, ikimiz de +50 puan kazanalım: ${link}`;
            if (navigator.share) {
              try {
                await navigator.share({ title: "Quizador", text: mesaj });
              } catch { /* vazgeçti */ }
            } else {
              await navigator.clipboard.writeText(mesaj);
              setKopyalandi(true);
              setTimeout(() => setKopyalandi(false), 2500);
            }
          }}
        >
          {kopyalandi ? "Kopyalandı" : "Davet linkini paylaş"}
        </button>
      </div>

      <div className="kart">
        <div className="baslik">
          Rozetler ({kazanilan.size}/{rozetler.length})
        </div>
        <div className="rozet-grid">
          {rozetler.map((r) => {
            const var_mi = kazanilan.has(r.id);
            return (
              <div key={r.id} className={`rozet ${var_mi ? "" : "kilitli"}`}>
                <div className="rozet-ikon">{var_mi ? r.ikon : <Ikon ad="kilit" boyut={18} />}</div>
                <div className="rozet-ad">{r.ad}</div>
                <div className="rozet-aciklama">{r.aciklama}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------- Yasal / hesap ---------- */}
      <div className="kart">
        <div className="baslik">Hesap</div>
        <Link to="/gizlilik" className="bd-metin-link">
          Gizlilik politikası
        </Link>
        <Link to="/kosullar" className="bd-metin-link">
          Kullanım koşulları
        </Link>

        <button
          className="btn tehlike"
          style={{ marginTop: 12 }}
          onClick={() => {
            setSilHata(null);
            setSilOnay(true);
          }}
        >
          Hesabımı sil
        </button>
        <div className="alt-yazi" style={{ marginTop: 8 }}>
          Profilin, puanların, rozetlerin ve tüm oyun kayıtların kalıcı olarak silinir.
          Bu işlem geri alınamaz.
        </div>
      </div>

      <button className="btn tehlike" onClick={signOut}>
        Çıkış Yap
      </button>

      {silOnay && (
        <Modal onKapat={siliniyor ? undefined : () => { setSilOnay(false); setSilMetin(""); }} etiket="Hesap silme onayı">
          <div className="bd-modal">
            <div className="bd-konum-baslik">Hesabını silmek üzeresin</div>
            <div className="bd-konum-aciklama">
              Bu işlem <b>geri alınamaz</b>. Onaylamak için aşağıya{" "}
              <b>{profile.username}</b> yaz.
            </div>
            <label className="bd-alan">
              <span>Hesap kimliğin</span>
              <input
                type="text"
                autoComplete="off"
                value={silMetin}
                onChange={(e) => setSilMetin(e.target.value)}
                placeholder={profile.username}
              />
            </label>
            {silHata && <div className="hata-kutu">{silHata}</div>}
            <div className="bd-konum-butonlar">
              <button
                className="btn tehlike"
                disabled={siliniyor || silMetin.trim() !== profile.username}
                onClick={async () => {
                  setSilHata(null);
                  setSiliniyor(true);
                  try {
                    const { error } = await supabase.rpc("hesabimi_sil");
                    if (error) throw error;
                    await signOut();
                  } catch (e) {
                    setSilHata(hataMesaji(e, "Hesap silinemedi."));
                    setSiliniyor(false);
                  }
                }}
              >
                {siliniyor ? "Siliniyor…" : "Evet, hesabımı sil"}
              </button>
              <button
                className="btn ikincil"
                disabled={siliniyor}
                onClick={() => {
                  setSilOnay(false);
                  setSilMetin("");
                }}
              >
                Vazgeç
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
