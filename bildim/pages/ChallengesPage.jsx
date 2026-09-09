import { useCallback, useEffect, useRef, useState } from "react";
import KategoriIkon from "../components/KategoriIkon.jsx";
import Ikon from "../components/Ikon.jsx";
import { hataMesaji } from "../lib/hata.js";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase.js";
import { useAuth } from "../../src/context/AuthContext.jsx";
import Avatar from "../../src/components/Avatar.jsx";
import { kategoriAdi, kategoriEtiket, kategorileriSirala } from "../lib/kategoriler.js";
import { oyuncuAdi } from "../lib/oyuncu.js";

const MAC_SECIMI = `*,
  p1:profiles!matches_oyuncu1_fkey(id, gorunen_ad, gorunen_avatar, puan),
  p2:profiles!matches_oyuncu2_fkey(id, gorunen_ad, gorunen_avatar, puan)`;

const GRUP_SECIMI = `*,
  katilimcilar:group_match_players(group_match_id, user_id, davet_durumu, skor,
    profil:profiles(id, gorunen_ad, gorunen_avatar, puan))`;

const HIZLI_SECIMI = `*,
  katilimcilar:hizli_oyuncular(hizli_mac_id, user_id, davet_durumu, skor,
    profil:profiles(id, gorunen_ad, gorunen_avatar, puan))`;

// Beş bot var (isabet 0.25 · 0.40 · 0.55 · 0.70 · 0.90); eşikler beşi de
// ayrı gösterecek şekilde ayarlandı — önceden üçü aynı etikete düşüyordu.
const botZorluk = (isabet) =>
  isabet <= 0.30
    ? { etiket: "Çok kolay", renk: "var(--bd-basari)" }
    : isabet <= 0.45
      ? { etiket: "Kolay", renk: "var(--success)" }
      : isabet <= 0.60
        ? { etiket: "Orta", renk: "var(--accent)" }
        : isabet <= 0.75
          ? { etiket: "Zor", renk: "var(--bd-odul-2)" }
          : { etiket: "Çok zor", renk: "var(--danger)" };

// Kategori etiketleri ortak dosyada (bildim/lib/kategoriler.js)

/** Kurduğun ama henüz yanıtlanmamış grup/hızlı davet kartı. */
function BekleyenKurulum({ baslik, kategori, katilimcilar, onIptal, iptalEdilen, id }) {
  const hazir = katilimcilar.filter((k) => k.davet_durumu === "kabul").length;
  return (
    <div className="bd-bekleyen-kurulum">
      <div className="bd-bk-ust">
        <div className="bd-bk-baslik">{baslik}</div>
        <div className="bd-bk-alt">
          {kategori ? kategoriEtiket(kategori) : "Karışık"} · {hazir}/
          {katilimcilar.length} hazır
        </div>
      </div>

      <div className="bd-bk-oyuncular">
        {katilimcilar.map((k) => (
          <div
            key={k.user_id}
            className={`bd-bk-oyuncu ${k.davet_durumu === "kabul" ? "hazir" : "bekliyor"}`}
            title={`${oyuncuAdi(k.profil, k.user_id)} — ${
              k.davet_durumu === "kabul" ? "hazır" : "bekliyor"
            }`}
          >
            <Avatar
              profile={{
                gorunen_ad: oyuncuAdi(k.profil, k.user_id),
                gorunen_avatar: k.profil?.gorunen_avatar,
              }}
              boyut={34}
            />
            <span className="bd-bk-durum" aria-hidden="true">
              {k.davet_durumu === "kabul" ? "hazır" : "…"}
            </span>
            <span className="bd-bk-ad">{oyuncuAdi(k.profil, k.user_id)}</span>
          </div>
        ))}
      </div>

      <button
        className="btn kucuk ikincil"
        disabled={iptalEdilen === id}
        onClick={onIptal}
      >
        {iptalEdilen === id ? "İptal ediliyor…" : "İptal et"}
      </button>
    </div>
  );
}

