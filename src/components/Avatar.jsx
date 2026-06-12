export default function Avatar({ profile, boyut = 42 }) {
  const harf = (profile?.username ?? "?").charAt(0).toUpperCase();
  return (
    <div className="avatar" style={{ width: boyut, height: boyut, fontSize: boyut * 0.4 }}>
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={profile.username} referrerPolicy="no-referrer" />
      ) : (
        harf
      )}
    </div>
  );
}
