# AI Voice Agent

A web-based AI voice agent that greets users in Hindi or English, accepts voice or text input, and replies using an LLM with conversation context. Voice output uses the browser’s built-in speech. Designed to run on **Vercel** with a Node.js serverless API and a single **OpenAI** API key.

---

## Features

- **Dual input:** Type in the text box or hold the Voice button to speak (Web Speech API).
- **Context-aware replies:** The last 10 messages are sent to the model so the agent keeps the conversation coherent.
- **Spoken replies:** Every agent message is read aloud via the browser’s text-to-speech.
- **Minimal tokens:** Short system prompt, capped context, and `max_tokens: 100` for low cost and fast responses.

---

## Prerequisites

- **Node.js** 18+
- **OpenAI API key** (starts with `sk-`)

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd <project-folder>
npm install
```

### 2. Environment

Copy the example env file and add your OpenAI key:

```bash
cp .env.example .env
```

Edit `.env` and set:

```
OPENAI_API_KEY=sk-your-actual-key
```

### 3. Deploy on Vercel (recommended)

1. Push the repo to GitHub and [import it in Vercel](https://vercel.com/new).
2. In the project **Settings → Environment Variables**, add:
   - **Name:** `OPENAI_API_KEY`  
   - **Value:** your OpenAI API key
3. Deploy. Vercel will serve the static site and the `/api` serverless functions.

No build step is required.

### 4. Run locally (optional)

- **With Vercel CLI:**  
  `npx vercel dev`  
  Uses your Vercel env; frontend and `/api/chat`, `/api/health` work locally.

- **Static only:**  
  Serve the project root with any static server (e.g. VS Code Live Server, `npx serve .`).  
  For chat to work, either use a deployed Vercel URL or run `vercel dev` so `/api` is available.

---

## Project Structure

```
.
├── api/
│   ├── chat.js      # POST /api/chat – LLM replies (OpenAI)
│   └── health.js    # GET /api/health – config check
├── css/
│   └── style.css    # Global styles
├── js/
│   └── agent.js     # Agent page: chat UI, voice in/out, context
├── index.html       # Landing page
├── agent.html       # Voice agent page
├── .env.example     # Env template (copy to .env)
├── vercel.json      # Headers and config
└── package.json     # Dependencies (openai), "type": "module"
```

---

## API

| Endpoint        | Method | Description |
|----------------|--------|-------------|
| `/api/health`   | GET    | Returns `{ status, openai_configured }`. No secrets. |
| `/api/chat`     | POST   | Body: `{ "messages": [ { "role": "user" \| "assistant", "content": "..." } ] }`. Returns `{ "reply": "..." }`. |

The backend sends the **last 10 messages** plus a short system prompt to OpenAI (`gpt-4o-mini`, `max_tokens: 100`).

---

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript. Voice input via Web Speech API; voice output via `speechSynthesis`.
- **Backend:** Node.js (Vercel serverless). Single dependency: `openai`.
- **LLM:** OpenAI `gpt-4o-mini`. No ElevenLabs, Twilio, or VAPI required.

---

## Configuration

| Variable          | Required | Description |
|-------------------|----------|-------------|
| `OPENAI_API_KEY`  | Yes      | OpenAI API key (starts with `sk-`). |

Optional variables (e.g. for local Python backend or future use) can be added to `.env` as in `.env.example`.

---

## License

Use and modify as needed for your project.
