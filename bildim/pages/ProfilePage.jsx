import { useEffect, useState } from "react";
import Ikon from "../components/Ikon.jsx";
import { sesAcikMi, sesAyarla, sesTik } from "../lib/ses.js";
import Modal from "../components/Modal.jsx";
import { hataMesaji } from "../lib/hata.js";
import { Link } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import AvatarCerceve from "../components/AvatarCerceve.jsx";
import RankBadge from "../components/RankBadge.jsx";
import SayanSayi from "../components/SayanSayi.jsx";
import KonumSecici from "../components/KonumSecici.jsx";
import ProfilAyarlari from "../components/ProfilAyarlari.jsx";
import TemaDugmesi from "../components/TemaDugmesi.jsx";
import { KOYU_TEMA_KAPALI } from "../lib/tema.js";
import UstalikIzgarasi from "../components/UstalikIzgarasi.jsx";
import KategoriProfili from "../components/KategoriProfili.jsx";
import { bayrak, konumKilidiKalan, sureMetni } from "../lib/konum.js";
import { rutbeBul, sonrakiRutbe } from "../lib/ranks.js";
import { y } from "../lib/yol.js";
import {
  pushDestekleniyor,
  pushDurumu,
  bildirimleriAc,
  bildirimleriKapat,
} from "../lib/push.js";
import { DILLER, tt, ttSunucu } from "../lib/dil.js";
import { useDil } from "../lib/dilKanca.js";

