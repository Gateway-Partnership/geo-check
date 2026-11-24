/* GEO Check · 自动往下播的一页。原生 JS，不引库。
   数据每 1.5 秒读一次 /api/result；每一段（scene）数据到了才出场，出场时自己演一遍，再滚到下一段。
   第六轮（2026-11-21 夜）：真地图底图、问 AI 去掉格子、分数改成「你哪里丢分」的诊断、加一段讲清道理、中英文切换。
   ?static=1：所有段直接显示最终状态（截图、检查用）。?fast=1：动画加速 20 倍（检查用）。?lang=en|zh：指定语言。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var QS = location.search, STILL = /[?&]static=1/.test(QS), RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var K = STILL ? 0 : /[?&]fast=1/.test(QS) ? 0.05 : RM ? 0.6 : 1;
  var DEMO = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /[?&]demo=1/.test(QS);
  var ENG = [['chatgpt_web', 'ChatGPT', 'chatgpt'], ['google_aimode', 'Google AI', 'google']];
  var S = { key: null, url: '', pick: null, d: null, timer: null, token: 0, auto: true, busy: false, fail: null, tried: [] };
  var LANG = (/[?&]lang=(en|zh)/.exec(QS) || [])[1] || (function () { try { return localStorage.getItem('geo_lang'); } catch (e) { return null; } })() || 'zh';
  var T = window.COPY[LANG] || window.COPY.zh;
  window.__story = { played: [], done: false };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function t(k, v) { return String(T[k] == null ? k : T[k]).replace(/\{(\w+)\}/g, function (_, n) { return v && v[n] != null ? esc(v[n]) : ''; }); }
  function nfmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms * K); }); }
  function until(fn, tok) { return new Promise(function (r) { (function loop() { if (tok !== S.token || fn()) return r(); setTimeout(loop, 300); })(); }); }
  function pic(k, cls) { return '<img class="pi ' + (cls || '') + '" src="/static/assets/pf/' + k + '.png" alt="" width="64" height="64">'; }
  function nm(s) { s = String(s == null ? '' : s).replace(' 地图', ''); if (LANG === 'en' && s === '小红书') return 'Xiaohongshu'; return LANG === 'en' ? (s.replace(/[㐀-鿿]+/g, '').replace(/\s+/g, ' ').trim() || s) : s; }  // 英文版里去掉名字后面的中文
  function api(path, body) {
    return fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined).then(function (r) { return r.json(); });
  }
  var GLYPH = {
    ai: '<path d="M4 6h16v9H9l-4 3.5V15H4z"/>', map: '<path d="M12 21s6-5.6 6-10.5a6 6 0 0 0-12 0C6 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
    platforms: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    media: '<path d="M5 5h11v14H7a2 2 0 0 1-2-2z"/><path d="M16 9h3v8a2 2 0 0 1-2 2M8 9h5M8 12.5h5M8 16h3"/>',
    consistency: '<path d="M4 8h10M4 12h16M4 16h7"/><path d="m15 15 2 2 3.5-4"/>', reputation: '<path d="m12 4 2.5 5.2 5.7.8-4.1 4 1 5.6L12 17l-5.1 2.6 1-5.6-4.1-4 5.7-.8z"/>',
    website: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.6 2.4 2.6 13.6 0 16M12 4c-2.6 2.4-2.6 13.6 0 16"/>',
    right: '<path d="M5 12h13M13 7l5 5-5 5"/>', phone: '<path d="M8 4 5.5 4.8c-.8.3-1.3 1.1-1.1 2 1 6 6.8 11.8 12.8 12.8.9.2 1.7-.3 2-1.1L20 16l-4-2.3-1.9 1.9c-2.1-1-3.8-2.7-4.8-4.8l1.9-1.9z"/>',
    ok: '<path d="M4 12.5 9 17 20 6.5"/>'
  };
  function glyph(k) { return '<svg class="g" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (GLYPH[k] || '') + '</svg>'; }
  function mark(k) { return '<svg class="mk" viewBox="0 0 12 12" aria-hidden="true"><path d="' + (k === 'ok' ? 'M2 6.5 5 9.5 10 3' : 'M3 3l6 6M9 3l-6 6') + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }
  function chip(r) { return '<span class="chip">' + pic(r.icon || r.key) + esc(pname(r)) + '</span>'; }
  function pname(r) { if (r.key === 'cat_infatuation' || r.key === 'cat_eater') { var c = ((S.d.platforms || {}).category) || {}; return (r.key === 'cat_eater' ? 'Eater' : 'The Infatuation') + (LANG === 'en' ? ' best ' + (c.kw || '') + ' list' : ' ' + (c.zh || '') + '榜单'); } return nm(r.name); }

  // ---------- 读数据 ----------
  function qs() { return ((S.d && S.d.questions) || []).slice(0, 8); }
  function runs(q, e) { return ((q.engines || {})[e]) || []; }
  function okRuns(q, e) { return runs(q, e).filter(function (r) { return r.status === 'ok'; }); }
  function hits(q, e) { return okRuns(q, e).filter(function (r) { return r['class'] === 'recommend'; }).length; }
  function quickDone() { var s = S.d && S.d.status; return s === 'quick_done' || s === 'full_running' || s === 'done'; }
  function back() { var n = 0; qs().forEach(function (q) { ENG.forEach(function (e) { if (runs(q, e[0]).length) n++; }); }); return n; }
  function qReady(q) { return ENG.every(function (e) { return runs(q, e[0]).length; }) || quickDone(); }
  function engState(q, e) { var all = runs(q, e); if (!all.length) return quickDone() ? 'none' : 'wait'; var ok = okRuns(q, e); if (!ok.length) return 'none'; return hits(q, e) ? 'yes' : 'no'; }
  function pfAll() { return (((S.d || {}).platforms || {}).rows || []).filter(function (r) { return !r.error; }); }
  function pfRows() { return pfAll().filter(function (r) { return r.kind !== 'pos' && r.kind !== 'bonus'; }); }  // 点餐系统只显示找到的那家，不算进「几个里有几个」
  function pfReady() { return pfAll().some(function (r) { return r.kind; }); }
  function street() { return String(((S.d || {}).store || {}).address || '').split(',')[0].trim(); }

  // ---------- 入口 ----------
  function entry() {
    var d = S.d || {}, h = '<section class="entry"><div class="entry__main"><h1>' + phrases(t('entry_h1')) + '</h1>';
    if (d.status === 'choose') {
      h += '<p class="lead">' + t('entry_choose', { n: (d.candidates || []).length }) + '</p><div class="branches">' + (d.candidates || []).map(function (c) {
        return '<button type="button" data-pick="' + c.i + '"><b>' + esc(c.name) + '</b><span>' + esc(c.address || '') + '</span></button>'; }).join('') + '</div>';
    } else if (S.busy) {
      h += '<div class="finding" role="status"><p>' + t('entry_finding') + '</p><div class="bar"><i></i></div></div>';
    } else {
      h += '<p class="lead">' + t('entry_lead') + '</p><form class="ask-form" id="f" novalidate><input id="url" type="text" autocapitalize="off" spellcheck="false" placeholder="' + t('entry_ph') + '" aria-label="' + t('entry_ph') + '" value="' + esc(S.url) + '"><button class="btn" type="submit">' + t('entry_btn') + glyph('right') + '</button></form>';
      if (S.fail) h += '<p class="warn" role="alert">' + esc(S.fail) + '</p>';
      h += '<p class="srcs"><span>' + t('entry_srcs') + '</span>' + ['google', 'yelp', 'tripadvisor', 'ubereats', 'doordash', 'eater', 'instagram', 'chatgpt'].map(function (k) { return pic(k); }).join('') + '</p>';
      if (DEMO && S.tried.length) h += '<p class="tried">' + S.tried.map(function (x) { return '<button type="button" class="link" data-key="' + esc(x.key) + '">' + esc(x.name || x.key) + '</button>'; }).join('') + '</p>';
    }
    h += '</div><div class="demo" aria-hidden="true"><p class="demo__q">' + t('demo_q') + '</p><p class="demo__who">' + pic('chatgpt') + t('demo_who') + '</p><ol><li>Shanghai 21</li><li class="is-you">' + t('demo_you') + '</li><li>Joe’s Shanghai</li></ol></div></section>';
    $('stage').innerHTML = h; $('rail').hidden = true; chrome(); fixOrphans($('stage'));
  }
  function phrases(s) { return String(s).split('|').map(function (x) { return '<span class="nw">' + x + '</span>'; }).join(LANG === 'en' ? ' ' : ''); }  // 标题按词组断行：「好吃」不会被拆开
  function fixOrphans(root) {  // 中文段落最后一行不许只剩一两个字：把段尾 6 个字绑在一起
    if (LANG !== 'zh') return;
    [].forEach.call(root.querySelectorAll('h2, h3, p, .pipe__n > span:last-child'), function (el) {
      var n = el.lastChild; if (!n || n.nodeType !== 3 || el.closest('.en, .quote')) return; var tx = n.nodeValue; if (tx.length < 9 || !/[\u3400-\u9fff]/.test(tx)) return;
      var sp = document.createElement('span'); sp.className = 'nw'; sp.textContent = tx.slice(-6); n.nodeValue = tx.slice(0, -6); el.appendChild(sp);
    });
  }
  function chrome() { $('lang').textContent = T.lang_other; $('resume').textContent = T.auto_resume; $('foot').textContent = T.foot; document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-CN'; }
  function start(url, pick, force) {
    S.token++; S.url = url; S.pick = pick || null; S.fail = null; S.busy = true; S.d = null; S.key = null; entry();
    api('/api/check', { url: url, pick: S.pick, force: !!force, mode: 'full', upgrade: true }).then(function (j) {
      if (j.error) { S.busy = false; S.fail = j.error; return entry(); }
      S.key = j.key; watch();
    }).catch(function () { S.busy = false; S.fail = t('entry_fail'); entry(); });
  }
  function watch() {
    clearInterval(S.timer); var started = false;
    function tick() {
      if (!S.key) return;
      api('/api/result?key=' + encodeURIComponent(S.key)).then(function (d) {
        if (d.error && !d.status) return;
        S.d = d; var st = d.status; if (started) lateFill(true);
        if (st === 'done' || st === 'error' || st === 'choose' || st === 'not_found') { clearInterval(S.timer); S.timer = null; }
        if (st === 'choose') { S.busy = false; return entry(); }
        if (st === 'not_found' || st === 'error') { S.busy = false; S.fail = t('entry_notfound'); S.key = null; return entry(); }
        if (d.store && !started) { started = true; S.busy = false; history.replaceState(null, '', location.pathname + location.search + '#k=' + encodeURIComponent(S.key)); play(); }
      }).catch(function () {});
    }
    tick(); S.timer = setInterval(tick, 1500);
  }

  // ---------- 小工具：出场、数数、打字、位移 ----------
  function sec(id, k, h, sub, body) {
    return '<section class="scene" id="sc-' + id + '" data-scene="' + id + '">' + (k ? '<p class="scene__k" data-r>' + k + '</p>' : '') + '<h2 data-r>' + h + '</h2>' + (sub ? '<p class="scene__sub" data-r>' + sub + '</p>' : '') + body + '</section>';
  }
  function reveal(el, sel, gap) {
    var list = [].slice.call(el.querySelectorAll(sel)), p = Promise.resolve();
    list.forEach(function (x) { p = p.then(function () { x.classList.add('in'); return sleep(gap); }); });
    return p;
  }
  function countUp(node, to, ms) {
    if (!node) return Promise.resolve(); if (!K) { node.textContent = nfmt(to); return Promise.resolve(); }
    return new Promise(function (res) { var t0 = performance.now(), dur = ms * K; (function f(now) { var p = Math.min(1, (now - t0) / dur); node.textContent = nfmt(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(f); else res(); })(t0); });
  }
  function typeInto(node, text) {  // 字先全部排好占住位置，再一个一个显出来：气泡不会一边打字一边变大
    if (!K) { node.textContent = text; return Promise.resolve(); }
    node.innerHTML = text.split('').map(function (ch) { return '<span class="ch">' + esc(ch) + '</span>'; }).join('');
    var p = Promise.resolve();
    [].forEach.call(node.children, function (c) { p = p.then(function () { c.classList.add('in'); return sleep(24); }); });
    return p;
  }
  function pipeTo(line, p) {  // 连线和光点只动 transform
    var v = line.offsetHeight > line.offsetWidth, len = v ? line.offsetHeight : line.offsetWidth;
    line.querySelector('i').style.transform = v ? 'scaleY(' + p + ')' : 'scaleX(' + p + ')';
    line.querySelector('b').style.transform = v ? 'translateY(' + (p * len) + 'px)' : 'translateX(' + (p * len) + 'px)';
  }

  var SCENES = [];
  // 1 第一屏：直接是店的卡片（反馈：不要「找到了，这是你的店」这种标题），卡片下半是分数，数据到了再填
  function scoreReady() { return quickDone() && (S.d.score || {}).total != null && (pfReady() || S.d.status === 'done'); }
  function ring(total, cls) {
    var R = 54, C = 2 * Math.PI * R;
    return '<div class="gauge ' + (cls || '') + '"><svg viewBox="0 0 140 140" aria-hidden="true"><circle class="g0" cx="70" cy="70" r="' + R + '"/><circle class="g1" cx="70" cy="70" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" style="--off:' + (C * (1 - total / 100)).toFixed(1) + ';--full:' + C.toFixed(1) + '"/></svg><p><b class="num" data-to="' + total + '">0</b><span>' + t('s7_of') + '</span></p></div>';
  }
  function heroScore() {
    var sc = S.d.score, band = sc.total < 50 ? 'low' : sc.total < 76 ? 'mid' : 'high', bad = problems().filter(function (p) { return !p.ok; });
    var h = ring(sc.total) + '<div class="hero__st"><p class="hero__lab">' + t('hero_score') + '<em class="band band--' + band + '">' + t('s7_band_' + band) + '</em></p>';
    if (bad.length) h += '<p class="lowest">' + t('s7_low_lab') + bad.slice(0, 2).map(function (p) { return '<span class="nw">' + p.title + '</span>'; }).join('') + '</p>';
    return h + '<a class="link" href="#sc-score">' + t('hero_more') + '</a></div>';
  }
  function lateFill(animate) {  // 分数和「AI 推荐了谁」要等回答回来：到了就填进第一屏和第二屏
    var d = S.d; if (!d || !d.store) return;
    var h = $('hero-score');
    var sigH = scoreReady() ? d.score.total + '|' + problems().filter(function (p) { return !p.ok; }).slice(0, 2).map(function (p) { return p.key; }).join() + '|' + LANG : '';
    if (h && sigH && h.dataset.done !== sigH) {
      animate = animate && !h.dataset.done; h.dataset.done = sigH; h.className = 'hero__score is-ready'; h.innerHTML = heroScore(); var g = h.querySelector('.gauge'), n = h.querySelector('.num');
      if (animate && K) { setTimeout(function () { g.classList.add('run'); countUp(n, d.score.total, 1300); }, 60); } else { g.classList.add('run'); n.textContent = d.score.total; }
    }
    var w = $('why-data');
    var sigW = quickDone() && (d.overall || {}).asked ? [d.overall.asked, d.overall.listed, d.overall.recommended, ((d.rivals || [])[0] || {}).count, ((d.rivals || [])[0] || {}).name].join('|') : '';
    if (w && sigW && w.dataset.done !== sigW) {
      var first = !w.dataset.done; w.dataset.done = sigW; var o = d.overall, top = (d.rivals || [])[0], mine = o.listed != null ? o.listed : (o.recommended || 0), lead = !top || mine >= top.count;
      w.innerHTML = lead ? t('s8_p3_top', { r: mine }) : t('s8_p3', { name: nm(top.google_name || top.name), c: top.count, r: mine, a: o.asked, miss: Math.max(0, o.asked - mine) });
      var v = $('why-viz');
      if (v && top) { var max = Math.max(top.count, mine, 1); v.innerHTML = '<div class="why__col"><i style="--h:' + Math.round(top.count / max * 100) + '%"></i><b class="num">' + top.count + '</b><span class="en">' + esc(nm(top.google_name || top.name)) + '</span><em>' + t('s8_them') + '</em></div><div class="why__col is-you"><i style="--h:' + Math.max(2, Math.round(mine / max * 100)) + '%"></i><b class="num">' + mine + '</b><span class="en">' + esc(nm(d.store.name)) + '</span><em>' + t('s8_you') + '</em></div>'; v.classList.remove('is-wait'); if (animate && K && first) { v.classList.remove('run'); setTimeout(function () { v.classList.add('run'); }, 60); } else v.classList.add('run'); }
      fixOrphans(w.parentNode);
    }
    var pn = $('pipe-asked'); if (pn && (d.overall || {}).asked && pn.dataset.to !== String(d.overall.asked) && pn.closest('.pipe__n').classList.contains('in')) { pn.dataset.to = d.overall.asked; pn.textContent = nfmt(d.overall.asked); var ds = pn.parentNode.querySelector('span:last-child'); if (ds) { ds.innerHTML = t('s2_d4', { n: nfmt(d.overall.asked), street: street() }); fixOrphans(pn.parentNode.parentNode); } }
    var sig = [(d.overall || {}).asked, (d.overall || {}).recommended, (d.score || {}).total, pfRows().filter(function (r) { return r.found; }).length, (d.rival_platforms || {}).name, LANG].join('|');
    ['result', 'wall', 'score', 'next'].forEach(function (id) {  // 已经放完的段：数据又变了（后台还在补问），原地换成新数字
      var el = document.getElementById('sc-' + id), sc = SCENES.filter(function (x) { return x.id === id; })[0];
      if (!el || window.__story.played.indexOf(id) < 0) return; if (!el.dataset.sig) { el.dataset.sig = sig; return; } if (el.dataset.sig === sig) return;
      el.insertAdjacentHTML('afterend', sc.html()); var nu = el.nextElementSibling; el.remove(); nu.dataset.sig = sig; fixOrphans(nu); settle(nu, sc);
    });
  }
  SCENES.push({ id: 'store', ready: function () { return !!S.d.store; }, html: function () {
    var d = S.d, s = d.store, p = d.portrait || {}, dishes = (p.dishes || []).slice(0, 3), qt = (p.quotes || [])[0], thumbs = (p.photos || []).slice(0, 3);
    var b = '<div class="store" data-r>';
    if (p.photo) {
      b += '<figure class="store__photo"><img class="store__main" src="' + esc(p.photo) + '" alt="" referrerpolicy="no-referrer" data-img>';
      if (thumbs.length === 3) b += '<div class="thumbs">' + thumbs.map(function (u) { return '<img src="' + esc(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-img>'; }).join('') + '</div>';
      b += '<figcaption>' + pic('google') + t('s1_photo') + '</figcaption></figure>';
    }
    b += '<div class="store__body"><h2 class="store__name">' + esc(s.name) + '</h2><p class="store__addr">' + esc(s.address || '') + '</p>';
    if (s.rating) b += '<p class="store__g">' + pic('google') + t('s1_rating', { r: s.rating, n: nfmt(s.review_count || 0) }) + '</p>';
    if (dishes.length) b += '<p class="store__lab">' + pic('google') + t('s1_dishes') + '</p><ul class="chips">' + dishes.map(function (x) {
      var zh = LANG === 'zh' && x.zh; return '<li>' + (zh ? '<b>' + esc(x.zh) + '</b><span class="en">' + esc(x.name) + '</span>' : '<b class="en">' + esc(x.name) + '</b>') + '<i>' + t('s1_mentions', { n: x.mentions }) + '</i></li>'; }).join('') + '</ul>';
    if (qt) b += '<blockquote class="quote"><p class="en">“' + esc(qt.text) + '”</p>' + (qt.zh && LANG === 'zh' ? '<p>' + esc(qt.zh) + '</p>' : '') + '</blockquote>';
    b += '</div><div class="hero__score" id="hero-score"><div class="go"><div class="go__bar"><i></i></div><span>' + t('s1_go') + '</span><button type="button" class="link" data-act="notme">' + t('s1_notme') + '</button></div></div></div>';
    var others = (d.candidates || []).filter(function (c) { return c.i !== d.picked; });
    if ((d.candidates || []).length > 1 && others.length) b += '<p class="aside" data-r>' + t('s1_branches') + others.map(function (c) { return '<button type="button" class="link" data-pick="' + c.i + '">' + esc(c.name) + '</button>'; }).join(' ') + '</p>';
    return '<section class="scene scene--hero" id="sc-store" data-scene="store">' + b + '</section>';
  }, play: function (el) { return reveal(el, '[data-r]', 220).then(function () { var g = el.querySelector('.go'); if (g) g.classList.add('run'); return sleep(3200); }); } });

  // 2 为什么要管这件事（反馈：这段有说服力，提到前面，用一段话加一张图告诉老板 AI 真的在影响生意）。道理先讲，这家店的数字等回答回来再填
  SCENES.push({ id: 'why', ready: function () { return !!S.d.store; }, html: function () {
    var b = '<div class="why" data-r><div class="why__txt"><p>' + t('s8_p1') + '</p><p class="why__big">' + t('s8_p2') + '</p><p id="why-data" class="why__data"></p><p class="why__geo">' + t('s8_p4') + '</p></div><div class="why__viz is-wait" id="why-viz" aria-hidden="true"><p class="why__wait"><span class="pulse"></span>' + t('s8_wait') + '</p></div></div>';
    return sec('why', '', t('s8_h'), '', b);
  }, play: function (el) { return reveal(el, '[data-r]', 220).then(function () { return sleep(3000); }); } });

  // 2 我们替你跑了四个地方
  SCENES.push({ id: 'pipe', ready: function () { return qs().length > 0; }, html: function () {
    var d = S.d, asked = (d.overall || {}).asked || (d.plan || {}).full_total || 32;
    var n = [d.store.review_count || 0, Math.max(pfRows().length, 26), ((d.grid || {}).cells || []).length || 9, asked];
    var icons = [pic('google'), pic('yelp') + pic('ubereats') + pic('eater'), glyph('map'), pic('chatgpt') + pic('google')];
    var b = '<ol class="pipe"><li class="pipe__line" aria-hidden="true"><i></i><b></b></li>' + [1, 2, 3, 4].map(function (i) {
      return '<li class="pipe__n"><span class="pipe__ic">' + icons[i - 1] + '</span><b class="num"' + (i === 4 ? ' id="pipe-asked"' : '') + ' data-to="' + n[i - 1] + '">·</b><strong>' + t('s2_n' + i) + '</strong><span>' + t('s2_d' + i, { n: nfmt(n[i - 1]), street: street() }) + '</span></li>'; }).join('') + '</ol>';
    return sec('pipe', '', t('s2_h'), t('s2_sub'), b);
  }, play: function (el) {
    var nodes = [].slice.call(el.querySelectorAll('.pipe__n')), line = el.querySelector('.pipe__line');
    return reveal(el, '[data-r]', 200).then(function () {
      line.classList.add('run'); var p = Promise.resolve();
      nodes.forEach(function (n, i) { p = p.then(function () { pipeTo(line, i / 3); n.classList.add('in'); return countUp(n.querySelector('.num'), +n.querySelector('.num').dataset.to, 700).then(function () { return sleep(350); }); }); });
      return p;
    });
  } });

  // 3 站路口：真地图底图（OpenStreetMap / CARTO 的瓦片，服务端存在本机），店和 9 个路口按经纬度落在图上
  var Z = 15, TILE = 256;  // 15 级：字大、路少，接近手机上看地图的样子
  function wx(lng) { return (lng + 180) / 360 * Math.pow(2, Z) * TILE; }
  function wy(lat) { var s = Math.sin(lat * Math.PI / 180); return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * Math.pow(2, Z) * TILE; }
  function mapView(g, store) {
    var xs = g.cells.map(function (c) { return wx(+c.lng); }), ys = g.cells.map(function (c) { return wy(+c.lat); });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var V = Math.max(x1 - x0, y1 - y0) * 1.42, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { V: V, left: cx - V / 2, top: cy - V / 2, sx: wx(+store.lng), sy: wy(+store.lat) };
  }
  SCENES.push({ id: 'grid', ready: function () { return !!S.d.grid || quickDone(); }, skip: function () { return !((S.d.grid || {}).cells || []).length; }, html: function () {
    var g = S.d.grid, st = S.d.store, n = g.cells.length, v = mapView(g, st), pct = function (px) { return (px / v.V * 100).toFixed(3) + '%'; }, tiles = '';
    for (var tx = Math.floor(v.left / TILE); tx <= Math.floor((v.left + v.V) / TILE); tx++) for (var ty = Math.floor(v.top / TILE); ty <= Math.floor((v.top + v.V) / TILE); ty++)
      tiles += '<img class="tile" src="/api/tile?z=' + Z + '&x=' + tx + '&y=' + ty + '" alt="" style="left:' + pct(tx * TILE - v.left) + ';top:' + pct(ty * TILE - v.top) + ';width:' + pct(TILE + 0.6) + '">';
    var pts = g.cells.map(function (c, i) {
      var cls = !c.rank ? 'r-out' : c.rank <= 3 ? 'r-top' : c.rank <= 10 ? 'r-mid' : 'r-low';
      return '<span class="pt ' + cls + '" data-i="' + i + '" style="left:' + pct(wx(+c.lng) - v.left) + ';top:' + pct(wy(+c.lat) - v.top) + '">' + (c.rank || '–') + '</span>';
    }).join('');
    var used = {}; g.cells.forEach(function (c) { used[!c.rank ? 'r-out' : c.rank <= 3 ? 'r-top' : c.rank <= 10 ? 'r-mid' : 'r-low'] = 1; });
    var lg = [['r-top', 's3_lg1'], ['r-mid', 's3_lg2'], ['r-low', 's3_lg3'], ['r-out', 's3_lg4']].filter(function (x) { return used[x[0]]; }).map(function (x) { return '<span><i class="' + x[0] + '"></i>' + t(x[1]) + '</span>'; }).join('');
    var zh = LANG === 'zh' && (((S.d.portrait || {}).dishes || []).filter(function (x) { return String(x.name).toLowerCase() === g.keyword; })[0] || {}).zh;
    var b = '<div class="map" data-r><div class="map__box"><div class="map__view" role="img" aria-label="' + t('s3_h', { kw: g.keyword, street: street() }) + '">' + tiles + '<span class="walker"></span>' + pts +
      '<span class="home" style="left:' + pct(v.sx - v.left) + ';top:' + pct(v.sy - v.top) + '"><b>' + t('s3_you') + '</b></span><span class="map__credit">' + t('map_credit') + '</span></div><p class="legend">' + lg + '</p><p class="note">' + t('s3_lg_note') + '</p></div>';
    b += '<div class="map__side"><p class="map__kw">' + pic('google') + '<span class="en">' + esc(g.keyword) + '</span>' + (zh ? '<span class="map__zh">' + esc(zh) + '</span>' : '') + '</p><div class="map__say" aria-live="polite"><p class="map__at"></p><p class="map__rank"></p><p class="map__first"></p></div>';
    b += '<p class="map__sum">' + (g.top3_cells ? t('s3_sum', { n: n, t: g.top3_cells }) : t('s3_sum_none', { n: n })) + (g.leader && g.leader[0] !== st.name ? ' ' + t('s3_leader', { name: g.leader[0], c: g.leader[1] }) : '') + '</p><p class="note">' + t('s3_src', { at: g.at || '' }) + '</p></div></div>';
    return sec('grid', '', t('s3_h', { kw: g.keyword, street: street() }), t('s3_sub', { n: n }), b);
  }, say: function (el, i, label) {
    var c = S.d.grid.cells[i], rk = el.querySelector('.map__rank');
    el.querySelector('.map__at').textContent = label || T.s3_at.replace('{i}', i + 1);
    rk.textContent = c.rank ? T.s3_rank.replace('{r}', c.rank) : T.s3_out; rk.className = 'map__rank ' + (c.rank && c.rank <= 3 ? 'good' : 'bad');
    el.querySelector('.map__first').textContent = label ? '' : c.rank === 1 ? T.s3_youfirst : c.top && c.top[0] ? T.s3_first.replace('{name}', c.top[0]) : '';
  }, near: function () {  // 离店最近的那个路口
    var g = S.d.grid, st = S.d.store, best = 0, bd = 1e18;
    g.cells.forEach(function (c, i) { var dd = Math.pow(wx(+c.lng) - wx(+st.lng), 2) + Math.pow(wy(+c.lat) - wy(+st.lat), 2); if (dd < bd) { bd = dd; best = i; } });
    return best;
  }, at: function (el, i) { var pt = el.querySelectorAll('.pt')[i], w = el.querySelector('.walker'); w.style.left = pt.style.left; w.style.top = pt.style.top; return w; },
  play: function (el) {
    var self = this, pts = [].slice.call(el.querySelectorAll('.pt')), w = el.querySelector('.walker'), view = el.querySelector('.map__view');
    function go(i) { var a = pts[0].getBoundingClientRect(), b2 = pts[i].getBoundingClientRect(); w.style.transform = 'translate(' + (b2.left - a.left) + 'px,' + (b2.top - a.top) + 'px)'; }
    w.style.left = pts[0].style.left; w.style.top = pts[0].style.top;
    return reveal(el, '[data-r]', 200).then(function () {
      view.classList.add('in'); var p = sleep(500);
      pts.forEach(function (pt, i) { p = p.then(function () { go(i); w.classList.add('on'); return sleep(i ? 520 : 200); }).then(function () { pt.classList.add('in'); self.say(el, i); return sleep(780); }); });
      return p.then(function () { var m = self.near(); go(m); self.say(el, m, T.s3_store); el.querySelector('.map__sum').classList.add('in'); el.querySelector('.home').classList.add('in'); return sleep(1200); });
    });
  }, still: function (el) { var m = this.near(); this.at(el, m).classList.add('on'); this.say(el, m, T.s3_store); el.querySelector('.map__view').classList.add('in'); } });

  // 4 问 AI（去掉了下面那排格子：下一段会说总数，这里只看一问一答）
  function listHtml(q, e) {  // 名单永远 5 行：你排在第 5 名以后，就前 3 名 + 一行小点点 + 你那一行；这样 8 个问题来回换，框不会忽大忽小
    var ok = okRuns(q, e[0]), st = engState(q, e[0]), ROWS = 5, li = [];
    var h = '<article class="ans ans--' + st + '"><h3>' + pic(e[2]) + e[1] + '</h3>';
    function row(n, name, cls) { return '<li class="' + (cls || '') + '"><span class="n">' + n + '</span><span class="en">' + esc(name) + '</span></li>'; }
    if (st === 'wait' || st === 'none') { li.push('<li class="is-note"><span class="n"></span><span>' + t(st === 'wait' ? 's4_wait' : 's4_none') + '</span></li>'); }
    else {
      var r = ok.filter(function (x) { return x['class'] === 'recommend'; })[0] || ok[0], pos = r['class'] === 'recommend' ? r.position : null, names = r.names || [];
      if (pos && pos > ROWS) { names.slice(0, 3).forEach(function (n2, i) { li.push(row(i + 1, n2)); }); li.push('<li class="is-gap" aria-hidden="true"><span class="n"></span><span>···</span></li>'); li.push(row(pos, names[pos - 1] || S.d.store.name, 'is-you')); }
      else if (pos) names.slice(0, ROWS).forEach(function (n2, i) { li.push(row(i + 1, n2, pos === i + 1 ? 'is-you' : '')); });
      else { names.slice(0, ROWS - 1).forEach(function (n2, i) { li.push(row(i + 1, n2)); }); li.push('<li class="is-absent"><span class="n"></span><span>' + t('s4_absent') + '</span></li>'); }
    }
    while (li.length < ROWS) li.splice(li.length - (st === 'no' ? 1 : 0), 0, '<li class="is-pad" aria-hidden="true"><span class="n"></span><span></span></li>');
    var v = st === 'yes' ? (function () { var r2 = ok.filter(function (x) { return x['class'] === 'recommend'; })[0]; return r2 && r2.position ? t('s4_yes', { p: r2.position }) : t('s4_yes0'); })() : st === 'no' ? t('s4_no') : '';
    return h + '<ol class="names">' + li.join('') + '</ol><p class="ans__v">' + (v || '&nbsp;') + '</p></article>';
  }
  function qaFrame(i) {
    var q = qs()[i];
    return '<div class="qa__ask"><p class="qa__who">' + t('s4_ask') + ' · ' + t('s4_q', { i: i + 1 }) + '</p><p class="bubble en" data-text="' + esc(q.text) + '"></p>' + '<p class="qa__zh">' + (q.text_zh && LANG === 'zh' ? esc(q.text_zh) : '&nbsp;') + '</p>' + '</div><div class="qa__ans">' + ENG.map(function (e) { return listHtml(q, e); }).join('') + '</div>';
  }
  function dots(el, i) { [].forEach.call(el.querySelectorAll('.qdot'), function (b, k) { b.className = 'qdot' + (k === i ? ' on' : k < i || el.classList.contains('done') ? ' seen' : ''); }); }
  function showQ(el, i, animate) {
    var fr = el.querySelector('.qa__frame'); fr.innerHTML = qaFrame(i); fr.classList.remove('out'); dots(el, i);
    var bub = fr.querySelector('.bubble'), items = [].slice.call(fr.querySelectorAll('.names li')), vs = [].slice.call(fr.querySelectorAll('.ans__v'));
    if (!animate) { bub.textContent = bub.dataset.text; items.concat(vs).forEach(function (x) { x.classList.add('in'); }); return Promise.resolve(); }
    return typeInto(bub, bub.dataset.text).then(function () { return sleep(250); }).then(function () {
      var p = Promise.resolve(); items.forEach(function (x) { p = p.then(function () { x.classList.add('in'); return sleep(70); }); });
      return p.then(function () { vs.forEach(function (x) { x.classList.add('in'); }); });
    });
  }
  SCENES.push({ id: 'qa', ready: function () { return qs().length > 0 && qReady(qs()[0]); }, html: function () {
    var n = qs().length;
    var b = '<div class="qa" data-r><div class="qa__frame"></div><p class="qdots">' + qs().map(function (q, i) { return '<button type="button" class="qdot" data-qi="' + i + '" aria-label="' + t('s4_q', { i: i + 1 }) + '"></button>'; }).join('') + '</p></div>';
    return sec('qa', '', t('s4_h'), t((S.d.questions || []).length > n ? 's4_sub_more' : 's4_sub', { n: n, nq: (S.d.questions || []).length }), b);
  }, play: function (el, tok) {
    return reveal(el, '[data-r]', 200).then(function () {
      var p = Promise.resolve(), n = qs().length;
      qs().forEach(function (q, i) { p = p.then(function () { return until(function () { return qReady(q); }, tok); }).then(function () { return showQ(el, i, true); }).then(function () { return sleep(i === n - 1 ? 1400 : 2300); }).then(function () { if (i < n - 1) { el.querySelector('.qa__frame').classList.add('out'); return sleep(180); } }); });
      return p.then(function () { el.classList.add('done'); dots(el, n - 1); });
    });
  }, still: function (el) { el.classList.add('done'); return showQ(el, 0, false); } });

  // 5 结果和对手
  SCENES.push({ id: 'result', ready: function () { return quickDone() && (S.d.overall || {}).asked > 0; }, html: function () {
    var d = S.d, o = d.overall, eg = d.engines || {}, me = d.store, mine = o.listed != null ? o.listed : o.recommended;
    var b = '<ul class="engs" data-r>' + ENG.map(function (e) { var v = eg[e[0]] || {}; return '<li class="' + (v.recommend ? 'yes' : 'no') + '">' + pic(e[2]) + '<span>' + t('s5_eng', { name: e[1], n: v.n || 0, r: v.recommend || 0 }) + '</span></li>'; }).join('') + '</ul>';
    var rows = (d.rivals || []).slice(0, 5).map(function (r) { return { nm: r.google_name || r.name, c: r.count, rating: r.rating, rc: r.review_count }; });
    if (rows.length) {
      rows.push({ nm: me.name, c: mine, you: true, rating: me.rating, rc: me.review_count }); rows.sort(function (a, b2) { return b2.c - a.c || (a.you ? -1 : 1); });
      var max = rows[0].c || 1;
      b += '<h3 data-r>' + t('s5_rivals') + '</h3><ol class="rank">' + rows.map(function (r) { return '<li class="' + (r.you ? 'is-you' : '') + '" data-r><span class="nm"><b class="en">' + esc(nm(r.nm)) + '</b>' + (r.rating ? '<small>' + pic('google') + t('s5_g', { r: r.rating, n: nfmt(r.rc || 0) }) + '</small>' : '') + '</span><span class="bar"><i style="--w:' + Math.max(r.c ? 3 : 0, Math.round(r.c / max * 100)) + '%"></i></span><span class="cnt">' + t('s5_times', { c: r.c }) + '</span></li>'; }).join('') + '</ol>';
    }
    var h = t('s5_h', { a: o.asked, r: '\u0001' }).replace('\u0001', '<em class="big num" data-to="' + o.recommended + '">' + o.recommended + '</em>');
    var nq = (d.questions || []).length, per = o.asked / (nq * ENG.length);
    return sec('result', '', h, t(per === Math.round(per) && per > 1 ? 's5_sub_even' : 's5_sub', { nq: nq, a: o.asked, per: per }), b);
  }, play: function (el) { var big = el.querySelector('h2 .big'); if (big) { big.textContent = '0'; setTimeout(function () { countUp(big, +big.dataset.to, 900); }, 250 * K); } return reveal(el, '[data-r]', 110).then(function () { return sleep(900); }); } });

  // 6 平台墙
  var CLS = [['口碑', 's6_c1'], ['品类', 's6_c7'], ['第三方', 's6_c2'], ['社交', 's6_c3'], ['外卖', 's6_c4'], ['团餐', 's6_c5']];
  function tile(r, rf) {
    var bad = r.found && (r.phone_ok === false || r.addr_ok === false), lab = bad ? t(r.phone_ok === false ? 's6_bad_phone' : 's6_bad_addr') : r.found ? (r.rating ? t('s6_stars', { r: r.rating }) : t(r.kind === 'mention' ? 's6_wrote' : 's6_on')) : t(r.kind === 'mention' ? 's6_nowrote' : 's6_off');
    return '<li class="pf ' + (bad ? 'bad' : r.found ? 'on' : 'off') + '" data-t>' + pic(r.icon || r.key) + '<b>' + esc(pname(r)) + '</b><span class="pf__s">' + mark(bad || !r.found ? 'x' : 'ok') + lab + '</span>' + (!r.found && rf[r.key] ? '<span class="pf__rv">' + t('s6_rv') + '</span>' : '') + '</li>';
  }
  SCENES.push({ id: 'wall', ready: function () { return pfReady() || (quickDone() && S.d.status === 'done'); }, skip: function () { return !pfReady(); }, html: function () {
    var d = S.d, rows = pfRows().concat(pfAll().filter(function (r) { return r.kind === 'bonus' && r.found; })), pos = pfAll().filter(function (r) { return r.kind === 'pos' && r.found; }), rp = d.rival_platforms, rf = (rp || {}).found || {}, a = rows.filter(function (r) { return r.found; }).length;
    var gap = rows.filter(function (r) { return !r.found && rf[r.key]; });
    var b = '<div class="vs" data-r><p class="vs__you"><b class="num" data-to="' + a + '">0</b><span>' + t('s6_you_lab') + '</span></p>';
    if (rp) { var bn = rows.filter(function (r) { return rf[r.key]; }).length + 1; b += '<p class="vs__rv"><b class="num" data-to="' + bn + '">0</b><span>' + t('s6_rival_lab', { name: nm(rp.name) }) + '</span></p>'; }
    b += '</div>';
    if (gap.length) b += '<div class="gap" data-r><p>' + t('s6_gap', { n: gap.length, name: nm(rp.name) }) + '</p><div class="gap__ic">' + gap.map(chip).join('') + '</div></div>';
    b += CLS.map(function (c) {
      var rs = rows.filter(function (r) { return r['class'] === c[0]; }); if (!rs.length) return '';
      return '<div class="wall"><p class="wall__h" data-r>' + t(c[1], { zh: ((d.platforms || {}).category || {}).zh, kw: ((d.platforms || {}).category || {}).kw }) + '<span>' + rs.filter(function (r) { return r.found; }).length + ' / ' + rs.length + '</span></p><ul>' + rs.map(function (r) { return tile(r, rf); }).join('') + '</ul></div>';
    }).join('');
    if (pos.length) b += '<div class="wall"><p class="wall__h" data-r>' + t('s6_c6') + '</p><ul>' + pos.map(function (r) { return tile(r, {}); }).join('') + '</ul></div>';
    var dk = {}; rows.forEach(function (r) { if (r.domain && !dk[r.domain.replace(/^guide\./, '')]) dk[r.domain.replace(/^guide\./, '')] = r; });  // 只认上面列出来的平台
    var six = d.team600;
    if (six && (six.sites || []).length) {  // 只有同事跑过 600 题的老客户有这块，数字来自同事的文件
      // 只列我们上面也查过的平台（有它自己的图标，「有没有你」用上面同一次检查的结果，口径一致）
      var li6 = six.sites.map(function (s) { var r = dk[s.domain] || dk[String(s.domain).replace(/^(ny|www|guide)\./, '')]; if (!r) return ''; return '<li class="' + (r.found ? 'on' : 'off') + '">' + pic(r.key) + '<b>' + esc(nm(r.name)) + '</b><span>' + t('s6_600_n', { c: s.count }) + '</span><em>' + t(r.found ? 's6_600_on' : 's6_600_off') + '</em></li>'; }).filter(Boolean).slice(0, 6).join('');
      if (li6) b += '<div class="cited cited--600" data-r><p>' + t('s6_600') + '</p><ul>' + li6 + '</ul></div>';
    } else {
      var cited = (d.sites || []).filter(function (s) { return s.kind !== 'rival' && s.kind !== 'own'; }).slice(0, 6);
      var li = cited.map(function (s) { var r = dk[s.domain] || dk[String(s.domain).replace(/^(ny|www)\./, '')]; return r ? '<li>' + pic(r.key) + '<b>' + esc(nm(r.name)) + '</b><span>' + t('s6_cited_n', { c: s.count }) + '</span></li>' : ''; }).join('');
      if (li) b += '<div class="cited" data-r><p>' + t('s6_cited') + '</p><ul>' + li + '</ul></div>';
    }
    b += '<p class="note" data-r>' + t('s6_note') + '</p>';
    return sec('wall', '', t('s6_h'), t('s6_sub', { n: rows.length }), b);
  }, play: function (el) {
    return reveal(el, 'h2[data-r], .scene__sub, .vs', 200).then(function () {
      [].forEach.call(el.querySelectorAll('.vs .num'), function (n) { countUp(n, +n.dataset.to, 900); });
      [].forEach.call(el.querySelectorAll('.wall__h, .gap'), function (x) { x.classList.add('in'); });
      return reveal(el, '[data-t]', 60);
    }).then(function () { return reveal(el, '.cited, .note', 260); }).then(function () { return sleep(1200); });
  } });

  // 7 诊断：每一项写成「你的问题是什么」，从丢分最多的排起
  function problems() {
    var d = S.d, sc = d.score || {}, rows = pfRows(), out = [];
    (sc.dims || []).forEach(function (x) {
      if (x.score == null) return; var f = x.facts || {}, p = { key: x.key, score: x.score, ok: x.score >= 80, title: '', desc: '', chips: '' };
      if (p.ok) { p.title = t('ok_' + x.key); out.push(p); return; }
      if (x.key === 'ai') { p.title = t('p_ai_t'); p.desc = t(f.rec ? 'p_ai_d' : 'p_ai0_d', f); }
      else if (x.key === 'map') { p.title = f.top3 ? t('p_map_t2', { miss: f.n - f.top3, n: f.n }) : t('p_map_t'); p.desc = t('p_map_d', f); }
      else if (x.key === 'platforms' || x.key === 'media') {
        var kind = x.key === 'platforms' ? 'page' : 'mention', miss = rows.filter(function (r) { return !r.found && (r.kind || 'page') === kind; });
        p.title = x.key === 'platforms' ? t('p_platforms_t', { k: miss.length }) : t('p_media_t'); p.desc = x.key === 'platforms' ? t('p_platforms_d') : t('p_media_d', { k: miss.length }); p.chips = miss.map(chip).join(''); p.k = miss.length;
      } else if (x.key === 'consistency') { p.title = t('p_consistency_t'); p.desc = t('p_consistency_d', { list: (f.bad || []).map(function (b) { return T.w_on.replace('{name}', nm(b.name)).replace('{what}', T['w_' + b.what]); }).join(LANG === 'en' ? ', ' : '、') }); }
      else if (x.key === 'reputation') { p.title = t(f.reviews < f.med_n ? 'p_reputation_t' : 'p_reputation_rt'); p.desc = t('p_reputation_d', { reviews: nfmt(f.reviews), rating: f.rating, med_n: nfmt(f.med_n) }); }
      else if (x.key === 'website') { p.title = t('p_website_t'); p.desc = [f.cited ? '' : t('p_website_cited'), f.schema ? '' : t('p_website_schema'), f.opens ? '' : t('p_website_down')].filter(Boolean).join(LANG === 'en' ? ' ' : ''); }
      if (!p.title) { p.title = esc(x.name); p.desc = esc(x.see); }
      out.push(p);
    });
    out.sort(function (a, b) { return a.score - b.score; });
    return out;
  }
  SCENES.push({ id: 'score', ready: scoreReady, html: function () {
    var d = S.d, sc = d.score, pv = d.prev_score, ps = problems(), bad = ps.filter(function (p) { return !p.ok; }), good = ps.filter(function (p) { return p.ok; });
    var band = sc.total < 50 ? 'low' : sc.total < 76 ? 'mid' : 'high';
    var same = !!(pv && pv.dims) && sc.dims.every(function (x) { return (x.score == null) === (pv.dims[x.key] == null); });
    var b = '<div class="scorehead"><div data-r class="gwrap">' + ring(sc.total) + '<em class="band band--' + band + '">' + t('s7_band_' + band) + '</em></div><div class="scoretext" data-r>';
    if (pv && pv.total != null) { var dd = sc.total - pv.total; b += '<p class="delta">' + t(!same ? 's7_prev_diff' : dd > 0 ? 's7_prev_up' : dd < 0 ? 's7_prev_down' : 's7_prev_same', { a: pv.total, b: sc.total, d: Math.abs(dd) }) + '</p>'; }
    if (bad.length) b += '<p class="lowest">' + t('s7_low_lab') + bad.slice(0, 2).map(function (p) { return '<span class="nw">' + p.title + '</span>'; }).join('') + '</p>';
    b += '<p>' + t('s7_lead') + '</p></div></div>';
    b += '<ol class="probs">' + bad.map(function (p, i) {
      return '<li class="prob ' + (p.score < 50 ? 'low' : 'mid') + '" data-r data-key="' + p.key + '"><span class="prob__n">' + (i + 1) + '</span><span class="prob__ic">' + glyph(p.key) + '</span><div class="prob__m"><h3>' + p.title + '</h3><p>' + p.desc + '</p>' + (p.chips ? '<p class="prob__chips">' + p.chips + '</p>' : '') + '</div><div class="prob__s"><span>' + t('s7_got', { n: p.score }) + '</span><div class="dim__bar"><i style="--w:' + Math.max(3, p.score) + '%"></i></div></div></li>'; }).join('') + '</ol>';
    if (good.length) b += '<div class="oks" data-r><p>' + t('s7_ok') + '</p><ul>' + good.map(function (p) { return '<li>' + glyph('ok') + p.title + '<span>' + t('s7_got', { n: p.score }) + '</span></li>'; }).join('') + '</ul></div>';
    if (bad.length) b += '<p class="fixline" data-r>' + t('s7_fix', { k: bad.length }) + '</p>';
    return sec('score', '', t('s7_h', { n: sc.total }).replace(/(\d+\s*分)/, '<span class="nw">$1</span>'), '', b);
  }, play: function (el) {
    return reveal(el, 'h2[data-r], .gwrap', 200).then(function () { el.querySelector('.gauge').classList.add('run'); return countUp(el.querySelector('.gauge .num'), S.d.score.total, 1300); })
      .then(function () { return reveal(el, '.scoretext, .prob, .oks, .fixline', 160); }).then(function () { return sleep(1200); });
  } });

  // 9 下一步：前三个问题各对一件事
  SCENES.push({ id: 'next', ready: scoreReady, html: function () {
    var g = S.d.grid || {}, rows = pfRows(), acts = problems().filter(function (p) { return !p.ok; }).slice(0, 3).map(function (p) {
      var ic = '';
      if (p.key === 'platforms') ic = rows.filter(function (r) { return !r.found && (r.kind || 'page') === 'page'; }).map(chip).join('');
      else if (p.key === 'media') ic = [['infatuation', 'The Infatuation'], ['eater', 'Eater'], ['timeout', 'Time Out']].map(function (x) { return chip({ key: x[0], name: x[1] }); }).join('');
      else if (p.key === 'consistency') ic = rows.filter(function (r) { return r.found && (r.phone_ok === false || r.addr_ok === false); }).map(chip).join('');
      else if (p.key === 'map' || p.key === 'reputation') ic = chip({ key: 'google', name: 'Google' });
      else if (p.key === 'ai') ic = chip({ key: 'google', name: 'Google' }) + chip({ key: 'yelp', name: 'Yelp' });
      return { t: t('a_' + p.key + '_t', { k: p.k }), d: t('a_' + p.key + '_d', { kw: g.keyword || '' }), ic: ic };
    });
    var b = '<ol class="todo">' + acts.map(function (a, i) { return '<li data-r><span class="todo__n">' + (i + 1) + '</span><div><h3>' + a.t + '</h3><p>' + a.d + '</p>' + (a.ic ? '<p class="todo__ic">' + a.ic + '</p>' : '') + '</div></li>'; }).join('') + '</ol>';
    b += '<p class="again" data-r><button type="button" class="link" data-act="reset">' + t('again') + '</button><button type="button" class="link" data-act="redo">' + t('redo') + '</button></p>';
    return sec('next', '', t(acts.length === 1 ? 's9_h1' : acts.length === 2 ? 's9_h2' : 's9_h'), '', b);
  }, play: function (el) { return reveal(el, '[data-r]', 220); } });

  // ---------- 导演：一段一段放 ----------
  function rail(cur) {
    var r = $('rail'); r.hidden = false;
    r.innerHTML = '<ol>' + SCENES.map(function (s) { var on = !!document.getElementById('sc-' + s.id); return '<li class="' + (s.id === cur ? 'now' : on ? 'done' : '') + '"><a ' + (on ? 'href="#sc-' + s.id + '"' : 'aria-disabled="true"') + '>' + t('nav_' + s.id) + '</a></li>'; }).join('') + '</ol>';
  }
  function waitNote(on) {
    var w = $('waiting'); if (!on) { if (w) w.remove(); return; }
    var txt = pfReady() || !quickDone() ? t('s4_waiting', { a: back(), b: qs().length * ENG.length || 16 }) : t('s6_waiting');
    if (!w) { w = document.createElement('p'); w.id = 'waiting'; w.className = 'waiting'; w.setAttribute('role', 'status'); $('stage').appendChild(w); }
    w.innerHTML = '<span class="pulse"></span>' + txt;
  }
  function settle(el, sc) {  // 直接摆成最终状态（静止模式、切换语言时用）
    [].forEach.call(el.querySelectorAll('[data-r],[data-t],.pipe__n,.pt,.map__sum,.home,.map__view'), function (x) { x.classList.add('in'); });
    el.classList.add('still', 'done'); [].forEach.call(el.querySelectorAll('.why__viz,.gauge'), function (x) { x.classList.add('run'); });
    [].forEach.call(el.querySelectorAll('.num[data-to]'), function (n) { n.textContent = nfmt(+n.dataset.to); });
    return sc.still ? sc.still(el) : null;
  }
  function play(instant) {
    var tok = ++S.token, stage = $('stage'); stage.innerHTML = ''; S.auto = !instant; window.__story = { played: [], done: false }; $('resume').hidden = true; chrome();
    var p = Promise.resolve();
    SCENES.forEach(function (sc) {
      p = p.then(function () {
        if (tok !== S.token) return;
        var iv = setInterval(function () { if (tok === S.token && !sc.ready()) waitNote(true); }, 900);
        return until(function () { return sc.ready(); }, tok).then(function () {
          clearInterval(iv); waitNote(false); if (tok !== S.token || (sc.skip && sc.skip())) return;
          stage.insertAdjacentHTML('beforeend', sc.html()); var el = document.getElementById('sc-' + sc.id); rail(sc.id); fixOrphans(el); lateFill(!instant);
          [].forEach.call(el.querySelectorAll('img[data-img]'), function (im) { im.onerror = function () { var f = im.closest('.thumbs') || im.closest('figure'); if (f) f.remove(); }; });
          if (!K || instant) { window.__story.played.push(sc.id); return settle(el, sc); }
          if (S.auto) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return sleep(350).then(function () { return sc.play(el, tok); }).then(function () { window.__story.played.push(sc.id); });
        });
      });
    });
    p.then(function () { if (tok === S.token) { lateFill(!instant); window.__story.done = true; rail(''); } });
  }
  function takeOver() { if (!S.auto || !S.d || !S.d.store || window.__story.done) return; S.auto = false; $('resume').hidden = false; }
  ['wheel', 'touchmove', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function (e) { if (ev === 'keydown' && !/^(Arrow|Page|Home|End| )/.test(e.key)) return; takeOver(); }, { passive: true }); });

  // ---------- 点击 ----------
  document.addEventListener('submit', function (ev) { if (ev.target.id !== 'f') return; ev.preventDefault(); var v = $('url').value.trim(); if (v) start(v, null, false); });
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-pick],[data-key],[data-act],[data-qi],#resume,#lang'); if (!b) return;
    if (b.id === 'lang') {  // 切换语言：已经在看结果的话，原地换成另一种语言的最终状态，不从头再放
      LANG = LANG === 'zh' ? 'en' : 'zh'; T = window.COPY[LANG]; try { localStorage.setItem('geo_lang', LANG); } catch (e) {}
      var y = window.scrollY; if (S.d && S.d.store) { play(true); setTimeout(function () { window.scrollTo(0, y); }, 60); } else entry(); return;
    }
    if (b.id === 'resume') { S.auto = true; b.hidden = true; var last = $('stage').lastElementChild; if (last) last.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (b.dataset.pick) return start(S.url || (S.d && S.d.input_url), +b.dataset.pick, false);
    if (b.dataset.key) { S.key = b.dataset.key; S.busy = true; entry(); return watch(); }
    if (b.dataset.qi != null) { var el = $('sc-qa'); if (el.classList.contains('done')) showQ(el, +b.dataset.qi, false); return; }
    var a = b.dataset.act;
    if (a === 'notme' || a === 'reset') { S.token++; clearInterval(S.timer); S.key = null; S.d = null; S.busy = false; S.url = ''; history.replaceState(null, '', location.pathname + location.search); $('resume').hidden = true; entry(); window.scrollTo(0, 0); var u = $('url'); if (u) u.focus(); return; }
    if (a === 'redo') return start(S.url || S.d.input_url, S.pick, true);
  });

  // ---------- 开场 ----------
  var m = /[#&]k=([^&]+)/.exec(location.hash);
  if (m) { S.key = decodeURIComponent(m[1]); S.busy = true; entry(); watch(); }
  else { entry(); if (DEMO) api('/api/list').then(function (j) { S.tried = (j.items || []).filter(function (x) { return x.status === 'done' || x.status === 'full_running'; }); entry(); }).catch(function () {}); }
})();