export default function ChallengesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [maclar, setMaclar] = useState([]);
  const [hata, setHata] = useState(null);
  const [toast, setToast] = useState(null);
  const bekleyenlerRef = useRef(null);
  const [botlar, setBotlar] = useState([]);
  const [oyuncular, setOyuncular] = useState([]);
  const [kategoriler, setKategoriler] = useState([]);
  const [kategori, setKategori] = useState(null); // null = karışık
  const [grupMaclar, setGrupMaclar] = useState([]);
  const [grupOyuncuSayisi, setGrupOyuncuSayisi] = useState(3);
  const [grupSecili, setGrupSecili] = useState([]);
  const [grupHata, setGrupHata] = useState(null);
  const [hizliMaclar, setHizliMaclar] = useState([]);
  const [hizliSecili, setHizliSecili] = useState([]);
  const [hizliHata, setHizliHata] = useState(null);
  const [grupAcik, setGrupAcik] = useState(false);
  const [hizliAcik, setHizliAcik] = useState(false);
  const [iptalEdilen, setIptalEdilen] = useState(null);
  const [iptalHata, setIptalHata] = useState(null);
  const katSeritRef = useRef(null);
  const [seritSonda, setSeritSonda] = useState(false);

  // Şerit sona geldiğinde sağdaki sönümleme ve "›" ipucu kaybolur
  const seritKaydi = useCallback(() => {
    const e = katSeritRef.current;
    if (!e) return;
    setSeritSonda(e.scrollLeft + e.clientWidth >= e.scrollWidth - 8);
  }, []);

  // Seçili kategori her zaman görünür alanda kalsın
  useEffect(() => {
    const e = katSeritRef.current;
    if (!e) return;
    const secili = e.querySelector(".bd-kat-kart.aktif");
    try {
      secili?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    } catch {
      /* eski tarayıcı — kaydırma olmadan da çalışır */
    }
    seritKaydi();
  }, [kategori, kategoriler, seritKaydi]);

  // Kurduğun grup/hızlı daveti geri al
  const davetIptal = async (tur, id) => {
    setIptalHata(null);
    setIptalEdilen(id);
    try {
      const { error } = await supabase.rpc(
        tur === "grup" ? "grup_mac_iptal" : "hizli_mac_iptal",
        tur === "grup" ? { p_group_match_id: id } : { p_hizli_mac_id: id }
      );
      if (error) throw error;
      if (tur === "grup") await grupYukle();
      else await hizliYukle();
    } catch (e) {
      setIptalHata(hataMesaji(e, "Davet iptal edilemedi."));
    } finally {
      setIptalEdilen(null);
    }
  };

  // Bekleyen tüm davetleri tek dokunuşla geri al
  const tumDavetleriIptal = async () => {
    setIptalHata(null);
    setIptalEdilen("tumu");
    try {
      await Promise.all([
        ...grupBeklenenTum.map((gm) =>
          supabase.rpc("grup_mac_iptal", { p_group_match_id: gm.id })
        ),
        ...hizliBeklenenTum.map((hm) =>
          supabase.rpc("hizli_mac_iptal", { p_hizli_mac_id: hm.id })
        ),
      ]);
      await Promise.all([grupYukle(), hizliYukle()]);
    } catch (e) {
      setIptalHata(hataMesaji(e, "Davetler iptal edilemedi."));
    } finally {
      setIptalEdilen(null);
    }
  };

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, gorunen_ad, gorunen_avatar, puan, bot_isabet")
      .eq("is_bot", true)
      .order("bot_isabet", { ascending: true })
      .then(({ data }) => setBotlar(data ?? []));
    // Rakip olabilecekler: YALNIZ arkadaşlar (sunucu da bunu zorunlu kılıyor).
    (async () => {
      try {
        const { data: dostluklar, error } = await supabase
          .from("friendships")
          .select("requester, addressee")
          .eq("durum", "arkadas")
          .or(`requester.eq.${user.id},addressee.eq.${user.id}`);
        if (error) throw error;
        const idler = [
          ...new Set(
            (dostluklar ?? []).map((f) => (f.requester === user.id ? f.addressee : f.requester))
          ),
        ];
        if (idler.length === 0) {
          setOyuncular([]);
          return;
        }
        const { data, error: hata2 } = await supabase
          .from("profiles")
          .select("id, gorunen_ad, gorunen_avatar, puan")
          .in("id", idler)
          .order("puan", { ascending: false });
        if (hata2) throw hata2;
        setOyuncular(data ?? []);
      } catch {
        setOyuncular([]);
      }
    })();
    supabase
      .rpc("get_categories")
      .then(({ data }) => setKategoriler(data ?? []));
  }, [user.id]);

  const yukle = useCallback(async () => {
    const { data } = await supabase
      .from("matches")
      .select(MAC_SECIMI)
      .or(`oyuncu1.eq.${user.id},oyuncu2.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(30);
    setMaclar(data ?? []);
  }, [user.id]);

  useEffect(() => {
    yukle();
    const kanal = supabase
      .channel("maclar")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, yukle)
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [yukle]);

  const grupYukle = useCallback(async () => {
    const { data } = await supabase
      .from("group_matches")
      .select(GRUP_SECIMI)
      .order("created_at", { ascending: false })
      .limit(20);
    setGrupMaclar(data ?? []);
  }, []);

  useEffect(() => {
    grupYukle();
    const kanal = supabase
      .channel("grup_maclar")
      .on("postgres_changes", { event: "*", schema: "public", table: "group_matches" }, grupYukle)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_match_players" }, grupYukle)
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [grupYukle]);

  const hizliYukle = useCallback(async () => {
    const { data } = await supabase
      .from("hizli_maclar")
      .select(HIZLI_SECIMI)
      .order("created_at", { ascending: false })
      .limit(20);
    setHizliMaclar(data ?? []);
  }, []);

  // Sayfa açılınca 24 saatten eski, yanıtlanmamış davetler temizlensin.
  // (Saatlik cron da aynı işi yapar; cron durursa liste yine birikmesin diye
  //  burada da tetikleniyor.)
  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("eski_davetleri_temizle");
        if (error) throw error;
        if (!iptal && data > 0) {
          grupYukle();
          hizliYukle();
          yukle();
        }
      } catch {
        /* RPC yoksa (migration bekliyor) veya ağ hatası — sessiz geç */
      }
    })();
    return () => { iptal = true; };
  }, [grupYukle, hizliYukle, yukle]);

  useEffect(() => {
    hizliYukle();
    const kanal = supabase
      .channel("hizli_maclar")
      .on("postgres_changes", { event: "*", schema: "public", table: "hizli_maclar" }, hizliYukle)
      .on("postgres_changes", { event: "*", schema: "public", table: "hizli_oyuncular" }, hizliYukle)
      .subscribe();
    return () => supabase.removeChannel(kanal);
  }, [hizliYukle]);


  const meydanOku = async (hedefId) => {
    setHata(null);
    setToast(null);
    try {
      const { data, error } = await supabase.rpc("create_challenge", {
        p_rakip: hedefId,
        p_kategori: kategori,
      });
      if (error) throw error;
      const botMu = botlar.some((b) => b.id === hedefId);
      if (botMu && data) {
        // Bot daveti saniyeler içinde kabul eder: oyuncuyu bekletmeden maça al.
        navigate(`/bildim/mac/${data}`);
        return;
      }
      setToast("Davet gönderildi — rakip kabul edince maç başlayacak.");
      await yukle();
      // Bekleyenler listesine kaydır
      setTimeout(() => {
        bekleyenlerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (e) {
      setHata(hataMesaji(e, "Meydan okuma başlatılamadı."));
    }
  };

  const cevapVer = async (macId, kabul) => {
    setHata(null);
    const { error } = await supabase.rpc("respond_challenge", {
      p_match_id: macId,
      p_kabul: kabul,
    });
    if (error) setHata(hataMesaji(error));
    else if (kabul) navigate(`/bildim/mac/${macId}`);
    else yukle();
  };

  const grupAday = [
    ...botlar,
    ...oyuncular.filter((o) => !botlar.some((b) => b.id === o.id)),
  ];
  const grupGerekli = grupOyuncuSayisi - 1;

  const grupSecimToggle = (id) => {
    setGrupSecili((secili) => {
      if (secili.includes(id)) return secili.filter((s) => s !== id);
      if (secili.length >= grupGerekli) return secili;
      return [...secili, id];
    });
  };

  const grubuKur = async () => {
    setGrupHata(null);
    const { data, error } = await supabase.rpc("create_group_challenge", {
      p_rakipler: grupSecili,
      p_kategori: kategori,
    });
    if (error) setGrupHata(hataMesaji(error));
    else {
      setGrupSecili([]);
      navigate(`/bildim/grup-mac/${data}`);
    }
  };

  const grupCevapVer = async (grupMacId, kabul) => {
    setGrupHata(null);
    const { error } = await supabase.rpc("respond_group_challenge", {
      p_group_match_id: grupMacId,
      p_kabul: kabul,
    });
    if (error) setGrupHata(hataMesaji(error));
    else if (kabul) navigate(`/bildim/grup-mac/${grupMacId}`);
    else grupYukle();
  };

  const hizliGerekli = 4;

  const hizliSecimToggle = (id) => {
    setHizliSecili((secili) => {
      if (secili.includes(id)) return secili.filter((s) => s !== id);
      if (secili.length >= hizliGerekli) return secili;
      return [...secili, id];
    });
  };

  const hizliKur = async () => {
    setHizliHata(null);
    const { data, error } = await supabase.rpc("create_hizli_mac", {
      p_rakipler: hizliSecili,
      p_kategori: kategori,
    });
    if (error) setHizliHata(hataMesaji(error));
    else {
      setHizliSecili([]);
      navigate(`/bildim/hizli-mac/${data}`);
    }
  };

  const hizliCevapVer = async (hizliMacId, kabul) => {
    setHizliHata(null);
    const { error } = await supabase.rpc("respond_hizli_davet", {
      p_hizli_mac_id: hizliMacId,
      p_kabul: kabul,
    });
    if (error) setHizliHata(hataMesaji(error));
    else if (kabul) navigate(`/bildim/hizli-mac/${hizliMacId}`);
    else hizliYukle();
  };

  const hizliBenimKaydim = (hm) => hm.katilimcilar?.find((k) => k.user_id === user.id);
  const hizliGelen = hizliMaclar.filter(
    (hm) => hm.durum === "bekliyor" && hizliBenimKaydim(hm)?.davet_durumu === "bekliyor"
  );
  const hizliAktif = hizliMaclar.filter((hm) => hm.durum === "aktif" && hizliBenimKaydim(hm));
  const hizliBeklenenTum = hizliMaclar.filter(
    (hm) => hm.durum === "bekliyor" && hizliBenimKaydim(hm)?.davet_durumu === "kabul" && hm.kurucu === user.id
  );
  // Listede en fazla son 5 davet gösterilir; eskiler yığılmasın.
  const hizliBeklenen = hizliBeklenenTum.slice(0, 5);
  const hizliBiten = hizliMaclar
    .filter((hm) => hm.durum === "bitti" && hizliBenimKaydim(hm))
    .slice(0, 10);

  const grupBenimKaydim = (gm) => gm.katilimcilar?.find((k) => k.user_id === user.id);
  const grupGelen = grupMaclar.filter(
    (gm) => gm.durum === "bekliyor" && grupBenimKaydim(gm)?.davet_durumu === "bekliyor"
  );
  const grupAktif = grupMaclar.filter((gm) => gm.durum === "aktif" && grupBenimKaydim(gm));
  const grupBeklenenTum = grupMaclar.filter(
    (gm) => gm.durum === "bekliyor" && grupBenimKaydim(gm)?.davet_durumu === "kabul" && gm.kurucu === user.id
  );
  const grupBeklenen = grupBeklenenTum.slice(0, 5);
  const grupBiten = grupMaclar
    .filter((gm) => gm.durum === "bitti" && grupBenimKaydim(gm))
    .slice(0, 10);

  const gelen = maclar.filter((m) => m.durum === "bekliyor" && m.oyuncu2 === user.id);
  const giden = maclar.filter((m) => m.durum === "bekliyor" && m.oyuncu1 === user.id);
  const aktif = maclar.filter((m) => m.durum === "aktif");
  const biten = maclar.filter((m) => m.durum === "bitti").slice(0, 10);

  const rakip = (m) => (m.oyuncu1 === user.id ? m.p2 : m.p1);

  return (
    <div>
      <div className="baslik">Meydan Okuma</div>
      {hata && <div className="hata-kutu">{hata}</div>}
      {toast && <div className="bd-toast">{toast}</div>}

      {/* Sana gelen davetler EN ÜSTTE — aşağıda kalıp gözden kaçmasınlar */}
      <div className="bd-gelen-davetler">
      {gelen.length > 0 && (
        <>
          <div className="baslik">Sana gelen ({gelen.length})</div>
          {gelen.map((m) => (
            <div key={m.id} className="liste-satir">
              <Avatar profile={m.p1} />
              <div className="bilgi">
                <div className="isim">{m.p1?.gorunen_ad}</div>
                <div className="detay">sana meydan okudu!</div>
              </div>
              <button className="btn kucuk" onClick={() => cevapVer(m.id, true)}>
                Kabul
              </button>
              <button className="btn kucuk tehlike" onClick={() => cevapVer(m.id, false)}>
                Reddet
              </button>
            </div>
          ))}
        </>
      )}

      {hizliGelen.length > 0 && (
        <>
          <div className="baslik">Hızlı yarış davetlerin ({hizliGelen.length})</div>
          {hizliGelen.map((hm) => (
            <div key={hm.id} className="liste-satir">
              <div className="bilgi">
                <div className="isim">
                  {hm.katilimcilar
                    ?.filter((k) => k.user_id !== user.id)
                    .map((k) => k.profil?.gorunen_ad)
                    .join(", ")}
                </div>
                <div className="detay">Hızlı Olan Kazanır — 5 kişilik yarış</div>
              </div>
              <button className="btn kucuk" onClick={() => hizliCevapVer(hm.id, true)}>
                Kabul
              </button>
              <button className="btn kucuk tehlike" onClick={() => hizliCevapVer(hm.id, false)}>
                Reddet
              </button>
            </div>
          ))}
        </>
      )}

      {grupGelen.length > 0 && (
        <>
          <div className="baslik">Grup davetlerin ({grupGelen.length})</div>
          {grupGelen.map((gm) => (
            <div key={gm.id} className="liste-satir">
              <div className="bilgi">
                <div className="isim">
                  {gm.katilimcilar
                    ?.filter((k) => k.user_id !== user.id)
                    .map((k) => k.profil?.gorunen_ad)
                    .join(", ")}
                </div>
                <div className="detay">{gm.oyuncu_sayisi} kişilik gruba davet edildin</div>
              </div>
              <button className="btn kucuk" onClick={() => grupCevapVer(gm.id, true)}>
                Kabul
              </button>
              <button className="btn kucuk tehlike" onClick={() => grupCevapVer(gm.id, false)}>
                Reddet
              </button>
            </div>
          ))}
        </>
      )}

      </div>


      {/* Kategori seçimi 1v1, grup ve hızlı modun HEPSİ için geçerlidir. */}
      <div className="bd-kat-baslik">
        <span>Kategori</span>
        <span className="alt-yazi">1v1 · grup · hızlı mod için</span>
      </div>
      <div className={`bd-kat-serit ${seritSonda ? "sonda" : ""}`}>
      <div className="bd-kat-grid" ref={katSeritRef} onScroll={seritKaydi}>
        <button
          className={`bd-kat-kart ${kategori === null ? "aktif" : ""}`}
          onClick={() => setKategori(null)}
        >
          <KategoriIkon anahtar="karisik" boyut={26} plaka />
          <span className="bd-kat-ad">Karışık</span>
          <span className="bd-kat-alt">Tüm kategoriler</span>
        </button>
        {kategorileriSirala(kategoriler).map((k) => {
          const toplam = Number(k.soru_sayisi ?? 0);
          const gorulen = Number(k.gorulen_sayisi ?? 0);
          const yuzde = toplam > 0 ? Math.round((gorulen / toplam) * 100) : 0;
          return (
            <button
              key={k.kategori}
              className={`bd-kat-kart kat-${k.kategori} ${kategori === k.kategori ? "aktif" : ""}`}
              onClick={() => setKategori(k.kategori)}
            >
              <KategoriIkon anahtar={k.kategori} boyut={26} plaka />
              <span className="bd-kat-ad">{kategoriAdi(k.kategori)}</span>
              <span className="bd-kat-alt">
                {toplam} soru
                <span className="bd-kat-yuzde"> · %{yuzde} çözüldü</span>
              </span>
              <span className="bd-kat-bar">
                <span className="dolgu" style={{ width: `${yuzde}%` }} />
              </span>
            </button>
          );
        })}
      </div>
        {/* Kaydırılabilir olduğunu belli eden ipucu; sona gelince kaybolur */}
        <span className="bd-kat-ipucu" aria-hidden="true">›</span>
      </div>

      {botlar
        .filter(
          (b) =>
            !maclar.some(
              (m) =>
                (m.oyuncu1 === b.id || m.oyuncu2 === b.id) &&
                ["bekliyor", "aktif"].includes(m.durum)
            )
        )
        .map((b) => {
          const z = botZorluk(b.bot_isabet);
          return (
            <div key={b.id} className="liste-satir">
              <Avatar profile={b} />
              <div className="bilgi">
                <div className="isim">{b.gorunen_ad} <Ikon ad="robot" boyut={14} /></div>
                <div className="detay">
                  Zorluk: <span style={{ color: z.renk, fontWeight: 700 }}>{z.etiket}</span> · her zaman hazır
                </div>
              </div>
              <button className="btn kucuk" onClick={() => meydanOku(b.id)}>
                Meydan oku
              </button>
            </div>
          );
        })}

      <div className="kart">
        <div className="bd-kat-baslik">
          <span>Arkadaşlarına meydan oku</span>
          <span className="alt-yazi">{oyuncular.length} arkadaş</span>
        </div>
        {oyuncular.length === 0 ? (
          <div className="alt-yazi">
            Henüz arkadaşın yok. <b>Arkadaşlar</b> sekmesinden davet linkini paylaş.
          </div>
        ) : (
          oyuncular.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <Avatar profile={p} boyut={34} />
              <span style={{ flex: 1, fontWeight: 600 }}>{p.gorunen_ad}</span>
              <button className="btn kucuk" onClick={() => meydanOku(p.id)}>
                Meydan oku
              </button>
            </div>
          ))
        )}
      </div>

      {/* Grup ve hızlı mod kurulumu açılır panelde: sayfa uzayıp dağılmasın */}
      <div className="bd-panel">
        <button
          className={`bd-panel-basi ${grupAcik ? "acik" : ""}`}
          onClick={() => setGrupAcik((a) => !a)}
          aria-expanded={grupAcik}
        >
          <Ikon ad="kisiler" boyut={18} />
          <span>Grup Maçı Kur (3-5 kişi)</span>
          <span className="ok" aria-hidden="true">›</span>
        </button>
        {grupAcik && (
        <div className="bd-panel-govde">
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {[3, 4, 5].map((n) => (
            <button
              key={n}
              className={`oyuncu-secim-cip ${grupOyuncuSayisi === n ? "secili" : ""}`}
              onClick={() => {
                setGrupOyuncuSayisi(n);
                setGrupSecili((s) => s.slice(0, n - 1));
              }}
            >
              {n} Kişi
            </button>
          ))}
        </div>
        <div className="alt-yazi" style={{ marginBottom: 8 }}>
          {grupSecili.length}/{grupGerekli} rakip seçildi (botlar dahil)
        </div>
        <div>
          {grupAday.map((p) => {
            const secili = grupSecili.includes(p.id);
            const dolu = !secili && grupSecili.length >= grupGerekli;
            return (
              <button
                key={p.id}
                className={`oyuncu-secim-cip ${secili ? "secili" : ""}`}
                disabled={dolu}
                onClick={() => grupSecimToggle(p.id)}
              >
                {p.gorunen_ad}
                {p.bot_isabet != null && <Ikon ad="robot" boyut={13} />}
              </button>
            );
          })}
        </div>
        {grupHata && <div className="hata-kutu" style={{ marginTop: 10 }}>{grupHata}</div>}
        <button
          className="btn"
          style={{ marginTop: 12 }}
          disabled={grupSecili.length !== grupGerekli}
          onClick={grubuKur}
        >
          Grubu kur ve davet et
        </button>
        </div>
        )}
      </div>

      <div className="bd-panel">
        <button
          className={`bd-panel-basi ${hizliAcik ? "acik" : ""}`}
          onClick={() => setHizliAcik((a) => !a)}
          aria-expanded={hizliAcik}
        >
          <Ikon ad="hizli" boyut={18} />
          <span>Hızlı Olan Kazanır (5 kişi)</span>
          <span className="ok" aria-hidden="true">›</span>
        </button>
        {hizliAcik && (
        <div className="bd-panel-govde">
        <div className="alt-yazi" style={{ marginBottom: 10 }}>
          Herkese aynı soru aynı anda. Sadece <b>ilk doğru cevabı</b> veren puan alır. Joker yok!
        </div>
        <div className="alt-yazi" style={{ marginBottom: 8 }}>
          {hizliSecili.length}/{hizliGerekli} rakip seçildi (botlar dahil)
        </div>
        <div>
          {grupAday.map((p) => {
            const secili = hizliSecili.includes(p.id);
            const dolu = !secili && hizliSecili.length >= hizliGerekli;
            return (
              <button
                key={p.id}
                className={`oyuncu-secim-cip ${secili ? "secili" : ""}`}
                disabled={dolu}
                onClick={() => hizliSecimToggle(p.id)}
              >
                {p.gorunen_ad}
                {p.bot_isabet != null && <Ikon ad="robot" boyut={13} />}
              </button>
            );
          })}
        </div>
        {hizliHata && <div className="hata-kutu" style={{ marginTop: 10 }}>{hizliHata}</div>}
        <button
          className="btn"
          style={{ marginTop: 12 }}
          disabled={hizliSecili.length !== hizliGerekli}
          onClick={hizliKur}
        >
          Yarışı kur ve davet et
        </button>
        </div>
        )}
      </div>

      {oyuncular.length > 0 && (
        <>
          <div className="baslik">Oyuncular</div>
          {oyuncular.map((p) => {
            const mevcutMac = maclar.some(
              (m) =>
                (m.oyuncu1 === p.id || m.oyuncu2 === p.id) &&
                ["bekliyor", "aktif"].includes(m.durum)
            );
            return (
              <div key={p.id} className="liste-satir">
                <Avatar profile={p} boyut={38} />
                <div className="bilgi">
                  <div className="isim">{p.gorunen_ad}</div>
                  <div className="detay"><Ikon ad="yildiz" boyut={13} /> {p.puan}</div>
                </div>
                {!mevcutMac && (
                  <button className="btn kucuk" onClick={() => meydanOku(p.id)}>
                    Meydan oku
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Kurduğun ve yanıt bekleyen davetler — düz metin yerine kart listesi */}
      {(grupBeklenen.length > 0 || hizliBeklenen.length > 0) && (
        <>
          <div className="baslik">Bekleyen davetlerin</div>
          {(grupBeklenenTum.length + hizliBeklenenTum.length) > 5 && (
            <div className="alt-yazi" style={{ marginBottom: 8 }}>
              Son 5 davet gösteriliyor ({grupBeklenenTum.length + hizliBeklenenTum.length} bekleyen davet var).
            </div>
          )}
          {grupBeklenen.map((gm) => (
            <BekleyenKurulum
              key={gm.id}
              tur="grup"
              baslik={`${gm.oyuncu_sayisi} kişilik grup maçı`}
              kategori={gm.kategori}
              katilimcilar={(gm.katilimcilar ?? []).filter((k) => k.user_id !== user.id)}
              onIptal={() => davetIptal("grup", gm.id)}
              iptalEdilen={iptalEdilen}
              id={gm.id}
            />
          ))}
          {hizliBeklenen.map((hm) => (
            <BekleyenKurulum
              key={hm.id}
              tur="hizli"
              baslik="Hızlı Olan Kazanır"
              kategori={hm.kategori}
              katilimcilar={(hm.katilimcilar ?? []).filter((k) => k.user_id !== user.id)}
              onIptal={() => davetIptal("hizli", hm.id)}
              iptalEdilen={iptalEdilen}
              id={hm.id}
            />
          ))}
          {(grupBeklenenTum.length + hizliBeklenenTum.length) > 1 && (
            <button
              className="btn ikincil kucuk"
              style={{ width: "100%", marginTop: 4 }}
              disabled={iptalEdilen !== null}
              onClick={tumDavetleriIptal}
            >
              {iptalEdilen === "tumu" ? "İptal ediliyor…" : "Tümünü iptal et"}
            </button>
          )}
          {iptalHata && <div className="hata-kutu">{iptalHata}</div>}
        </>
      )}

      {hizliAktif.length > 0 && (
        <>
          <div className="baslik">Devam eden hızlı yarışlar</div>
          {hizliAktif.map((hm) => (
            <div key={hm.id} className="liste-satir">
              <div className="bilgi">
                <div className="isim">
                  {hm.katilimcilar
                    ?.filter((k) => k.user_id !== user.id)
                    .map((k) => oyuncuAdi(k.profil, k.user_id))
                    .join(", ")}
                </div>
                <div className="detay">Hızlı Olan Kazanır</div>
              </div>
              <button className="btn kucuk" onClick={() => navigate(`/bildim/hizli-mac/${hm.id}`)}>
                Oyna
              </button>
              <button
                className="btn kucuk ikincil"
                disabled={iptalEdilen === hm.id}
                onClick={() => davetIptal("hizli", hm.id)}
              >
                {iptalEdilen === hm.id ? "…" : "İptal"}
              </button>
            </div>
          ))}
        </>
      )}

      {hizliBiten.length > 0 && (
        <>
          <div className="baslik">Biten hızlı yarışlar</div>
          {hizliBiten.map((hm) => {
            const kazandim = hm.kazanan === user.id;
            const berabere = hm.kazanan === null;
            return (
              <div key={hm.id} className="liste-satir">
                <div className="bilgi">
                  <div className="isim">
                    {hm.katilimcilar
                      ?.filter((k) => k.user_id !== user.id)
                      .map((k) => `${k.profil?.gorunen_ad} (${k.skor})`)
                      .join(", ")}
                  </div>
                  <div className="detay">senin skorun: {hizliBenimKaydim(hm)?.skor ?? 0}</div>
                </div>
                <span
                  className="rutbe-chip"
                  style={{
                    color: berabere
                      ? "var(--text-dim)"
                      : kazandim
                        ? "var(--success)"
                        : "var(--danger)",
                  }}
                >
                  {berabere ? "Berabere" : kazandim ? "Kazandın +50" : "Kaybettin"}
                </span>
              </div>
            );
          })}
        </>
      )}

      {grupAktif.length > 0 && (
        <>
          <div className="baslik">Devam eden grup maçları</div>
          {grupAktif.map((gm) => (
            <div key={gm.id} className="liste-satir">
              <div className="bilgi">
                <div className="isim">
                  {gm.katilimcilar
                    ?.filter((k) => k.user_id !== user.id)
                    .map((k) => oyuncuAdi(k.profil, k.user_id))
                    .join(", ")}
                </div>
                <div className="detay">{gm.oyuncu_sayisi} kişilik grup maçı</div>
              </div>
              <button className="btn kucuk" onClick={() => navigate(`/bildim/grup-mac/${gm.id}`)}>
                Oyna
              </button>
              {/* Yarım kalmış maçları temizlemek için */}
              <button
                className="btn kucuk ikincil"
                disabled={iptalEdilen === gm.id}
                onClick={() => davetIptal("grup", gm.id)}
              >
                {iptalEdilen === gm.id ? "…" : "İptal"}
              </button>
            </div>
          ))}
        </>
      )}

      {aktif.length > 0 && (
        <>
          <div className="baslik">Devam eden</div>
          {aktif.map((m) => {
            // Asenkron maç: herkes kendi hızında oynar. Kendi sıramız bitmediyse
            // "sıra sende" — yarım kalan müsabaka buradan sürdürülür.
            const benP1 = m.oyuncu1 === user.id;
            const benimSoru = benP1 ? (m.oyuncu1_soru ?? 0) : (m.oyuncu2_soru ?? 0);
            const toplam = m.soru_ids?.length ?? 20;
            const siraSende = benimSoru < toplam;
            return (
              <div key={m.id} className={`liste-satir ${siraSende ? "sirasende" : ""}`}>
                <Avatar profile={rakip(m)} />
                <div className="bilgi">
                  <div className="isim">
                    {oyuncuAdi(rakip(m), benP1 ? m.oyuncu2 : m.oyuncu1)}
                    {siraSende && <span className="bd-sira-sende">SIRA SENDE</span>}
                  </div>
                  <div className="detay">
                    {m.oyuncu1_skor} - {m.oyuncu2_skor} · {benimSoru}/{toplam} soru
                    {!siraSende && " · rakip oynuyor"}
                  </div>
                </div>
                <button className="btn kucuk" onClick={() => navigate(`/bildim/mac/${m.id}`)}>
                  {siraSende ? "Devam et" : "Gör"}
                </button>
              </div>
            );
          })}
        </>
      )}

      {giden.length > 0 && (
        <>
          <div className="baslik">Gönderdiğin</div>
          {giden.map((m) => (
            <div key={m.id} className="liste-satir">
              <Avatar profile={m.p2} />
              <div className="bilgi">
                <div className="isim">{m.p2?.gorunen_ad}</div>
                <div className="detay">cevap bekleniyor…</div>
              </div>
            </div>
          ))}
        </>
      )}

      {biten.length > 0 && (
        <>
          <div className="baslik">Bitenler</div>
          {biten.map((m) => {
            const kazandim = m.kazanan === user.id;
            const berabere = m.kazanan === null;
            return (
              <div key={m.id} className="liste-satir">
                <Avatar profile={rakip(m)} />
                <div className="bilgi">
                  <div className="isim">{rakip(m)?.gorunen_ad}</div>
                  <div className="detay">
                    {m.oyuncu1_skor} - {m.oyuncu2_skor}
                  </div>
                </div>
                <span
                  className="rutbe-chip"
                  style={{
                    color: berabere
                      ? "var(--text-dim)"
                      : kazandim
                        ? "var(--success)"
                        : "var(--danger)",
                  }}
                >
                  {berabere ? "Berabere" : kazandim ? "Kazandın +20" : "Kaybettin"}
                </span>
              </div>
            );
          })}
        </>
      )}

      {grupBiten.length > 0 && (
        <>
          <div className="baslik">Biten grup maçları</div>
          {grupBiten.map((gm) => {
            const kazandim = gm.kazanan === user.id;
            const berabere = gm.kazanan === null;
            const odul = 10 * gm.oyuncu_sayisi;
            return (
              <div key={gm.id} className="liste-satir">
                <div className="bilgi">
                  <div className="isim">
                    {gm.katilimcilar
                      ?.filter((k) => k.user_id !== user.id)
                      .map((k) => `${k.profil?.gorunen_ad} (${k.skor})`)
                      .join(", ")}
                  </div>
                  <div className="detay">senin skorun: {grupBenimKaydim(gm)?.skor ?? 0}</div>
                </div>
                <span
                  className="rutbe-chip"
                  style={{
                    color: berabere
                      ? "var(--text-dim)"
                      : kazandim
                        ? "var(--success)"
                        : "var(--danger)",
                  }}
                >
                  {berabere ? "Berabere" : kazandim ? `Kazandın +${odul}` : "Kaybettin"}
                </span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
