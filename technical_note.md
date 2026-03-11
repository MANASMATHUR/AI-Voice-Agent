# Technical Note – Riverwood AI Voice Agent

Short architecture description and answer to the technical thinking question for the submission.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (User)                                                  │
│  • Landing page (index.html) → Agent page (agent.html)           │
│  • Voice input: Web Speech API (no server)                       │
│  • Voice output: Browser speechSynthesis (no server)             │
│  • Conversation state: in-memory array (last N messages sent)   │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Vercel (Serverless)                                             │
│  • Static: HTML, CSS, JS                                         │
│  • GET  /api/health  → reports OPENAI_API_KEY configured         │
│  • POST /api/chat    → body: { messages: [...] }                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  OpenAI API                                                      │
│  • model: gpt-4o-mini                                            │
│  • input: system prompt + last 10 messages (context)             │
│  • output: single reply (max 100 tokens)                          │
└─────────────────────────────────────────────────────────────────┘
```

- **Single API key:** Only `OPENAI_API_KEY` is required. No ElevenLabs, Twilio, or VAPI.
- **Context:** The frontend sends the full conversation; the backend trims to the last 10 messages before calling OpenAI so the agent remembers the dialogue while keeping token usage low.
- **Voice:** Input = Web Speech API (browser). Output = browser TTS. No server-side voice APIs.

---

## Technical Thinking Question

**If Riverwood needs to call 1000 customers every morning, how would you design the infrastructure to handle these calls efficiently?**

### Design (high level)

1. **Queue and workers**
   - Put “call tasks” (customer id, phone number, script/context) in a **queue** (e.g. Redis/Bull, or SQS).
   - **Worker pool** (e.g. 10–20 concurrent workers) pulls tasks, runs the voice flow for one customer, then fetches the next. This caps concurrent outbound calls and stays within provider limits.

2. **Voice pipeline per call**
   - **Outbound:** Twilio (or VAPI) to dial the customer.
   - **STT:** Twilio/VAPI stream → Whisper or provider STT.
   - **LLM:** Same as today (OpenAI, last N turns) for replies.
   - **TTS:** ElevenLabs (or PlayHT) for natural voice; stream audio back to the call.
   - **Recording:** Store call audio and/or transcript for compliance and quality.

3. **Scaling and reliability**
   - Run workers on a small cluster (e.g. 2–4 nodes) or serverless (e.g. Lambda + SQS) so you can scale worker count with queue depth.
   - Retries with backoff for failed calls; dead-letter queue for repeated failures.
   - Rate limits: respect Twilio/concurrent-call limits and OpenAI/Whisper/ElevenLabs rate limits (e.g. batch or throttle).

4. **Scheduling**
   - “Every morning” = a cron (e.g. 9 AM) that enqueues 1000 tasks (one per customer). Workers process the queue over the next 1–2 hours so you don’t burst 1000 simultaneous calls.

### Estimated infrastructure cost per 1000 calls (rough)

| Component | Assumption | Est. cost (USD) |
|-----------|------------|------------------|
| **Twilio (outbound voice)** | ~3 min/call, 1000 calls | ~$50–80 |
| **OpenAI (GPT-4o-mini)** | ~500 input + 100 output tokens/call, 10 turns | ~$2–5 |
| **OpenAI Whisper (STT)** | ~3 min audio/call | ~$15–20 |
| **ElevenLabs (TTS)** | ~500 chars/call, 10 replies | ~$15–30 |
| **Compute (workers)** | 2–4 small VMs or serverless | ~$5–15 |
| **Queue/Redis** | Managed Redis or SQS | ~$5–10 |
| **Total (order of magnitude)** | | **~$90–160 per 1000 calls** |

- Exact numbers depend on call length, turns per call, and provider pricing. The above is a ballpark for a “3 min, ~10 exchange” voice flow.
- **This prototype** uses only OpenAI (chat); voice is browser-based, so it doesn’t incur Twilio/ElevenLabs. For production at scale, the above stack is a reasonable target and fits the “1000 calls every morning” requirement with controlled concurrency and cost.
