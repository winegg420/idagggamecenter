// Profil: kişisel istatistikler, rozetler, maç geçmişi, rütbe çerçevesi.
import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { useStatsStore } from '../stores/statsStore';
import { useCharacterStore } from '../stores/characterStore';
import { rankTitleForPoints } from '../game/scoring';
import { BADGES, RANK_FRAMES } from '../game/badges';
import { getCharacter, CHARACTERS } from '../game/characters/characters';
import { matchHistory, type HistoryRow } from '../services/social';
import { getMap2D as getMap } from '../game/track2d/maps2d';
import type { MapId } from '../game/types';
import { SKILL_INFO } from '../game/skills/skillInfo';
import type { SkillId } from '../game/types';
import { AVATARS, avatarDataUri } from '../lib/avatars';

export function ProfileScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const user = useAuthStore((s) => s.user);
  const setAvatar = useAuthStore((s) => s.setAvatar);
  const stats = useStatsStore();
  const { selectedId, xp } = useCharacterStore();
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [pickingAvatar, setPickingAvatar] = useState(false);

  useEffect(() => {
    if (user?.id) {
      void matchHistory(user.id).then(setHistory);
    }
  }, [user]);

  const rankTitle = rankTitleForPoints(stats.points);
  const frameClass = RANK_FRAMES[rankTitle] ?? 'frame-caylak';
  const winRate = stats.totalRaces > 0 ? Math.round((stats.totalWins / stats.totalRaces) * 100) : 0;

  // En çok kullanılan skill
  const favSkill = Object.entries(stats.skillUses).sort((a, b) => b[1] - a[1])[0]?.[0] as
    | SkillId
    | undefined;

  // Favori harita (yerel geçmişten)
  const mapCounts = new Map<string, number>();
  for (const h of history) mapCounts.set(h.harita, (mapCounts.get(h.harita) ?? 0) + 1);
  const favMap = [...mapCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  // En çok oynanan karakter (XP'ye göre)
  const favChar = Object.entries(xp).sort((a, b) => b[1] - a[1])[0]?.[0] ?? selectedId;

  return (
    <div className="screen profile-screen">
      <div className="lobby-header">
        <button className="btn small" onClick={() => setScreen('menu')}>
          ← Menü
        </button>
        <h2>Profil</h2>
        <span />
      </div>

      <div className="profile-top">
        <button
          className={`avatar-frame ${frameClass}`}
          onClick={() => setPickingAvatar(true)}
          aria-label="Profil fotoğrafını değiştir"
        >
          <img className="avatar-img" src={avatarDataUri(user?.avatarId)} alt="" />
          <span className="avatar-edit">✏️</span>
        </button>
        <div>
          <h3>{user?.username ?? 'Oyuncu'}</h3>
          <p className="rank-title">{rankTitle} · {stats.points} puan</p>
          <p className="tagline" style={{ margin: 0 }}>
            {getCharacter(favChar).emoji} favori karakter
          </p>
        </div>
      </div>

      {/* Avatar seçici: 20 özgün parodi kahraman */}
      {pickingAvatar && (
        <div className="avatar-modal" onClick={() => setPickingAvatar(false)}>
          <div className="avatar-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3>Profil Fotoğrafı Seç</h3>
            <div className="avatar-grid">
              {AVATARS.map((a) => (
                <button
                  key={a.id}
                  className={`avatar-cell ${user?.avatarId === a.id ? 'selected' : ''}`}
                  onClick={() => {
                    void setAvatar(a.id);
                    setPickingAvatar(false);
                  }}
                >
                  <img src={avatarDataUri(a.id)} alt={a.name} />
                  <small>{a.name}</small>
                </button>
              ))}
            </div>
            <button className="btn small" onClick={() => setPickingAvatar(false)}>
              Kapat
            </button>
          </div>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-box">
          <b>{stats.totalRaces}</b>
          <span>Toplam Yarış</span>
        </div>
        <div className="stat-box">
          <b>{stats.totalWins}</b>
          <span>Galibiyet</span>
        </div>
        <div className="stat-box">
          <b>%{winRate}</b>
          <span>Kazanma Oranı</span>
        </div>
        <div className="stat-box">
          <b>{favSkill ? SKILL_INFO[favSkill].emoji : '—'}</b>
          <span>Favori Skill</span>
        </div>
        <div className="stat-box">
          <b>{favMap ? getMap(favMap as MapId).name : '—'}</b>
          <span>Favori Harita</span>
        </div>
        <div className="stat-box">
          <b>{stats.winStreak}</b>
          <span>Galibiyet Serisi</span>
        </div>
      </div>

      <h3 className="section-title">Rozetler ({stats.badges.length}/{BADGES.length})</h3>
      <div className="badge-grid">
        {BADGES.map((b) => {
          const owned = stats.badges.includes(b.id);
          return (
            <div key={b.id} className={`badge-cell ${owned ? 'owned' : 'locked'}`} title={b.aciklama}>
              <span className="badge-emoji">{owned ? b.emoji : '🔒'}</span>
              <span className="badge-name">{b.isim}</span>
            </div>
          );
        })}
      </div>

      <h3 className="section-title">Karakter Seviyeleri</h3>
      <div className="badge-grid">
        {CHARACTERS.filter((c) => (xp[c.id] ?? 0) > 0).map((c) => (
          <div key={c.id} className="badge-cell owned">
            <span className="badge-emoji">{c.emoji}</span>
            <span className="badge-name">Sv {useCharacterStore.getState().levelOf(c.id)}</span>
          </div>
        ))}
      </div>

      <h3 className="section-title">Maç Geçmişi (son 20)</h3>
      {history.length === 0 && <p className="tagline">Henüz kayıtlı maç yok.</p>}
      <div className="history-list">
        {history.map((h) => (
          <div key={h.raceId} className="history-row">
            <span>{getMap(h.harita as MapId).name}</span>
            <span>{h.sira ? `${h.sira}.` : 'DNF'}</span>
            <span className="res-points">+{h.puan}</span>
            <span className="history-date">{new Date(h.tarih).toLocaleDateString('tr-TR')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
