# NSFWLover API Proxy

Cloudflare Workers 逆向 nsfwlover.com /api/image，免費 NSFW AI 生圖代理。

## 快速啟動

1. Clone: `git clone <this-repo>`
2. Token: 登入 nsfwlover.com > F12 > Application > Cookies > 複製 `__Secure-next-auth.session-token`
3. `wrangler secret put NSFWLOVER_TOKEN`
4. KV: `wrangler kv:namespace create RATE-LIMIT` > 替換 toml ID
5. `wrangler deploy`
6. 測試: `https://your-worker.workers.dev/test`

## API

POST `/`
```json
{
  "prompt": "nsfw girl",
  "steps": 30
}
