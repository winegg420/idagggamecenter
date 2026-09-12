// Ag katmani testi: ziplama yuksekligi (h) poz paketinde gidiyor mu?
// Sahte Supabase kanali; gercek ag yok.
import assert from "node:assert";
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: { hidden: false, addEventListener() {}, removeEventListener() {} },
});
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => saat } });
let saat = 1000;
const gonderilen = [];
let abone;
const kanal = {
  on() { return kanal; },
  subscribe(f) { abone = f; return kanal; },
  presenceState: () => ({}),
  track: async () => {},
  untrack() {},
  send: (m) => gonderilen.push(m),
};
const supabase = { channel: () => kanal, removeChannel() {} };

const { meydanBaglan } = await import("../harita/coklu.js");
const c = meydanBaglan({ supabase, ben: { id: "ben", ad: "Ben", renk: 1, sac: 1 }, onDurum() {} });
await abone("SUBSCRIBED");

c.pozGonder(1, 2, 0.5, 0);           // yerde
saat += 200;
c.pozGonder(1, 2, 0.5, 1.9);         // ziplamanin tepesi — konum ayni, yalniz h degisti
saat += 200;
c.pozGonder(1, 2, 0.5, 0);           // yere indi

const pozlar = gonderilen.filter((m) => m.event === "poz").map((m) => m.payload);
console.log("gonderilen poz:", JSON.stringify(pozlar));
assert.strictEqual(pozlar.length, 3, "uc paket de gitmeli (h degisimi yutulmamali)");
assert.strictEqual(pozlar[0].h, 0);
assert.strictEqual(pozlar[1].h, 1.9, "tepe yuksekligi paketle gidiyor");
assert.strictEqual(pozlar[2].h, 0);
assert.ok(pozlar.every((p) => typeof p.t === "number"), "zaman damgasi korunuyor");
console.log("\nAg katmani: ziplama yuksekligi poz paketinde gidiyor. Tumu gecti.");
