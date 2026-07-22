import { useEffect, useRef } from 'react';
import type { RunnerInput } from './types';

/**
 * Oyuncu girdisi (Fun Run tarzı buton şeması):
 * - ZIPLA: sağ alt buton (dokun) / Space / ↑ / W
 * - EĞİL: zıplamanın yanındaki buton (basılı tut) / ↓ / S
 * - Skill butonu HUD'dadır (sol alt), bu modülün dışında.
 * Oyun döngüsü her karede consume() çağırır.
 */
export function usePlayerInput() {
  const jumpQueued = useRef(false);
  const touchDuck = useRef(false);
  const keyDuck = useRef(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        jumpQueued.current = true;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') keyDuck.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown' || e.code === 'KeyS') keyDuck.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  /** Zıplama butonu: bir dokunuş = bir zıplama isteği */
  const pressJump = () => {
    jumpQueued.current = true;
  };

  /** Eğilme butonu: basılıyken true */
  const setDuck = (v: boolean) => {
    touchDuck.current = v;
  };

  const consume = (): RunnerInput => {
    const jump = jumpQueued.current;
    jumpQueued.current = false;
    return { lateral: 0, jump, duck: touchDuck.current || keyDuck.current };
  };

  return { pressJump, setDuck, consume };
}
