// Hızlı maç kuyruğu: küresel bir realtime kanalında oyuncu toplar.
// 12 sn içinde eşleşme olursa en kıdemli oyuncu oda kurup kodu yayınlar;
// kimse yoksa çağıran taraf bot dolgulu tek kişilik yarışa düşer.
import { supabase } from '../lib/supabase';

const QUEUE_CHANNEL = 'pr-quickmatch';
const WAIT_MS = 12000;
const MAX_PLAYERS = 6;

export type QuickMatchResult =
  | { kind: 'room'; code: string; isHost: boolean }
  | { kind: 'solo' };

interface QueueMember {
  id: string;
  joinedAt: number;
}

export function findQuickMatch(
  selfId: string,
  onStatus: (msg: string) => void,
  createRoom: () => Promise<string>,
): { promise: Promise<QuickMatchResult>; cancel: () => void } {
  if (!supabase) {
    return { promise: Promise.resolve({ kind: 'solo' }), cancel: () => {} };
  }

  const channel = supabase.channel(QUEUE_CHANNEL, {
    config: { presence: { key: selfId }, broadcast: { self: false } },
  });

  let cancelled = false;
  let settled = false;
  const joinedAt = Date.now();

  const cleanup = () => {
    void channel.unsubscribe().catch(() => {});
  };

  const promise = new Promise<QuickMatchResult>((resolve) => {
    const settle = (r: QuickMatchResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(r);
    };

    const members = (): QueueMember[] => {
      const state = channel.presenceState<{ joinedAt: number }>();
      return Object.entries(state).map(([id, metas]) => ({
        id,
        joinedAt: metas[0]?.joinedAt ?? Date.now(),
      }));
    };

    const amOldest = (): boolean => {
      const list = members();
      if (list.length === 0) return true;
      const oldest = list.reduce((a, b) =>
        a.joinedAt < b.joinedAt || (a.joinedAt === b.joinedAt && a.id < b.id) ? a : b,
      );
      return oldest.id === selfId;
    };

    const tryHost = async () => {
      if (settled || cancelled) return;
      const others = members().filter((m) => m.id !== selfId);
      if (others.length === 0) {
        settle({ kind: 'solo' });
        return;
      }
      if (!amOldest()) return; // host olmayan taraf 'match' mesajını bekler
      try {
        onStatus('Oda kuruluyor…');
        const code = await createRoom();
        channel.send({ type: 'broadcast', event: 'match', payload: { code } }).catch(() => {});
        settle({ kind: 'room', code, isHost: true });
      } catch {
        settle({ kind: 'solo' });
      }
    };

    channel
      .on('broadcast', { event: 'match' }, ({ payload }) => {
        settle({ kind: 'room', code: (payload as { code: string }).code, isHost: false });
      })
      .on('presence', { event: 'sync' }, () => {
        const count = members().length;
        onStatus(`Oyuncu aranıyor… (${count} kişi kuyrukta)`);
        // Kuyruk dolduysa beklemeden başlat
        if (count >= MAX_PLAYERS) void tryHost();
      });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await channel.track({ joinedAt });
        } catch {
          settle({ kind: 'solo' });
          return;
        }
        window.setTimeout(() => void tryHost(), WAIT_MS);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        settle({ kind: 'solo' });
      }
    });
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      settled = true;
      cleanup();
    },
  };
}
