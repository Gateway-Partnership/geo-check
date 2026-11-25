/* GEO Check 页面逻辑。
   两个页面：首页（#v-home）和报告（#v-report）。加载过程就在报告页上演，不是单独一页。
   数据怎么来（和旧版一样）：
     POST /api/check {url}      → {key} 或 {error}
     GET  /api/result?key=<店>  → 那家店的 result.json；status 不是 done 就每 1.5 秒再读一次
     GET  /api/tile?z=&x=&y=    → 地图底图
   网址：/#k=<店>  直接打开那家店的报告；加 ?static 跳过加载动画。 */
(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ic = k => '/static/assets/pf/' + k + '.png';
const EX_KEY = 'baonoodlehouse.com';
const STATIC = /[?&]static\b/.test(location.search);
let view = '';
const api = (path, body) => fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined).then(r => r.json());

/* =====================================================================
   首页
   ===================================================================== */
/* ---------- 分段控件 ---------- */
function segSet(seg, val, key){
  const btns = [...seg.querySelectorAll('button')];
  btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset[key] === val)));
  const on = btns.find(b => b.dataset[key] === val), th = seg.querySelector('.thumb');
  if (on && th){ if (getComputedStyle(seg).flexDirection === 'column'){ th.style.height = on.offsetHeight + 'px'; th.style.transform = 'translateY(' + on.offsetTop + 'px)'; } else { th.style.height = ''; th.style.width = on.offsetWidth + 'px'; th.style.transform = 'translateX(' + on.offsetLeft + 'px)'; } }
}

/* ---------- 骨架波浪：每块骨架截取同一条横跨容器的光带，光从右往左一整道扫过去 ---------- */
function setWave(root){
  if (!root) return;
  const r = root.getBoundingClientRect();
  root.querySelectorAll('.sk').forEach(el => {
    const b = el.getBoundingClientRect();
    el.style.setProperty('--x', (b.left - r.left) + 'px');
    el.style.setProperty('--W', r.width + 'px');
    el.style.setProperty('--y', Math.round((b.top - r.top) * .35));
  });
}

/* ---------- 平台滚动带 + 平台格子 ---------- */
const PF1 = [['google','Google 地图','点评'],['yelp','Yelp','点评'],['tripadvisor','Tripadvisor','点评'],['ubereats','Uber Eats','外卖'],['doordash','DoorDash','外卖'],['grubhub','Grubhub','外卖'],['instagram','Instagram','社交'],['tiktok','TikTok','社交'],['reddit','Reddit','社交'],['xiaohongshu','小红书','社交'],['restaurantguru','Restaurant Guru','点评']];
const PF2 = [['eater','Eater','媒体'],['infatuation','The Infatuation','媒体'],['michelin','MICHELIN Guide','媒体'],['timeout','Time Out','媒体'],['seamless','Seamless','外卖'],['fantuan','饭团外卖','外卖'],['hungrypanda','熊猫外卖','外卖'],['facebook','Facebook','社交'],['wanderlog','Wanderlog','媒体'],['yellowpages','Yellow Pages','点评'],['menupages','MenuPages','媒体'],['ezcater','ezCater','团餐']];
function fill(ul, list){
  const one = list.map(p => '<li><img class="pi" src="' + ic(p[0]) + '" alt="">' + p[1] + '<em>' + p[2] + '</em></li>').join('');
  ul.innerHTML = one + one.replace(/<li>/g, '<li class="dup" aria-hidden="true">');
}
fill($('#mq1'), PF1); fill($('#mq2'), PF2);
const GRID = [['google','Google 地图',1],['yelp','Yelp',1],['eater','Eater',0],['ubereats','Uber Eats',1],['infatuation','The Infatuation',0],['instagram','Instagram',1],['reddit','Reddit',0],['doordash','DoorDash',1],['tripadvisor','Tripadvisor',1],['timeout','Time Out',0],['tiktok','TikTok',1],['grubhub','Grubhub',1]];
$('#pgrid').innerHTML = GRID.map((p, i) => '<div class="pf' + (p[2] ? '' : ' x') + '" style="--i:' + i + '"><img class="pi" src="' + ic(p[0]) + '" alt=""><div><b>' + p[1] + '</b><span>' + (p[2] ? '有你' : '没有你 · 对手有') + '</span></div></div>').join('');
document.querySelectorAll('img[data-pf]').forEach(i => { i.src = ic(i.dataset.pf); });

/* ---------- 问 AI 演示：打字 → 发送 → 骨架闪 → 名单出现 → 删掉 → 下一个 ---------- */
const QS = [
  { en:'best soup dumplings near me', zh:'客人在问：附近哪家汤包好吃', list:['Lucky Bowl','@','Pell St. Kitchen','Canal Noodle Co.'] },
  { en:'late night noodles in Chinatown', zh:'客人在问：唐人街哪里能吃宵夜面', list:['Canal Noodle Co.','Golden Reed','Lucky Bowl',null] },
  { en:'where to take my parents for dim sum', zh:'客人在问：带爸妈去哪吃早茶', list:['Jade Pavilion','Pell St. Kitchen','Golden Reed','@'] },
  { en:'cheap eats near Bowery under $20', zh:'客人在问：Bowery 附近 20 美元以内吃什么', list:['@','Lucky Bowl','Mott & Co.','Canal Noodle Co.'] }
];
const chat = $('#chat'), typed = $('#typed'), comp = $('#composer'), gloss = $('#gloss'), verdict = $('#verdict'), input = $('#q');
const rows = [...$('#ans').children];
let chatTok = 0;
const cleanName = v => v.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
function myName(){ const v = input.value.trim(); return v ? cleanName(v) : '你的店'; }
function clearRows(){ rows.forEach(li => li.classList.remove('on', 'is-you', 'is-miss')); verdict.classList.remove('on'); }
async function showAnswer(q, tok){
  chat.classList.add('waving', 'thinking'); setWave(chat);
  await sleep(RM ? 0 : 950); if (tok !== chatTok) return;
  chat.classList.remove('waving', 'thinking');
  let pos = 0;
  for (let i = 0; i < rows.length; i++){
    const li = rows[i], v = q.list[i];
    li.querySelector('.nm').textContent = v === '@' ? myName() : v === null ? '名单里没有你' : v;
    li.querySelector('.n').textContent = v === null ? '–' : String(i + 1);
    li.classList.toggle('is-you', v === '@'); li.classList.toggle('is-miss', v === null);
    if (v === '@') pos = i + 1;
    li.classList.add('on');
    await sleep(RM ? 0 : 110); if (tok !== chatTok) return;
  }
  verdict.textContent = pos ? '推荐了你 · 第 ' + pos : '没推荐你';
  verdict.className = 'verdict on ' + (pos ? 'good' : 'bad');
}
async function chatLoop(){
  const tok = ++chatTok; let i = 0;
  while (tok === chatTok){
    const q = QS[i % QS.length]; i++;
    await sleep(RM ? 300 : 700); if (tok !== chatTok) return;
    gloss.textContent = q.zh; gloss.classList.add('on');
    comp.classList.add('typing');
    if (RM) typed.textContent = q.en;
    else for (const ch of q.en){ typed.textContent += ch; await sleep(34 + Math.random() * 55 + (ch === ' ' ? 40 : 0)); if (tok !== chatTok) return; }
    comp.classList.remove('typing'); comp.classList.add('armed');
    await sleep(RM ? 200 : 650); if (tok !== chatTok) return;
    comp.classList.add('sent'); setTimeout(() => comp.classList.remove('sent'), 220);
    await showAnswer(q, tok); if (tok !== chatTok) return;
    await sleep(RM ? 4000 : 2900); if (tok !== chatTok) return;
    clearRows(); gloss.classList.remove('on'); comp.classList.remove('armed'); comp.classList.add('typing');
    if (RM) typed.textContent = '';
    else while (typed.textContent.length){ typed.textContent = typed.textContent.slice(0, -1); await sleep(16); if (tok !== chatTok) return; }
    comp.classList.remove('typing');
  }
}
function stopChat(){ chatTok++; chat.classList.remove('waving', 'thinking'); clearRows(); typed.textContent = ''; gloss.classList.remove('on'); comp.className = 'composer'; }
input.addEventListener('input', () => rows.forEach(li => { if (li.classList.contains('is-you')) li.querySelector('.nm').textContent = myName(); }));

/* ---------- 报告展台：目录高亮滑过去，卡片一叠一叠往前换；4 秒一换，鼠标放上去暂停 ---------- */
const tocItems = [...document.querySelectorAll('.toc button')], cards = [...document.querySelectorAll('.card')], hl = $('.toc .hl'), toc = $('.toc');
let cur = 0, timer = null, hovering = false;
function placeHL(){ const b = tocItems[cur]; hl.style.width = b.offsetWidth + 'px'; hl.style.height = b.offsetHeight + 'px'; hl.style.transform = 'translate(' + b.offsetLeft + 'px,' + b.offsetTop + 'px)'; }
function showCard(i){
  const prev = cur, n = cards.length; cur = i;
  tocItems.forEach((b, k) => { b.classList.toggle('on', k === i); b.setAttribute('aria-selected', String(k === i)); });
  cards.forEach((c, k) => {
    const d = (k - i + n) % n;
    c.classList.remove('s0', 's1', 's2', 'out');
    if (d === 0) c.classList.add('s0'); else if (d === 1) c.classList.add('s1'); else if (d === 2) c.classList.add('s2'); else if (k === prev) c.classList.add('out');
  });
  placeHL();
  if (toc.scrollWidth > toc.clientWidth) toc.scrollTo({ left: tocItems[i].offsetLeft - 16, behavior: RM ? 'auto' : 'smooth' });
}
function arm(){ clearInterval(timer); if (RM) return; timer = setInterval(() => { if (!hovering && view === 'home' && !document.hidden) showCard((cur + 1) % cards.length); }, 4000); }
tocItems.forEach((b, k) => b.addEventListener('click', () => { showCard(k); arm(); }));
$('#showBody').addEventListener('mouseenter', () => { hovering = true; });
$('#showBody').addEventListener('mouseleave', () => { hovering = false; });

