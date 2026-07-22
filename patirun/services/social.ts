// Sosyal katman: arkadaşlar, engelleme, sıralamalar, maç geçmişi, online durum.
// Tüm çağrılar try-catch'li; Supabase yoksa boş sonuç döner.
import { supabase } from '../lib/supabase';

export interface UserRow {
  id: string;
  username: string;
  puan: number;
  rutbe: string;
  total_races: number;
  total_wins: number;
  /** Profil avatarı (avatar_id kolonu; migration yoksa undefined) */
  avatar_id?: string | null;
}

export interface FriendEntry extends UserRow {
  friendshipId: number;
  status: 'pending' | 'accepted';
  /** İsteği ben mi gönderdim */
  outgoing: boolean;
}

export interface HistoryRow {
  raceId: number;
  harita: string;
  mod: string;
  sira: number | null;
  puan: number;
  bitis_suresi: number | null;
  tarih: string;
}

/** TÜM kayıtlı oyuncular (puan sıralı) — Oyuncular listesi ekranı için */
export async function listAllUsers(selfId: string, limit = 100): Promise<UserRow[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('pr_users')
      .select('*')
      .neq('id', selfId)
      .order('puan', { ascending: false })
      .limit(limit);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function searchUsers(query: string, selfId: string): Promise<UserRow[]> {
  if (!supabase || query.trim().length < 2) return [];
  try {
    const { data } = await supabase
      .from('pr_users')
      .select('*')
      .ilike('username', `%${query.trim()}%`)
      .neq('id', selfId)
      .limit(20);
    return data ?? [];
  } catch {
    return [];
  }
}

export async function sendFriendRequest(selfId: string, targetId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('pr_friendships')
      .insert({ user1: selfId, user2: targetId, status: 'pending' });
    return !error;
  } catch {
    return false;
  }
}

export async function acceptFriendRequest(friendshipId: number): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('pr_friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    return !error;
  } catch {
    return false;
  }
}

export async function removeFriend(friendshipId: number): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('pr_friendships').delete().eq('id', friendshipId);
    return !error;
  } catch {
    return false;
  }
}

export async function listFriends(selfId: string): Promise<FriendEntry[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('pr_friendships')
      .select('id, user1, user2, status')
      .or(`user1.eq.${selfId},user2.eq.${selfId}`);
    if (!data || data.length === 0) return [];
    const otherIds = data.map((f) => (f.user1 === selfId ? f.user2 : f.user1));
    const { data: users } = await supabase
      .from('pr_users')
      .select('*')
      .in('id', otherIds);
    const userMap = new Map((users ?? []).map((u) => [u.id, u]));
    return data
      .map((f) => {
        const otherId = f.user1 === selfId ? f.user2 : f.user1;
        const u = userMap.get(otherId);
        if (!u) return null;
        return {
          ...u,
          friendshipId: f.id,
          status: f.status as 'pending' | 'accepted',
          outgoing: f.user1 === selfId,
        };
      })
      .filter((x): x is FriendEntry => x !== null);
  } catch {
    return [];
  }
}

export async function blockUser(selfId: string, targetId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('pr_blocks')
      .insert({ blocker_id: selfId, blocked_id: targetId });
    // Engellenince arkadaşlık da silinir
    await supabase
      .from('pr_friendships')
      .delete()
      .or(
        `and(user1.eq.${selfId},user2.eq.${targetId}),and(user1.eq.${targetId},user2.eq.${selfId})`,
      );
    return !error;
  } catch {
    return false;
  }
}

export async function unblockUser(selfId: string, targetId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('pr_blocks')
      .delete()
      .eq('blocker_id', selfId)
      .eq('blocked_id', targetId);
    return !error;
  } catch {
    return false;
  }
}

export async function listBlocked(selfId: string): Promise<UserRow[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from('pr_blocks').select('blocked_id').eq('blocker_id', selfId);
    const ids = (data ?? []).map((b) => b.blocked_id);
    if (ids.length === 0) return [];
    const { data: users } = await supabase
      .from('pr_users')
      .select('*')
      .in('id', ids);
    return users ?? [];
  } catch {
    return [];
  }
}

/** Genel sıralama: toplam puana göre ilk 50 */
export async function globalLeaderboard(): Promise<UserRow[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('pr_users')
      .select('*')
      .order('puan', { ascending: false })
      .limit(50);
    return data ?? [];
  } catch {
    return [];
  }
}

/** Haftalık/aylık vitrin: dönem içindeki yarışlardan kazanılan puan toplamı */
export async function periodLeaderboard(days: number): Promise<{ user: UserRow; periodPoints: number }[]> {
  if (!supabase) return [];
  try {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data } = await supabase
      .from('pr_race_participants')
      .select('user_id, puan, races!inner(baslangic)')
      .gte('races.baslangic', since)
      .limit(2000);
    if (!data) return [];
    const totals = new Map<string, number>();
    for (const row of data) {
      totals.set(row.user_id, (totals.get(row.user_id) ?? 0) + (row.puan ?? 0));
    }
    const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    if (top.length === 0) return [];
    const { data: users } = await supabase
      .from('pr_users')
      .select('*')
      .in('id', top.map(([id]) => id));
    const userMap = new Map((users ?? []).map((u) => [u.id, u]));
    return top
      .map(([id, pts]) => {
        const u = userMap.get(id);
        return u ? { user: u, periodPoints: pts } : null;
      })
      .filter((x): x is { user: UserRow; periodPoints: number } => x !== null);
  } catch {
    return [];
  }
}

/** Son 20 yarış geçmişi */
export async function matchHistory(userId: string): Promise<HistoryRow[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from('pr_race_participants')
      .select('race_id, sira, puan, bitis_suresi, races!inner(harita, mod, baslangic)')
      .eq('user_id', userId)
      .order('race_id', { ascending: false })
      .limit(20);
    return (data ?? []).map((row) => {
      const race = row.races as unknown as { harita: string; mod: string; baslangic: string };
      return {
        raceId: row.race_id,
        harita: race.harita,
        mod: race.mod,
        sira: row.sira,
        puan: row.puan,
        bitis_suresi: row.bitis_suresi,
        tarih: race.baslangic,
      };
    });
  } catch {
    return [];
  }
}

/** Kazanılmış rozet id'leri (uzak) */
export async function fetchUserBadges(userId: string): Promise<string[]> {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from('pr_user_badges').select('badge_id').eq('user_id', userId);
    return (data ?? []).map((b) => b.badge_id);
  } catch {
    return [];
  }
}
