// Üst çubuktaki coin hapı. Dokununca dükkânın Coin sekmesine götürür.
// Bakiye gelene kadar hiç çizilmez (migration uygulanmadan boş hap durmasın).
import { Link } from "react-router-dom";
import Ikon from "./Ikon.jsx";
import { useCoin } from "../lib/coin.js";
import { y } from "../lib/yol.js";

export default function CoinHapi() {
  const { bakiye } = useCoin();
  if (bakiye === null) return null;
  return (
    <Link to={y("/joker?sekme=coin")} className="bd-coin-hap" aria-label={`${bakiye} coin`}>
      <Ikon ad="coin" boyut={15} />
      <span>{bakiye.toLocaleString("tr-TR")}</span>
    </Link>
  );
}