/* =====================================================================
   报告页
   数据：/api/result?key=<店> 读回来的 result.json（字段说明见各 render 函数）。
   流程：读数据 → build() 整理成页面要用的样子 → 每一屏各自 render → 加载动画一屏一屏亮出来。
   ===================================================================== */
const T = window.COPY, rpEl = $('#rp'), prog = $('#prog');
const t = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => v && v[k] != null ? v[k] : '');
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const nf = n => Number(n || 0).toLocaleString('en-US');
const CHK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const BANG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v8M12 18h.01"/></svg>';
const ARR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
const GO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5"/></svg>';
const CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"/></svg>';
const pfIcon = k => ic(String(k).replace(/^cat_/, ''));
const ENG = [['chatgpt_web', 'chatgpt', 'ChatGPT'], ['google_aimode', 'google', 'Google AI']];
let M = null, KEY = '';

/* ---------- 把 result.json 整理成页面要用的样子 ---------- */
function build(d){
  const st = d.store || {}, por = d.portrait || {}, dim = {};
  ((d.score || {}).dims || []).forEach(x => { if (x.score != null) dim[x.key] = x; });
  const nDims = Object.keys(dim).length || 1, total = (d.score || {}).total || 0;

  /* 问题：每个问题、每个 AI 问了几遍，哪几遍推荐了这家店 */
  const qs = (d.questions || []).map(q => {
    const runs = ENG.map(e => (((q.engines || {})[e[0]]) || []).filter(r => r.status === 'ok'));
    const all = runs[0].concat(runs[1]);
    return { zh: q.text_zh || q.text, en: q.text_zh ? q.text : '', runs, asked: all.length, rec: all.filter(r => r['class'] === 'recommend').length };
  }).filter(q => q.asked);
  const eng = ENG.map((e, i) => ({ n: qs.reduce((a, q) => a + q.runs[i].length, 0), rec: qs.reduce((a, q) => a + q.runs[i].filter(r => r['class'] === 'recommend').length, 0) }));
  const asked = eng[0].n + eng[1].n, rec = eng[0].rec + eng[1].rec;

  /* 对手：AI 回答里出现最多的几家。评分还没查到的店，先用示例数字（页面上会注明） */
  const rivals = (d.rivals || []).map(r => ({ name: r.name, count: r.count || 0, rating: r.rating, reviews: r.review_count }));
  let repRivals = rivals.filter(r => r.rating && r.reviews).slice(0, 3), repSim = false;
  if (!repRivals.length && rivals.length){
    repSim = true;
    repRivals = rivals.slice(0, 3).map(r => { let h = 0; for (const c of r.name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return { name: r.name, count: r.count, rating: Math.round((4.3 + (h % 5) / 10) * 10) / 10, reviews: Math.round((st.review_count || 500) * (1.6 + (h % 23) / 10) / 10) * 10 }; });
  }

  /* 平台：y = 有你，x = 对手有你没有，z = 都没有 */
  const rp = d.rival_platforms || {}, rf = rp.found || {}, hasRival = !!rp.name;
  const pf = (((d.platforms || {}).rows) || []).filter(r => !r.error && (r.kind === 'page' || r.kind === 'mention')).map(r => ({ key: r.key, name: String(r.name).replace(' 地图', ' 地图'), sub: r.sub, domain: r.domain, cat: r.found ? 'y' : (!hasRival || rf[r.key]) ? 'x' : 'z' }));
  const nap = (((d.platforms || {}).rows) || []).filter(r => !r.error && !r.base && (r.phone_ok != null || r.addr_ok != null || r.hours_ok != null)).map(r => ({ key: r.key, name: r.name, phone_ok: r.phone_ok, addr_ok: r.addr_ok, hours_ok: r.hours_ok }));
  /* 营业时间：Google 上的（store.hours）对比各平台上的。平台那一行有真实的 hours 就用真实的；
     没有就用 static/sample-hours.js 里的示例（页面上会标「示例数据」）。网址加 ?hours=ok 可以看全对的样子。 */
  const SH = (window.SAMPLE_HOURS || {})[d.key] || {}, toMap = a => { const o = {}; (a || []).forEach(x => { o[x.day] = hNorm(x.hours); }); return o; };
  let hRef = toMap(st.hours), hSample = false; if (!Object.keys(hRef).length && SH.google){ hRef = {}; Object.keys(SH.google).forEach(k => { hRef[k] = hNorm(SH.google[k]); }); hSample = true; }
  const hRows = !Object.keys(hRef).length ? [] : (((d.platforms || {}).rows) || []).filter(r => !r.error && !r.base && r.found).map(r => {
    let days = null; if (r.hours && r.hours.length) days = toMap(r.hours); else if (SH.platforms && SH.platforms[r.key]){ hSample = true; days = Object.assign({}, hRef); if (!/[?&]hours=ok\b/.test(location.search)) Object.keys(SH.platforms[r.key]).forEach(k => { days[k] = hNorm(SH.platforms[r.key][k]); }); }
    return days && { key: r.key, name: r.name, days, diff: T.days.filter(x => days[x[0]] != null && days[x[0]] !== hRef[x[0]]).map(x => x[0]) };
  }).filter(Boolean);
  const pfN = { y: pf.filter(p => p.cat === 'y').length, x: pf.filter(p => p.cat === 'x').length, z: pf.filter(p => p.cat === 'z').length };

  /* 七个方面 → 做得好的 / 要改进的（带一句有数字的话） */
  const facts = k => { const f = Object.assign({}, (dim[k] || {}).facts || {}); f.miss = (f.n || 0) - (f.found || 0); f.out = (f.n || 0) - (f.top3 || 0); f.bad = (f.bad || []).length; f.rating = st.rating; f.reviews = nf(st.review_count); f.med_n = nf(f.med_n); f.asked = asked; f.rec = rec; return f; };
  const dims = Object.keys(dim).filter(k => T.dims[k]).map(k => { const good = dim[k].score >= 60, c = T.dims[k]; return { key: k, score: dim[k].score, good, to: c.to, title: good ? c.tGood : c.tBad, line: t(good ? c.good : c.bad, facts(k)) }; });
  const ORDER = ['ai', 'reputation', 'map', 'website', 'media', 'platforms', 'consistency'];
  const good = dims.filter(x => x.good).sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key)), bad = dims.filter(x => !x.good).sort((a, b) => a.score - b.score);

  /* 行动：每件事大概能加几分。数据里没有这个数，这里按「把对应那一项补到 70 分」估算 */
  const GAIN = { media: 'media', dish: 'website', engine: 'ai', site: 'website', website: 'website', platforms: 'platforms', map: 'map', reviews: 'reputation' };
  const actions = (d.actions || []).map(a => { const x = dim[GAIN[a.id]]; return { id: a.id, title: a.title, see: a.see, do: a['do'], gain: x && x.score < 70 ? Math.max(1, Math.round((70 - x.score) / nDims)) : 0 }; });

  const groups = (d.source_groups || []).slice(), own = groups.filter(g => g.kind === 'own')[0] || { count: 0, names: [] };
  return {
    key: d.key, date: d.asked_on, store: st, total, nap, demoBad: !!d._demoBad, hours: { ref: hRef, rows: hRows, sample: hSample }, dim, dims, good, bad, qs, eng, asked, rec, rivals, repRivals, repSim, pf, pfN, rivalName: rp.name || '', actions,
    photos: [por.photo].concat(por.photos || []).filter(Boolean).slice(0, 4), dishes: (por.dishes || []).slice(0, 3), quote: (por.quotes || [])[0],
    groups: groups.filter(g => g.kind !== 'own').sort((a, b) => b.count - a.count), own, srcTotal: groups.reduce((a, g) => a + (g.count || 0), 0), sites: (d.sites || []).slice(0, 8), grid: d.grid || null,
    verdict: total >= 76 ? T.verdictHigh : (st.rating >= 4.5 ? T.verdictLoved : T.verdictUnknown)
  };
}

