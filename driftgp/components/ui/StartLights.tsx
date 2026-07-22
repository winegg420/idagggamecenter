// Yarış başlama ekranı.
// Solo: F1 tarzı 5 ışık + rastgele sönüş (yerel zamanlayıcı).
// Multi: iki fazlı senkron start —
//   1) Giriş efekti: "YARIŞ BAŞLIYOR" + oyuncuların yüklenmesi beklenir (n/m hazır).
//   2) Host'un yayınladığı goAt epoch'una hizalı 3-2-1 kırmızı ışık geri sayımı → yeşil BAŞLA!
//   Tüm istemciler aynı goAt'a hizalandığı için herkes AYNI ANDA başlar.

import { useEffect, useReducer, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { multiplayer } from '../../net/multiplayer';
import { getTrackDef } from '../../game/tracks';
import { audio } from '../../game/audio';

const LIGHT_INTERVAL = 900;

/** Multi mod başlama ekranı: bekleme → 3-2-1 → BAŞLA! */
function MultiStart() {
  const trackId = useGameStore((s) => s.trackId);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  // count: 4 = bekleme/HAZIR OL, 3..1 = geri sayım, 0 = yeşil BAŞLA!
  const [count, setCount] = useState(4);
  const started = useRef(false);
  const prevCount = useRef(4);

  // goAt/ready güncellemelerinde re-render
  useEffect(() => multiplayer.subscribe(() => bump()), []);

  useEffect(() => {
    const iv = window.setInterval(() => {
      if (started.current) {
        clearInterval(iv);
        return;
      }
      const goAt = multiplayer.raceGoAt;
      if (goAt === null) return; // hâlâ oyuncular yükleniyor
      const remaining = goAt - Date.now();
      if (remaining <= 0) {
        started.current = true;
        setCount(0);
        useGameStore.getState().setRacePhase('racing');
      } else {
        setCount(Math.min(4, Math.ceil(remaining / 1000)));
      }
    }, 50);
    return () => clearInterval(iv);
  }, []);

  // sayı değişiminde bip, yeşilde uzun bip
  useEffect(() => {
    if (count === prevCount.current) return;
    if (count >= 1 && count <= 3) audio.beep(440, 0.15);
    if (count === 0) audio.beep(880, 0.45);
    prevCount.current = count;
  }, [count]);

  // yeşil ışık 1.2 sn sonra kaybolur (racePhase racing olduğundan HUD zaten aktif)
  const [goVisible, setGoVisible] = useState(true);
  useEffect(() => {
    if (count !== 0) return;
    const t = window.setTimeout(() => setGoVisible(false), 1400);
    return () => clearTimeout(t);
  }, [count]);

  if (count === 0 && !goVisible) return null;

  const readyCount = multiplayer.readyIds.size;
  const totalCount = Math.max(multiplayer.expectedIds.size, readyCount);
  const waiting = multiplayer.raceGoAt === null;

  // giriş/bekleme ekranı — tam ekran karartma + başlık animasyonu
  if (count === 4) {
    return (
      <div className="race-intro">
        <div className="race-intro-title">YARIŞ BAŞLIYOR</div>
        <div className="race-intro-track">🏁 {getTrackDef(trackId).name}</div>
        <div className="race-intro-status">
          {waiting ? (
            <>
              <span className="race-intro-spinner" /> Oyuncular yükleniyor… {readyCount}/{totalCount} hazır
            </>
          ) : (
            'HAZIR OL!'
          )}
        </div>
      </div>
    );
  }

  // 3-2-1 kırmızı ışıklar + büyük sayı → yeşil BAŞLA!
  const green = count === 0;
  return (
    <div className="start-lights">
      <div className="lights-panel">
        {[3, 2, 1].map((i) => (
          <div key={i} className={`light ${green ? 'green' : count <= i ? 'on' : ''}`} />
        ))}
      </div>
      {green ? (
        <div className="go-text">BAŞLA!</div>
      ) : (
        <div className="count-num" key={count}>
          {count}
        </div>
      )}
    </div>
  );
}

/** Solo mod: F1 tarzı 5 kırmızı ışık + rastgele sönüş. */
function SoloStart({ active }: { active: boolean }) {
  const lights = useGameStore((s) => s.lights);
  const lightsOut = useGameStore((s) => s.lightsOut);
  const timers = useRef<number[]>([]);
  const prevLights = useRef(0);

  // ışık yandıkça bip sesi
  useEffect(() => {
    if (lights > prevLights.current && lights > 0) audio.beep(440, 0.15);
    if (lightsOut && prevLights.current > 0) audio.beep(880, 0.4);
    prevLights.current = lightsOut ? 0 : lights;
  }, [lights, lightsOut]);

  useEffect(() => {
    if (!active) return;
    const st = useGameStore.getState();
    st.setLights(0, false);
    timers.current.forEach(clearTimeout);
    timers.current = [];

    for (let i = 1; i <= 5; i++) {
      timers.current.push(window.setTimeout(() => st.setLights(i, false), 600 + i * LIGHT_INTERVAL));
    }
    const holdMs = 600 + 5 * LIGHT_INTERVAL + 400 + Math.random() * 1400;
    timers.current.push(
      window.setTimeout(() => {
        st.setLights(0, true);
        st.setRacePhase('racing');
      }, holdMs),
    );
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [active]);

  // sönüşten sonra GO! kaybolur
  useEffect(() => {
    if (!lightsOut) return;
    const t = window.setTimeout(() => useGameStore.getState().setLights(0, false), 1200);
    return () => clearTimeout(t);
  }, [lightsOut]);

  if (!active && !lightsOut) return null;

  return (
    <div className="start-lights">
      {lightsOut ? (
        <div className="go-text">GO!</div>
      ) : (
        <div className="lights-panel">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`light ${i <= lights ? 'on' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
}

export function StartLights() {
  const racePhase = useGameStore((s) => s.racePhase);
  const screen = useGameStore((s) => s.screen);
  const mode = useGameStore((s) => s.mode);

  const active = screen === 'race' && racePhase === 'countdown';

  if (mode === 'multi') {
    // MultiStart kendi görünürlüğünü yönetir (yeşil BAŞLA! racing fazına taşar)
    if (!active && racePhase !== 'racing') return null;
    if (screen !== 'race') return null;
    return active || racePhase === 'racing' ? <MultiStartGate active={active} /> : null;
  }
  return <SoloStart active={active} />;
}

/** BAŞLA! yazısının racing fazına 1.4 sn taşabilmesi için MultiStart'ı mount'ta tutan kapı. */
function MultiStartGate({ active }: { active: boolean }) {
  const wasActive = useRef(false);
  if (active) wasActive.current = true;
  // yarış countdown'dan geçmeden racing'e girmişse (ör. sayfa yenileme) hiç gösterme
  if (!wasActive.current) return null;
  return <MultiStart />;
}
