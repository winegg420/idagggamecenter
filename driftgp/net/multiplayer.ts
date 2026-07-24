// Supabase Realtime tabanlı 6 kişilik oda sistemi.
// - Oda: `room:{KOD}` kanalı; presence = üyelik, broadcast = durum senkronu (10Hz) ve yarış olayları.
// - Bağlantı kopması: presence 'leave' → oyuncu listeden düşer, diğerlerinin yarışı etkilenmez;
//   yarış sırasında kopan oyuncu DNF sayılır.
// - Matchmaking: `lobby` kanalı presence'ında bekleyen odalar ilan edilir; boş oda bulunamazsa oluşturulur.
// - Davet: `user:{id}` kanalına broadcast; alıcı çevrimiçiyse bildirim alır.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/** Tek pozisyon anlık görüntüsü — snapshot interpolasyonu için (t = yerel alım zamanı, ms). */
export interface PosSnapshot {
  x: number;
  z: number;
  heading: number;
  speed: number;
  t: number;
}

export interface RemotePlayerState {
  id: string;
  name: string;
  carId: string;
  paintColor: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  drifting: boolean;
  nitro: boolean;
  /** birikimli gövde hasarı 0..1 — uzak araçta duman/alev göstermek için senkronlanır */
  damage: number;
  lap: number;
  trackIndex: number;
  finished: boolean;
  finishTime: number;
  /** yarışı yarıda bıraktı (lobiye/menüye döndü) — pistte gösterilmez, sonuçta DNF */
  quit: boolean;
  lastUpdate: number;
  /** son iki pozisyon anlık görüntüsü — akıcı interpolasyon/ekstrapolasyon için */
  snapPrev: PosSnapshot | null;
  snapCur: PosSnapshot | null;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  playerCount: number;
  status: 'waiting' | 'racing';
}

export interface RaceStartMsg {
  trackId: string;
  laps: number;
  /** benzersiz yarış kimliği — aynı yarışı ikinci kez başlatmayı engeller */
  raceId: number;
}

type Listener = () => void;

const MAX_PLAYERS = 6;

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

class MultiplayerManager {
  selfId = `p-${Math.random().toString(36).slice(2, 10)}`;
  selfName = 'Sürücü';
  selfCarId = 'civic-ok';
  selfPaint = '#0077b6';

  roomCode: string | null = null;
  isHost = false;
  roomStatus: 'waiting' | 'racing' = 'waiting';
  players = new Map<string, RemotePlayerState>();
  raceStart: RaceStartMsg | null = null;
  /** epoch ms — ışıkların sönüp yarışın başlayacağı an. null = oyuncular hâlâ yükleniyor. */
  raceGoAt: number | null = null;
  /** sahnesi yüklenip hazır sinyali veren oyuncular (bekleme ekranı "n/m hazır" için) */
  readyIds = new Set<string>();
  /** yarış başlangıcında beklenen oyuncu kimlikleri (start anındaki üye listesi) */
  expectedIds = new Set<string>();
  pendingInvite: { from: string; roomCode: string } | null = null;
  lastError: string | null = null;
  /** presence'ta host meta'lı bir üye görülüyor mu (oda doğrulama + host devri için) */
  private hostPresent = false;
  /** host saati − kendi saatim (ms). NTP tarzı ping/pong ile ölçülür; host'ta 0.
   *  'go' epoch'unu (host saatinde) yerel saate çevirmek için kullanılır → gerçek senkron start. */
  private clockOffset = 0;
  /** offset örneklerinin en düşük RTT'lisi (en az tıkanık ölçüm en güvenilirdir) */
  private clockBestRtt = Infinity;
  private clockPingTimers: number[] = [];

  private room: RealtimeChannel | null = null;
  private lobby: RealtimeChannel | null = null;
  private inviteChannel: RealtimeChannel | null = null;
  private listeners = new Set<Listener>();
  private lastSend = 0;
  private goTimeout: number | null = null;
  private identityRetrack: number | null = null;