/* ---------- 标题打字：字先全部排好占住位置，再一个一个显出来 ---------- */
function tySet(h, html){
  const walk = (node, cls) => [...node.childNodes].map(n => n.nodeType === 3 ? [...n.nodeValue].map(ch => '<span class="ch' + cls + '">' + esc(ch) + '</span>').join('') : n.tagName === 'BR' ? '<br>' : walk(n, n.classList && n.classList.contains('r') ? ' r' : n.classList && n.classList.contains('a') ? ' a' : cls)).join('');
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  h.setAttribute('aria-label', tmp.textContent); h.innerHTML = walk(tmp, ''); h._c = [...h.querySelectorAll('.ch')]; h._tok = (h._tok || 0) + 1;
}
async function tyRun(h){
  if (!h || !h._c) return; const tok = ++h._tok, cs = h._c;
  cs.forEach(c => c.classList.remove('on')); const old = h.querySelector('.cr'); if (old) old.remove();
  if (RM){ cs.forEach(c => c.classList.add('on')); return; }
  const cr = document.createElement('i'); cr.className = 'cr'; cr.setAttribute('aria-hidden', 'true'); h.appendChild(cr); h.classList.add('typing');
  for (const c of cs){
    c.classList.add('on'); cr.style.cssText = 'left:' + (c.offsetLeft + c.offsetWidth) + 'px;top:' + (c.offsetTop + c.offsetHeight * .1) + 'px;height:' + (c.offsetHeight * .8) + 'px';
    await sleep(/[⺀-￿]/.test(c.textContent) ? 34 : 16); if (tok !== h._tok) return;
  }
  h.classList.remove('typing'); await sleep(1600); if (tok === h._tok) cr.remove();
}

/* ---------- 封面 ---------- */
const phs = $$('.rp-ph'), lb = $('#lb'), lbImg = $('#lbImg');
function renderCover(){
  const s = M.store, h = $('#rName'), PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  h.classList.toggle('long', String(s.name).length > 22); tySet(h, esc(s.name));
  $('#rMeta').innerHTML = PIN + '<span>' + esc(s.address) + '</span>';
  $('#rBadge').innerHTML = '<img class="pi" src="' + ic('google') + '" alt="Google">' + STAR + '<b>' + esc(s.rating) + '</b><span>' + nf(s.review_count) + ' 条评价</span>';
  phs.forEach((b, i) => { const im = b.querySelector('img'); b.hidden = !M.photos[i]; if (M.photos[i]){ im.src = M.photos[i]; im.alt = s.name + ' 的照片 ' + (i + 1); } });
  $('.cv__r').hidden = !M.photos.length;
  const q = M.quote;
  $('#rSay').innerHTML = !M.dishes.length ? '' : '<p class="cv__lab"><img class="pi" src="' + ic('google') + '" alt="">Google 评价里，客人最常提的</p><ul class="cv__dish">' + M.dishes.map(x => '<li><strong>' + x.mentions + '<small>条评价提到</small></strong><b>' + esc(x.zh || x.name) + '</b><em>' + esc(x.zh ? x.name : '') + '</em></li>').join('') + '</ul>' +
    (q ? '<blockquote class="cv__q">' + esc(q.text) + (q.zh ? '<small>' + esc(q.zh) + '</small>' : '') + '<cite>' + (q.rating >= 4 ? '<span>' + '★★★★★'.slice(0, Math.round(q.rating)) + '</span>' : '') + esc(q.author || '') + ' · Google 评价</cite></blockquote>' : '');
}
const phoneFmt = s => { const m = /^1?(\d{3})(\d{3})(\d{4})$/.exec(String(s || '').replace(/\D/g, '')); return m ? '(' + m[1] + ') ' + m[2] + '-' + m[3] : String(s || ''); };
const hNorm = s => { s = String(s || '').replace(/[\u202f\u00a0]/g, ' ').trim(); if (/^closed$/i.test(s)) return T.hrsClosed; if (/24 hours/i.test(s)) return T.hrs24; return s.replace(/(\d{1,2})(?::(\d\d))?\s*(AM|PM)/gi, (_, h, m, ap) => { h = +h % 12 + (/pm/i.test(ap) ? 12 : 0); return (h < 10 ? '0' : '') + h + ':' + (m || '00'); }).replace(/\s*[–-]\s*/g, '–'); };
const dateZh = s => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ''); return m ? m[1] + ' 年 ' + (+m[2]) + ' 月 ' + (+m[3]) + ' 日' : ''; };

/* ---------- 01 得分 ---------- */
function renderScore(){
  const s = M.total, band = s < 50 ? 'low' : s < 76 ? 'mid' : 'high';
  tySet($('#hScore'), M.verdict);
  const pts = (M.bad.length ? M.good.slice(0, 1) : M.good.slice(0, 3)).map(x => ['ok', x.line]).concat(M.bad.slice(0, 2).map(x => ['no', x.line]));
  $('#sc').innerHTML = '<div class="sc__l"><p class="sc__n"><b data-count="' + s + '">' + s + '</b><span>/ 100</span><em>' + T.band[band] + '</em></p><div class="sc__bar" style="--p:' + s + '%" data-skb><i class="z1"></i><i class="z2"></i><i class="z3"></i><b><em>' + T.here + '</em></b></div><p class="sc__ax"><span>' + T.band.low + '</span><span>' + T.band.mid + '</span><span>' + T.band.high + '</span></p></div>' +
    '<div class="sc__r"><ul class="sc__pts">' + pts.map((p, i) => '<li class="' + p[0] + '" style="--i:' + i + '"><i>' + (p[0] === 'ok' ? CHK : BANG) + '</i><span>' + esc(p[1]) + '</span></li>').join('') + '</ul><a class="btn rise d3" href="#r-plan" data-goto>' + T.toPlan + GO + '</a></div>';
  const g = M.grid, cells = (g && g.cells) || [], top3 = cells.filter(c => c.rank && c.rank <= 3).length, n20 = M.asked ? Math.round(M.rec / M.asked * 20) : 0, logos = M.pf.filter(p => p.cat === 'y').slice(0, 7);
  $('#vit').innerHTML =
    '<a href="#r-ai" data-goto><div class="vit__g"><div class="vg-dots">' + Array.from({ length: 20 }, (_, i) => '<i class="' + (i < n20 ? 'y' : '') + '" style="--i:' + i + '"></i>').join('') + '</div></div><p>' + M.rec + '<small>/ ' + M.asked + '</small></p><span>次提问，AI 推荐了你</span>' + ARR + '</a>' +
    '<a href="#r-map" data-goto><div class="vit__g"><div class="vg-grid">' + cells.map((c, i) => '<i class="' + (!c.rank ? '' : c.rank <= 3 ? 't' : c.rank <= 10 ? 'm' : '') + '" style="--i:' + (i + 6) + '"></i>').join('') + '</div></div><p>' + top3 + '<small>/ ' + cells.length + '</small></p><span>个路口排进地图前 3</span>' + ARR + '</a>' +
    '<a href="#r-pf" data-goto><div class="vit__g"><div class="vg-logos">' + logos.map(p => '<img src="' + pfIcon(p.key) + '" alt="">').join('') + '</div></div><p>' + M.pfN.y + '<small>/ ' + M.pf.length + '</small></p><span>个平台和媒体上有你</span>' + ARR + '</a>' +
    '<a href="#r-rep" data-goto><div class="vit__g"><span class="stars" style="--v:' + (M.store.rating / 5 * 100).toFixed(1) + '%"><i>★★★★★</i><i>★★★★★</i></span></div><p>' + esc(M.store.rating) + '<small>分</small></p><span>' + nf(M.store.review_count) + ' 条 Google 评价</span>' + ARR + '</a>';
}

