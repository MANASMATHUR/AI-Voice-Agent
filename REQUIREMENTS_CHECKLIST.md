# Challenge Requirements – Checklist

This document maps each challenge requirement to what this prototype delivers. Use it to verify the Loom demo and submission.

---

## Your Challenge

| Requirement | Status | How it’s met |
|-------------|--------|--------------|
| Build a simple prototype of an AI voice agent for Riverwood | ✅ | Web app: landing page + agent page. Agent represents Riverwood Estate, Sector 7 Kharkhauda. |
| The agent should greet the user naturally in Hindi or English | ✅ | First message is a greeting in English and Hindi (LLM-generated). Ongoing replies match customer language. |
| It should accept user input by voice or text | ✅ | **Text:** input field + Send. **Voice:** hold the Voice button (Web Speech API); transcript is sent as the user message. |
| It should generate contextual responses using an LLM | ✅ | OpenAI GPT (gpt-4o-mini) via `/api/chat`. System prompt sets Riverwood context. |
| It should convert responses into natural speech | ✅ | Browser Text-to-Speech (speechSynthesis) speaks every agent reply. (OpenAI-only; no ElevenLabs key used.) |
| **Bonus:** The agent remembers previous conversation context | ✅ | Full conversation array is sent on each request; API uses last 10 messages so the agent keeps context. |

---

## Example Scenario

| Step | Status | How it’s shown |
|------|--------|----------------|
| AI calls the user | ✅ | Simulated: opening the agent page triggers the “call” (agent speaks first with greeting + update). |
| Greets the customer | ✅ | First agent message is a warm greeting in English and Hindi. |
| Shares a construction progress update | ✅ | First message includes a brief construction update for Sector 7 Kharkhauda (prompted in the greeting). |
| Asks if the customer plans to visit the site | ✅ | First message asks if they plan to visit the site soon. |
| Records the response | ✅ | User’s reply (voice or text) appears in the conversation and is sent as context for the next turn. |

---

## Tech Stack (Challenge Recommendations vs This Repo)

| Recommended | This prototype | Note |
|-------------|----------------|------|
| OpenAI GPT models | ✅ gpt-4o-mini | Used for all agent replies. |
| ElevenLabs or PlayHT | ❌ | Not used (only OpenAI key). Browser TTS used for speech. |
| Twilio Voice or VAPI | ❌ | Not used. In-app “call” = agent speaks first on page load. |
| Node.js | ✅ | API is Node.js (Vercel serverless). |
| Replit or GitHub | ✅ | Deploy via Vercel; repo can be GitHub. |

---

## Submission Requirements

| Item | Where / how |
|------|-------------|
| Loom video showing the working prototype | Record: open landing → View Challenge → agent greets (voice) → you reply by text or voice → agent responds with context → briefly explain architecture. |
| Demo link (GitHub, Replit, or Drive) | Deploy on Vercel and share the live URL; or share GitHub repo link. |
| Short technical note explaining architecture | See `TECHNICAL_NOTE.md` (architecture + 1000-calls design + cost). |
| Estimated infrastructure cost per 1000 calls | See `TECHNICAL_NOTE.md`. |

---

## Where to Send

- **Email:** sanyam@riverwoodindia.com  
- **Contact:** 8572070707  

---

## Evaluation Criteria (How This Prototype Addresses Them)

| Criteria | Weight | How this prototype addresses it |
|----------|--------|----------------------------------|
| Voice Realism | 25% | Browser TTS; clear and consistent. (Higher realism would need ElevenLabs – not used here due to OpenAI-only constraint.) |
| Latency | 20% | gpt-4o-mini, max 100 tokens, last-10-messages context for fast replies. |
| Infrastructure Design | 20% | See `TECHNICAL_NOTE.md` for scalable 1000-calls design and cost. |
| Context Understanding | 20% | Conversation history (last 10 messages) sent every turn for logical flow. |
| Creativity | 15% | Warm, bilingual greeting; construction update + site-visit question in first message. |
