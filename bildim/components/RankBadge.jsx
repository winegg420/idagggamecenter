import { rutbeBul } from "../lib/ranks.js";

export default function RankBadge({ puan }) {
  const r = rutbeBul(puan ?? 0);
  return (
    <span className="rutbe-chip" style={{ color: r.renk }}>
      {r.ikon} {r.ad}
    </span>
  );
}