/* ---------- 02 AI 怎么说：问题 + 点阵 + 重放回答 ---------- */
let qSel = { q: 0, e: 0, r: 0 }, qTok = 0;
function qPick(k){ const q = M.qs[k]; for (let e = 1; e >= 0; e--){ const r = q.runs[e].findIndex(x => x['class'] === 'recommend'); if (r >= 0) return { q: k, e, r }; } return { q: k, e: q.runs[1].length ? 1 : 0, r: 0 }; }
function renderQA(){
  const dense = Math.max.apply(null, M.qs.map(q => Math.max(q.runs[0].length, q.runs[1].length)).concat([0])) > 4, LIM = 8;
  tySet($('#hAi'), t(T.hAi, { asked: M.asked, rec: M.rec, c: M.rec / (M.asked || 1) < .5 ? 'r' : 'a' })); $('#lAi').textContent = T.lAi;
  const qa = $('#qa'); qa.className = 'qa' + (dense ? ' qa--dense' : '');
  qa.innerHTML = '<div class="qa__l"><p class="qa__eng">' + ENG.map((e, i) => '<span class="' + (M.eng[i].rec ? '' : 'zero') + '"><img class="pi" src="' + ic(e[1]) + '" alt="">' + e[2] + ' 推荐你 <b>' + M.eng[i].rec + '</b> / ' + M.eng[i].n + ' 次</span>').join('') + '</p><ol class="qa__list" id="qlist">' +
    M.qs.map((q, k) => { let n = 0; return '<li class="' + (k >= LIM ? 'more' : '') + '"><button type="button" data-q="' + k + '"><span class="t">' + esc(q.zh) + '</span>' + (q.en ? '<small>' + esc(q.en) + '</small>' : '<small></small>') + '<span class="dots">' + ENG.map((e, i) => '<span class="g"><img class="pi" src="' + ic(e[1]) + '" alt="' + e[2] + '">' + q.runs[i].map((r, j) => { const hit = r['class'] === 'recommend'; return '<i class="' + (hit ? 'y' : '') + '" data-e="' + i + '" data-r="' + j + '" style="--i:' + (k * 4 + n++) + '" data-tip="' + e[2] + ' · 第 ' + (j + 1) + ' 次 · ' + (hit ? '<b>推荐了你</b>' + (r.position ? '，排第 ' + r.position : '') : '没提到你') + '"></i>'; }).join('') + '</span>').join('') + '</span><em class="' + (q.rec ? '' : 'zero') + '">' + q.rec + ' / ' + q.asked + '</em></button></li>'; }).join('') +
    '</ol>' + (M.qs.length > LIM ? '<button type="button" class="qa__more" id="qaMore">' + t(T.qaAll, { n: M.qs.length }) + '</button>' : '') + '</div><div class="qa__r"><div class="qc-w"><div class="qc" id="qc" aria-live="polite"></div></div></div>';
  qSel = qPick(0); qShow(false);
  /* 排行 */
  const rows = M.rivals.slice(0, 4).map(r => [r.name, r.count, 0]).concat([[T.you, M.rec, 1]]).sort((a, b) => b[1] - a[1]), max = Math.max.apply(null, rows.map(r => r[1]).concat([1])), lead = rows[0];
  $('#rank').innerHTML = '<h3>' + (lead[2] ? t(T.rankAhead, { asked: M.asked }) : t(T.rankBehind, { asked: M.asked, count: lead[1], rec: M.rec })) + '</h3><div class="rank__rows">' + rows.map((r, i) => '<div class="' + (r[2] ? 'me' : '') + '"><span>' + esc(r[0]) + '</span><i style="--w:' + Math.max(2, Math.round(r[1] / max * 100)) + '%;--i:' + i + '"></i><b data-to="' + r[1] + '">0</b></div>').join('') + '</div>';
  $('#rank').classList.remove('in');
}
async function qShow(anim){
  const tok = ++qTok, q = M.qs[qSel.q], run = q.runs[qSel.e][qSel.r], e = ENG[qSel.e], qc = $('#qc'); if (!run) return;
  $$('#qlist button').forEach(b => b.classList.toggle('on', +b.dataset.q === qSel.q));
  $$('#qlist .dots i').forEach(i => i.classList.toggle('sel', +i.closest('button').dataset.q === qSel.q && +i.dataset.e === qSel.e && +i.dataset.r === qSel.r));
  const hit = run['class'] === 'recommend', names = run.names || [], pos = hit ? (run.position || 0) : 0;
  let show = names.slice(0, 6).map((n, i) => [i + 1, n]); if (pos > 6) show = show.slice(0, 5).concat([[pos, names[pos - 1]]]);
  const rest = names.length - show.length, src = (run.cited_domains || []).slice(0, 5);
  qc.innerHTML = '<p class="qc__q"><span id="qcQ"></span></p><p class="qc__who"><span><img class="pi" src="' + ic(e[1]) + '" alt="">' + e[2] + '<small>' + t(T.qcNth, { r: qSel.r + 1, n: q.runs[qSel.e].length }) + '</small></span><span class="qc__v ' + (hit ? 'good' : 'bad') + '">' + (hit ? (pos ? t(T.qcYes, { pos }) : '推荐了你') : T.qcNo) + '</span></p><ol class="ans">' +
    show.map(r => '<li class="' + (r[0] === pos ? 'is-you' : '') + '"><span class="n">' + r[0] + '</span><span class="line"><span class="nm">' + esc(r[1]) + '</span></span><span class="you">你</span></li>').join('') +
    (rest > 0 ? '<li class="more on"><span class="nm" style="opacity:1;filter:none;transform:none">' + t(T.qcMore, { n: rest }) + '</span></li>' : '') +
    (hit ? '' : '<li class="is-miss"><span class="n">–</span><span class="line"><span class="nm">' + T.qcMiss + '</span></span><span class="you">你</span></li>') +
    '</ol><p class="qc__src">' + (src.length ? T.qcSrc + src.map(s => '<span>' + esc(s) + '</span>').join('') : T.qcNoSrc) + '</p>';
  const text = q.en || q.zh, el = $('#qcQ'), lis = $$('#qc .ans li:not(.more)');
  if (!anim || RM){ el.textContent = text; lis.forEach(li => li.classList.add('on')); return; }
  for (const ch of text){ el.textContent += ch; await sleep(/[⺀-￿]/.test(ch) ? 38 : 20); if (tok !== qTok) return; }
  await sleep(260); if (tok !== qTok) return;
  for (const li of lis){ li.classList.add('on'); await sleep(90); if (tok !== qTok) return; }
}
$('#qa').addEventListener('click', e => {
  const more = e.target.closest('#qaMore'); if (more){ const on = $('#qa').classList.toggle('all'); more.textContent = on ? T.qaLess : t(T.qaAll, { n: M.qs.length }); return; }
  const dot = e.target.closest('.dots i'), b = e.target.closest('#qlist button'); if (!b) return;
  qSel = dot ? { q: +b.dataset.q, e: +dot.dataset.e, r: +dot.dataset.r } : qPick(+b.dataset.q); qShow(true);
});

/* ---------- 03 AI 看哪里 ---------- */
function renderSrc(){
  const own = M.own.count || 0, K = { rival: 'k-rival', editorial: 'k-editorial', claimable: 'k-claimable' }, rv = (M.groups.filter(g => g.kind === 'rival')[0] || {}).count || 0;
  const v = { total: nf(M.srcTotal), own: nf(own), rival: nf(rv) }, mode = !own ? 'Zero' : own < rv ? 'Less' : 'Lead';
  tySet($('#hSrc'), t(T['hSrc' + mode], v)); $('#lSrc').textContent = t(T.lSrc, v);
  $('#tSrc').innerHTML = '<span>' + T['take' + mode] + '</span><a href="#r-plan" data-goto>' + T.takeGo + '</a>';
  const lab = g => T.srcKinds[g.kind] || esc(g.label), eg = g => (g.names || []).length ? t(T.srcEg, { names: esc(g.names.slice(0, 3).join('、')) }) : '';
  const tipOf = g => '<b>' + lab(g) + ' · ' + nf(g.count) + ' 次</b>' + (g.n_sites ? '<br>' + t(T.srcTipN, { n: g.n_sites }) : '') + (eg(g) ? '，' + eg(g) : '') + (T.srcWhy[g.kind] ? '<br>' + T.srcWhy[g.kind] : '');
  const ownTip = '<b>' + T.srcKinds.own + ' · ' + nf(own) + ' 次</b><br>' + (own ? T.srcWhy.own : T.srcWhy.ownZero);
  $('#src').innerHTML = '<div class="src__bar" data-skb>' + M.groups.map((g, i) => '<i class="' + (K[g.kind] || 'k-other') + '" data-k="' + i + '" data-tip="' + esc(tipOf(g)) + '" style="--n:' + Math.max(1, g.count) + ';--i:' + i + '"><b>' + nf(g.count) + '</b><span>' + lab(g) + '</span></i>').join('') + '<i class="k-own' + (own ? '' : ' zero') + '" data-k="' + M.groups.length + '" data-tip="' + esc(ownTip) + '" style="--n:' + Math.max(1, own) + ';--i:' + M.groups.length + '"><b>' + nf(own) + '</b><span>' + T.srcKinds.own + '</span></i></div><ul class="src__lg rise">' +
    M.groups.map((g, i) => '<li data-k="' + i + '" data-tip="' + esc(tipOf(g)) + '"><span><i class="' + (K[g.kind] || 'k-other') + '"></i>' + lab(g) + '</span><small>' + eg(g) + '</small></li>').join('') +
    '<li class="own" data-k="' + M.groups.length + '" data-tip="' + esc(ownTip) + '"><span><i class="k-own' + (own ? '' : ' zero') + '"></i>' + T.srcKinds.own + '</span><small>' + esc((M.own.names || []).join('、')) + '</small></li></ul>';
  const max = Math.max.apply(null, M.sites.map(s => s.count).concat([1]));
  $('#sites').innerHTML = M.sites.map(s => {
    const p = M.pf.filter(x => x.domain && (s.domain === x.domain || s.domain.endsWith('.' + x.domain)))[0];
    const st = s.kind === 'own' ? ['', T.siteOwn] : s.kind === 'rival' ? ['', esc(s.kind_zh || T.siteRival)] : p ? (p.cat === 'y' ? ['yes', T.siteYes] : ['no', T.siteNo]) : ['', esc(s.kind_zh || '')];
    return '<li>' + (p ? '<img class="av" src="' + pfIcon(p.key) + '" alt="">' : '<span class="av">' + esc(String(s.name || s.domain).charAt(0)) + '</span>') + '<b>' + esc(s.name || s.domain) + '</b><span class="bar"><i class="' + (s.kind === 'own' ? 'k-own' : K[s.kind] || 'k-other') + '" style="--w:' + Math.round(s.count / max * 100) + '%"></i><span>' + t(T.times, { n: s.count }) + '</span></span><em class="' + st[0] + '">' + st[1] + '</em></li>';
  }).join('');
  $('#sitesFold .fold__b span').textContent = t(T.sitesBtn, { n: M.sites.length }); $('#sitesFold').hidden = !M.sites.length;
}
$('#src').addEventListener('mouseover', e => { const el = e.target.closest('[data-k]'), box = $('#src'); if (!el) return; box.classList.add('hot'); $$('[data-k]', box).forEach(x => x.classList.toggle('on', x.dataset.k === el.dataset.k)); });
$('#src').addEventListener('mouseleave', () => { const box = $('#src'); box.classList.remove('hot'); $$('[data-k]', box).forEach(x => x.classList.remove('on')); });
$('#sitesFold .fold__b').addEventListener('click', e => { const f = $('#sitesFold'), o = !f.classList.contains('open'); f.classList.toggle('open', o); e.currentTarget.setAttribute('aria-expanded', String(o)); });

