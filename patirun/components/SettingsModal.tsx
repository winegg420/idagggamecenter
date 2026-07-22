import { useSettingsStore, type Quality } from '../stores/settingsStore';
import { sound } from '../lib/sound';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const s = useSettingsStore();

  const Toggle = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <div className="setting-row">
      <span>{label}</span>
      <button
        className={`btn tiny ${value ? 'voted' : ''}`}
        onClick={() => {
          onChange(!value);
          sound.click();
        }}
      >
        {value ? 'Açık' : 'Kapalı'}
      </button>
    </div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>⚙️ Ayarlar</h3>
        <Toggle label="🎵 Müzik" value={s.music} onChange={(v) => s.set({ music: v })} />
        <Toggle label="🔊 Ses Efektleri" value={s.sfx} onChange={(v) => s.set({ sfx: v })} />
        <Toggle label="📳 Titreşim" value={s.vibration} onChange={(v) => s.set({ vibration: v })} />
        <div className="setting-row">
          <span>🖥️ Grafik</span>
          <div className="cosmetic-slots">
            {(['otomatik', 'dusuk', 'orta', 'yuksek'] as Quality[]).map((q) => (
              <button
                key={q}
                className={`btn tiny ${s.quality === q ? 'voted' : ''}`}
                onClick={() => s.set({ quality: q })}
              >
                {q === 'otomatik' ? 'Oto' : q === 'dusuk' ? 'Düşük' : q === 'orta' ? 'Orta' : 'Yüksek'}
              </button>
            ))}
          </div>
        </div>
        <button className="btn primary" onClick={onClose}>
          Tamam
        </button>
        <button
          className="btn"
          style={{ marginTop: 8 }}
          onClick={() => window.location.assign('/')}
        >
          🏠 Oyun Merkezi'ne dön
        </button>
      </div>
    </div>
  );
}
