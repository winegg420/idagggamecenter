// Oda istemcisi: Supabase Realtime kanal yönetimi (presence + broadcast).
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { ChatMsg, FinishMsg, GoMsg, PosMsg, ReadyMsg, SkillMsg, StartMsg } from './protocol';
import { NETWORK } from '../config/constants';

export interface RoomPlayer {
  id: string;
  username: string;
  character: string;
  team: number;
  vote: string | null;
  /** Son dans zamanı (animasyon tetiklemek için) */
  danceAt: number;
}

export interface RoomCallbacks {
  onPlayers?: (players: RoomPlayer[]) => void;
  onChat?: (msg: ChatMsg) => void;
  onStart?: (msg: StartMsg) => void;
  /** Bir oyuncunun yarış sahnesi yüklendi (host senkron start için toplar) */
  onReady?: (msg: ReadyMsg) => void;
  /** Host'un "şu kadar sonra GO" kararı — herkes buna hizalanır */
  onGo?: (msg: GoMsg) => void;
  onPos?: (msg: PosMsg) => void;
  onSkill?: (msg: SkillMsg) => void;
  onFinish?: (msg: FinishMsg) => void;
  onClosed?: () => void;
  onStatus?: (status: 'connected' | 'reconnecting' | 'closed') => void;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPRSTUVYZ23456789';

export function generateRoomCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  }
  return code;
}