/* ---------- 04 地图：店和 9 个路口按经纬度落在真实底图上（底图瓦片走 /api/tile） ---------- */
const Z = 15, TILE = 256;
const wx = lng => (lng + 180) / 360 * Math.pow(2, Z) * TILE;
const wy = lat => { const s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * Math.pow(2, Z) * TILE; };
let mapCell = () => {};
function renderMap(){
  const g = M.grid, m = $('#rmap'), sec = $('#r-map'); sec.hidden = !(g && g.cells && g.cells.length); if (sec.hidden) return;
  const cells = g.cells, xs = cells.map(c => wx(+c.lng)), ys = cells.map(c => wy(+c.lat)), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
  const V = Math.max(x1 - x0, y1 - y0) * 1.42, left = (x0 + x1) / 2 - V / 2, top = (y0 + y1) / 2 - V / 2, pct = px => (px / V * 100).toFixed(3) + '%';
  const sx = wx(+M.store.lng) - left, sy = wy(+M.store.lat) - top, n = cells.length, top3 = cells.filter(c => c.rank && c.rank <= 3).length;
  let home = 0, best = 1e9; cells.forEach((c, i) => { const dd = Math.hypot(xs[i] - left - sx, ys[i] - top - sy); if (dd < best){ best = dd; home = i; } });
  const order = cells.map((c, i) => [i, Math.hypot(xs[i] - left - sx, ys[i] - top - sy)]).sort((a, b) => a[1] - b[1]).map(v => v[0]);
  let tiles = '';
  for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + V) / TILE); tx++) for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + V) / TILE); ty++)
    tiles += '<img class="tl" alt="" src="/api/tile?z=' + Z + '&x=' + tx + '&y=' + ty + '" style="left:' + pct(tx * TILE - left) + ';top:' + pct(ty * TILE - top) + ';width:' + pct(TILE + 0.6) + '">';
  m.style.setProperty('--sx', pct(sx)); m.style.setProperty('--sy', pct(sy));
  m.innerHTML = tiles + '<span class="rp-scan" style="left:' + pct(sx) + ';top:' + pct(sy) + '"></span>' +
    cells.map((c, i) => '<button type="button" class="rp-pt ' + (!c.rank ? '' : c.rank <= 3 ? 't' : c.rank <= 10 ? 'm' : '') + (i === home ? ' sel' : '') + '" data-c="' + i + '" style="left:' + pct(xs[i] - left) + ';top:' + pct(ys[i] - top) + ';--i:' + order.indexOf(i) + '" aria-label="路口 ' + (i + 1) + (c.rank ? '，你排第 ' + c.rank : '，没搜到你') + '">' + (c.rank || '–') + '</button>').join('') +
    '<span class="rp-home" style="left:' + pct(sx) + ';top:' + pct(sy) + '">' + T.homeTag + '</span><span class="rp-credit">底图 © OpenStreetMap · CARTO</span>';
  mapCell = (i, anim) => {
    const c = cells[i], el = $('#rcell');
    const body = '<p>' + t(i === home ? T.cellHome : T.cell, { i: i + 1 }) + '</p><h3>' + (c.rank ? t(T.cellRank, { rank: c.rank, c: c.rank <= 3 ? '' : 'no' }) : T.cellOut) + '</h3><ol>' + (c.top || []).slice(0, 3).map((nm, k) => '<li class="' + (c.rank === k + 1 ? 'me' : '') + '"><span>' + (k + 1) + '</span><b>' + esc(nm) + '</b></li>').join('') + '</ol>';
    if (!anim){ el.innerHTML = body; return; }
    el.classList.add('swap'); setTimeout(() => { el.innerHTML = body; el.classList.remove('swap'); }, 200);
  };
  mapCell(home, false);
  tySet($('#hMap'), top3 === n ? t(T.hMapAll, { n }) : t(T.hMapSome, { n, out: n - top3 })); $('#lMap').textContent = t(T.lMap, { n, kw: g.keyword || '' });
}
$('#rmap').addEventListener('click', e => { const b = e.target.closest('.rp-pt'); if (!b) return; $$('#rmap .rp-pt').forEach(x => x.classList.toggle('sel', x === b)); mapCell(+b.dataset.c, true); });