  get available(): boolean {
    return supabase !== null;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  setIdentity(name: string, carId: string, paint: string) {
    const changed = name !== this.selfName || carId !== this.selfCarId || paint !== this.selfPaint;
    this.selfName = name;
    this.selfCarId = carId;
    this.selfPaint = paint;
    // odadayken isim/araç değişirse presence'ı tazele → diğerleri yeni ismi görür.
    // Debounce: her tuş vuruşunda track göndermemek için (realtime mesaj limiti).
    if (changed && this.room) {
      if (this.identityRetrack !== null) clearTimeout(this.identityRetrack);
      this.identityRetrack = window.setTimeout(() => {
        this.identityRetrack = null;
        this.room
          ?.track({ name: this.selfName, carId: this.selfCarId, paint: this.selfPaint, host: this.isHost })
          .catch(() => {/* geçici ağ hatası — sonraki sync telafi eder */});
      }, 400);
    }
  }

  async init(authUserId?: string) {
    if (!supabase) return;
    if (authUserId) this.selfId = authUserId;
    try {
      // kişisel davet kanalı
      this.inviteChannel?.unsubscribe();
      this.inviteChannel = supabase.channel(`dg-user:${this.selfId}`);
      this.inviteChannel.on('broadcast', { event: 'invite' }, ({ payload }) => {
        this.pendingInvite = payload as { from: string; roomCode: string };
        this.notify();
      });
      await this.inviteChannel.subscribe();
    } catch (err) {
      console.warn('[DidaGP] Davet kanalı açılamadı:', err);
    }
  }

  // ---------- Oda ----------

  async createRoom(): Promise<string | null> {
    if (!supabase) return null;
    const code = randomCode();
    const ok = await this.joinChannel(code, true);
    return ok ? code : null;
  }

  async joinRoom(code: string): Promise<boolean> {
    if (!supabase) return false;
    return this.joinChannel(code.toUpperCase().trim(), false);
  }

  private async joinChannel(code: string, asHost: boolean): Promise<boolean> {
    if (!supabase) return false;
    this.leaveRoom();
    this.lastError = null;
    try {
      const ch = supabase.channel(`dg-room:${code}`, { config: { presence: { key: this.selfId } } });

      ch.on('presence', { event: 'sync' }, () => {
        const state = ch.presenceState<{ name: string; carId: string; paint: string; host: boolean }>();
        const seen = new Set<string>();
        let hostSeen = false;
        for (const [key, metas] of Object.entries(state)) {
          seen.add(key);
          const meta = metas[0];
          if (meta?.host) hostSeen = true;
          if (key === this.selfId) continue;
          if (!meta) continue;
          const existing = this.players.get(key);
          if (!existing) {
            this.players.set(key, {
              id: key,
              name: meta.name,
              carId: meta.carId,
              paintColor: meta.paint,
              x: 0,
              z: 0,
              heading: 0,
              speed: 0,
              drifting: false,
              nitro: false,
              damage: 0,
              lap: 1,
              trackIndex: 0,
              finished: false,
              finishTime: -1,
              quit: false,
              lastUpdate: Date.now(),
              snapPrev: null,
              snapCur: null,
            });
          } else {
            existing.name = meta.name;
            existing.carId = meta.carId;
            existing.paintColor = meta.paint;
          }
        }
        // ayrılanları temizle (bağlantı kopması dahil) — kalanların yarışı devam eder
        for (const key of [...this.players.keys()]) {
          if (!seen.has(key)) this.players.delete(key);
        }
        this.hostPresent = hostSeen;
        // host ayrıldıysa: en küçük id'li üye yeni host olur (oda ölmez, deterministik seçim)
        if (!hostSeen && this.room === ch && seen.size > 0) {
          const minId = [...seen].sort()[0];
          if (minId === this.selfId && !this.isHost) {
            this.isHost = true;
            ch.track({ name: this.selfName, carId: this.selfCarId, paint: this.selfPaint, host: true }).catch(() => {});
            this.announceToLobby().catch(() => {});
          }
        }
        // bekleme fazında biri odadan düştüyse onu bekleme (kilitlenme olmasın)
        this.maybeSendGo();
        // lobi ilanındaki oyuncu sayısını güncel tut
        this.updateLobbyPresence();
        this.notify();
      });

      ch.on('broadcast', { event: 'pos' }, ({ payload }) => {
        const p = payload as Partial<RemotePlayerState> & { id: string };
        const player = this.players.get(p.id);
        if (player) {
          Object.assign(player, p, { lastUpdate: Date.now() });
          // snapshot tamponu: son iki örnek → RemoteCars akıcı interpolasyon yapar
          player.snapPrev = player.snapCur;
          player.snapCur = {
            x: p.x ?? player.x,
            z: p.z ?? player.z,
            heading: p.heading ?? player.heading,
            speed: p.speed ?? player.speed,
            t: performance.now(),
          };
        }
      });

      ch.on('broadcast', { event: 'start' }, ({ payload }) => {
        this.raceStart = payload as RaceStartMsg;
        this.roomStatus = 'racing';
        this.beginReadyPhase();
        this.resetPlayersRaceState(); // önceki yarışın bitirdi/DNF durumu yeni yarışa taşınmasın
        this.notify();
      });

      // bir oyuncunun yarış sahnesi yüklendi → herkes "n/m hazır" görür; host tamamlanınca GO yollar
      ch.on('broadcast', { event: 'ready' }, ({ payload }) => {
        const { id } = payload as { id: string };
        this.readyIds.add(id);
        this.maybeSendGo();
        this.notify();
      });

      // istemci saat-senkron ping'i (yalnız host yanıtlar) → alan istemcinin offset'ini ölçer
      ch.on('broadcast', { event: 'ping' }, ({ payload }) => {
        if (!this.isHost) return;
        const { id, t0 } = payload as { id: string; t0: number };
        this.room
          ?.send({ type: 'broadcast', event: 'pong', payload: { to: id, t0, t1: Date.now() } })
          .catch(() => {/* geçici ağ hatası — sonraki ping telafi eder */});
      });

      // host'tan gelen pong → NTP tarzı offset (host saati − kendi saatim) hesapla, en düşük RTT'yi tut
      ch.on('broadcast', { event: 'pong' }, ({ payload }) => {
        const { to, t0, t1 } = payload as { to: string; t0: number; t1: number };
        if (to !== this.selfId) return;
        const t3 = Date.now();
        const rtt = t3 - t0;
        if (rtt < this.clockBestRtt) {
          this.clockBestRtt = rtt;
          // t1 host'un alım/gönderim anı; simetrik gecikme varsayımıyla offset = host − self
          this.clockOffset = t1 - (t0 + t3) / 2;
        }
      });

      // host'un GO kararı: tüm istemciler geri sayımı host epoch'una hizalar → herkes AYNI ANDA başlar
      ch.on('broadcast', { event: 'go' }, ({ payload }) => {
        const { goAt, t0 } = payload as { goAt: number; t0?: number };
        // Cihaz saatleri (özellikle telefonlarda) sapar; ayrıca 'go' mesajının tek yönlü
        // ağ gecikmesi kadar geç ulaşması geri sayımı kaydırır (bir oyuncu ~1 sn erken başlar).
        // Çözüm: goAt host saatindedir; önceden ölçtüğümüz saat-offset'i ile YEREL saate
        // çeviririz (clientTime = hostTime − offset) → mesajın uçuş süresinden bağımsız senkron.
        // Offset ölçülemediyse (ping yanıtsız) eski göreli yönteme düş: alım + kalan süre.
        if (this.clockBestRtt !== Infinity) {
          this.raceGoAt = goAt - this.clockOffset;
        } else {
          this.raceGoAt = t0 != null ? Date.now() + (goAt - t0) : goAt;
        }
        this.notify();
      });

      ch.on('broadcast', { event: 'finish' }, ({ payload }) => {
        const { id, time } = payload as { id: string; time: number };
        const player = this.players.get(id);
        if (player) {
          player.finished = true;
          player.finishTime = time;
          this.notify();
        }
      });

      ch.on('broadcast', { event: 'quit' }, ({ payload }) => {
        const { id } = payload as { id: string };
        const player = this.players.get(id);
        if (player) {
          player.quit = true;
          player.finished = true;
          player.finishTime = -1; // DNF
          this.notify();
        }
      });

      const status = await new Promise<string>((resolve) => {
        ch.subscribe((s) => {
          resolve(s); // ilk durum — sonraki çağrılar no-op
          // katılım sonrası kopma: kullanıcıya bildir (sessiz ölü oda kalmasın)
          if ((s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') && this.room === ch) {
            this.lastError = 'Sunucu bağlantısı koptu — odaya yeniden katıl';
            this.notify();
          }
        }, 10000);
      });
      if (status !== 'SUBSCRIBED') {
        this.lastError = 'Odaya bağlanılamadı';
        return false;
      }

      await ch.track({ name: this.selfName, carId: this.selfCarId, paint: this.selfPaint, host: asHost });
      this.room = ch;
      this.roomCode = code;
      this.isHost = asHost;
      this.roomStatus = 'waiting';
      this.raceStart = null;
      // DİKKAT: hostPresent'ı burada asHost ile EZME — presence sync bu satırdan önce gelip
      // hostPresent=true yazmış olabilir (yarış durumu); ezersek katılım yanlışlıkla
      // "Oda bulunamadı" ile reddedilir. leaveRoom() zaten false'a sıfırlamıştı.
      if (asHost) this.hostPresent = true;

      if (!asHost) {
        // Oda doğrulama: Supabase kanalları anında "var olur" — yanlış koda katılım sessizce
        // boş bir odaya düşer. Presence sync'ini bekleyip host'un gerçekten orada olduğunu doğrula.
        const deadline = Date.now() + 5000;
        while (Date.now() < deadline && !this.hostPresent) {
          await new Promise((r) => setTimeout(r, 150));
        }
        if (!this.hostPresent) {
          this.lastError = 'Oda bulunamadı — kodu kontrol et';
          this.leaveRoom();
          return false;
        }
        // kapasite kontrolü (presence sync geldikten sonra sayım güvenilir)
        if (this.players.size + 1 > MAX_PLAYERS) {
          this.lastError = 'Oda dolu (6/6)';
          this.leaveRoom();
          return false;
        }
      }
      await this.announceToLobby();
      this.notify();
      return true;
    } catch (err) {
      console.error('[DidaGP] Oda bağlantı hatası:', err);
      this.lastError = 'Bağlantı hatası';
      return false;
    }
  }

  leaveRoom() {
    try {
      this.room?.unsubscribe();
      this.lobby?.unsubscribe();
    } catch {
      /* yoksay */
    }
    this.room = null;
    this.lobby = null;
    this.roomCode = null;
    this.isHost = false;
    this.roomStatus = 'waiting';
    this.hostPresent = false;
    this.players.clear();
    this.raceStart = null;
    this.raceGoAt = null;
    this.readyIds.clear();
    this.expectedIds.clear();
    this.clockPingTimers.forEach(clearTimeout);
    this.clockPingTimers = [];
    this.clockOffset = 0;
    this.clockBestRtt = Infinity;
    if (this.goTimeout !== null) clearTimeout(this.goTimeout);
    this.goTimeout = null;
    this.notify();
  }

  /** Yarış bitince/yarıda bırakılınca lobiye dönüş — raceStart temizlenmezse lobi ekranı
   *  yarışı anında yeniden başlatır (kritik akış bug'ı). Oda üyeliği korunur. */
  returnToLobby() {
    this.raceStart = null;
    this.raceGoAt = null;
    this.readyIds.clear();
    this.expectedIds.clear();
    if (this.goTimeout !== null) clearTimeout(this.goTimeout);
    this.goTimeout = null;
    this.roomStatus = 'waiting';
    this.updateLobbyPresence();
    this.notify();
  }

  /** Yeni yarış başlarken tüm uzak oyuncuların önceki yarış durumunu sıfırla. */
  private resetPlayersRaceState() {
    for (const p of this.players.values()) {
      p.finished = false;
      p.finishTime = -1;
      p.quit = false;
      p.lap = 1;
      p.trackIndex = 0;
      p.damage = 0;
      p.snapPrev = null;
      p.snapCur = null;
    }
  }

  /** Host'un lobi ilanını (oyuncu sayısı + durum) güncel tutar. */
  private updateLobbyPresence() {
    if (!this.isHost || !this.lobby || !this.roomCode) return;
    this.lobby
      .track({ code: this.roomCode, playerCount: this.players.size + 1, status: this.roomStatus })
      .catch(() => {/* geçici ağ hatası — presence sync'te tekrar denenir */});
  }

  // ---------- Lobi / Matchmaking ----------

  private async announceToLobby() {
    if (!supabase || !this.isHost || !this.roomCode) return;
    try {
      this.lobby?.unsubscribe();
      this.lobby = supabase.channel('dg-lobby', { config: { presence: { key: this.selfId } } });
      await new Promise<string>((resolve) => this.lobby!.subscribe((s) => resolve(s), 8000));
      await this.lobby.track({
        code: this.roomCode,
        playerCount: this.players.size + 1,
        status: this.roomStatus,
      });
    } catch (err) {
      console.warn('[DidaGP] Lobi ilanı başarısız:', err);
    }
  }

  /** Bekleyen odaları listeler (matchmaking + manuel liste için). */
  async listOpenRooms(): Promise<RoomInfo[]> {
    if (!supabase) return [];
    try {
      const lobbyCh = supabase.channel('dg-lobby', { config: { presence: { key: `scan-${this.selfId}` } } });
      const rooms: RoomInfo[] = [];
      await new Promise<void>((resolve) => {
        lobbyCh.on('presence', { event: 'sync' }, () => {
          const state = lobbyCh.presenceState<{ code: string; playerCount: number; status: string }>();
          rooms.length = 0;
          for (const [key, metas] of Object.entries(state)) {
            const m = metas[0];
            if (m?.code && m.status === 'waiting' && key !== this.selfId) {
              rooms.push({ code: m.code, hostId: key, playerCount: m.playerCount, status: 'waiting' });
            }
          }
        });
        lobbyCh.subscribe((s) => {
          if (s === 'SUBSCRIBED') setTimeout(resolve, 800); // presence sync bekle
          else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') resolve();
        }, 8000);
      });
      lobbyCh.unsubscribe();
      return rooms.filter((r) => r.playerCount < MAX_PLAYERS);
    } catch (err) {
      console.warn('[DidaGP] Oda taraması başarısız:', err);
      return [];
    }
  }

  /** Rastgele eşleşme: açık oda varsa katıl, yoksa oda kur. */
  async quickMatch(): Promise<string | null> {
    const rooms = await this.listOpenRooms();
    for (const r of rooms) {
      if (await this.joinRoom(r.code)) return r.code;
    }
    return this.createRoom();
  }

  /** Kayıtlı kullanıcıya davet gönder (çevrimiçiyse alır). */
  async invite(userId: string): Promise<boolean> {
    if (!supabase || !this.roomCode) return false;
    try {
      const ch = supabase.channel(`dg-user:${userId}`);
      await new Promise<string>((resolve) => ch.subscribe((s) => resolve(s), 8000));
      await ch.send({
        type: 'broadcast',
        event: 'invite',
        payload: { from: this.selfName, roomCode: this.roomCode },
      });
      ch.unsubscribe();
      return true;
    } catch (err) {
      console.warn('[DidaGP] Davet gönderilemedi:', err);
      return false;
    }
  }

  clearInvite() {
    this.pendingInvite = null;
    this.notify();
  }

  // ---------- Yarış ----------

  /**
   * İki fazlı senkron start:
   * 1) Host 'start' yayınlar → herkes yarış sahnesini yükler, yüklenince 'ready' yollar.
   * 2) Tüm beklenenler hazır olunca (veya 12 sn güvenlik zaman aşımında) host 'go' yayınlar;
   *    goAt epoch'una hizalı 3-2-1 geri sayımıyla HERKES AYNI ANDA başlar.
   */
  async startRace(trackId: string, laps: number) {
    if (!this.room || !this.isHost) return;
    const msg: RaceStartMsg = { trackId, laps, raceId: Date.now() };
    this.raceStart = msg;
    this.roomStatus = 'racing';
    this.beginReadyPhase();
    this.resetPlayersRaceState();
    try {
      await this.room.send({ type: 'broadcast', event: 'start', payload: msg });
      await this.lobby?.track({ code: this.roomCode, playerCount: this.players.size + 1, status: 'racing' });
    } catch (err) {
      console.error('[DidaGP] Yarış başlatılamadı:', err);
    }
    this.notify();
  }

  /** Yeni yarışın bekleme fazını kurar (start'ı alan HERKESTE çalışır). */
  private beginReadyPhase() {
    this.raceGoAt = null;
    this.readyIds.clear();
    this.expectedIds = new Set([this.selfId, ...this.players.keys()]);
    // istemci: GO'dan önce host saatiyle offset'i ölç (senkron start bunun üzerine kurulur)
    if (!this.isHost) this.syncClock();
    if (this.goTimeout !== null) clearTimeout(this.goTimeout);
    // güvenlik: bir istemci takılıp 'ready' gönderemezse yarış sonsuza dek beklemesin
    this.goTimeout = window.setTimeout(() => {
      this.goTimeout = null;
      this.sendGo();
    }, 12000);
  }

  /** İstemci saatini host saatine göre kalibre eder: birkaç ping/pong, en düşük RTT örneği tutulur.
   *  ~4.4 sn'lik GO penceresinden çok önce tamamlanır; sonucu 'go' handler'ı kullanır. */
  private syncClock() {
    this.clockPingTimers.forEach(clearTimeout);
    this.clockPingTimers = [];
    this.clockBestRtt = Infinity;
    const sendPing = () => {
      if (!this.room || this.isHost) return;
      this.room
        .send({ type: 'broadcast', event: 'ping', payload: { id: this.selfId, t0: Date.now() } })
        .catch(() => {/* geçici ağ hatası — diğer örnekler telafi eder */});
    };
    // 4 örnek, 220 ms arayla → tıkanık anları atlayıp en iyi (min-RTT) offset'i yakala.
    // (Az tutuldu: 6 kişilik odada host'un pong yanıtları realtime hız limitini zorlamasın.)
    for (let i = 0; i < 4; i++) {
      this.clockPingTimers.push(window.setTimeout(sendPing, i * 220));
    }
  }

  /** Yarış sahnesi yüklendiğinde Scene tarafından çağrılır — "hazırım" sinyali. */
  sendRaceReady() {
    if (!this.room || !this.raceStart) return;
    if (this.readyIds.has(this.selfId)) return;
    this.readyIds.add(this.selfId); // broadcast kendine yansımaz → yerelde işaretle
    this.room
      .send({ type: 'broadcast', event: 'ready', payload: { id: this.selfId } })
      .catch(() => {/* geçici ağ hatası — host 12 sn zaman aşımıyla yine başlatır */});
    this.maybeSendGo();
    this.notify();
  }

  /** Host: beklenen herkes hazırsa GO yayınla. (ready olayı + presence sync'te çağrılır) */
  private maybeSendGo() {
    if (!this.isHost || !this.raceStart || this.raceGoAt !== null) return;
    const online = new Set([this.selfId, ...this.players.keys()]);
    for (const id of this.expectedIds) {
      if (online.has(id) && !this.readyIds.has(id)) return; // hâlâ yükleniyor
    }
    if (!this.readyIds.has(this.selfId)) return; // kendi sahnem de yüklenmiş olmalı
    this.sendGo();
  }

  private sendGo() {
    if (!this.isHost || !this.raceStart || this.raceGoAt !== null || !this.room) return;
    if (this.goTimeout !== null) {
      clearTimeout(this.goTimeout);
      this.goTimeout = null;
    }
    // 4.4 sn ileri: ~0.9 sn "HAZIR OL" + 3 sn kırmızı ışıklı geri sayım + yayın gecikme payı
    const t0 = Date.now();
    const goAt = t0 + 4400;
    this.raceGoAt = goAt;
    this.room
      // t0 = host'un gönderim anı; alıcı "kalan süre"yi kendi saatine çevirir.
      .send({ type: 'broadcast', event: 'go', payload: { goAt, t0 } })
      .catch((err) => console.error('[DidaGP] GO yayınlanamadı:', err));
    this.notify();
  }

  /** Fizik döngüsünden çağrılır — 15Hz'e düşürülür (eventsPerSecond: 20 sınırının altında). */
  sendState(
    state: Omit<RemotePlayerState, 'name' | 'carId' | 'paintColor' | 'lastUpdate' | 'finishTime' | 'finished' | 'quit' | 'snapPrev' | 'snapCur'>,
  ) {
    if (!this.room) return;
    const now = performance.now();
    if (now - this.lastSend < 66) return;
    this.lastSend = now;
    this.room
      .send({ type: 'broadcast', event: 'pos', payload: state })
      .catch(() => {/* geçici ağ hatası — sonraki paket telafi eder */});
  }

  async sendFinish(time: number) {
    if (!this.room) return;
    try {
      await this.room.send({ type: 'broadcast', event: 'finish', payload: { id: this.selfId, time } });
    } catch (err) {
      console.warn('[DidaGP] Bitiş bildirilemedi:', err);
    }
  }

  /** Yarışı yarıda bırakma bildirimi — diğer oyuncular bu aracı pistten kaldırır, sonuçta DNF yazar. */
  async sendQuit() {
    if (!this.room) return;
    try {
      await this.room.send({ type: 'broadcast', event: 'quit', payload: { id: this.selfId } });
    } catch (err) {
      console.warn('[DidaGP] Ayrılma bildirilemedi:', err);
    }
  }
}

export const multiplayer = new MultiplayerManager();
