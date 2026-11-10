import crypto from 'crypto';

export default async function handler(req, res) {
  const { message } = req.query;

  if (!message) {
    return res.status(400).json({ "response": "Message is required" });
  }

  // PHP-এর bin2hex(random_bytes(n)) এর হুবহু অল্টারনেটিভ
  const randomHex = (bytes) => crypto.randomBytes(bytes).toString('hex');

  const url = "https://android.chat.openai.com/backend-api/f/conversation";

  const mCookie = '__cflb=' + randomHex(20) + '; '
                + '__cfuvid=' + randomHex(24) + '; '
                + 'oai-sc=' + randomHex(64) + '; '
                + '__cf_bm=' + randomHex(48);

  const mHeaders = {
    'User-Agent': 'ChatGPT/1.2027.000 (Android 12; SM-F741N; build 27230000)',
    'Accept': 'text/event-stream,application/json',
    'Content-Type': 'application/json',
    'oai-device-id': randomHex(10),
    'Cookie': mCookie
  };

  // PHP-এর মতো করে হুবহু UUID জেনারেট করা
  const chunk1 = randomHex(4);
  const chunk2 = randomHex(2);
  const chunk3 = '4' + randomHex(2).substring(1);
  const chunk4 = (Math.floor(Math.random() * 4) + 8).toString(16) + randomHex(2).substring(1);
  const chunk5 = randomHex(6);
  const msgId = `${chunk1}-${chunk2}-${chunk3}-${chunk4}-${chunk5}`;

  const payload = {
    action: 'next',
    messages: [{
        id: msgId,
        author: { role: 'user' },
        content: { parts: [message], content_type: 'text' },
        status: 'finished_successfully',
        recipient: 'all',
        metadata: {
            is_visually_hidden_from_conversation: false,
            exclude_after_next_user_message: false,
            content_references: [],
            search_result_groups: [],
            search_queries: [],
            image_results: [],
            real_time_audio_has_video: false,
            dictation: false,
            image_gen_async: false,
            trigger_async_ux: false,
            writing_blocks: {}
        }
    }],
    model: 'auto',
    history_and_training_disabled: false,
    fork_from_shared_post: false,
    enable_message_followups: false,
    force_use_sse: true,
    force_use_search: null,
    force_paragen: false,
    supported_encodings: ['v1'],
    supports_buffering: true,
    timezone: 'Asia/Ho_Chi_Minh', // PHP-এর মতো সেম টাইমজোন
    timezone_offset_min: -420,
    system_hints: [],
    is_onboarding_conversation: false,
    stream: true
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: mHeaders,
      body: JSON.stringify(payload)
    });

    const textResponse = await response.text();
    let text = '';
    const lines = textResponse.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.indexOf('data:') !== 0) continue;

      const jsonStr = line.substring(5).trim();
      if (jsonStr === '[DONE]') continue;

      try {
        const data = JSON.parse(jsonStr);
        if (!data || typeof data !== 'object') continue;

        if (data.v && Array.isArray(data.v)) {
          const patches = data.v;
          for (let j = 0; j < patches.length; j++) {
            const patch = patches[j] || {};
            if (patch.p === '/message/content/parts/0' && patch.o === 'append' && typeof patch.v === 'string') {
              text += patch.v;
            }
          }
        }

        const part = data.v?.message?.content?.parts?.[0];
        if (text === '' && data.v?.message?.author?.role === 'assistant' && typeof part === 'string') {
          text = part;
        }
      } catch (e) {
        // Partial chunk JSON parse error ignore করা হলো
      }
    }

    // যদি Vercel-এর IP Cloudflare ব্লক করে দেয়, তাহলে 403 এরর দেখাবে
    if (!text && response.status !== 200) {
        text = `Error ${response.status}: API request blocked by Cloudflare/OpenAI from Vercel IP.`;
    }

    res.status(200).json({
      "Owner -> ": "@Arman",
      "message": message,
      "response": text.trim()
    });

  } catch (error) {
    res.status(500).json({ "response": "Backend Connection Error: " + error.message });
  }
}
