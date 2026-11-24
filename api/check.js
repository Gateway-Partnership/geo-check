// 线上演示版的 /api/check：只认已经测好的几家店，直接回结果在哪；不认识的店不跑（线上没有后台，不会花任何钱）。
// 缓存键规则和 geo_live/resolve.py 的 cache_key 一致（域名；店名走别名表）。
const ALIAS = {
  "bao noodle house": "baonoodlehouse.com", "包之面": "baonoodlehouse.com", "004": "baonoodlehouse.com",
  "easy joy": "easyjoybuffet.com", "easy joy buffet": "easyjoybuffet.com", "意中人": "easyjoybuffet.com", "020": "easyjoybuffet.com",
  "good coconut": "good-coconut-motion-demo.vercel.app", "good coconut fidi": "good-coconut-motion-demo.vercel.app", "好椰椰": "good-coconut-motion-demo.vercel.app", "025": "good-coconut-motion-demo.vercel.app",
};
const KEYS = new Set(Object.values(ALIAS));
const SHARED = ["vercel.app", "netlify.app", "github.io", "wixsite.com", "toasttab.com", "chowbus.com", "square.site", "squareup.com"];
function keyOf(input) {
  const s = (input || "").trim();
  const a = ALIAS[s.toLowerCase()];
  if (a) return a;
  let u = s; if (!/^[a-z]+:\/\//i.test(u)) u = "https://" + u;
  let h; try { h = new URL(u).hostname.toLowerCase(); } catch (e) { return null; }
  if (h.startsWith("www.")) h = h.slice(4);
  let key = h;
  if (SHARED.some((d) => h === d || h.endsWith("." + d))) { const seg = new URL(u).pathname.split("/").filter(Boolean)[0]; key = h + (seg ? "__" + seg : ""); }
  return key.replace(/[^a-z0-9.__-]+/g, "_");
}
module.exports = (req, res) => {
  res.setHeader("content-type", "application/json; charset=utf-8"); res.setHeader("cache-control", "no-store");
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const key = keyOf((body || {}).url);
  if (key && KEYS.has(key)) return res.status(200).send(JSON.stringify({ key, status: "done", cached: true }));
  return res.status(200).send(JSON.stringify({ error: "这是演示版，只带了几家已经测过的店（Bao Noodle House、Easy Joy、Good Coconut）。想测你的店，等这一版正式开放。" }));
};
