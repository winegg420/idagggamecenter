// Oyuncular: kayıtlı TÜM kullanıcılar listesi (online göstergeli) — listeden
// direkt oda daveti gönderilir (Bildim'deki oyuncu listesi mantığı).
import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { usePresenceStore } from '../stores/presenceStore';
import { useRoomStore } from '../stores/roomStore';
import { listAllUsers, type UserRow } from '../services/social';
import { supabaseConfigured } from '../lib/supabase';
import { avatarDataUri } from '../lib/avatars';

export function PlayersScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const user = useAuthStore((s) => s.user);
  const onlineIds = usePresenceStore((s) => s.onlineIds);
  const roomClient = useRoomStore((s) => s.client);
  const [players, setPlayers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Davet gönderilen oyuncular (buton geri bildirimi) */
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      setPlayers(await listAllUsers(user.id));
    } catch {
      setError('Oyuncu listesi yüklenemedi');
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const invite = async (target: UserRow) => {
    if (!user || busy) return;
    const uname = user.username ?? 'Oyuncu';
    setError(null);
    setBusy(true);
    try {
      // Oda yoksa arka planda kur — davet mevcut/yeni odanın koduyla gider
      let client = useRoomStore.getState().client;
      if (!client) {
        const ok = await useRoomStore.getState().createRoom(user.id, uname);
        client = useRoomStore.getState().client;
        if (!ok || !client) {
          setError(useRoomStore.getState().error ?? 'Oda oluşturulamadı');
          setBusy(false);
          return;
        }
      }
      usePresenceStore.getState().sendInvite(target.id, uname, client.code);
      setSentTo((prev) => new Set(prev).add(target.id));
    } catch {
      setError('Davet gönderilemedi');
    }
    setBusy(false);
  };

  const q = query.trim().toLocaleLowerCase('tr');
  const filtered = players.filter((p) => !q || p.username.toLocaleLowerCase('tr').includes(q));
  // Online olanlar üstte (kendi içlerinde puan sıralı — liste zaten puan sıralı)
  const sorted = [
    ...filtered.filter((p) => onlineIds.has(p.id)),
    ...filtered.filter((p) => !onlineIds.has(p.id)),
  ];
  const onlineCount = filtered.filter((p) => onlineIds.has(p.id)).length;

  return (
    <div className="screen profile-screen">
      <div className="lobby-header">
        <button
          className="btn small"
          onClick={() => setScreen(roomClient ? 'lobby' : 'menu')}
        >
          ← {roomClient ? 'Lobi' : 'Menü'}
        </button>
        <h2>Oyuncular</h2>
        <span className="tagline" style={{ margin: 0 }}>🟢 {onlineCount}</span>
      </div>

      {!supabaseConfigured && <p className="tagline">Oyuncu listesi için Supabase gerekli.</p>}
      {roomClient && (
        <p className="tagline">
          Davetler <b>{roomClient.code}</b> kodlu odana gönderilir.
        </p>
      )}

      <div className="chat-input-row">
        <input
          className="text-input chat-input"
          value={query}
          placeholder="Oyuncu ara…"
          maxLength={16}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn small" onClick={() => void refresh()}>
          🔄
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="tagline">Yükleniyor…</p>}
      {!loading && sorted.length === 0 && (
        <p className="tagline">{q ? 'Eşleşen oyuncu yok.' : 'Henüz başka kayıtlı oyuncu yok.'}</p>
      )}

      {sorted.map((p) => {
        const online = onlineIds.has(p.id);
        const sent = sentTo.has(p.id);
        return (
          <div key={p.id} className="results-row">
            <span className={`online-dot ${online ? 'on' : ''}`} />
            <img className="avatar-sq" src={avatarDataUri(p.avatar_id)} alt="" />
            <span className="res-name">
              {p.username} <small>({p.rutbe} · ⭐{p.puan})</small>
            </span>
            {online && !sent && (
              <button className="btn tiny" disabled={busy || !supabaseConfigured} onClick={() => void invite(p)}>
                🏁 Davet Et
              </button>
            )}
            {online && sent && <span className="invite-sent">✓ Davet gitti</span>}
            {!online && <small className="offline-label">çevrimdışı</small>}
          </div>
        );
      })}

      {roomClient && (
        <button className="btn primary big" style={{ marginTop: 12 }} onClick={() => setScreen('lobby')}>
          🚪 Lobiye Dön
        </button>
      )}
    </div>
  );
}
