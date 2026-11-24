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

## 规矩

- 直接改、直接 push 到 `main` 就行。
- 别改 `data/` 里的数字。觉得数据不对，写在 issue 里。
- 每次 push 写清楚改了什么、为什么。