export default function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { dil, dilDegistir } = useDil();
  const [rozetler, setRozetler] = useState([]);
  const [kazanilan, setKazanilan] = useState(new Set());
  const [kopyalandi, setKopyalandi] = useState(false);
  // Profil dört sekmeye ayrıldı; varsayılan İstatistiklerim.
  const [sekme, setSekme] = useState("istatistik");
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

  if (!profile) return <div className="yukleniyor">{tt("Yükleniyor…")}</div>;

  const r = rutbeBul(profile.puan);
  const sonraki = sonrakiRutbe(profile.puan);
  const ilerleme = sonraki
    ? Math.min(100, ((profile.puan - r.min) / (sonraki.min - r.min)) * 100)
    : 100;


  return (
    <div>
      {/* 2B KARAKTER VİTRİNİ KALKTI (13 Eylül 2026): profilde artık
          seçilen avatar fotoğrafı görünür, 3B karakter yalnız meydanda. */}

      <h1 className="baslik bd-gorsel-gizli">{tt("Profil")}</h1>
      <div className="bd-profil-ust">
        <AvatarCerceve profile={profile} boyut={92} userId={user?.id} />

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
          <span className="etiket">{tt("Puan")}</span>
        </div>
        {/* Boş durum: kocaman bir "0" yerine hedefi göster. Sıfır bir başarı
            değil, henüz atılmamış bir adım. */}
        {profile.sampiyonluk > 0 ? (
          <div className="bd-istatistik">
            <span className="deger"><SayanSayi deger={profile.sampiyonluk} /></span>
            <span className="etiket">{tt("Şampiyonluk")}</span>
          </div>
        ) : (
          <div className="bd-istatistik">
            {/* ÜÇ KUTU AYNI TÜRDE: sayı + etiket. Eskiden ortadaki bir
                cümleydi ("İlk şampiyonluğuna / 1 turnuva kaldı") ve aynı
                hizada üç farklı tür bilgi duruyordu; kutu taşıyordu. */}
            <span className="deger">1</span>
            <span className="etiket">{tt("Turnuvaya kaldı")}</span>
          </div>
        )}
        {(profile.seri ?? 0) > 0 ? (
          <div className="bd-istatistik">
            <span className="deger">{profile.seri}</span>
            <span className="etiket">{tt("Günlük Seri")}</span>
          </div>
        ) : (
          <div className="bd-istatistik">
            <span className="deger">1</span>
            <span className="etiket">{tt("Maç ile seri başlar")}</span>
          </div>
        )}
      </div>

      {/* ---------- SEKMELER ----------
          Sayfa 3890 px'ti: kimlik, istatistik, sekiz ayar kartı, rozetler
          ve davet arka arkaya tek sütundaydı. Bloklar AYNEN korundu,
          yalnız dört sekmeye ayrıldı. */}
      <div className="bd-profil-sekmeler" role="tablist" aria-label={tt("Profil bölümleri")}>
        {[["istatistik", tt("İstatistiklerim")], ["ayarlar", tt("Ayarlar")],
          ["rozet", tt("Rozetler")], ["davet", tt("Davet")]].map(([id, ad]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={sekme === id}
            className={"bd-profil-sekme" + (sekme === id ? " aktif" : "")}
            onClick={() => setSekme(id)}
          >
            {ad}
          </button>
        ))}
      </div>

      {sekme === "istatistik" && (<>
      {/* Kategori başarısı + unvan (Paket 14, 4.8/4.10) */}
      <div className="kart"><KategoriProfili userId={user?.id} /></div>
      <UstalikIzgarasi />

      {/* ---------- Hatalarım bankası ---------- */}
      {banka && (
        <Link to={y("/calisma")} className="kart bd-profil-hatalarim">
          <span className="bd-mod-ikon hatalarim">
            <Ikon ad="kitap" boyut={20} />
          </span>
          <div className="bd-profil-hatalarim-metin">
            <div className="ad">{tt("Hatalarım")}</div>
            <div className="alt-yazi">
              {tt("Öğrenilen soru:")} <b>{banka.ogrenilen}</b> {tt("· Bankada:")} <b>{banka.bekleyen}</b>
            </div>
          </div>
          <span className="ok" aria-hidden="true">›</span>
        </Link>
      )}

      {sonraki && (
        <div className="kart">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              {tt("Sonraki rütbe:")} <Ikon ad={sonraki.ikon} boyut={15} /> {sonraki.ad}
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
      </>)}

      {sekme === "ayarlar" && (<>
      {/* ---------- Görünüm (3B karakter) — EN ÜSTTE (Paket 8) ----------
          Eskiden ProfilAyarlari'nın beş kartının ALTINDAYDI; önemli bir
          özellik 6 kaydırma arkasında kalıyordu. */}
      <Link to={y("/gorunum")} className="kart bd-profil-hatalarim">
        <span className="bd-mod-ikon" style={{ background: "var(--bd-vurgu)" }}>
          <Ikon ad="tisort" boyut={20} />
        </span>
        <div className="bd-profil-hatalarim-metin">
          <div className="ad">{tt("Görünüm")}</div>
          <div className="alt-yazi">
            {tt("Saç, şapka, gözlük, kıyafet ve efektleri buradan değiştir.")}
          </div>
        </div>
        <span className="ok" aria-hidden="true">›</span>
      </Link>

      <ProfilAyarlari />

      {/* ---------- Konum (şehir/ülke ligi) ---------- */}
      {konumDuzenle ? (
        <KonumSecici mod="kart" onKapat={() => setKonumDuzenle(false)} />
      ) : (
        <div className="kart bd-konum-ozet">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{tt("Yarıştığın şehir")}</div>
            <div className="alt-yazi">
              {profile.ulke
                ? `${bayrak(profile.ulke)} ${profile.sehir ?? "—"}`
                : tt("Henüz seçmedin — şehir ve ülke liglerine giremezsin.")}
            </div>
            {konumKilidiKalan(profile.konum_degisti_at) > 0 && (
              <div className="alt-yazi">
                {tt("Değiştirmek için")} {sureMetni(konumKilidiKalan(profile.konum_degisti_at))} {tt("kaldı.")}
              </div>
            )}
          </div>
          <button className="btn kucuk ikincil" onClick={() => setKonumDuzenle(true)}>
            {profile.ulke ? tt("Değiştir") : tt("Seç")}
          </button>
        </div>
      )}

      {pushDestekleniyor() && bildirim !== "desteklenmiyor" && (
        <div className="kart" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="bd-ayar-ikon"><Ikon ad="zil" boyut={22} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{tt("Bildirimler")}</div>
            <div className="alt-yazi">
              {bildirim === "acik"
                ? tt("Açık")
                : bildirim === "engelli"
                  ? tt("Tarayıcı ayarlarından engellenmiş.")
                  : tt("Kapalı")}
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
              {bildirim === "acik" ? tt("Kapat") : tt("Aç")}
            </button>
          )}
        </div>
      )}

      {/* Maç sesleri: son 5 saniye tik'i, doğru/yanlış vuruşu, bitiş tonu */}
      <div className="kart" style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div className="bd-ayar-ikon"><Ikon ad={ses ? "sesAcik" : "sesKapali"} boyut={22} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{tt("Oyun sesleri")}</div>
          <div className="alt-yazi">
            {ses ? tt("Açık") : tt("Kapalı")}
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
          {ses ? tt("Kapat") : tt("Aç")}
        </button>
      </div>

      {/* SADELEŞTİRME — tema düğmesi üst bardan kalktı ama
          KAYBOLMADI. Ayar, ayarların olduğu yere taşındı; oyuncu kontrolü
          elinde tutuyor. Bileşen aynı bileşen. */}
      {/* Dil: arayüz + soru dili. Seçim profile yazılır, sayfa bir kez yenilenir. */}
      <div className="kart bd-ayar-satir">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{tt("Dil")}</div>
          <div className="alt-yazi">{tt("Arayüzün ve soruların dili")}</div>
        </div>
        <div className="giris-dil bd-ayar-dil" role="group" aria-label={tt("Dil")}>
          {DILLER.map((d) => (
            <button
              key={d}
              type="button"
              className={"giris-dil-btn" + (dil === d ? " aktif" : "")}
              aria-pressed={dil === d}
              onClick={() => dilDegistir(d)}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Koyu tema geçici olarak kapalı (lib/tema.js › KOYU_TEMA_KAPALI):
          geri bildirim süresince tek mod, düğme gizli. */}
      {!KOYU_TEMA_KAPALI && (
      <div className="kart bd-ayar-satir">
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* "Görünüm" adı 3B karakter kartına ait (Paket 8): iki kart aynı
              adı taşıyordu. */}
          <div style={{ fontWeight: 700, fontSize: 14 }}>{tt("Tema")}</div>
          <div className="alt-yazi">{tt("Açık ve koyu tema arasında geç")}</div>
        </div>
        <TemaDugmesi />
      </div>
      )}

      {/* ---------- Yasal / hesap ---------- */}
      <div className="kart">
        <div className="baslik">{tt("Hesap")}</div>
        <Link to="/gizlilik" className="bd-metin-link">
          {tt("Gizlilik politikası")}
        </Link>
        <Link to="/kosullar" className="bd-metin-link">
          {tt("Kullanım koşulları")}
        </Link>

        <button
          className="btn tehlike"
          style={{ marginTop: 12 }}
          onClick={() => {
            setSilHata(null);
            setSilOnay(true);
          }}
        >
          {tt("Hesabımı sil")}
        </button>
        <div className="alt-yazi" style={{ marginTop: 8 }}>
          {tt("Profilin, puanların, rozetlerin ve tüm oyun kayıtların kalıcı olarak silinir. Bu işlem geri alınamaz.")}
        </div>
      </div>

      <button className="btn tehlike" onClick={signOut}>
        {tt("Çıkış Yap")}
      </button>
      </>)}

      {sekme === "rozet" && (<>
      <div className="kart">
        <div className="baslik">
          {tt("Rozetler (")}{kazanilan.size}/{rozetler.length})
        </div>
        <div className="rozet-grid">
          {rozetler.map((r) => {
            const var_mi = kazanilan.has(r.id);
            return (
              <div key={r.id} className={`rozet ${var_mi ? "" : "kilitli"}`}>
                <div className="rozet-ikon">{var_mi ? r.ikon : <Ikon ad="kilit" boyut={18} />}</div>
                <div className="rozet-ad">{ttSunucu(r.ad)}</div>
                <div className="rozet-aciklama">{ttSunucu(r.aciklama)}</div>
              </div>
            );
          })}
        </div>
      </div>
      </>)}

      {sekme === "davet" && (<>
      <div className="kart" style={{ textAlign: "center" }}>
        <div className="baslik">{tt("Arkadaşını davet et")}</div>
        <div className="alt-yazi" style={{ marginBottom: 12 }}>
          {tt("Her davet için")} <b>{tt("ikiniz de 200 coin")}</b>.
          {profile.davet_sayisi > 0 && (
            <> {tt("Şu ana kadar")} {profile.davet_sayisi} {tt("kişi davet ettin.")}</>
          )}
        </div>
        <button
          className="btn"
          onClick={async () => {
            const link = `${window.location.origin}/?davet=${user.id}`;
            const mesaj = tt("Quiz Tactics'te benimle yarışmaya var mısın? Bu linkle gel, ikimiz de 200 coin kazanalım: {0}", { 0: link });
            if (navigator.share) {
              try {
                await navigator.share({ title: "Quiz Tactics", text: mesaj });
              } catch { /* vazgeçti */ }
            } else {
              await navigator.clipboard.writeText(mesaj);
              setKopyalandi(true);
              setTimeout(() => setKopyalandi(false), 2500);
            }
          }}
        >
          {kopyalandi ? tt("Kopyalandı") : tt("Davet linkini paylaş")}
        </button>
      </div>
      </>)}

      {silOnay && (
        <Modal onKapat={siliniyor ? undefined : () => { setSilOnay(false); setSilMetin(""); }} etiket={tt("Hesap silme onayı")}>
          <div className="bd-modal">
            <div className="bd-konum-baslik">{tt("Hesabını silmek üzeresin")}</div>
            <div className="bd-konum-aciklama">
              {tt("Bu işlem")} <b>{tt("geri alınamaz")}</b>{tt(". Onaylamak için aşağıya")}{" "}
              <b>{profile.username}</b> {tt("yaz.")}
            </div>
            <label className="bd-alan">
              <span>{tt("Hesap kimliğin")}</span>
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
                    setSilHata(hataMesaji(e, tt("Hesap silinemedi.")));
                    setSiliniyor(false);
                  }
                }}
              >
                {siliniyor ? tt("Siliniyor…") : tt("Evet, hesabımı sil")}
              </button>
              <button
                className="btn ikincil"
                disabled={siliniyor}
                onClick={() => {
                  setSilOnay(false);
                  setSilMetin("");
                }}
              >
                {tt("Vazgeç")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