/* ---------- 05 平台 ---------- */
function chips(f, anim){
  const c = $('#chips'), html = M.pf.filter(p => p.cat === f).map((p, i) => '<div class="rp-chip ' + f + '" style="--i:' + i + '"><img class="pi" src="' + pfIcon(p.key) + '" alt="" onerror="this.style.visibility=\'hidden\'"><div><b>' + esc(p.name) + '</b><span>' + (f === 'x' ? (M.rivalName ? T.chipX : '没有你') : f === 'y' ? T.chipY : T.chipZ) + '</span></div></div>').join('');
  if (!anim){ c.innerHTML = html; return; }
  c.classList.add('swap'); setTimeout(() => { c.innerHTML = html; c.classList.remove('swap'); }, RM ? 0 : 200);
}
function renderPf(){
  const N = M.pfN, first = N.x ? 'x' : 'y', con = M.dim.consistency;
  tySet($('#hPf'), N.x && M.rivalName ? t(T.hPfMiss, { x: N.x }) : T.hPfOk); $('#lPf').textContent = t(T.lPf, { n: M.pf.length, y: N.y, x: N.x, z: N.z }) + (M.rivalName ? t(T.lPfRival, { rival: M.rivalName }) : '');
  $('#ratio').innerHTML = ['y', 'x', 'z'].filter(k => N[k]).map(k => '<i class="' + k + '" style="flex:' + N[k] + '"></i>').join(''); $('#ratio').setAttribute('data-skb', '');
  $('#pfseg').innerHTML = '<span class="thumb"></span>' + [['x', T.pfX], ['y', T.pfY], ['z', T.pfZ]].filter(k => N[k[0]]).map(k => '<button type="button" data-f="' + k[0] + '" aria-pressed="' + (k[0] === first) + '">' + k[1] + ' ' + N[k[0]] + '</button>').join('');
  chips(first, false);
  /* 资料核对。每个平台有 phone_ok / addr_ok（以后还可以有 hours_ok）：true = 和 Google 一样，false = 不一样，没有 = 没法核对 */
  const FIELDS = [['phone_ok', T.napPhone, phoneFmt(M.store.phone)], ['addr_ok', T.napAddr, M.store.address], ['hours_ok', T.napHours, '']].filter(f => M.nap.some(r => r[f[0]] != null));
  const rows = M.nap.map(r => ({ r, bad: FIELDS.filter(f => r[f[0]] === false) })).sort((a, b) => b.bad.length - a.bad.length), nBad = rows.reduce((a, x) => a + x.bad.length, 0), nAll = M.nap.reduce((a, r) => a + FIELDS.filter(f => r[f[0]] != null).length, 0), nap = $('#nap');
  nap.hidden = !rows.length; nap.className = 'nap rise' + (nBad ? ' bad' : '');
  nap.innerHTML = '<div class="nap__h"><i>' + (nBad ? BANG : CHK) + '</i><div><h3>' + (nBad ? t(T.napBadH, { n: nBad }) : T.napOkH) + '</h3><p>' + t(nBad ? T.napBadP : T.napOkP, { n: nAll }) + '</p></div></div>' +
    (nBad ? '<ul class="nap__fix">' + rows.filter(x => x.bad.length).map(x => x.bad.map(f => '<li>' + t(T.napFix, { name: esc(x.r.name), what: f[1], right: esc(f[2] || '') }) + '</li>').join('')).join('') + '</ul>' : '') +
    '<p class="nap__ref"><img class="pi" src="' + ic('google') + '" alt="">' + T.napRef + FIELDS.filter(f => f[2]).map(f => '<span>' + f[1] + ' ' + esc(f[2]) + '</span>').join('') + '</p>' +
    '<ul class="nap__grid">' + rows.map((x, i) => '<li class="' + (x.bad.length ? 'bad' : '') + '" style="--i:' + i + '"><img class="pi" src="' + pfIcon(x.r.key) + '" alt=""><b>' + esc(x.r.name) + '</b>' + FIELDS.filter(f => x.r[f[0]] != null).map(f => '<span class="' + (x.r[f[0]] ? '' : 'x') + '">' + f[1] + (x.r[f[0]] ? '' : T.napDiff) + '</span>').join('') + '</li>').join('') + '</ul>' +
    (M.demoBad ? '<p class="note">' + T.napDemo + '</p>' : '');
  /* 营业时间：只列出和 Google 不一样的地方，一样的平台用一句话带过 */
  const HR = M.hours, hrs = $('#hrs'), dayZh = k => T.days.filter(x => x[0] === k)[0][1];
  hrs.hidden = !HR.rows.length;
  if (HR.rows.length){
    /* 同一个平台上，写错成同一个时间、正确时间也相同的几天，合成一行：周五、周六 */
    const lines = []; HR.rows.forEach(r => { const by = {}; r.diff.forEach(k => { const id = r.days[k] + '|' + HR.ref[k]; (by[id] = by[id] || { r, mine: r.days[k], right: HR.ref[k], days: [] }).days.push(dayZh(k)); }); Object.keys(by).forEach(id => lines.push(by[id])); });
    const same = HR.rows.filter(r => !r.diff.length), nDiff = HR.rows.reduce((a, r) => a + r.diff.length, 0), tag = HR.sample ? '<span class="hrs__k" data-tip="' + esc(T.hrsSampleNote) + '">' + T.hrsSample + '</span>' : '';
    hrs.className = 'nap hrs rise d2' + (nDiff ? ' bad' : '');
    hrs.innerHTML = '<div class="nap__h"><i>' + (nDiff ? BANG : CHK) + '</i><div><h3>' + (nDiff ? t(T.hrsBadH, { n: nDiff }) : t(T.hrsOkH, { n: HR.rows.length })) + tag + '</h3>' + (nDiff ? '<p>' + T.hrsBadP + '</p>' : '') + '</div></div>' +
      (nDiff ? '<ul class="hrs__list">' + lines.map((x, i) => '<li style="--i:' + i + '"><span class="hrs__n"><img class="pi" src="' + pfIcon(x.r.key) + '" alt="">' + esc(x.r.name) + '</span><b>' + x.days.join('、') + '</b><span class="hrs__v x"><small>' + T.hrsOn + '</small>' + esc(x.mine) + '</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5"/></svg><span class="hrs__v"><small>' + T.hrsG + '</small>' + esc(x.right) + '</span></li>').join('') + '</ul>' : '') +
      (nDiff && same.length ? '<p class="hrs__rest">' + same.slice(0, 6).map(r => '<img class="pi" src="' + pfIcon(r.key) + '" alt="' + esc(r.name) + '">').join('') + t(T.hrsRest, { n: same.length }) + '</p>' : '');
  }
}
$('#pfseg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; segSet($('#pfseg'), b.dataset.f, 'f'); chips(b.dataset.f, true); });

/* ---------- 06 口碑 ---------- */
function renderRep(){
  const me = { name: T.you, rating: M.store.rating, reviews: M.store.review_count || 0, me: 1 }, rv = M.repRivals, sec = $('#r-rep'); sec.hidden = !rv.length || !me.rating; if (sec.hidden) return;
  const byR = [me].concat(rv).sort((a, b) => b.rating - a.rating || (b.me || 0) - (a.me || 0)), topR = byR[0].rating, big = rv.slice().sort((a, b) => b.reviews - a.reviews)[0], maxN = Math.max(me.reviews, big.reviews), med = rv.map(r => r.reviews).sort((a, b) => a - b)[Math.floor(rv.length / 2)], x = big.reviews / (me.reviews || 1);
  tySet($('#hRep'), me.reviews < med ? T.hRepFew : T.hRepOk); $('#lRep').textContent = T.lRep;
  $('#rep').innerHTML = '<div class="rep__l"><h3>' + T.repStars + '</h3><ul class="rep__stars">' + byR.map(r => '<li class="' + (r.me ? 'me' : '') + '"><span' + (r.me && r.rating >= topR ? ' data-tag="' + T.repTop + '"' : '') + '>' + esc(r.name) + '</span><span class="stars" style="--v:' + (r.rating / 5 * 100).toFixed(1) + '%"><i>★★★★★</i><i>★★★★★</i></span><b>' + r.rating.toFixed(1) + '</b></li>').join('') + '</ul></div>' +
    '<div class="rep__r"><h3>' + T.repCount + '</h3><div class="rep__cols" data-skb data-io>' + [me].concat(rv).sort((a, b) => a.reviews - b.reviews).map((r, i) => '<div class="col' + (r.me ? ' me' : '') + '" style="--h:' + Math.max(10, Math.round(r.reviews / maxN * 230)) + 'px;--i:' + i + '"><b data-to="' + r.reviews + '">0</b><i></i><span>' + esc(r.name) + '</span></div>').join('') + '</div><p class="rep__say rise d2">' + (x >= 1.5 ? t(T.repTimes, { x: x >= 10 ? Math.round(x) : String(Math.round(x * 10) / 10) }) : T.repLead) + '</p>' + (M.repSim ? '<p class="note">' + T.repSim + '</p>' : '') + '</div>';
}

/* ---------- 07 总结和下一步 ---------- */
let proj = 0;
function renderSum(){
  const row = (x, i) => '<a href="#' + x.to + '" data-goto style="--i:' + i + '"><span><b>' + esc(x.title) + '</b><small>' + esc(x.line) + '</small></span>' + ARR + '</a>', bad = M.bad.slice(0, 4);
  tySet($('#hSum'), bad.length ? t(T.hSum, { g: M.good.length, bad: bad.slice(0, 3).map(x => T['short'][x.key] || x.title).join('、') }) : T.hSumAllGood);
  $('#sum').innerHTML = '<div class="rp-sumc"><h3><i>' + CHK + '</i>' + T.sumGood + '<span>' + t(T.sumN, { n: M.good.length }) + '</span></h3>' + M.good.map(row).join('') + '</div><div class="rp-sumc bad"><h3><i>' + BANG + '</i>' + T.sumBad + '<span>' + T.sumOrder + '</span></h3>' + (bad.length ? bad.map(row).join('') : '<p class="none">' + T.sumNone + '</p>') + '</div>';
  /* 行动计划 */
  const gain = M.actions.reduce((a, x) => a + x.gain, 0);
  tySet($('#hNext'), gain ? t(T.hNext, { n: M.actions.length, to: Math.min(100, M.total + gain) }) : T.hNextKeep);
  $('#acts').innerHTML = M.actions.map((a, i) => '<div class="rp-act' + (i ? '' : ' open') + '" data-a="' + i + '"><div class="rp-act__h" role="button" tabindex="0" aria-expanded="' + !i + '"><span class="rp-chk" role="checkbox" aria-checked="false" tabindex="0" aria-label="标为要做">' + CHK + '</span><h3>' + esc(a.title) + '</h3><span class="g">' + (a.gain ? t(T.gain, { n: a.gain }) : a.id === 'keep' ? T.keep : '') + '</span>' + CHEV + '</div><div class="rp-act__b"><div><div class="rp-act__in"><p><b>' + T.why + '</b>' + esc(a.see) + '</p><p><b>' + T.how + '</b>' + esc(a['do']) + '</p></div></div></div></div>').join('');
  $$('#acts .rp-act').forEach(x => x.classList.remove('done')); proj = M.total; $('#projBase').style.width = M.total + '%'; $('#projBar').style.left = M.total + '%'; projUpdate(true);
}
function projUpdate(now){
  const gain = $$('#acts .rp-act.done').reduce((a, x) => a + M.actions[+x.dataset.a].gain, 0), to = Math.min(100, M.total + gain), el = $('#projN'), from = proj, t0 = performance.now(), dur = now || RM ? 0 : 700; proj = to;
  (function f(n){ const p = dur ? Math.min(1, (n - t0) / dur) : 1; el.innerHTML = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))) + '<small>/ 100</small>'; if (p < 1) requestAnimationFrame(f); })(t0);
  $('#projBar').style.width = (to - M.total) + '%';
  $('#projFrom').innerHTML = gain ? t(T.projGain, { n: M.total, g: to - M.total }) : t(T.projNow, { n: M.total });
}
$('#acts').addEventListener('click', e => {
  const ck = e.target.closest('.rp-chk'), card = e.target.closest('.rp-act'); if (!card) return;
  if (ck){ const on = !card.classList.contains('done'); card.classList.toggle('done', on); ck.setAttribute('aria-checked', String(on)); projUpdate(); return; }
  if (e.target.closest('.rp-act__h')){ const o = !card.classList.contains('open'); card.classList.toggle('open', o); card.querySelector('.rp-act__h').setAttribute('aria-expanded', String(o)); }
});
$('#acts').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.rp-chk, .rp-act__h')){ e.preventDefault(); e.target.click(); } });

