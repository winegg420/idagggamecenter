import { useEffect, useState } from "react";
import { supabase } from "../../src/lib/supabase.js";
import Avatar from "../../src/components/Avatar.jsx";
import Ikon from "./Ikon.jsx";

/**
 * Turnuva sayfasındaki boş ekranı dolduran tanıtım bloğu:
 * nasıl oynanır (3 madde) + son turnuvanın ilk 3'ü + katılımcı sayısı.
 */
export default function TurnuvaTanitim() {
  const [sonTurnuva, setSonTurnuva] = useState(null);
  const [ilkUc, setIlkUc] = useState([]);
  const [katilan, setKatilan] = useState(0);

  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const { data: tlar, error } = await supabase
          .from("tournaments")
          .select("id, tarih, seans, durum, kazanan")
          .eq("durum", "bitti")
          .order("tarih", { ascending: false })
          .limit(1);
        if (error) throw error;
        const t = (tlar ?? [])[0];
        if (!t || !aktif) return;
        setSonTurnuva(t);

        const { data: oyuncular, error: hata2 } = await supabase
          .from("tournament_players")
          .select("user_id, dogru_sayisi, elendi, profil:profiles(gorunen_ad, gorunen_avatar)")
          .eq("tournament_id", t.id)
          .order("dogru_sayisi", { ascending: false })
          .limit(50);
        if (hata2) throw hata2;
        if (!aktif) return;

        setKatilan((oyuncular ?? []).length);
        // Kazanan en üstte, sonra doğru sayısına göre
        const sirali = [...(oyuncular ?? [])].sort((a, b) => {
          if (a.user_id === t.kazanan) return -1;
          if (b.user_id === t.kazanan) return 1;
          return (b.dogru_sayisi ?? 0) - (a.dogru_sayisi ?? 0);
        });
        setIlkUc(sirali.slice(0, 3));
      } catch {
        /* turnuva geçmişi yoksa blok sadece "nasıl oynanır" gösterir */
      }
    })();
    return () => {
      aktif = false;
    };
  }, []);

  return (
    <>
      <div className="kart bd-turnuva-nasil">
        <div className="bd-kat-baslik"><span>Nasıl oynanır?</span></div>
        <ol className="bd-nasil-liste">
          <li>
            <span className="bd-nasil-no">1</span>
            <span>
              <b>Lobiye katıl.</b> Turnuva her gün <b>10:00</b> ve <b>22:00</b>'de başlar;
              başlamadan lobide olman gerekir.
            </span>
          </li>
          <li>
            <span className="bd-nasil-no">2</span>
            <span>
              <b>Yanlış cevap elenmektir.</b> Herkese aynı soru aynı anda gelir,
              bir soruyu kaçıran turnuvadan çıkar.
            </span>
          </li>
          <li>
            <span className="bd-nasil-no">3</span>
            <span>
              <b>Son kalan kazanır</b> ve <b>+250 puan</b> alır. Finalde joker
              kullanılamaz — sadece bilgi.
            </span>
          </li>
        </ol>
      </div>

      {sonTurnuva && ilkUc.length > 0 && (
        <div className="kart">
          <div className="bd-kat-baslik">
            <span>Son turnuva</span>
            <span className="alt-yazi">{katilan} katılımcı</span>
          </div>
          <div className="bd-son-turnuva">
            {ilkUc.map((o, i) => (
              <div key={o.user_id} className={`bd-son-satir ${i === 0 ? "birinci" : ""}`}>
                <span className="bd-son-madalya">
                  {i + 1}
                </span>
                <Avatar profile={o.profil} boyut={32} />
                <span className="bd-son-ad">{o.profil?.gorunen_ad ?? "Oyuncu"}</span>
                <span className="bd-son-dogru">
                  <Ikon ad="onay" boyut={13} /> {o.dogru_sayisi ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
