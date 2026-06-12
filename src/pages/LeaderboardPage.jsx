import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../context/AuthContext.jsx";
import Avatar from "../components/Avatar.jsx";
import RankBadge from "../components/RankBadge.jsx";

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [sekme, setSekme] = useState("genel");
  const [liste, setListe] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);

  useEffect(() => {
    const yukle = async () => {
      setYukleniyor(true);
      if (sekme === "genel") {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, puan, sampiyonluk")
          .order("puan", { ascending: false })
          .limit(50);
        setListe(data ?? []);
      } else if (sekme === "hafta") {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, puan, puan_hafta, sampiyonluk")
          .order("puan_hafta", { ascending: false })
          .limit(50);
        setListe(data ?? []);
      } else {
        const { data: dostluklar } = await supabase
          .from("friendships")
          .select("requester, addressee")
          .eq("durum", "arkadas")
          .or(`requester.eq.${user.id},addressee.eq.${user.id}`);
        const idler = new Set([user.id]);
        (dostluklar ?? []).forEach((f) => {
          idler.add(f.requester);
          idler.add(f.addressee);
        });
        const { data } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, puan, sampiyonluk")
          .in("id", [...idler])
          .order("puan", { ascending: false });
        setListe(data ?? []);
      }
      setYukleniyor(false);
    };
    yukle();
  }, [sekme, user.id]);

  return (
    <div>
      <div className="baslik">📊 Sıralama</div>
      <div className="sekmeler">
        <button
          className={`sekme ${sekme === "genel" ? "aktif" : ""}`}
          onClick={() => setSekme("genel")}
        >
          🌍 Genel
        </button>
        <button
          className={`sekme ${sekme === "hafta" ? "aktif" : ""}`}
          onClick={() => setSekme("hafta")}
        >
          📅 Bu Hafta
        </button>
        <button
          className={`sekme ${sekme === "arkadas" ? "aktif" : ""}`}
          onClick={() => setSekme("arkadas")}
        >
          👥 Arkadaşlar
        </button>
      </div>

      {yukleniyor ? (
        <div className="yukleniyor">Yükleniyor…</div>
      ) : liste.length === 0 ? (
        <div className="alt-yazi" style={{ textAlign: "center", padding: 24 }}>
          Burada henüz kimse yok.
        </div>
      ) : (
        liste.map((p, i) => (
          <div
            key={p.id}
            className="liste-satir"
            style={p.id === user.id ? { borderColor: "var(--primary)" } : {}}
          >
            <span className={`sira-no ${i < 3 ? "ilk3" : ""}`}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
            </span>
            <Avatar profile={p} boyut={38} />
            <div className="bilgi">
              <div className="isim">
                {p.username} {p.id === user.id && "(sen)"}
              </div>
              <div className="detay">
                <RankBadge puan={p.puan} />
                {p.sampiyonluk > 0 && <span> · 🏆 {p.sampiyonluk}</span>}
              </div>
            </div>
            <span style={{ fontWeight: 800 }}>
              ⭐ {sekme === "hafta" ? (p.puan_hafta ?? 0) : p.puan}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
