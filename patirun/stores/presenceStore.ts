// Küresel online durumu: 'online' kanalında presence ile kimin oyunda olduğu izlenir.
// Arkadaş online bildirimleri + oyuncular arası oda davetleri buradan akar.
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface GameInvite {
  from: string;
  fromName: string;
  code: string;
}

interface PresenceState {
  onlineIds: Set<string>;
  /** Kısa süreli bildirim metni ("X şu an oyunda") */
  toast: string | null;
  /** Gelen oda daveti (Oyuncular listesinden gönderilir) */
  invite: GameInvite | null;
  /** Bildirim gösterilecek arkadaş id'leri (FriendsScreen doldurur) */
  friendIds: Set<string>;
  friendNames: Map<string, string>;
  connect: (selfId: string) => void;
  setFriends: (ids: string[], names: Map<string, string>) => void;
  clearToast: () => void;
  /** Bir oyuncuya oda daveti yolla (online kanalı üzerinden broadcast) */
  sendInvite: (toId: string, fromName: string, code: string) => void;
  clearInvite: () => void;
}

let channel: RealtimeChannel | null = null;
let inviteTimer = 0;
let myId = '';

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineIds: new Set(),
  toast: null,
  invite: null,
  friendIds: new Set(),
  friendNames: new Map(),

  connect: (selfId) => {
    if (!supabase || channel) return;
    try {
      myId = selfId;
      channel = supabase.channel('pr-online', {
        config: { presence: { key: selfId } },
      });
      // Oda daveti: bana adreslenmişse banner göster (30 sn sonra düşer)
      channel.on('broadcast', { event: 'invite' }, ({ payload }) => {
        const p = payload as { to?: string } & GameInvite;
        if (p.to !== selfId || !p.code || !p.fromName) return;
        set({ invite: { from: p.from, fromName: p.fromName, code: p.code } });
        window.clearTimeout(inviteTimer);
        inviteTimer = window.setTimeout(() => set({ invite: null }), 30000);
      });
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel!.presenceState();
        const prev = get().onlineIds;
        const next = new Set(Object.keys(state));
        // Yeni gelen arkadaş var mı → bildirim
        for (const id of next) {
          if (!prev.has(id) && id !== selfId && get().friendIds.has(id)) {
            const name = get().friendNames.get(id) ?? 'Arkadaşın';
            set({ toast: `🟢 ${name} şu an oyunda!` });
            window.setTimeout(() => set({ toast: null }), 4000);
          }
        }
        set({ onlineIds: next });
      });
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel!.track({ at: Date.now() });
          } catch {
            // presence takılırsa online görünmeyiz, kritik değil
          }
        }
      });
    } catch {
      channel = null;
    }
  },

  setFriends: (ids, names) => set({ friendIds: new Set(ids), friendNames: names }),
  clearToast: () => set({ toast: null }),

  sendInvite: (toId, fromName, code) => {
    if (!channel) return;
    try {
      void channel
        .send({
          type: 'broadcast',
          event: 'invite',
          payload: { to: toId, from: myId, fromName, code },
        })
        .catch(() => {
          // davet iletilemezse sessiz geç — gönderen tekrar deneyebilir
        });
    } catch {
      // kanal kopuksa davet gönderilemez, kritik değil
    }
  },

  clearInvite: () => {
    window.clearTimeout(inviteTimer);
    set({ invite: null });
  },
}));
