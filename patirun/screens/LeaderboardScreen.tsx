// Sıralamalar: genel, arkadaşlar, haftalık ve aylık vitrin.
import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import {
  globalLeaderboard,
  listFriends,
  periodLeaderboard,
  type UserRow,
} from '../services/social';
import { supabaseConfigured } from '../lib/supabase';
import { avatarDataUri } from '../lib/avatars';

type Tab = 'genel' | 'arkadas' | 'hafta' | 'ay';

export function LeaderboardScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('genel');
  const [rows, setRows] = useState<{ user: UserRow; value: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setRows([]);
    const load = async () => {
      if (tab === 'genel') {
        const data = await globalLeaderboard();
        return data.map((u) => ({ user: u, value: u.puan }));
      }
      if (tab === 'arkadas') {
        if (!user?.id) return [];
        const friends = await listFriends(user.id);
        const accepted = friends.filter((f) => f.status === 'accepted');
        return accepted
          .map((f) => ({ user: f as UserRow, value: f.puan }))
          .sort((a, b) => b.value - a.value);
      }
      const days = tab === 'hafta' ? 7 : 30;
      const data = await periodLeaderboard(days);
      return data.map((d) => ({ user: d.user, value: d.periodPoints }));
    };
    void load().then((r) => {
      if (alive) {
        setRows(r);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [tab, user]);

  return (
    <div className="screen profile-screen">
      <div className="lobby-header">
        <button className="btn small" onClick={() => setScreen('menu')}>
          ← Menü
        </button>
        <h2>Sıralama</h2>
        <span />
      </div>

      <div className="cosmetic-slots">
        {(
          [
            ['genel', '🌍 Genel'],
            ['arkadas', '👥 Arkadaşlar'],
            ['hafta', '📅 Bu Hafta'],
            ['ay', '🗓️ Bu Ay'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} className={`btn tiny ${tab === t ? 'voted' : ''}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {!supabaseConfigured && <p className="tagline">Sıralama için Supabase bağlantısı gerekli.</p>}
      {loading && <div className="loading-spinner" />}

      <div className="results-table">
        {rows.map((r, i) => (
          <div key={r.user.id} className={`results-row ${r.user.id === user?.id ? 'winner' : ''}`}>
            <span className="res-rank">{i + 1}.</span>
            <img className="avatar-sq" src={avatarDataUri(r.user.avatar_id)} alt="" />
            <span className="res-name">
              {r.user.username} <small>({r.user.rutbe})</small>
            </span>
            <span className="res-points">{r.value}</span>
          </div>
        ))}
        {!loading && rows.length === 0 && supabaseConfigured && (
          <p className="tagline">Henüz veri yok.</p>
        )}
      </div>
    </div>
  );
}
