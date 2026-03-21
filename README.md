# AI Voice Agent – Riverwood Estate

Production-oriented AI voice agent for **Riverwood Estate** (Riverwood Projects LLP): text chat with streaming + ElevenLabs TTS, and **live voice calls** via **VAPI** (Web SDK) with ElevenLabs + OpenAI configured in the VAPI dashboard.

**Agent:** Priya — warm, conversational, optimized for **spoken** output (pauses, fillers, natural rhythm).

---

## Evaluation focus (current rubric)

| Criterion | Weight | Implementation |
|-----------|--------|----------------|
| **Voice realism** | **70%** | `api/_lib/voice-prompt.js` + VAPI inline assistant (`js/agent-vapi.js`): thinking time, fillers, `...` pauses, anti-list rules. ElevenLabs voice settings tuned for warmth. |
| **Latency** | **15%** | SSE on `/api/chat-stream`, `gpt-4o-mini`, Eleven turbo / multilingual TTS; VAPI streaming + balanced `optimizeStreamingLatency`. |
| **Cost efficiency** | **15%** | Mini model, response cache, per-session rate limits; optional Redis for scale. |

`GET /api/health` returns `evaluation_criteria`, `text_chat_ready`, `voice_call_ready`, and `production_stack`.

---

## Stack (production)

| Need | Env / config |
|------|----------------|
| Text chat (LLM) | `OPENAI_API_KEY` (`sk-` or `sk-proj-`) |
| Text chat (TTS) | `ELEVENLABS_API_KEY` + optional `ELEVENLABS_VOICE_ID*` — **required** unless `ELEVENLABS_OPTIONAL=true` (local dev only) |
| Voice call page | `VAPI_PUBLIC_KEY`, `VAPI_ASSISTANT_ID` — assistant in VAPI must use **ElevenLabs** voice + **OpenAI** model |
| Memory / scale (recommended) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

See `.env.example` for the full template.

---

## Quick start

```bash
git clone <repo-url>
cd <project-folder>
npm install
cp .env.example .env
# Edit .env with your keys
npm run dev
```

Open **http://localhost:3000** (or your `PORT`).

- **Landing:** `index.html`
- **Text chat:** `agent.html`
- **Voice call:** `agent-vapi.html` (requires VAPI keys + browser mic)

> Use an HTTP server URL — **not** `file://` — so `/api/health` and `/api/chat-stream` work.

**Vercel:** `npx vercel` and set the same env vars in the project dashboard. For local Vercel parity: `npx vercel dev`.

---

## VAPI Web SDK (voice page)

`agent-vapi.html` loads `@vapi-ai/web` from jsDelivr ESM. The bundle’s default export is a **module namespace**; the client class is on `.default` — this is handled in the inline script so `new Vapi(key)` works.

**If the browser shows `POST …/call/web` → 400:** VAPI rejected the payload. Common causes: `assistantOverrides` didn’t match the saved assistant, or the dashboard uses a **different** model id than `gpt-4o-mini`. This repo’s `js/agent-vapi.js` uses **`temperature: 0.5`** and **`maxTokens: 250`** to match a typical **GPT 4o Mini** assistant in the dashboard; change `VAPI_MODEL_SETTINGS` there if your assistant differs.

**Deepgram Flux:** If the transcriber uses **Flux General English**, VAPI’s UI recommends disabling the conflicting **Smart Endpointing** plan under **Advanced → Start Speaking Plan** so Flux end-of-turn detection works.

Set `VAPI_ASSISTANT_ID` to your assistant UUID (e.g. from the Assistants list). The app auto-retries once with **`firstMessage` only** if the first start looks like a 400.

**Dashboard vs inline voice/STT:** When `VAPI_ASSISTANT_ID` is set, the browser sends **minimal** `assistantOverrides` (`firstMessage` + `model` only) so `POST …/call/web` stays valid — **ElevenLabs voice and transcriber/STT** (including multilingual or Flux language) must be tuned in the **VAPI dashboard** for that assistant. If you omit `VAPI_ASSISTANT_ID`, the app uses an **inline assistant** from `js/agent-vapi.js` with full `voice` + `transcriber` blocks for local/dev tuning without changing dashboard settings.

---

## API endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Config flags, rubric JSON, `vapiPublicKey` / `vapiAssistantId` for the voice page |
| `/api/chat` | POST | Chat + optional TTS (ElevenLabs when configured) |
| `/api/chat-stream` | POST | JSON or **SSE** stream (`stream: true`) |
| `/api/transcribe` | POST | Whisper (multipart audio) |

---

## Project structure

```
.
├── api/
│   ├── _lib/           # redis, cache, tts, voice-prompt, env helpers
│   ├── chat.js
│   ├── chat-stream.js
│   ├── health.js
│   ├── transcribe.js
│   └── vapi/           # webhook, outbound helpers
├── css/
├── js/
│   ├── agent.js        # Text chat + SSE + health bootstrap
│   └── agent-vapi.js   # VAPI voice call UI
├── server.js           # Local static + /api/* (mirrors serverless handlers)
├── vercel.json
├── .env.example
└── ARCHITECTURE.md     # Deeper design + scale notes
```

---

## Features

- **Conversation memory:** Redis when configured; in-memory fallback with shorter retention
- **Rate limiting:** Per session (see `api/_lib/redis.js`)
- **Response caching:** Common greetings / FAQs (`api/_lib/cache.js`)
- **Languages:** English, Hindi (Devanagari), Marathi (Devanagari)

---

## License / use

Built for the Riverwood Projects LLP internship challenge.
