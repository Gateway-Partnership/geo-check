# GEO 查询演示页（只读演示版）

顾客问 AI「去哪吃」时，AI 推不推荐这家店。这一页把测好的结果讲给店老板看。
这里只带两家已经测好的店，数据都在仓里，不连后台、不花钱：

- Bao Noodle House（包之面）：`#k=baonoodlehouse.com`
- Easy Joy：`#k=easyjoybuffet.com`

## 先看这里

11-23 的前端反馈会议纪要：[docs/meeting-notes-2026-11-23.md](docs/meeting-notes-2026-11-23.md)

## 本机预览

```bash
python3 serve.py
```

然后打开 http://localhost:8000/#k=baonoodlehouse.com 。只需要 Python 3，不用装别的。

## 改哪里

| 文件 | 管什么 |
|---|---|
| `index.html` | 页面骨架 |
| `static/story.css` | 样式 |
| `static/story.js` | 页面逻辑、动画、每一屏怎么播 |
| `static/copy.js` | 页面上的文字 |
| `static/assets/` | 字体、平台 logo |
| `data/<店>/result.json` | 测出来的结果（**别改**，这是真实测量数据） |
| `api/check.js` · `vercel.json` · `serve.py` | 线上和本机怎么取数据（一般不用动） |

## 注意：这是给外人看的版本

这份去掉了品牌名，也去掉了页面最后的「联系我们」那一节。会议上说了这一节以后要留（放名字、logo、二维码、Instagram 等），所以做新版时请自己把它加回去。

## 怎么开始、怎么交

1. 点右上角 **Fork**，复制一份到你自己的账号下。
2. clone 你那份，按上面「本机预览」跑起来。
3. 在你那份里随便改、随便 push。
4. 改好一版后，点 **Contribute → Open pull request** 发过来，写清楚改了什么、为什么。

## 规矩

- 别改 `data/` 里的数字。觉得数据不对，写在 issue 里。
- 每次 push 写清楚改了什么、为什么。
- 截止：周三（11 月 26 日）晚上。质量第一，改到「这版能拿去 pitch」为止。
