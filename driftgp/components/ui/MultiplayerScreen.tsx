// Çok oyunculu lobi: oda kur/katıl, hızlı eşleşme, açık odalar, kayıtlı kullanıcı davetleri.

import { useEffect, useReducer, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useGarageStore } from '../../store/garageStore';
import { useProfileStore } from '../../store/profileStore';
import { multiplayer, type RoomInfo } from '../../net/multiplayer';
import { isOnline, supabase } from '../../lib/supabase';
import { getCar } from '../../game/cars';
import { TRACK_DEFS } from '../../game/tracks';

interface UserRow {
  id: string;
  name: string;
}

export function MultiplayerScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const configureRace = useGameStore((s) => s.configureRace);
  const trackId = useGameStore((s) => s.trackId);
  const totalLaps = useGameStore((s) => s.totalLaps);
  const playerName = useProfileStore((s) => s.playerName);
  const setPlayerName = useProfileStore((s) => s.setPlayerName);
  const selectedCarId = useGarageStore((s) => s.selectedCarId);
  // boya rengine (VERİ) abone — getCustomization fonksiyon referansı sabittir, güncelleme tetiklemez
  const paintColor = useGarageStore(
    (s) => (s.customizations[s.selectedCarId] ?? { paintColor: getCar(s.selectedCarId).defaultColor }).paintColor,
  );

  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [openRooms, setOpenRooms] = useState<RoomInfo[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  // yarışa geçiş App seviyesindeki abonelikte (lobi + sonuç ekranını birlikte kapsar)
  useEffect(() => {
    multiplayer.setIdentity(playerName, selectedCarId, paintColor);
    const unsub = multiplayer.subscribe(() => bump());
    return unsub;
  }, [playerName, selectedCarId, paintColor]);

  // kayıtlı kullanıcı listesi (profiles tablosu — auth gerekli)
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('dg_profiles')
      .select('id, data')
      .limit(50)
      .then(({ data, error }) => {
        if (error || !data) return;
        setUsers(
          data
            .filter((r) => r.id !== multiplayer.selfId)
            .map((r) => ({ id: r.id, name: (r.data as { playerName?: string })?.playerName ?? 'Sürücü' })),
        );
      });
  }, []);

  const refreshRooms = async () => {
    setBusy('list');
    setOpenRooms(await multiplayer.listOpenRooms());
    setBusy(null);
  };

  if (!isOnline()) {
    return (
      <div className="screen list-screen">
        <div className="screen-header">
          <button className="icon-btn" onClick={() => setScreen('menu')}>
            ←
          </button>
          <h2>ÇOK OYUNCULU</h2>
          <div />
        </div>
        <div className="mp-offline">
          <p>🌐 Çok oyunculu mod için Supabase yapılandırması gerekiyor.</p>
          <p className="offline-note">
            <code>.env</code> dosyasına <code>VITE_SUPABASE_URL</code> ve <code>VITE_SUPABASE_ANON_KEY</code>{' '}
            eklendiğinde bu ekran otomatik aktifleşir.
          </p>
        </div>
      </div>
    );
  }

  const inRoom = multiplayer.roomCode !== null;

  return (
    <div className="screen list-screen">
      <div className="screen-header">
        <button
          className="icon-btn"
          onClick={() => {
            multiplayer.leaveRoom();
            setScreen('menu');
          }}
        >
          ←
        </button>
        <h2>ÇOK OYUNCULU</h2>
        <div />
      </div>

      {/* oyuncu adı — maça girmeden/lobideyken değiştirilebilir, araç üstü etikette görünür */}
      <div className="mp-name-row">
        <label htmlFor="mp-name">👤 SÜRÜCÜ ADIN</label>
        <input
          id="mp-name"
          value={playerName}
          maxLength={14}
          placeholder="Sürücü"
          onChange={(e) => setPlayerName(e.target.value)}
          onBlur={(e) => {
            const t = e.target.value.trim();
            setPlayerName(t.length > 0 ? t : 'Sürücü');
          }}
        />
      </div>

      {!inRoom ? (
        <>
          <div className="mp-actions">
            <button
              className="primary-btn"
              disabled={busy !== null}
              onClick={async () => {
                setBusy('quick');
                await multiplayer.quickMatch();
                setBusy(null);
              }}
            >
              {busy === 'quick' ? 'ARANIYOR…' : '⚡ HIZLI EŞLEŞME'}
            </button>
            <button
              className="secondary-btn"
              disabled={busy !== null}
              onClick={async () => {
                setBusy('create');
                await multiplayer.createRoom();
                setBusy(null);
              }}
            >
              {busy === 'create' ? 'KURULUYOR…' : '➕ ODA KUR'}
            </button>
          </div>
          <div className="mp-join">
            <input
              placeholder="ODA KODU"
              value={joinCode}
              maxLength={5}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button
              className="secondary-btn"
              disabled={joinCode.length < 5 || busy !== null}
              onClick={async () => {
                setBusy('join');
                await multiplayer.joinRoom(joinCode);
                setBusy(null);
              }}
            >
              KATIL
            </button>
          </div>
          {multiplayer.lastError && <p className="error-note">⚠️ {multiplayer.lastError}</p>}

          <div className="section-title-row">
            <h3 className="section-title">AÇIK ODALAR</h3>
            <button className="chip" onClick={refreshRooms} disabled={busy !== null}>
              {busy === 'list' ? '…' : '↻ Yenile'}
            </button>
          </div>
          {openRooms.length === 0 ? (
            <p className="offline-note">Açık oda yok — Hızlı Eşleşme ile oda kurabilirsin.</p>
          ) : (
            openRooms.map((r) => (
              <div key={r.code} className="room-row">
                <span>
                  🏁 {r.code} · {r.playerCount}/6
                </span>
                <button
                  className="chip active"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy('join');
                    await multiplayer.joinRoom(r.code);
                    setBusy(null);
                  }}
                >
                  KATIL
                </button>
              </div>
            ))
          )}

          {users.length > 0 && (
            <>
              <h3 className="section-title">KAYITLI OYUNCULAR</h3>
              {users.map((u) => (
                <div key={u.id} className="room-row">
                  <span>👤 {u.name}</span>
                  <span className="offline-note">davet için önce oda kur</span>
                </div>
              ))}
            </>
          )}
        </>
      ) : (
        <div className="mp-room">
          <div className="room-code-box">
            ODA KODU: <b>{multiplayer.roomCode}</b>
            <button
              className="chip"
              onClick={() => navigator.clipboard?.writeText(multiplayer.roomCode!).catch(() => {})}
            >
              📋 Kopyala
            </button>
          </div>
          <h3 className="section-title">
            OYUNCULAR ({multiplayer.players.size + 1}/6)
          </h3>
          <div className="room-row self">
            <span>
              👤 {playerName} (sen{multiplayer.isHost ? ' · host' : ''})
            </span>
            <span className="badge-chip">{getCar(selectedCarId).name}</span>
          </div>
          {[...multiplayer.players.values()].map((p) => (
            <div key={p.id} className="room-row">
              <span>👤 {p.name}</span>
              <span className="badge-chip">{getCar(p.carId).name}</span>
            </div>
          ))}

          {users.length > 0 && (
            <>
              <h3 className="section-title">DAVET ET</h3>
              {users.map((u) => (
                <div key={u.id} className="room-row">
                  <span>👤 {u.name}</span>
                  <button className="chip active" onClick={() => multiplayer.invite(u.id)}>
                    ✉️ Davet
                  </button>
                </div>
              ))}
            </>
          )}

          {multiplayer.isHost ? (
            <>
              <h3 className="section-title">PİST</h3>
              <div className="filter-row">
                {TRACK_DEFS.map((t) => (
                  <button
                    key={t.id}
                    className={`chip ${trackId === t.id ? 'active' : ''}`}
                    onClick={() => configureRace({ trackId: t.id })}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <button
                className="primary-btn"
                onClick={() => multiplayer.startRace(trackId, totalLaps)}
              >
                🏁 YARIŞI BAŞLAT ({totalLaps} tur)
              </button>
            </>
          ) : (
            <p className="offline-note">
              {multiplayer.roomStatus === 'racing'
                ? '🏁 Yarış sürüyor — bitince host yenisini başlatabilir…'
                : "Host'un yarışı başlatması bekleniyor…"}
            </p>
          )}
          {multiplayer.lastError && <p className="error-note">⚠️ {multiplayer.lastError}</p>}
          <button className="secondary-btn" onClick={() => multiplayer.leaveRoom()}>
            ODADAN AYRIL
          </button>
        </div>
      )}
    </div>
  );
}