export function whatsappInviteUrl(code: string): string {
  const url = `${window.location.origin}?oda=${code}`;
  const text = `🏁 PatiRun'da yarışa katıl! Oda kodu: ${code}\n${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export class RoomClient {
  readonly code: string;
  readonly selfId: string;
  readonly username: string;
  hostId: string;
  private channel: RealtimeChannel;
  private cb: RoomCallbacks = {};
  /** Gönderen (oyuncu/bot) başına son pozisyon gönderim zamanı */
  private lastPosSent = new Map<string, number>();
  private presenceData: { username: string; character: string; team: number; vote: string | null; danceAt: number };
  players: RoomPlayer[] = [];

  private constructor(
    code: string,
    selfId: string,
    username: string,
    hostId: string,
    channel: RealtimeChannel,
  ) {
    this.code = code;
    this.selfId = selfId;
    this.username = username;
    this.hostId = hostId;
    this.channel = channel;
    this.presenceData = { username, character: 'sloth', team: 0, vote: null, danceAt: 0 };
  }

  get isHost(): boolean {
    return this.selfId === this.hostId;
  }

  /** Oda kur: rooms tablosuna kayıt + kanala katılım. */
  static async create(selfId: string, username: string): Promise<RoomClient> {
    if (!supabase) throw new Error('Çok oyunculu mod için Supabase yapılandırması gerekli');
    let code = generateRoomCode();
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase.from('pr_rooms').insert({ code, host_id: selfId });
      if (!error) break;
      if (attempt === 2) throw new Error('Oda oluşturulamadı: ' + error.message);
      code = generateRoomCode();
    }
    return RoomClient.joinChannel(code, selfId, username, selfId);
  }

  /** Koda göre odaya katıl. */
  static async join(code: string, selfId: string, username: string): Promise<RoomClient> {
    if (!supabase) throw new Error('Çok oyunculu mod için Supabase yapılandırması gerekli');
    const normalized = code.trim().toUpperCase();
    const { data, error } = await supabase
      .from('pr_rooms')
      .select('code, host_id, status')
      .eq('code', normalized)
      .maybeSingle();
    if (error) throw new Error('Oda sorgulanamadı: ' + error.message);
    if (!data) throw new Error('Oda bulunamadı. Kodu kontrol et.');
    if (data.status === 'closed') throw new Error('Bu oda kapanmış.');
    return RoomClient.joinChannel(normalized, selfId, username, data.host_id);
  }

  private static joinChannel(
    code: string,
    selfId: string,
    username: string,
    hostId: string,
  ): Promise<RoomClient> {
    const channel = supabase!.channel(`pr-room:${code}`, {
      config: { presence: { key: selfId }, broadcast: { self: false } },
    });
    const client = new RoomClient(code, selfId, username, hostId, channel);

    channel
      .on('presence', { event: 'sync' }, () => client.syncPlayers())
      .on('broadcast', { event: 'chat' }, ({ payload }) => client.cb.onChat?.(payload as ChatMsg))
      .on('broadcast', { event: 'start' }, ({ payload }) =>
        // recvAt: geri sayım YEREL alınma anına göre hesaplanır (saat farkı etkisiz)
        client.cb.onStart?.({ ...(payload as StartMsg), recvAt: Date.now() }),
      )
      .on('broadcast', { event: 'ready' }, ({ payload }) =>
        client.cb.onReady?.(payload as ReadyMsg),
      )
      .on('broadcast', { event: 'go' }, ({ payload }) =>
        client.cb.onGo?.({ ...(payload as GoMsg), recvAt: Date.now() }),
      )
      .on('broadcast', { event: 'pos' }, ({ payload }) => client.cb.onPos?.(payload as PosMsg))
      .on('broadcast', { event: 'skill' }, ({ payload }) =>
        client.cb.onSkill?.(payload as SkillMsg),
      )
      .on('broadcast', { event: 'finish' }, ({ payload }) =>
        client.cb.onFinish?.(payload as FinishMsg),
      )
      .on('broadcast', { event: 'closed' }, () => client.cb.onClosed?.());

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Odaya bağlanılamadı (zaman aşımı)')), 10000);
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          try {
            await channel.track(client.presenceData);
          } catch {
            // presence takılırsa oyuncu listesi sync'te düzelir
          }
          client.cb.onStatus?.('connected');
          resolve(client);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          client.cb.onStatus?.('reconnecting');
        } else if (status === 'CLOSED') {
          client.cb.onStatus?.('closed');
        }
      });
    });
  }

  setCallbacks(cb: RoomCallbacks): void {
    this.cb = { ...this.cb, ...cb };
  }

  private syncPlayers(): void {
    const state = this.channel.presenceState<{
      username: string;
      character: string;
      team: number;
      vote: string | null;
      danceAt: number;
    }>();
    this.players = Object.entries(state).map(([id, metas]) => {
      const m = metas[metas.length - 1];
      return {
        id,
        username: m.username,
        character: m.character,
        team: m.team,
        vote: m.vote,
        danceAt: m.danceAt,
      };
    });
    this.cb.onPlayers?.(this.players);
  }

  /** Presence güncelle (takım, oy, karakter, dans). */
  async updatePresence(
    partial: Partial<{ character: string; team: number; vote: string | null; danceAt: number }>,
  ): Promise<void> {
    this.presenceData = { ...this.presenceData, ...partial };
    try {
      await this.channel.track(this.presenceData);
    } catch {
      // bağlantı kopuksa reconnect akışı devralır
    }
  }

  private send(event: string, payload: unknown): void {
    void this.channel.send({ type: 'broadcast', event, payload }).catch(() => {
      // gönderilemeyen tekil mesajlar oyunu durdurmasın
    });
  }

  sendChat(msg: ChatMsg): void {
    this.send('chat', msg);
    this.cb.onChat?.(msg); // kendi mesajını da göster (broadcast self kapalı)
  }

  sendStart(msg: StartMsg): void {
    if (!this.isHost) return;
    this.send('start', msg);
  }

  /** "Sahnem hazır" — host bunları toplayıp GO yayınlar (senkron start). */
  sendReady(): void {
    const msg: ReadyMsg = { u: this.selfId };
    this.send('ready', msg);
  }

  /** Host: kesin başlangıç anı. */
  sendGo(msg: GoMsg): void {
    if (!this.isHost) return;
    this.send('go', msg);
  }

  /** Pozisyon: gönderen başına saniyede en fazla POSITION_SEND_RATE mesaj. */
  sendPos(msg: PosMsg): void {
    const now = Date.now();
    const last = this.lastPosSent.get(msg.u) ?? 0;
    if (now - last < 1000 / NETWORK.POSITION_SEND_RATE) return;
    this.lastPosSent.set(msg.u, now);
    this.send('pos', msg);
  }

  sendSkill(msg: SkillMsg): void {
    this.send('skill', msg);
  }

  sendFinish(msg: FinishMsg): void {
    this.send('finish', msg);
  }

  /** Odayı kapat (sadece host) ve ayrıl. */
  async close(): Promise<void> {
    if (this.isHost && supabase) {
      this.send('closed', {});
      try {
        await supabase.from('pr_rooms').update({ status: 'closed' }).eq('code', this.code);
      } catch {
        // oda satırı güncellenemese de kanal kapanır
      }
    }
    await this.leave();
  }

  async leave(): Promise<void> {
    try {
      await this.channel.unsubscribe();
    } catch {
      // zaten kopuksa sorun değil
    }
  }
}
