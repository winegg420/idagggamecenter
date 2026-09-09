/**
 * Kendi satırını işaretleyen rozet.
 *
 * Neden ayrı bileşen: sıralama/liste ekranlarında ad ile "sen" metin olarak
 * birleştiriliyordu ("idagg sen"), bazı yerlerde de "(sen)" yazılıyordu.
 * Tek bileşene indirildi; ad ile rozet artık ayrı düğümler.
 *
 * Kullanım: {benMi && <SenRozeti />}
 */
export default function SenRozeti({ metin = "sen" }) {
  return (
    <span className="bd-sen" aria-label="bu satır sensin">
      {metin}
    </span>
  );
}
