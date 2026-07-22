// Bekleme odası: oyuncular yan yana, dans/emoji/chat, harita oylaması, takımlar.
import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '../stores/roomStore';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { whatsappInviteUrl } from '../net/roomClient';
import { maskProfanity } from '../lib/profanity';
import { useCharacterStore, pickBotCharacters } from '../stores/characterStore';
import { characterDataUri } from '../render2d/characterSprites';
import { BOT_NAMES } from '../game/bots/botAI';
import { availableMaps2D as availableMaps } from '../game/track2d/maps2d';
import type { MapId } from '../game/types';
import { PHYSICS, RACE, SECRETS } from '../config/constants';
import { useStatsStore } from '../stores/statsStore';

const EMOJIS = ['😂', '🔥', '😎', '🐢', '💪', '👀', '🎉', '😱'];
const QUICK_PHRASES = ['Hazırım!', 'Hadi başlayalım!', 'Bu sefer ben kazanırım', 'Kaçış yok!', 'Görüşürüz podyumda 😏'];

export function LobbyScreen() {
  const { client, players, chat, startMsg, status, error, leaveRoom, quickMatch } = useRoomStore();
  const setScreen = useAppStore((s) => s.setScreen);
  const selfId = useAuthStore((s) => s.user?.id);
  const [text, setText] = useState('');
  const [showTeams, setShowTeams] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hiddenUnlocked = useStatsStore((s) => s.totalRaces >= SECRETS.HIDDEN_MAP_RACES);
  const maps = availableMaps(hiddenUnlocked);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // Seçili karakteri odaya bildir
  useEffect(() => {
    if (client) {
      void client.updatePresence({ character: useCharacterStore.getState().selectedId });
    }
  }, [client]);

  // Host yarışı başlattı → yarış ekranına
  useEffect(() => {
    if (startMsg) setScreen('mpRace');
  }, [startMsg, setScreen]);

  // Hızlı maç: host bekleme sonrası otomatik başlatır (botlarla doldurarak).
  // 8 sn: oyuncular bu sürede harita OYLAYABİLİR (en çok oy alan kazanır).
  const autoStartTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!quickMatch || !client?.isHost || startMsg) return;
    autoStartTimer.current = window.setTimeout(() => startRaceRef.current(true), 8000);
    return () => {
      if (autoStartTimer.current !== null) window.clearTimeout(autoStartTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickMatch, client, startMsg]);

  useEffect(() => {
    if (status === 'closed') {
      void leaveRoom();
      setScreen('menu');
    }
  }, [status, leaveRoom, setScreen]);

  if (!client) {
    return (
      <div className="screen center">
        <p>{error ?? 'Oda bağlantısı yok'}</p>
        <button className="btn" onClick={() => setScreen('menu')}>
          ← Menü
        </button>
      </div>
    );
  }

  const self = players.find((p) => p.id === selfId);
  const isHost = client.isHost;

  // Oy sayımı
  const voteCounts = new Map<string, number>();
  for (const p of players) {
    if (p.vote) voteCounts.set(p.vote, (voteCounts.get(p.vote) ?? 0) + 1);
  }

  const sendText = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    client.sendChat({
      u: client.username,
      kind: 'text',
      body: maskProfanity(trimmed).slice(0, 120),
      t: Date.now(),
    });
    setText('');
  };

  const startRaceRef = useRef<(fill: boolean) => void>(() => {});
  // Eksik oyuncular HER maçta botla tamamlanır (özel oda dahil) — 2 kişilik
  // odada da 6 koşuculu dolu bir yarış olur (kullanıcı isteği 2026-07-04)
  const startRace = (fillWithBots = true) => {
    // Harita: çoğunluk oyu, eşitlikte rastgele
    let winner: MapId = 'orman';
    let best = -1;
    const tied: MapId[] = [];
    for (const m of maps) {
      const count = voteCounts.get(m.id) ?? 0;
      if (count > best) {
        best = count;
        tied.length = 0;
        tied.push(m.id);
      } else if (count === best) {
        tied.push(m.id);
      }
    }
    winner = tied[Math.floor(Math.random() * tied.length)] ?? 'orman';

    const gridX: Record<string, number> = {};
    const teams: Record<string, number> = {};
    const total = players.length;
    players.forEach((p, i) => {
      const spread = Math.min(PHYSICS.TRACK_HALF_WIDTH * 2 - 1.6, Math.max(1, total - 1) * 1.8);
      gridX[p.id] = total <= 1 ? 0 : -spread / 2 + (spread / (total - 1)) * i;
      teams[p.id] = p.team;
    });

    // Hızlı maç: eksik yerleri botla doldur (MAX_PLAYERS kişiye tamamla)
    const bots: { id: string; name: string; character: string }[] = [];
    if (fillWithBots && players.length < RACE.MAX_PLAYERS) {
      const need = RACE.MAX_PLAYERS - players.length;
      const botChars = pickBotCharacters(need, '');
      const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
      for (let i = 0; i < need; i++) {
        const id = `qbot-${i}`;
        bots.push({ id, name: names[i % names.length], character: botChars[i] });
        const spread = Math.min(PHYSICS.TRACK_HALF_WIDTH * 2 - 1.6, (RACE.MAX_PLAYERS - 1) * 1.8);
        gridX[id] = -spread / 2 + (spread / (RACE.MAX_PLAYERS - 1)) * (players.length + i);
      }
    }

    const msg = {
      startAt: Date.now() + (RACE.START_LIGHTS * RACE.START_LIGHT_INTERVAL + 0.4) * 1000 + 1500,
      map: winner,
      timeOfDay: (Math.random() < 0.3 ? 'gece' : 'gunduz') as 'gece' | 'gunduz',
      teams,
      gridX,
      shortcutOpen: Math.random() < SECRETS.SHORTCUT_CHANCE,
      seed: Math.floor(Math.random() * 1e9),
      bots,
    };
    client.sendStart(msg);
    // Host kendine de aynı mesajı uygular (broadcast self kapalı)
    useRoomStore.getState().setStartMsg(msg);
  };
  startRaceRef.current = startRace;

  return (
    <div className="screen lobby">
      <div className="lobby-header">
        <button className="btn small" onClick={() => void leaveRoom().then(() => setScreen('menu'))}>
          ← Çık
        </button>
        <div className="room-code" onClick={() => void navigator.clipboard?.writeText(client.code)}>
          Oda: <b>{client.code}</b> 📋
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn small" onClick={() => setScreen('players')}>
            🌐 Davet
          </button>
          <a className="btn small whatsapp" href={whatsappInviteUrl(client.code)} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        </div>
      </div>

      {/* Oyuncular yan yana */}
      <div className="lobby-players">
        {players.map((p) => (
          <button
            key={p.id}
            className={`lobby-player ${p.danceAt > Date.now() - 2500 ? 'dancing' : ''}`}
            onClick={() => {
              if (p.id === selfId) void client.updatePresence({ danceAt: Date.now() });
            }}
          >
            <img
              className="lobby-avatar-img"
              src={characterDataUri(p.character, undefined, 'idle')}
              alt={p.username}
            />
            <span className="lobby-name">
              {p.username}
              {p.id === client.hostId && ' 👑'}
            </span>
            {p.team > 0 && <span className={`team-tag team-${p.team}`}>T{p.team}</span>}
          </button>
        ))}
      </div>

      {/* Harita oylaması */}
      <div className="lobby-section">
        <h3>Harita Oyla</h3>
        <div className="map-votes">
          {maps.map((m) => (
            <button
              key={m.id}
              className={`btn map-btn ${self?.vote === m.id ? 'voted' : ''}`}
              onClick={() => void client.updatePresence({ vote: m.id })}
            >
              {m.name} {voteCounts.get(m.id) ? `(${voteCounts.get(m.id)})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Takımlar (özel oda) */}
      <div className="lobby-section">
        <button className="btn small" onClick={() => setShowTeams(!showTeams)}>
          {showTeams ? 'Takımları gizle' : 'Takım kur (2v2 / 2v2v2)'}
        </button>
        {showTeams && (
          <div className="team-picker">
            {[0, 1, 2, 3].map((t) => (
              <button
                key={t}
                className={`btn small ${self?.team === t ? 'voted' : ''}`}
                onClick={() => void client.updatePresence({ team: t })}
              >
                {t === 0 ? 'Takımsız' : `Takım ${t}`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sohbet */}
      <div className="lobby-chat">
        <div className="chat-messages">
          {chat.map((c) => (
            <div key={c.key} className={`chat-msg kind-${c.kind}`}>
              {c.kind === 'emoji' ? (
                <span>
                  <b>{c.u}</b> <span className="chat-emoji">{c.body}</span>
                </span>
              ) : c.kind === 'dance' ? (
                <i>{c.u} dans ediyor! 💃</i>
              ) : (
                <span>
                  <b>{c.u}:</b> {c.body}
                </span>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="chat-quick">
          {EMOJIS.map((e) => (
            <button
              key={e}
              className="emoji-btn"
              onClick={() => client.sendChat({ u: client.username, kind: 'emoji', body: e, t: Date.now() })}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="chat-quick">
          {QUICK_PHRASES.map((q) => (
            <button
              key={q}
              className="btn tiny"
              onClick={() => client.sendChat({ u: client.username, kind: 'quick', body: q, t: Date.now() })}
            >
              {q}
            </button>
          ))}
        </div>
        <div className="chat-input-row">
          <input
            className="text-input chat-input"
            value={text}
            maxLength={120}
            placeholder="Mesaj yaz…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendText()}
          />
          <button className="btn small" onClick={sendText}>
            Gönder
          </button>
        </div>
      </div>

      {isHost && (
        <button
          className="btn primary big start-btn"
          onClick={() => startRace(true)}
          disabled={players.length < 1}
        >
          🏁 YARIŞI BAŞLAT
        </button>
      )}
      {!isHost && <p className="tagline">Host'un yarışı başlatması bekleniyor…</p>}
    </div>
  );
}
