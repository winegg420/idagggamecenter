// Karakter seçimi + kozmetik özelleştirme (2D SVG önizlemeli).
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { useCharacterStore } from '../stores/characterStore';
import {
  CHARACTERS,
  COSMETIC_COLORS,
  COSMETIC_LABELS,
  COSMETIC_OPTIONS,
  GLOW_LEVEL,
  getCharacter,
  type CosmeticConfig,
} from '../game/characters/characters';
import { characterDataUri, type Pose } from '../render2d/characterSprites';
import { sound } from '../lib/sound';

/** Canlı önizleme: koşu pozları arasında geçiş yapan SVG kare animasyonu */
function Preview2D({ charId, cosmetics }: { charId: string; cosmetics: CosmeticConfig }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setFrame((f) => (f + 1) % 4), 220);
    return () => window.clearInterval(t);
  }, []);
  const poses: Pose[] = ['run1', 'idle', 'run2', 'idle'];
  const src = useMemo(
    () => poses.map((p) => characterDataUri(charId, cosmetics, p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [charId, cosmetics],
  );
  return <img className="char-preview-img" src={src[frame]} alt="Karakter önizleme" />;
}

type SlotKey = keyof typeof COSMETIC_OPTIONS;

const SLOT_LABELS: Record<SlotKey, string> = {
  hat: 'Şapka',
  glasses: 'Gözlük',
  necklace: 'Kolye/Boyun',
  wristband: 'Bileklik',
  hair: 'Saç',
  mustache: 'Bıyık',
  beard: 'Sakal',
  top: 'Üst Giyim',
  shoes: 'Ayakkabı',
};

const COLOR_SLOT: Partial<Record<SlotKey, keyof CosmeticConfig>> = {
  hat: 'hatColor',
  glasses: 'glassesColor',
  necklace: 'necklaceColor',
  wristband: 'wristbandColor',
  hair: 'hairColor',
  top: 'topColor',
  shoes: 'shoesColor',
};

export function CharacterScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const userId = useAuthStore((s) => s.user?.id);
  const { selectedId, select, cosmeticsOf, levelOf, saveCosmetics } = useCharacterStore();
  const [editingId, setEditingId] = useState(selectedId);
  const [draft, setDraft] = useState<CosmeticConfig>(() => cosmeticsOf(selectedId));
  const [activeSlot, setActiveSlot] = useState<SlotKey>('hat');
  const [saved, setSaved] = useState(false);

  const def = useMemo(() => getCharacter(editingId), [editingId]);
  const level = levelOf(editingId);

  const pickCharacter = (id: string) => {
    setEditingId(id);
    setDraft(cosmeticsOf(id));
    setSaved(false);
    sound.click();
  };

  const setOption = (slot: SlotKey, value: string) => {
    setDraft((d) => ({ ...d, [slot]: value }));
    setSaved(false);
    sound.click();
  };

  const setColor = (color: string) => {
    const colorKey = COLOR_SLOT[activeSlot];
    if (!colorKey) return;
    setDraft((d) => ({ ...d, [colorKey]: color }));
    setSaved(false);
  };

  const save = async () => {
    await saveCosmetics(editingId, draft, userId);
    select(editingId);
    setSaved(true);
    sound.pickup();
  };

  return (
    <div className="screen character-screen">
      <div className="lobby-header">
        <button className="btn small" onClick={() => setScreen('menu')}>
          ← Menü
        </button>
        <h2>Karakterler</h2>
        <button className="btn small primary" onClick={() => void save()}>
          {saved ? '✓ Kaydedildi' : 'Kaydet & Seç'}
        </button>
      </div>

      {/* Karakter listesi */}
      <div className="char-list">
        {CHARACTERS.map((c) => (
          <button
            key={c.id}
            className={`char-card ${c.id === editingId ? 'active' : ''} ${c.id === selectedId ? 'chosen' : ''}`}
            onClick={() => pickCharacter(c.id)}
          >
            <img
              className="char-thumb"
              src={characterDataUri(c.id, cosmeticsOf(c.id), 'idle')}
              alt={c.name}
              loading="lazy"
            />
            <span className="char-name">{c.name}</span>
            <span className="char-level">Sv {levelOf(c.id)}</span>
          </button>
        ))}
      </div>

      {/* 2D önizleme */}
      <div className={`char-preview ${level >= GLOW_LEVEL ? 'has-glow' : ''}`}>
        <Preview2D charId={editingId} cosmetics={draft} />
        <p className="char-bio">{def.bio}</p>
        {level >= GLOW_LEVEL && <p className="char-glow-note">✨ Seviye {level} — altın hale açık!</p>}
      </div>

      {/* Kozmetik slotları */}
      <div className="cosmetic-slots">
        {(Object.keys(COSMETIC_OPTIONS) as SlotKey[]).map((slot) => (
          <button
            key={slot}
            className={`btn tiny ${activeSlot === slot ? 'voted' : ''}`}
            onClick={() => setActiveSlot(slot)}
          >
            {SLOT_LABELS[slot]}
          </button>
        ))}
      </div>

      {/* Seçenekler: her biri o parçanın karaktere GİYDİRİLMİŞ mini önizlemesi */}
      <div className="cosmetic-options">
        {COSMETIC_OPTIONS[activeSlot].map((opt) => (
          <button
            key={opt}
            className={`cos-option ${draft[activeSlot] === opt ? 'voted' : ''}`}
            onClick={() => setOption(activeSlot, opt)}
          >
            <img
              src={characterDataUri(editingId, { ...draft, [activeSlot]: opt }, 'idle')}
              alt={COSMETIC_LABELS[opt] ?? opt}
              loading="lazy"
            />
            <span>{COSMETIC_LABELS[opt] ?? opt}</span>
          </button>
        ))}
      </div>

      {/* Renkler */}
      {COLOR_SLOT[activeSlot] && draft[activeSlot] !== 'yok' && (
        <div className="color-row">
          {COSMETIC_COLORS.map((c) => (
            <button
              key={c}
              className="color-swatch"
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`Renk ${c}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