/* ---------- 目录条 + 进入动画 + 数字跳动 + 提示框 ---------- */
const RS = $$('.scn[data-rail]'), rail = $('#rail'), rhl = rail.querySelector('.hl');
rail.insertAdjacentHTML('beforeend', RS.map(r => '<a href="#' + r.id + '"><i></i>' + r.dataset.rail + '</a>').join(''));
const rLinks = $$('a', rail); let rCur = -1;
function rSet(i){
  if (i === rCur) return; rCur = i; rLinks.forEach((a, k) => a.classList.toggle('on', k === i));
  const a = rLinks[i]; if (!a){ rhl.style.opacity = 0; return; } rhl.style.opacity = ''; rhl.style.width = a.offsetWidth + 'px'; rhl.style.transform = 'translateX(' + a.offsetLeft + 'px)';
}
function rSpy(){
  if (view !== 'report') return; let i = -1; const line = innerHeight * .35;
  RS.forEach((r, k) => { if (!r.hidden && r.getBoundingClientRect().top <= line) i = k; });
  rSet(i);
  /* 保险：万一有一屏已经在眼前、却还没亮起来（比如直接跳到它中间），这里补一次 */
  $$('.scn', rpEl).forEach(sc => { if (sc.hidden || sc.classList.contains('in') || sc.classList.contains('is-wait')) return; const r = sc.getBoundingClientRect(); if (r.top < innerHeight * .86 && r.bottom > 0) sceneIn(sc); });
}
addEventListener('scroll', rSpy, { passive: true });
document.addEventListener('click', e => { const a = e.target.closest('#rail a, [data-goto]'); if (!a) return; e.preventDefault(); const el = document.getElementById(a.getAttribute('href').slice(1)); if (el) el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); });
function sceneIn(s){ if (s.classList.contains('in')) return; s.classList.add('in'); $$('[data-io]', s).forEach(el => bio ? bio.observe(el) : blockIn(el)); $$('.ty', s).forEach(tyRun); countIn(s); if (s.id === 'r-ai') setTimeout(() => qShow(true), RM ? 0 : 700); }
const rio = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting){ rio.unobserve(en.target); sceneIn(en.target); } }), { threshold: .06, rootMargin: '0px 0px -14% 0px' }) : null;
function countIn(root){
  $$('[data-count]', root || rpEl).forEach(el => { const to = +el.dataset.count, t0 = performance.now(), dur = RM ? 0 : 1400; (function f(now){ const p = dur ? Math.min(1, (now - t0) / dur) : 1; el.textContent = nf(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(f); })(t0); });
}
/* 一屏里靠下的小块（[data-to] 的数字）：滚到它自己才开始动，条和数字一起长 */
function countTo(el, to, ms, delay){ if (RM){ el.textContent = nf(to); return; } setTimeout(() => { const t0 = performance.now(); (function f(now){ const p = Math.min(1, (now - t0) / ms); el.textContent = nf(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(f); })(t0); }, delay); }
function blockIn(el){ el.classList.add('in'); $$('[data-to]', el).forEach((b, i) => countTo(b, +b.dataset.to, 1100, i * 90 + 200)); }
const bio = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting){ bio.unobserve(en.target); blockIn(en.target); } }), { threshold: .35 }) : null;
const tip = $('#rpTip');
document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (!el) return; const r = el.getBoundingClientRect(); tip.innerHTML = el.dataset.tip; tip.style.left = Math.min(innerWidth - 160, Math.max(160, r.left + r.width / 2)) + 'px'; tip.style.top = r.top + 'px'; tip.classList.add('on'); });
document.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('[data-tip]')) tip.classList.remove('on'); });
addEventListener('scroll', () => tip.classList.remove('on'), { passive: true });
function toast(msg){
  let el = $('#toast'); if (!el){ el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('on'); clearTimeout(el._h); el._h = setTimeout(() => el.classList.remove('on'), 2400);
}

/* ---------- 加载：骨架照着真实排版画（每行字一条、每张卡一块），所以加载中和加载完是同一个结构 ---------- */
let loadTok = 0;
const setP = p => prog.firstElementChild.style.setProperty('--p', p);
const ldUnits = k => $$(k ? '[data-ld="' + k + '"]' : '[data-ld]', rpEl).filter(u => !u.hidden);
const TEXTY = /^(P|H1|H2|H3|H4|SPAN|SMALL|B|EM|STRONG|A|LABEL|TD|TH|BLOCKQUOTE|FIGCAPTION)$/;
function skBuild(u){
  const old = u.querySelector(':scope>.ld-sk'); if (old) old.remove();
  const R = u.getBoundingClientRect(); if (R.width < 2 || R.height < 2) return;
  let h = '';
  const add = (l, tp, w, hh, rad) => { if (w >= 4 && hh >= 4) h += '<i class="sk" style="left:' + (l - R.left).toFixed(1) + 'px;top:' + (tp - R.top).toFixed(1) + 'px;width:' + w.toFixed(1) + 'px;height:' + hh.toFixed(1) + 'px;border-radius:' + rad + '"></i>'; };
  const block = (cs, r) => add(r.left, r.top, r.width, r.height, parseFloat(cs.borderTopLeftRadius) >= 4 ? cs.borderTopLeftRadius : (Math.min(r.width, r.height) < 28 ? '6px' : '12px'));
  const lines = (el, direct) => {   /* 一行字 = 一条 */
    const box = el.getBoundingClientRect(), rg = document.createRange(), rs = [];
    const nodes = direct ? [...el.childNodes].filter(n => n.nodeType === 3) : (() => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), a = []; let n; while ((n = w.nextNode())) a.push(n); return a; })();
    nodes.forEach(n => { if (!n.nodeValue.trim()) return; rg.selectNodeContents(n); [...rg.getClientRects()].forEach(r => { const l = Math.max(r.left, box.left, R.left), rt = Math.min(r.right, box.right, R.right); if (rt - l > 1 && r.height > 1) rs.push({ l, r: rt, t: r.top, b: r.bottom }); }); });
    rs.sort((a, b) => a.t - b.t || a.l - b.l);
    const out = [];
    rs.forEach(r => { const cy = (r.t + r.b) / 2, o = out.find(o => Math.abs(o.cy - cy) < (o.b - o.t) * .45 && r.l - o.r < 28 && r.l >= o.l - 2); if (o){ o.r = Math.max(o.r, r.r); o.t = Math.min(o.t, r.t); o.b = Math.max(o.b, r.b); } else out.push({ l: r.l, r: r.r, t: r.t, b: r.b, cy }); });
    out.forEach(o => { const bh = Math.max(8, Math.min((o.b - o.t) * .52, 44)); add(o.l, o.cy - bh / 2, o.r - o.l, bh, Math.min(8, bh / 2) + 'px'); });
  };
  const boxed = cs => (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent' && !/\/ 0\)$/.test(cs.backgroundColor)) || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none';
  const walk = (el, depth) => {
    for (const c of el.children){
      if (c.classList.contains('ld-sk') || c.hidden) continue;
      const r = c.getBoundingClientRect(), m = c.dataset ? c.dataset.skb : undefined; if (m == null && (r.width < 2 || r.height < 2)) continue;
      const cs = getComputedStyle(c);
      if (m === 'text') lines(c);
      else if (m != null) block(cs, r);
      else if (c instanceof SVGElement){ if (r.width >= 28) block(cs, r); }
      else if (TEXTY.test(c.tagName) && !(c.tagName === 'A' && c.classList.contains('btn'))) lines(c);
      else if (boxed(cs)) block(cs, r);
      else if (!c.children.length){ if (c.textContent.trim()) lines(c); else block(cs, r); }
      else if (depth < 5){ lines(c, true); walk(c, depth + 1); }
      else block(cs, r);
    }
  };
  const self = u.dataset.skb;
  if (self === 'text') lines(u); else if (self != null) add(R.left, R.top, R.width, R.height, 'inherit'); else walk(u, 1);
  const ov = document.createElement('span'); ov.className = 'ld-sk'; ov.setAttribute('aria-hidden', 'true'); ov.innerHTML = h; u.appendChild(ov);
}
function ldPrep(){
  ldUnits().forEach(u => { u.classList.remove('ld-go', 'in'); if (rio) rio.unobserve(u); u.classList.add('is-wait'); });
  ldUnits().forEach(skBuild);
  rLinks.forEach(a => a.classList.remove('run', 'ok'));
  rpEl.classList.add('ld-run', 'waving'); document.body.classList.add('ld-run-top'); setWave(rpEl);
}
function ldOpen(u, now){
  if (!u.classList.contains('is-wait')) return;
  u.classList.remove('is-wait'); const ov = u.querySelector(':scope>.ld-sk');
  if (now){ if (ov) ov.remove(); }
  else { u.classList.add('ld-go'); setTimeout(() => u.classList.remove('ld-go'), 1100); if (ov){ ov.classList.add('off'); setTimeout(() => ov.remove(), 500); } }
  if (u.classList.contains('scn')){ const a = rLinks[RS.indexOf(u)]; if (a){ a.classList.remove('run'); a.classList.add('ok'); } if (rio) rio.observe(u); else sceneIn(u); }
}
function ldShow(k, tok){ ldUnits(k).forEach((u, j) => setTimeout(() => { if (tok === loadTok) ldOpen(u); }, RM ? 0 : j * 140)); }
function ldRun(k){ ldUnits(k).forEach(u => { const a = rLinks[RS.indexOf(u)]; if (a) a.classList.add('run'); }); }
function ldClear(){ $$('.scn', rpEl).forEach(s => { s.classList.remove('in'); if (rio) rio.unobserve(s); }); ldUnits().forEach(u => { u.classList.add('is-wait'); ldOpen(u, true); }); rLinks.forEach(a => a.classList.remove('run', 'ok')); rpEl.classList.remove('ld-run', 'waving'); document.body.classList.remove('ld-run-top'); }
function kSet(a, b){ const k = $('#rK'), w = $('#rWhen'); k.textContent = a; if (w.textContent !== b){ w.textContent = b; w.classList.remove('kin'); void w.offsetWidth; w.classList.add('kin'); } }
/* 演示版的数据一次就读全了，所以这里按固定的节奏一屏一屏亮出来。
   正式版数据是陆续回来的：哪一块到了，就调一次 ldShow('<那一块>')，其余不用改。 */
async function runLoad(){
  const tok = ++loadTok, alive = () => tok === loadTok, K = RM ? .15 : 1;
  ldPrep(); kSet(T.kLoading, T.phaseFind);
  prog.hidden = false; prog.classList.remove('done'); setP(.04);
  await sleep(900 * K); if (!alive()) return;
  ldShow('store', tok); ldShow('photo', tok); setP(.14);
  ['rev', 'pf', 'map', 'ai', 'score'].forEach(ldRun); kSet(T.kLoading, T.phaseWork);
  let got = 0; const N = M.asked || 1, step = Math.max(1, Math.round(N / 14));
  const tick = setInterval(() => { if (!alive()) return clearInterval(tick); got = Math.min(N, got + step + Math.floor(Math.random() * step)); kSet(T.kLoading, t(T.phaseGot, { n: got })); setP(.18 + got / N * .72); if (got >= N) clearInterval(tick); }, 330 * K);
  await sleep(1100 * K); if (!alive()) return; ldShow('rev', tok);
  await sleep(1200 * K); if (!alive()) return; ldShow('pf', tok);
  await sleep(1100 * K); if (!alive()) return; ldShow('map', tok);
  await new Promise(r => { const w = () => (!alive() || got >= N) ? r() : setTimeout(w, 120); w(); }); if (!alive()) return;
  ldShow('ai', tok); kSet(T.kLoading, T.phaseScore);
  await sleep(1000 * K); if (!alive()) return; ldShow('score', tok);
  await sleep(900 * K); if (!alive()) return;
  setP(1); prog.classList.add('done'); rpEl.classList.remove('ld-run', 'waving'); document.body.classList.remove('ld-run-top'); kSet(T.kReport, dateZh(M.date)); rCur = -1; rSpy(); toast(T.ready);
}

