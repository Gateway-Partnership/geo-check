"""本机预览：python3 serve.py → 打开 http://localhost:8000/#k=baonoodlehouse.com
模仿 vercel.json 的两条改写 + api/check.js，只用 Python 标准库。"""
import http.server, json, os, re, urllib.parse
ROOT = os.path.dirname(os.path.abspath(__file__))
KEYS = {"baonoodlehouse.com", "easyjoybuffet.com"}
ALIAS = {"bao noodle house": "baonoodlehouse.com", "包之面": "baonoodlehouse.com", "easy joy": "easyjoybuffet.com", "easy joy buffet": "easyjoybuffet.com", "意中人": "easyjoybuffet.com"}

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = dict(urllib.parse.parse_qsl(u.query))
        if u.path == "/api/result" and re.fullmatch(r"[A-Za-z0-9._-]+", q.get("key", "")):
            self.path = f"/data/{q['key']}/result.json"
        elif u.path == "/api/tile" and all(q.get(c, "").isdigit() for c in "zxy"):
            self.path = f"/tiles/{q['z']}/{q['x']}/{q['y']}.jpg"
        return super().do_GET()
    def do_POST(self):
        n = int(self.headers.get("content-length") or 0)
        try: url = (json.loads(self.rfile.read(n) or b"{}").get("url") or "").strip()
        except Exception: url = ""
        k = ALIAS.get(url.lower()) or re.sub(r"^www\.", "", urllib.parse.urlparse(url if "://" in url else "https://" + url).hostname or "")
        body = {"key": k, "status": "done", "cached": True} if k in KEYS else {"error": "演示版只带了 Bao Noodle House 和 Easy Joy。"}
        b = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(200); self.send_header("content-type", "application/json; charset=utf-8"); self.send_header("content-length", str(len(b))); self.end_headers(); self.wfile.write(b)

if __name__ == "__main__":
    print("打开 http://localhost:8000/#k=baonoodlehouse.com  或  http://localhost:8000/#k=easyjoybuffet.com")
    http.server.ThreadingHTTPServer(("127.0.0.1", 8000), H).serve_forever()
