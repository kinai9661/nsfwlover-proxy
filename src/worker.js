export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 靜態檔案與測試頁 (/test)
    if (url.pathname === '/test' || url.pathname.endsWith('.html')) {
      const assetResp = await env.ASSETS.fetch(`${new URL(request.url).origin}${url.pathname}`);
      return assetResp || new Response('Not found', { status: 404 });
    }

    // CORS 與方法檢查
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST only' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 速率限制 (KV)
    const clientIP = request.headers.get('CF-Connecting-IP') || 'anon';
    const rateKey = `rate:${clientIP}`;
    let rateData = await env.KV.get(rateKey, { type: 'json' });
    if (!rateData) rateData = { count: 0, reset: Date.now() };
    if (Date.now() - rateData.reset > 60000) {
      rateData = { count: 0, reset: Date.now() };
    }
    if (rateData.count >= 10) {
      return new Response(JSON.stringify({ error: 'Rate limited (10/min)' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    rateData.count++;
    env.KV.put(rateKey, JSON.stringify(rateData), { expirationTtl: 70 });

    // API 請求
    const body = await request.json();
    const target = env.TARGET_API;

    const resp = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `__Secure-next-auth.session-token=${env.NSFWLOVER_TOKEN}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Origin': 'https://www.nsfwlover.com',
        'Referer': 'https://www.nsfwlover.com/nsfw-ai-image-generator',
      },
      body: JSON.stringify({
        prompt: body.prompt || '',
        negative_prompt: body.negative_prompt || '',
        steps: body.steps || 30,
        width: body.width || 512,
        height: body.height || 512,
        seed: body.seed || -1,
        ...(body.image && { image: body.image })  // img2img
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: `Upstream: ${errText}` }), {
        status: resp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await resp.json();
    const openAIResp = {
      data: [{
        b64_json: data.image || data.url || '',
        revised_prompt: body.prompt,
        info: data.info || {}
      }]
    };

    const finalResp = new Response(JSON.stringify(openAIResp), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    // 快取 5 分
    ctx.waitUntil(caches.default.put(request.url, finalResp.clone()));
    return finalResp;
  }
};