/* ---------- 打开一份报告 ---------- */
function renderAll(d){
  M = build(d);
  renderCover(); renderScore(); renderQA(); renderSrc(); renderMap(); renderPf(); renderRep(); renderSum();
  const ps = $('#pfseg [aria-pressed="true"]'); if (ps) segSet($('#pfseg'), ps.dataset.f, 'f');
}
function showReport(d, loading){
  renderAll(d); window.scrollTo(0, 0); rCur = -1; tyRun($('#rName'));
  if (loading) runLoad(); else { loadTok++; prog.hidden = true; ldClear(); $$('.scn', rpEl).forEach(s => { if (rio) rio.observe(s); else sceneIn(s); }); kSet(T.kReport, dateZh(M.date)); }
  requestAnimationFrame(rSpy);
}

/* ---------- 照片：点一下放大，左右键翻 ---------- */
let lbI = 0, lbFrom = null;
const lbList = () => phs.filter(b => !b.hidden);
function lbShow(i){ const L = lbList(); lbI = (i + L.length) % L.length; const im = L[lbI].querySelector('img'); lbImg.src = im.src; lbImg.alt = im.alt; $('#lbN').textContent = (lbI + 1) + ' / ' + L.length + ' · 来自 Google'; lbImg.classList.remove('in'); void lbImg.offsetWidth; lbImg.classList.add('in'); }
function lbOpen(i, from){ lbFrom = from; lb.hidden = false; lbShow(i); requestAnimationFrame(() => lb.classList.add('on')); lb.querySelector('.lb__x').focus(); }
function lbClose(){ lb.classList.remove('on'); setTimeout(() => { lb.hidden = true; }, RM ? 0 : 300); if (lbFrom) lbFrom.focus(); }
document.addEventListener('click', e => {
  const p = e.target.closest('.rp-ph'); if (p && !p.classList.contains('is-wait')) return lbOpen(lbList().indexOf(p), p);
  if (lb.hidden) return;
  const b = e.target.closest('[data-lb]'); if (b) return b.dataset.lb === 'x' ? lbClose() : lbShow(lbI + +b.dataset.lb);
  if (e.target === lb) lbClose();
});
document.addEventListener('keydown', e => { if (lb.hidden) return; if (e.key === 'Escape') lbClose(); else if (e.key === 'ArrowLeft') lbShow(lbI - 1); else if (e.key === 'ArrowRight') lbShow(lbI + 1); });

/* =====================================================================
   页面切换
   ===================================================================== */
/* 首页的大字：随滚动一个字一个字变深 */
function lightPrep(h){
  const walk = (node, cls) => [...node.childNodes].map(n => n.nodeType === 3 ? [...n.nodeValue].map(ch => '<span class="ch' + cls + '">' + (ch === ' ' ? '&nbsp;' : esc(ch)) + '</span>').join('') : walk(n, n.classList && n.classList.contains('r') ? ' r' : n.classList && n.classList.contains('a') ? ' a' : cls)).join('');
  const tmp = document.createElement('div'); tmp.innerHTML = h.innerHTML; h.innerHTML = walk(tmp, ''); h._c = $$('.ch', h); h._k = -1;
}
function lightAll(){
  $$('[data-light]').forEach(h => {
    if (!h._c || !h.offsetParent) return; const r = h.getBoundingClientRect();
    const p = RM ? 1 : Math.max(0, Math.min(1, (innerHeight * .92 - r.top) / (innerHeight * .4))), k = Math.round(p * h._c.length);
    if (k !== h._k){ h._k = k; h._c.forEach((c, i) => c.classList.toggle('lit', i < k)); }
  });
}
$$('[data-light]').forEach(lightPrep);
const gio = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting){ en.target.classList.add('in'); gio.unobserve(en.target); } }), { threshold: .18 }) : null;
$$('.gx').forEach(g => gio ? gio.observe(g) : g.classList.add('in'));

function setHash(h){ try { history.replaceState(null, '', h || (location.pathname + location.search)); } catch (e) {} }
function go(v){
  view = v; $('#v-home').hidden = v !== 'home'; $('#v-report').hidden = v === 'home'; document.body.classList.toggle('is-report', v === 'report');
  const sec = $(v === 'home' ? '#v-home' : '#v-report'); sec.classList.remove('view'); void sec.offsetWidth; sec.classList.add('view');
  window.scrollTo(0, 0);
}
function goHome(){ loadTok++; openTok++; KEY = ''; prog.hidden = true; document.body.classList.remove('ld-run-top'); go('home'); setHash(''); showCard(0); arm(); chatLoop(); requestAnimationFrame(lightAll); }
/* 读一家店的结果。后台还在跑（status 不是 done）就每 1.5 秒再读一次 */
let openTok = 0;
async function openKey(key, loading){
  const tok = ++openTok; let d = await api('/api/result?key=' + encodeURIComponent(key));
  while (d && !d.error && d.status && !/^(done|error|not_found|choose)$/.test(d.status)){ await sleep(1500); if (tok !== openTok) return; d = await api('/api/result?key=' + encodeURIComponent(key)); }
  if (tok !== openTok) return;
  if (!d || d.error || d.status !== 'done' || !d.store) throw { error: T.notFound };
  d.key = d.key || key; d.asked_on = d.asked_on || String(d.updated_at || '').slice(0, 10);
  if (/[?&]demo=bad\b/.test(location.search)){ const rs = (((d.platforms || {}).rows) || []).filter(r => !r.base); const a = rs.filter(r => r.phone_ok === true)[0], b = rs.filter(r => r.addr_ok === true && r !== a)[0]; if (a) a.phone_ok = false; if (b) b.addr_ok = false; d._demoBad = true; }
  stopChat(); clearInterval(timer); KEY = key; go('report'); setHash('#k=' + encodeURIComponent(key)); showReport(d, loading && !STATIC);
}
function hintReset(){ const h = $('#hint'); h.className = 'hint'; h.innerHTML = '<span>免费</span><span>约 1 分钟</span><span>只替你问，不改你的任何资料</span>'; }
function hintErr(msg){ const h = $('#hint'); h.className = 'hint err'; h.textContent = msg; }
const askBtn = $('#ask .btn'), askHtml = askBtn.innerHTML;
function busy(on){ askBtn.disabled = on; askBtn.innerHTML = on ? '正在查…' : askHtml; }
$('#ask').addEventListener('submit', async e => {
  e.preventDefault(); const form = $('#ask'), v = input.value.trim();
  if (!v){ form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); hintErr('先输入店名或官网，比如 baonoodlehouse.com'); input.focus(); return; }
  busy(true);
  try { const j = await api('/api/check', { url: v }); if (!j || j.error || !j.key) throw j || {}; await openKey(j.key, true); }
  catch (err) { hintErr((err && err.error) || T.netFail); }
  busy(false);
});
input.addEventListener('input', () => { if ($('#hint').classList.contains('err')) hintReset(); });
document.addEventListener('click', e => {
  const a = e.target.closest('#toDemo,#other,#toHow,#toGeo,#ctaBtn,#rCta,#rAgain'); if (!a) return;
  e.preventDefault();
  if (a.id === 'toGeo' || a.id === 'toHow'){ if (view !== 'home') goHome(); setTimeout(() => $(a.id === 'toGeo' ? '#geo' : '#how').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }), 60); return; }
  if (a.id === 'ctaBtn'){ window.scrollTo({ top: 0, behavior: RM ? 'auto' : 'smooth' }); setTimeout(() => input.focus({ preventScroll: true }), RM ? 0 : 500); return; }
  if (a.id === 'toDemo') return openKey(EX_KEY, true).catch(() => toast(T.netFail));
  if (a.id === 'rCta') return toast(T.ctaToast);
  if (a.id === 'other' || a.id === 'rAgain'){ goHome(); setTimeout(() => { input.value = ''; input.focus(); }, 80); }
});
addEventListener('scroll', () => { $('#top').classList.toggle('scrolled', scrollY > 8); if (view === 'home') lightAll(); }, { passive: true });
addEventListener('resize', () => {
  placeHL();
  if (view !== 'report') return;
  rCur = -1; rSpy(); const pf = $('#pfseg [aria-pressed="true"]'); if (pf) segSet($('#pfseg'), pf.dataset.f, 'f');
  if (rpEl.classList.contains('ld-run')){ ldUnits().filter(u => u.classList.contains('is-wait')).forEach(skBuild); setWave(rpEl); }
});
/* 按网址决定先看哪一页：/#k=<店> 直接开报告，否则是首页 */
function route(){
  const m = /[#&]k=([^&]+)/.exec(location.hash), key = m ? decodeURIComponent(m[1]) : '';
  if (key){ if (key !== KEY) openKey(key, true).catch(() => { goHome(); hintErr(T.notFound); }); }
  else if (view !== 'home') goHome();
}
addEventListener('hashchange', route);
(document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(route);
})();
