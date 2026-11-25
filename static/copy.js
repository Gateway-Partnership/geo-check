/* 页面上的文字（报告页）。{花括号} 里的词会被换成数据里的数字或名字。
   现在只有中文。要加英文版，照这个结构再写一份，在 story.js 里按语言选。 */
window.COPY = {
  kLoading: '正在检查',
  kReport: 'AI 曝光报告',
  phaseFind: '在 Google 地图上找这家店',
  phaseWork: '读评价、查平台、搜地图，同时问 AI',
  phaseGot: '已收到 {n} 个 AI 回答',
  phaseScore: '正在算总分',
  ready: '报告好了，可以往下看了',
  notFound: '没找到这家店。演示版只带了 Bao Noodle House 和 Easy Joy。',
  netFail: '网络不太顺，再试一次。',
  band: { low: '要抓紧', mid: '一般', high: '不错' },

  /* 01 得分：一句人话。r = 红色强调，a = 橙色强调 */
  verdictLoved: '客人都夸你，<em class="r">AI 却不太认识你</em>。',
  verdictUnknown: 'AI 还<em class="r">不太认识</em>你的店。',
  verdictHigh: 'AI 已经认识你了，<em class="a">再补几处更稳</em>。',
  here: '你在这里',
  toPlan: '看先做哪几件事',

  /* 七个方面：tGood / tBad 是标题，good / bad 是带数字的一句话 */
  dims: {
    ai:          { to: 'r-ai',  tGood: 'AI 经常推荐你',           tBad: 'AI 很少推荐你',         good: '{asked} 次提问，AI 推荐你 {rec} 次',   bad: '{asked} 次提问，AI 只推荐你 {rec} 次' },
    media:       { to: 'r-src', tGood: '美食媒体写到了你',         tBad: '美食媒体和论坛没写到你', good: '{n} 个美食媒体和论坛，{found} 个写到你', bad: '{n} 个美食媒体和论坛，{miss} 个没写到你' },
    website:     { to: 'r-src', tGood: '官网 AI 读得懂',           tBad: '官网 AI 读不懂',         good: 'AI 回答时用到了你的官网',               bad: '你的官网，AI 一次都没用上' },
    map:         { to: 'r-map', tGood: '附近的人在地图上搜得到你', tBad: '地图上不容易搜到你',     good: '{n} 个路口，{top3} 个排进地图前 3',      bad: '{n} 个路口，{out} 个排不进地图前 3' },
    platforms:   { to: 'r-pf',  tGood: '该开的平台基本都开了',     tBad: '还有平台没开',           good: '{n} 个平台，{found} 个上面有你',         bad: '{n} 个平台，{miss} 个上面没有你' },
    consistency: { to: 'r-pf',  tGood: '各平台的电话、地址都对得上', tBad: '有平台的资料对不上',   good: '核对了 {n} 处电话和地址，都对得上',      bad: '有 {bad} 处电话或地址和 Google 不一样' },
    reputation:  { to: 'r-rep', tGood: '客人给的评分高',           tBad: '评价比常被推荐的店少',   good: 'Google 评分 {rating}，{reviews} 条评价', bad: '你有 {reviews} 条评价，常被推荐的店有 {med_n} 条' }
  },

  /* 02 AI 怎么说 */
  hAi: '{asked} 次提问，AI 说到你 <em class="{c}">{rec} 次</em>。',
  lAi: '每个点是一次提问，橙色的点是 AI 推荐了你。点一个问题，或者点一个点，看 AI 当时怎么回答。',
  qaAll: '看全部 {n} 个问题',
  qaLess: '收起',
  qcYes: '推荐了你 · 排第 {pos}',
  qcNo: '没提到你',
  qcMiss: '名单里没有你',
  qcMore: '还有 {n} 家',
  qcSrc: '它看了：',
  qcNoSrc: '这次没有列出它看了哪些网站',
  qcNth: '第 {r} 次回答，共 {n} 次',
  rankBehind: '同样这 {asked} 次回答，<em>排第一的对手被说到 {count} 次</em>，你 {rec} 次。',
  rankAhead: '同样这 {asked} 次回答，AI 说到你最多。',
  you: '你的店',

  /* 03 AI 看哪里。三种情况：你的官网一次没被读（Zero）、被读得比对手少（Less）、比对手多（Lead） */
  hSrcZero: '对手的官网，AI 读了 {rival} 次；<br><em class="r">你的官网，0 次</em>。',
  hSrcLess: '对手的官网，AI 读了 {rival} 次；<br><em class="r">你的官网，{own} 次</em>。',
  hSrcLead: '你的官网，AI 读了 <em class="a">{own} 次</em>，比对手的还多。',
  lSrc: 'AI 回答「去哪吃」之前，会先上网查资料。这次它一共查了 {total} 次，去了下面这几类网站。',
  srcKinds: { rival: '对手的官网', editorial: '美食媒体和榜单', claimable: '点评和外卖平台', own: '你的官网' },
  srcEg: '比如 {names}',
  srcTipN: '来自 {n} 个网站',
  srcWhy: { rival: '它们把招牌菜写在了自己的官网上，AI 读得到。', editorial: '这类网站写「哪几家最好吃」的榜单，AI 很爱看。', claimable: '这类平台的资料，你自己可以上去补。', own: 'AI 回答时用到了你的官网。', ownZero: 'AI 这次一次都没用到你的官网。' },
  takeZero: '对手把招牌菜、地址、营业时间写在了自己的官网上，AI 读得到。你的官网，AI 还读不到，所以它很少想起你。',
  takeLess: '你的官网 AI 读得到，但用得没有对手多。把招牌菜写得更清楚，AI 会更常用它。',
  takeLead: '你的官网 AI 读得懂，也常用。这一项你做得好。',
  takeGo: '看怎么改',
  sitesBtn: 'AI 最常看的 {n} 个网站',
  times: '{n} 次',
  siteYes: '上面有你', siteNo: '上面没有你', siteRival: '对手的官网', siteOwn: '你的官网',

  /* 04 地图 */
  hMapAll: '{n} 个路口，你<em class="a">都排进了前 3</em>。',
  hMapSome: '{n} 个路口，<em class="r">{out} 个你排不进前 3</em>。',
  lMap: '我们站在你店周围 {n} 个路口，各搜了一次 Google 地图「{kw}」。',
  cell: '路口 {i}', cellHome: '路口 {i} · 你店门口',
  cellRank: '你排第 <em class="{c}">{rank}</em>', cellOut: '<em class="no">没搜到你</em>',
  homeTag: '你的店在这里',

  /* 05 平台 */
  hPfMiss: '<em class="r">{x} 个平台</em>，对手有，你没有。',
  hPfOk: '该开的平台，你<em class="a">基本都开了</em>。',
  lPf: '查了 {n} 个平台：有你 {y} 个，对手有你没有 {x} 个，都没有 {z} 个。先补红色的。',
  lPfRival: '这里的对手，是 AI 推荐最多的那家店（{rival}）。',
  pfX: '对手有你没有', pfY: '有你', pfZ: '都没有',
  chipX: '对手有，你没有', chipY: '有你', chipZ: '你和对手都没有',

  /* 05 下半：资料核对 */
  napOkH: '这些平台上的电话和地址，都和 Google 上一样。',
  napOkP: '核对了 {n} 处。AI 在各处看到的说法一致，就更敢推荐你。',
  napBadH: '有 {n} 处资料，和 Google 上不一样。',
  napBadP: '核对了 {n} 处。AI 看到两个说法，不知道该信哪个，就不敢推荐。先把下面这几处改掉。',
  napFix: '去 {name} 把{what}改成和 Google 一样：{right}',
  napRef: '以 Google 上的为准',
  napPhone: '电话', napAddr: '地址', napHours: '营业时间', napDiff: '不一样',
  /* 05 下半：营业时间对照 */
  days: [['Monday', '周一'], ['Tuesday', '周二'], ['Wednesday', '周三'], ['Thursday', '周四'], ['Friday', '周五'], ['Saturday', '周六'], ['Sunday', '周日']],
  hrsOkH: '营业时间：核对了 {n} 个平台，都和 Google 上一样。',
  hrsBadH: '营业时间有 {n} 处，和 Google 上不一样。',
  hrsBadP: '客人照着平台上的时间来，可能扑空。去平台上改成和 Google 一样。',
  hrsOn: '平台上写', hrsG: 'Google 上是',
  hrsRest: '其余 {n} 个平台和 Google 一样',
  hrsClosed: '休息', hrs24: '24 小时',
  hrsSample: '示例数据',
  hrsSampleNote: '后台现在只核对了电话和地址，还没有营业时间。这里先用示例数据演示，不是这家店的真实结果。',
  napDemo: '这是「资料对不上」的示例样子（网址里带了 ?demo=bad），不是这家店的真实结果。',

  /* 06 口碑 */
  hRepFew: '分数你不输，<em class="r">评价他们更多</em>。',
  hRepOk: '评分和评价数，你<em class="a">都不输</em>。',
  lRep: '下面几家，是 AI 最常推荐的对手。AI 更敢推荐评价多的店。',
  repStars: 'Google 评分', repCount: 'Google 评价数',
  repTop: '最高', repTimes: '评价最多的对手，是你的 <em>{x} 倍</em>。', repLead: '你的评价数不比他们少。',
  repSim: '对手的评分和评价数还没查到，这里先用示例数字。',

  /* 07 总结和下一步 */
  hSum: '你有 <em class="a">{g} 个长处</em>，最该补的是<em class="r">{bad}</em>。',
  hSumAllGood: '七个方面你<em class="a">都做得不错</em>。',
  sumGood: '做得好的', sumBad: '需要改进的', sumN: '{n} 项', sumOrder: '按影响大小排', sumNone: '这次没有发现明显的短板。',
  short: { ai: 'AI 推荐', media: '媒体', website: '官网', map: '地图', platforms: '平台', consistency: '资料', reputation: '评价数' },
  hNext: '先做这 {n} 件事，预计能到 <em class="a">{to} 分</em>。',
  hNextKeep: '现在要做的，是<em class="a">守住这个分数</em>。',
  why: '为什么', how: '怎么做', gain: '预计 +{n} 分', keep: '守住分数',
  projNow: '现在 {n} 分。勾选右边的事试试。', projGain: '现在 {n} 分，做完预计多 <em>{g} 分</em>。',
  ctaToast: '这里以后接预约表单'
};
