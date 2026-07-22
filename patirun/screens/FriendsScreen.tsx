// Arkadaşlar: arama, ekleme, kabul, çıkarma, engelleme, online durum.
import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { usePresenceStore } from '../stores/presenceStore';
import {
  acceptFriendRequest,
  blockUser,
  listBlocked,
  listFriends,
  removeFriend,
  searchUsers,
  sendFriendRequest,
  unblockUser,
  type FriendEntry,
  type UserRow,
} from '../services/social';
import { supabaseConfigured } from '../lib/supabase';

export function FriendsScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const user = useAuthStore((s) => s.user);
  const onlineIds = usePresenceStore((s) => s.onlineIds);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [blocked, setBlocked] = useState<UserRow[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    const [f, b] = await Promise.all([listFriends(user.id), listBlocked(user.id)]);
    setFriends(f);
    setBlocked(b);
    // Online bildirimleri için presence store'a arkadaş listesini ver
    const accepted = f.filter((x) => x.status === 'accepted');
    usePresenceStore
      .getState()
      .setFriends(accepted.map((x) => x.id), new Map(accepted.map((x) => [x.id, x.username])));
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const doSearch = async () => {
    if (!user?.id) return;
    setBusy(true);
    const results = await searchUsers(query, user.id);
    // Engellenenleri ve mevcut arkadaşları arama sonucundan ayıkla
    const friendIds = new Set(friends.map((f) => f.id));
    const blockedIds = new Set(blocked.map((b) => b.id));
    setSearchResults(results.filter((r) => !friendIds.has(r.id) && !blockedIds.has(r.id)));
    setBusy(false);
  };

  const incoming = friends.filter((f) => f.status === 'pending' && !f.outgoing);
  const outgoing = friends.filter((f) => f.status === 'pending' && f.outgoing);
  const accepted = friends.filter((f) => f.status === 'accepted');

  return (
    <div className="screen profile-screen">
      <div className="lobby-header">
        <button className="btn small" onClick={() => setScreen('menu')}>
          ← Menü
        </button>
        <h2>Arkadaşlar</h2>
        <span />
      </div>

      {!supabaseConfigured && <p className="tagline">Arkadaş sistemi için Supabase gerekli.</p>}

      {/* Arama */}
      <div className="chat-input-row">
        <input
          className="text-input chat-input"
          value={query}
          placeholder="Kullanıcı ara…"
          maxLength={16}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void doSearch()}
        />
        <button className="btn small" disabled={busy || query.trim().length < 2} onClick={() => void doSearch()}>
          🔍 Ara
        </button>
      </div>
      {searchResults.map((r) => (
        <div key={r.id} className="results-row">
          <span className="res-name">
            {r.username} <small>({r.rutbe})</small>
          </span>
          <button
            className="btn tiny"
            onClick={() =>
              void sendFriendRequest(user!.id, r.id).then(() => {
                setSearchResults((s) => s.filter((x) => x.id !== r.id));
                void refresh();
              })
            }
          >
            ➕ Ekle
          </button>
        </div>
      ))}

      {/* Gelen istekler */}
      {incoming.length > 0 && <h3 className="section-title">Gelen İstekler</h3>}
      {incoming.map((f) => (
        <div key={f.friendshipId} className="results-row">
          <span className="res-name">{f.username}</span>
          <button
            className="btn tiny"
            onClick={() => void acceptFriendRequest(f.friendshipId).then(() => void refresh())}
          >
            ✓ Kabul
          </button>
          <button
            className="btn tiny"
            onClick={() => void removeFriend(f.friendshipId).then(() => void refresh())}
          >
            ✕ Reddet
          </button>
        </div>
      ))}

      {/* Arkadaş listesi */}
      <h3 className="section-title">Arkadaşlarım ({accepted.length})</h3>
      {accepted.length === 0 && <p className="tagline">Henüz arkadaş eklemedin.</p>}
      {accepted.map((f) => (
        <div key={f.friendshipId} className="results-row">
          <span className="res-name">
            {onlineIds.has(f.id) ? '🟢 ' : '⚪ '}
            {f.username} <small>({f.rutbe})</small>
          </span>
          <button
            className="btn tiny"
            onClick={() => void removeFriend(f.friendshipId).then(() => void refresh())}
          >
            Çıkar
          </button>
          <button
            className="btn tiny"
            onClick={() => void blockUser(user!.id, f.id).then(() => void refresh())}
          >
            🚫 Engelle
          </button>
        </div>
      ))}

      {/* Giden bekleyenler */}
      {outgoing.length > 0 && <h3 className="section-title">Gönderilen İstekler</h3>}
      {outgoing.map((f) => (
        <div key={f.friendshipId} className="results-row">
          <span className="res-name">{f.username} (bekliyor)</span>
          <button
            className="btn tiny"
            onClick={() => void removeFriend(f.friendshipId).then(() => void refresh())}
          >
            İptal
          </button>
        </div>
      ))}

      {/* Engellenenler */}
      {blocked.length > 0 && <h3 className="section-title">Engellenenler</h3>}
      {blocked.map((b) => (
        <div key={b.id} className="results-row">
          <span className="res-name">{b.username}</span>
          <button
            className="btn tiny"
            onClick={() => void unblockUser(user!.id, b.id).then(() => void refresh())}
          >
            Engeli Kaldır
          </button>
        </div>
      ))}
    </div>
  );
}
