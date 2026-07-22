import { create } from 'zustand';
import { RoomClient, type RoomPlayer } from '../net/roomClient';
import type { ChatMsg, StartMsg } from '../net/protocol';

export interface LobbyChatEntry extends ChatMsg {
  key: number;
}

interface RoomState {
  client: RoomClient | null;
  players: RoomPlayer[];
  chat: LobbyChatEntry[];
  /** Yarış başlatma mesajı (yarış ekranına taşınır) */
  startMsg: StartMsg | null;
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'closed';
  error: string | null;
  /** Hızlı maç akışı: lobi otomatik başlar, eksikler botla dolar */
  quickMatch: boolean;
  setQuickMatch: (v: boolean) => void;
  createRoom: (selfId: string, username: string) => Promise<boolean>;
  joinRoom: (code: string, selfId: string, username: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  pushChat: (msg: ChatMsg) => void;
  setStartMsg: (msg: StartMsg | null) => void;
}

let chatSeq = 0;

function wireCallbacks(client: RoomClient, set: (p: Partial<RoomState>) => void, get: () => RoomState) {
  client.setCallbacks({
    onPlayers: (players) => set({ players }),
    onChat: (msg) => get().pushChat(msg),
    onStart: (msg) => set({ startMsg: msg }),
    onClosed: () => set({ status: 'closed' }),
    onStatus: (s) =>
      set({ status: s === 'connected' ? 'connected' : s === 'closed' ? 'closed' : 'reconnecting' }),
  });
}

export const useRoomStore = create<RoomState>((set, get) => ({
  client: null,
  players: [],
  chat: [],
  startMsg: null,
  status: 'idle',
  error: null,
  quickMatch: false,
  setQuickMatch: (v) => set({ quickMatch: v }),

  createRoom: async (selfId, username) => {
    set({ status: 'connecting', error: null, chat: [], startMsg: null });
    try {
      const client = await RoomClient.create(selfId, username);
      wireCallbacks(client, set, get);
      set({ client, status: 'connected', players: client.players });
      return true;
    } catch (e) {
      set({ status: 'idle', error: e instanceof Error ? e.message : 'Oda oluşturulamadı' });
      return false;
    }
  },

  joinRoom: async (code, selfId, username) => {
    set({ status: 'connecting', error: null, chat: [], startMsg: null });
    try {
      const client = await RoomClient.join(code, selfId, username);
      wireCallbacks(client, set, get);
      set({ client, status: 'connected', players: client.players });
      return true;
    } catch (e) {
      set({ status: 'idle', error: e instanceof Error ? e.message : 'Odaya katılınamadı' });
      return false;
    }
  },

  leaveRoom: async () => {
    const client = get().client;
    if (client) {
      if (client.isHost) await client.close();
      else await client.leave();
    }
    set({ client: null, players: [], chat: [], startMsg: null, status: 'idle' });
  },

  pushChat: (msg) => {
    const entry: LobbyChatEntry = { ...msg, key: ++chatSeq };
    set({ chat: [...get().chat.slice(-49), entry] });
  },

  setStartMsg: (msg) => set({ startMsg: msg }),
}));
