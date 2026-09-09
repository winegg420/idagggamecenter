// KAFA TOPU — admin paneli.
// Yetki sunucuda doğrulanır (kafatopu_admin_mi + admin RPC'leri);
// panel yalnızca geliştirici hesabında görünür ve çalışır.
// Maç içi admin gücü: yetenek soğuması ~yok (1 sn) — MacPage uygular.

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../src/lib/supabase.js";
import { useKT } from "../KafaTopuApp.jsx";

export default function AdminPage() {
  const { adminMi } = useKT();
  const navigate = useNavigate();
  const [kuyruk, setKuyruk] = useState([]);
  const [aktifMaclar, setAktifMaclar] = useState([]);
  const [oyuncular, setOyuncular] = useState([]);
  const [seciliOyuncu, setSeciliOyuncu] = useState("");
  const [yeniPuan, setYeniPuan] = useState("");
  const [mesaj, setMesaj] = useState("");

  const yukle = useCallback(async () => {
    try {
      const [k, m, p] = await Promise.all([
        supabase.rpc("kafatopu_admin_kuyruk"),
        supabase
          .from("kafatopu_maclar")
          .select("id, mod, tur, durum, skor1, skor2, created_at")
          .eq("durum", "aktif")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("kafatopu_profiller")
          .select("user_id, puan")
          .order("puan", { ascending: false })
          .limit(200),
      ]);
      if (!k.error) setKuyruk(k.data ?? []);
      if (!m.error) setAktifMaclar(m.data ?? []);
      if (!p.error) {
        const idler = (p.data ?? []).map((x) => x.user_id);
        let adlar = {};
        if (idler.length) {
          const { data } = await supabase.from("profiles").select("id, gorunen_ad").in("id", idler);
          for (const x of data ?? []) adlar[x.id] = x.gorunen_ad;
        }
        setOyuncular((p.data ?? []).map((x) => ({ ...x, ad: adlar[x.user_id] ?? x.user_id.slice(0, 8) })));
      }
    } catch (e) {
      console.error("KafaTopu admin yükleme hatası:", e);
    }
  }, []);

  useEffect(() => {
    if (adminMi) yukle();
  }, [adminMi, yukle]);

  if (!adminMi) {
    return (
      <div className="kt-sayfa kt-kuyruk-orta">
        <h1 className="kt-baslik">👑 Admin</h1>
        <div className="kt-alt-yazi">Bu sayfa yalnızca geliştirici hesabına açıktır.</div>
        <button className="kt-btn ikincil" style={{ maxWidth: 340, margin: "16px auto" }} onClick={() => navigate("/kafatopu")}>
          <span className="kt-btn-ikon">←</span><span>Menüye dön</span>
        </button>
      </div>
    );
  }

  const puanAyarla = async () => {
    if (!seciliOyuncu || yeniPuan === "") return;
    try {
      const { error } = await supabase.rpc("kafatopu_admin_puan_ayarla", {
        p_user: seciliOyuncu,
        p_puan: Number(yeniPuan),
      });
      if (error) throw error;
      setMesaj("Puan güncellendi ✓");
      yukle();
    } catch (e) {
      console.error("KafaTopu admin puan hatası:", e);
      setMesaj("Puan güncellenemedi.");
    }
  };

  const maclariTemizle = async () => {
    try {
      const { data, error } = await supabase.rpc("kafatopu_admin_maclari_temizle");
      if (error) throw error;
      setMesaj(`${data ?? 0} takılı maç iptal edildi ✓`);
      yukle();
    } catch (e) {
      console.error("KafaTopu admin temizlik hatası:", e);
      setMesaj("Temizlik başarısız.");
    }
  };

  const macIptal = async (id) => {
    try {
      const { error } = await supabase.rpc("kafatopu_mac_iptal", { p_mac_id: id });
      if (error) throw error;
      yukle();
    } catch (e) {
      console.error("KafaTopu admin maç iptali hatası:", e);
    }
  };

  return (
    <div className="kt-sayfa">
      <h1 className="kt-baslik">👑 Admin Paneli</h1>
      {mesaj && <div className="kt-alt-yazi">{mesaj}</div>}

      <div className="kt-kart">
        <b>Maç içi güçlerin</b>
        <div className="kt-alt-yazi" style={{ textAlign: "left", marginTop: 6 }}>
          Admin hesabında özel yetenek soğuması yok denecek kadar azdır (1 sn) —
          otomatik uygulanır, ayar gerekmez.
        </div>
      </div>

      <div className="kt-kart">
        <b>Kuyruk ({kuyruk.length})</b>
        {kuyruk.length === 0 && <div className="kt-alt-yazi">Kuyruk boş.</div>}
        {kuyruk.map((k) => (
          <div key={k.user_id} className="kt-sira-satir">
            <span className="kt-sira-ad">{k.user_id.slice(0, 8)}…</span>
            <span className="kt-istatistik">{k.mod} · {k.tur} · {k.puan}p</span>
          </div>
        ))}
      </div>

      <div className="kt-kart">
        <b>Aktif maçlar ({aktifMaclar.length})</b>
        {aktifMaclar.length === 0 && <div className="kt-alt-yazi">Aktif maç yok.</div>}
        {aktifMaclar.map((m) => (
          <div key={m.id} className="kt-sira-satir">
            <span className="kt-sira-ad">
              {m.mod} {m.tur} · {m.skor1}-{m.skor2}
            </span>
            <button className="kt-btn tehlike" style={{ width: "auto", padding: "6px 12px", margin: 0 }} onClick={() => macIptal(m.id)}>
              İptal
            </button>
          </div>
        ))}
        <button className="kt-btn ikincil" style={{ marginTop: 10 }} onClick={maclariTemizle}>
          <span className="kt-btn-ikon">🧹</span>
          <span>10 dk'dan eski takılı maçları/kuyruğu temizle</span>
        </button>
      </div>

      <div className="kt-kart">
        <b>Oyuncu puanı ayarla</b>
        <div className="kt-form-satir">
          <select value={seciliOyuncu} onChange={(e) => setSeciliOyuncu(e.target.value)}>
            <option value="">Oyuncu seç…</option>
            {oyuncular.map((o) => (
              <option key={o.user_id} value={o.user_id}>
                {o.ad} ({o.puan}p)
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Yeni puan"
            value={yeniPuan}
            onChange={(e) => setYeniPuan(e.target.value)}
          />
        </div>
        <button className="kt-btn" onClick={puanAyarla}>
          <span className="kt-btn-ikon">💾</span>
          <span>Puanı kaydet</span>
        </button>
      </div>

      <button className="kt-btn ikincil" onClick={() => navigate("/kafatopu")}>
        <span className="kt-btn-ikon">←</span>
        <span>Menüye dön</span>
      </button>
    </div>
  );
}
