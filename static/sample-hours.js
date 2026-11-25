/* 营业时间核对的【示例数据】。不是测出来的，只用来演示「营业时间对照」这个模块长什么样。
   data/ 里的真实数据没有动。

   为什么要有这个文件：后台现在只核对了各平台的电话和地址，还没有营业时间。
   等后台有了，在 result.json 的 platforms.rows[] 每一行加一个 hours 字段就行，格式和 store.hours 一样：
     "hours": [{ "day": "Monday", "hours": "11 AM–10:30 PM" }, ...]
   页面看到真实的 hours 就会用真实的，这个文件可以直接删掉。

   写法：
     google     这家店在 Google 上的营业时间。只有 result.json 里 store.hours 是空的时候才用。
     platforms  哪些平台核对了营业时间。{} = 和 Google 完全一样；写了某一天 = 那一天和 Google 不一样。 */
window.SAMPLE_HOURS = {
  'baonoodlehouse.com': {
    platforms: {
      yelp: { Thursday: '11 AM–10:30 PM' },                              // Google 上周四休息，Yelp 上写着营业
      doordash: { Friday: '11 AM–10 PM', Saturday: '11 AM–10 PM' },      // 周五周六比 Google 上早关一个半小时
      ubereats: {},
      grubhub: {},
      tripadvisor: {}
    }
  },
  'easyjoybuffet.com': {
    google: { Monday: '10 AM–10:30 PM', Tuesday: '10 AM–10:30 PM', Wednesday: '10 AM–10:30 PM', Thursday: '10 AM–10:30 PM', Friday: '10 AM–10:30 PM', Saturday: '10 AM–10:30 PM', Sunday: '10 AM–10:30 PM' },
    platforms: {
      yelp: { Friday: '10 AM–11:30 PM', Saturday: '10 AM–11:30 PM' },    // 周五周六比 Google 上晚关一小时
      grubhub: { Monday: 'Closed' },                                     // Google 上周一营业，Grubhub 上写着休息
      doordash: {},
      seamless: {},
      tripadvisor: {}
    }
  }
};
