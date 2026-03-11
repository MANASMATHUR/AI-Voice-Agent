# Riverwood Projects LLP – AI Voice Agent Prototype

AI Systems Internship Challenge 2024: production-ready prototype for Riverwood Estate (DDJAY, Sector 7 Kharkhauda). The agent greets in Hindi or English, accepts voice or text, uses an LLM with **conversation context** (remembers previous messages), and speaks replies via browser TTS. Deployable on **Vercel** with a Node.js serverless API.

## Deploy on Vercel

1. Push this repo to GitHub and import the project in [Vercel](https://vercel.com).
2. In **Project → Settings → Environment Variables**, add:
   - `OPENAI_API_KEY` = `sk-your-openai-key`
3. Deploy. The site will serve the landing page and agent; `/api/chat` and `/api/health` run as serverless functions.

No build step required. Static files (HTML, CSS, JS) and the `api/` folder are used as-is.

## Local development

- **Option A – Vercel CLI:** `npm i -g vercel && vercel dev` (uses your Vercel env).
- **Option B – Static only:** Serve the repo root with any static server (e.g. Live Server). Set `OPENAI_API_KEY` in Vercel and use the deployed `/api` for chat, or run a local proxy to Vercel.

## What’s included

| Item | Description |
|------|-------------|
| **Landing** | Dark theme, Sora + DM Sans, red accent, gradient. “View Challenge” / “Learn More”. |
| **Agent** | Chat UI; text + voice input (Web Speech API); **conversation context** (last 10 messages sent to the API so the agent remembers the dialogue). Browser TTS for replies. |
| **API** | Node.js serverless: `POST /api/chat` (OpenAI, minimal tokens), `GET /api/health`. |

## Token usage (minimal)

- Short system prompt; only the **last 10 messages** sent to the model for context.
- `gpt-4o-mini`, `max_tokens: 100`, so each reply is cheap and fast.

## Tech stack

- **Frontend:** HTML, CSS, JS. Voice input via Web Speech API; voice output via browser speech synthesis.
- **Backend:** Node.js (Vercel serverless in `api/`). OpenAI only; no ElevenLabs required.

## Code standards

- No `localhost` in frontend; API base is `window.location.origin` for production.
- Defensive checks (elements exist, trim input, catch fetch errors).
- CORS and security headers in `vercel.json`.
- Input validation and token/conversation capping in the API.

---

**Contact:** sanyam@riverwoodindia.com | 8572070707
