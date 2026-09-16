// ============================================================
// MEYDAN ENTEGRASYON SINAMASI — sahte Supabase istemcisi (yalnız yerel; canlıya çıkmaz)
// Gerçek HaritaSayfasi + coklu.js + meydanBotlari.js çalışır; ağ yerine bu nesne cevap verir.
//   window.__sahteKanal.oyuncuEkle(id, ad, gorunum) · .poz(id, x, z, y) · .gorunum(id, g) · .emoji(id, e)
// ============================================================
const simdi = () => new Date().toISOString();
const botlar = () => {
  const t = Date.now();
  return [
    { user_id: "bot-a1", gorunen_ad: "Deniz", tohum: "tohum-a1", katman: 0, baslangic: new Date(t - 90000).toISOString(), bitis: new Date(t + 30 * 60000).toISOString(), sunucu_zamani: simdi(), gorunum: null },
    { user_id: "bot-b7", gorunen_ad: "Ece", tohum: "tohum-b7", katman: 1, baslangic: new Date(t - 60000).toISOString(), bitis: new Date(t + 30 * 60000).toISOString(), sunucu_zamani: simdi(), gorunum: null },
  ];
};
const RPC = {
  meydan_bot_ayarlari: () => [{ taban: 2, ek: 0, tavan: 2, dalga_sn: 240, dalga_ust: 2, grup_en_cok: 1, ziyaret_yuzde: 0, ikram_yuzde: 0 }],
  meydan_botlari: botlar,
  esya_katalogum: () => [{ esyalar: [], sahip: [], gorunum: window.__testGorunum ?? { avatar3d: { ten: "#c58b62", sac: "kisa", sacRenk: "#30211c", kiyafet: "polo", altRenk: "#253341", ayakkabiRenk: "#eee7d8", gozluk: "gunes", bas: "kep" } } }],
  olta_durumum: () => [{}], ikramlarim: () => [], sonraki_turnuva_ani: () => null,
};
function sorgu() {
  const s = { data: [], error: null };
  const zincir = new Proxy({}, { get: (_, ad) => (ad === "then" ? (coz) => coz(s) : () => zincir) });
  return zincir;
}
const kanallar = [];
function kanal(ad, ayar) {
  const k = { ad, ayar, dinleyiciler: [], durum: {} };
  const api = {
    on(tur, filtre, f) { k.dinleyiciler.push({ tur, event: filtre?.event, f }); return api; },
    subscribe(cb) { setTimeout(() => { cb?.("SUBSCRIBED"); }, 20); return api; },
    presenceState: () => k.durum,
    track: async (y) => { k.durum[ayar?.config?.presence?.key ?? "ben"] = [y]; api._tetikle("presence", "sync", {}); return "ok"; },
    untrack: async () => "ok",
    send: async () => "ok",
    unsubscribe: async () => "ok",
    _tetikle(tur, event, yuk) { for (const d of k.dinleyiciler) if (d.tur === tur && (!d.event || d.event === event)) d.f(yuk); },
    _k: k,
  };
  kanallar.push(api);
  return api;
}
window.__sahteKanal = {
  oyuncuEkle(id, ad, gorunum = null) { for (const c of kanallar) { c._k.durum[id] = [{ id, ad, renk: 0x4a9dd9, sac: 0x222222, gorunum }]; c._tetikle("presence", "sync", {}); } },
  poz(id, x, z, y = 0) { for (const c of kanallar) c._tetikle("broadcast", "poz", { payload: { id, x, z, y, h: 0, t: performance.now() } }); },
  gorunum(id, g) { for (const c of kanallar) c._tetikle("broadcast", "gorunum", { payload: { id, g } }); },
  emoji(id, e) { for (const c of kanallar) c._tetikle("broadcast", "emoji", { payload: { id, e } }); },
  kanallar,
};
export const supabaseHazir = true;
export const supabase = {
  rpc: async (ad) => ({ data: RPC[ad] ? RPC[ad]() : null, error: null }),
  from: () => sorgu(),
  channel: (ad, ayar) => kanal(ad, ayar),
  removeChannel: () => {},
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
};
