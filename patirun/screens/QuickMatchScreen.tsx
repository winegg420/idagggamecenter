// Hızlı maç: kuyrukta oyuncu ara, bulunamazsa bot dolgulu yarışa düş.
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { useRoomStore } from '../stores/roomStore';
import { findQuickMatch } from '../net/quickMatch';
import { supabaseConfigured } from '../lib/supabase';

export function QuickMatchScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const startRace = useAppStore((s) => s.startRace);
  const userId = useAuthStore((s) => s.user?.id);
  const username = useAuthStore((s) => s.user?.username);
  const [statusText, setStatusText] = useState('Oyuncu aranıyor…');
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!userId || !username) {
      setScreen('menu');
      return;
    }
    // Supabase yoksa doğrudan bot yarışı
    if (!supabaseConfigured) {
      startRace('orman', { botDifficulty: 'orta', botCount: 5 });
      return;
    }

    const { promise, cancel } = findQuickMatch(
      userId,
      setStatusText,
      async () => {
        const ok = await useRoomStore.getState().createRoom(userId, username);
        const client = useRoomStore.getState().client;
        if (!ok || !client) throw new Error('Oda kurulamadı');
        return client.code;
      },
    );
    cancelRef.current = cancel;

    void promise.then(async (result) => {
      if (result.kind === 'solo') {
        setStatusText('Rakip bulunamadı — botlarla başlıyor!');
        window.setTimeout(() => startRace('orman', { botDifficulty: 'orta', botCount: 5 }), 800);
        return;
      }
      // Eşleşme: host oda zaten kurdu, diğerleri katılır; lobi otomatik başlatır
      useRoomStore.getState().setQuickMatch(true);
      if (!result.isHost) {
        const ok = await useRoomStore.getState().joinRoom(result.code, userId, username);
        if (!ok) {
          startRace('orman', { botDifficulty: 'orta', botCount: 5 });
          return;
        }
      }
      setScreen('lobby');
    });

    return () => {
      cancelRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen center">
      <div className="loading-spinner" />
      <h2>⚡ Hızlı Maç</h2>
      <p>{statusText}</p>
      <button
        className="btn"
        onClick={() => {
          cancelRef.current?.();
          setScreen('menu');
        }}
      >
        ← Vazgeç
      </button>
    </div>
  );
}
