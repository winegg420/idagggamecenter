// Paylaşılan avatar bileşeni (tüm oyunlar kullanır).
// Bildim gizlilik güncellemesinden sonra profiller `gorunen_ad` / `gorunen_avatar`
// döndürüyor; diğer modüller hâlâ `username` / `avatar_url` gönderiyor.
// Bu yüzden ikisini de kabul eder — görünen alanlar önceliklidir.
export default function Avatar({ profile, boyut = 42 }) {
  const ad = profile?.gorunen_ad ?? profile?.username ?? "?";
  const gorsel =
    profile?.gorunen_avatar !== undefined
      ? profile.gorunen_avatar
      : profile?.avatar_url;
  const harf = ad.charAt(0).toUpperCase();
  return (
    <div className="avatar" style={{ width: boyut, height: boyut, fontSize: boyut * 0.4 }}>
      {gorsel ? (
        <img src={gorsel} alt={ad} referrerPolicy="no-referrer" />
      ) : (
        harf
      )}
    </div>
  );
}
