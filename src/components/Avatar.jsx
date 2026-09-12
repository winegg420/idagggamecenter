// Paylaşılan avatar bileşeni (tüm oyunlar kullanır).
//
// Bildim gizlilik güncellemesinden sonra profiller `gorunen_ad` /
// `gorunen_avatar` döndürüyor; diğer modüller hâlâ `username` /
// `avatar_url` gönderiyor. Bu yüzden ikisini de kabul eder.
//
// 2B KARAKTER: profilde `gorunum.karakter` varsa avatar PatiRun'dan
// taşınan vektör karakter sisteminden üretilir (bildim/karakter/).
// Üretilen SVG data-URI önbelleklidir — 25 satırlık lig tablosu aynı
// görünümü ikinci kez çizmez. Karakter seçilmemişse eski davranış
// (fotoğraf ya da baş harf) aynen sürer; hiçbir çağıran değişmedi.
import { avatarUri, karakterSecilmisMi } from "../../bildim/karakter/gorunum.js";

export default function Avatar({ profile, boyut = 42, poz = "idle" }) {
  const ad = profile?.gorunen_ad ?? profile?.username ?? "?";
  const gorsel =
    profile?.gorunen_avatar !== undefined
      ? profile.gorunen_avatar
      : profile?.avatar_url;
  const harf = ad.charAt(0).toUpperCase();

  const karakter = karakterSecilmisMi(profile?.gorunum)
    ? avatarUri(profile.gorunum, poz)
    : null;

  return (
    <div
      className={`avatar${karakter ? " avatar-karakter" : ""}`}
      style={{ width: boyut, height: boyut, fontSize: boyut * 0.4 }}
    >
      {karakter ? (
        <img src={karakter} alt={ad} loading="lazy" />
      ) : gorsel ? (
        <img src={gorsel} alt={ad} referrerPolicy="no-referrer" />
      ) : (
        harf
      )}
    </div>
  );
}
