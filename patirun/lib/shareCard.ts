// Paylaşılabilir sonuç kartı: 2D canvas ile PNG üretir, Web Share / indirme.
import type { RaceResultRow } from '../stores/raceStore';
import type { FunCategory } from '../services/buildResults';

export async function generateResultCard(
  mapName: string,
  results: RaceResultRow[],
  categories: FunCategory[],
): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Arka plan
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#14213d');
    grad.addColorStop(1, '#2a4a7f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px system-ui, sans-serif';
    ctx.fillText('🐾 PATİRUN', canvas.width / 2, 90);
    ctx.font = '28px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText(mapName, canvas.width / 2, 135);

    // Sıralama
    ctx.textAlign = 'left';
    let y = 210;
    const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
    for (let i = 0; i < Math.min(results.length, 5); i++) {
      const r = results[i];
      ctx.fillStyle = i === 0 ? 'rgba(255,209,102,0.25)' : 'rgba(255,255,255,0.08)';
      roundRect(ctx, 50, y - 38, 620, 54, 12);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillText(`${medals[i]}  ${r.name}`, 70, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#80ed99';
      ctx.fillText(`+${r.points}`, 650, y);
      ctx.textAlign = 'left';
      y += 70;
    }

    // Mizahi kategoriler
    y += 20;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('Maçın Yıldızları', 60, y);
    y += 42;
    ctx.font = '22px system-ui, sans-serif';
    for (const c of categories.slice(0, 5)) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`${c.emoji} ${c.title}: ${c.name}`, 60, y);
      y += 36;
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Arkadaşlarınla 60 saniyelik kapışma!', canvas.width / 2, 860);

    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Kartı paylaş (Web Share) ya da indir. */
export async function shareResultCard(
  mapName: string,
  results: RaceResultRow[],
  categories: FunCategory[],
): Promise<boolean> {
  const blob = await generateResultCard(mapName, results, categories);
  if (!blob) return false;
  const file = new File([blob], 'yaris-sonuc.png', { type: 'image/png' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'PatiRun — Yarış Sonucu' });
      return true;
    }
  } catch {
    // paylaşım iptal edildi ya da desteklenmiyor → indirme
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yaris-sonuc.png';
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
