// Profil: rank, XP ilerlemesi, istatistikler, rozetler, isim düzenleme, Google girişi.

import { useEffect, useState } from 'react';
import { useGameStore, formatTime } from '../../store/gameStore';
import { useProfileStore } from '../../store/profileStore';
import { getRank, nextRank, BADGES } from '../../game/xp';
import { TRACK_DEFS } from '../../game/tracks';
import { isOnline, supabase } from '../../lib/supabase';

export function ProfileScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const p = useProfileStore();
  const rank = getRank(p.xp);
  const next = nextRank(p.xp);
  const progress = next ? (p.xp - rank.minXp) / (next.minXp - rank.minXp) : 1;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.playerName);
  const [isimHata, setIsimHata] = useState<string | null>(null);

  // Görünen ad = Bildim paylaşılan kimliği. Buradan değiştirmek profiles.username'i
  // günceller → tüm oyunlarda + hub'da aynı anda yansır (Faz 4).
  const isimKaydet = async () => {
    const yeni = name.trim();
    if (yeni.length < 3) {
      setIsimHata('En az 3 karakter');
      return;
    }
    p.setPlayerName(yeni);
    setEditing(false);
    setIsimHata(null);
    if (!supabase) return;
    try {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { error } = await supabase.from('profiles').update({ username: yeni }).eq('id', uid);
      if (error && (error.code === '23505' || error.message.toLowerCase().includes('duplicate'))) {
        setIsimHata('Bu kullanıcı adı alınmış');
      }
    } catch (e) {
      console.warn('[DriftGP] İsim güncellenemedi:', e);
    }
  };

  return (
    <div className="screen list-screen">
      <div className="screen-header">
        <button className="icon-btn" onClick={() => setScreen('menu')}>
          ←
        </button>
        <h2>PROFİL</h2>
        <div />
      </div>

      <div className="profile-card">
        <div className="profile-rank-icon">{rank.icon}</div>
        <div className="profile-main">
          {editing ? (
            <div className="name-edit">
              <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
              <button className="chip active" onClick={() => void isimKaydet()}>
                ✓
              </button>
              {isimHata && <span className="offline-note" style={{ marginLeft: 8 }}>{isimHata}</span>}
            </div>
          ) : (
            <div className="profile-name" onClick={() => setEditing(true)}>
              {p.playerName} ✏️
            </div>
          )}
          <div className="profile-rank">
            {rank.name} · {p.xp.toLocaleString('tr-TR')} XP
          </div>
          <div className="xp-bar">
            <div className="xp-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          {next && (
            <div className="xp-next">
              {next.icon} {next.name}: {(next.minXp - p.xp).toLocaleString('tr-TR')} XP kaldı
            </div>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-tile">
          <b>{p.totalRaces}</b>
          <span>Yarış</span>
        </div>
        <div className="stat-tile">
          <b>{p.wins}</b>
          <span>Zafer</span>
        </div>
        <div className="stat-tile">
          <b>{Math.round(p.totalDriftScore).toLocaleString('tr-TR')}</b>
          <span>Drift Puanı</span>
        </div>
        <div className="stat-tile">
          <b>{p.badges.length}/{BADGES.length}</b>
          <span>Rozet</span>
        </div>
      </div>

      {Object.keys(p.bestLapByTrack).length > 0 && (
        <div className="best-laps">
          <h3>EN İYİ TURLAR</h3>
          {TRACK_DEFS.filter((t) => p.bestLapByTrack[t.id]).map((t) => (
            <div key={t.id} className="best-lap-row">
              <span>{t.name}</span>
              <b>{formatTime(p.bestLapByTrack[t.id])}</b>
            </div>
          ))}
        </div>
      )}

      <h3 className="section-title">ROZETLER</h3>
      <div className="badge-grid">
        {BADGES.map((b) => {
          const owned = p.badges.includes(b.id);
          return (
            <div key={b.id} className={`badge-tile ${owned ? 'owned' : ''}`}>
              <div className="badge-icon">{b.icon}</div>
              <div className="badge-name">{b.name}</div>
              <div className="badge-desc">{b.desc}</div>
            </div>
          );
        })}
      </div>

      <div className="auth-box">
        {!isOnline() ? (
          <p className="offline-note">☁️ Bulut kaydı kapalı — Supabase yapılandırılmadı (offline mod)</p>
        ) : (
          <p className="offline-note">
            👤 Kimliğin IDA GG Game Center hesabınla paylaşılır — ismini yukarıdan değiştirince tüm oyunlarda güncellenir.
          </p>
        )}
        <button className="secondary-btn" onClick={() => window.location.assign('/')}>
          🏠 Oyun Merkezi'ne dön
        </button>
      </div>
    </div>
  );
}
