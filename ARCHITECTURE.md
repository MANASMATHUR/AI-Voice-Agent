# AI Voice Agent - Technical Architecture

## System Overview

A scalable AI voice agent for **Riverwood Estate** - a 15.5-acre premium residential plotted township in Sector-7, Kharkhauda (Sonipat, Haryana). Licensed under DDJAY (Deen Dayal Jan Awas Yojna) by DTCP Haryana.

The agent handles customer calls with personalized construction updates, answers project questions, and schedules site visits - all with conversation memory and natural voice interaction.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CUSTOMER TOUCHPOINTS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│   📱 Phone Call          💻 Web Interface          📲 WhatsApp (future)     │
│   (Twilio/VAPI)          (Browser)                 (Twilio)                 │
└──────────┬───────────────────────┬────────────────────────┬─────────────────┘
           │                       │                        │
           ▼                       ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API GATEWAY (Vercel Edge)                         │
│  • Rate Limiting (30 req/min per session)                                   │
│  • Request Validation                                                        │
│  • CORS Handling                                                            │
└──────────┬───────────────────────┬────────────────────────┬─────────────────┘
           │                       │                        │
           ▼                       ▼                        ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────────────┐
│  /api/call      │   │ /api/chat-stream│   │  /api/transcribe                │
│  (Twilio Hook)  │   │ (SSE Streaming) │   │  (Whisper STT)                  │
└────────┬────────┘   └────────┬────────┘   └────────────────┬────────────────┘
         │                     │                             │
         └─────────────────────┼─────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CORE AI SERVICES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  OpenAI GPT-4o  │  │   ElevenLabs    │  │  Response Cache │             │
│  │  (Conversation) │  │   (Voice TTS)   │  │  (Common Q&A)   │             │
│  │  - mini model   │  │  - Multilingual │  │  - 2hr TTL      │             │
│  │  - Streaming    │  │  - Low latency  │  │  - Cost saving  │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER (Upstash Redis)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Conversation History (50 messages, 7-day TTL)                            │
│  • Session Metadata (language, preferences)                                 │
│  • Rate Limit Counters                                                      │
│  • Response Cache                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Infrastructure for 1000 Calls/Morning

### Challenge
Riverwood needs to call 1000 customers every morning with personalized updates. This requires:
- Parallel call handling (not sequential)
- Cost optimization
- Reliable delivery
- Call scheduling and retry logic

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CALL ORCHESTRATION LAYER                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     SCHEDULER (Cron/Cloud Scheduler)                 │   │
│  │  • Triggers at 9:00 AM daily                                        │   │
│  │  • Fetches customer list from CRM                                   │   │
│  │  • Creates call queue                                               │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     MESSAGE QUEUE (Redis/SQS)                        │   │
│  │  • 1000 call jobs queued                                            │   │
│  │  • Priority ordering (VIP customers first)                          │   │
│  │  • Retry logic with exponential backoff                             │   │
│  └──────────────────────────────────┬──────────────────────────────────┘   │
│                                     │                                       │
│                    ┌────────────────┼────────────────┐                     │
│                    │                │                │                      │
│                    ▼                ▼                ▼                      │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐           │
│  │   Worker 1       │ │   Worker 2       │ │   Worker N       │           │
│  │   (50 calls)     │ │   (50 calls)     │ │   (50 calls)     │           │
│  │                  │ │                  │ │                  │           │
│  │  Twilio/VAPI     │ │  Twilio/VAPI     │ │  Twilio/VAPI     │           │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Scaling Strategy

| Concurrency Level | Workers | Calls/Worker | Time to Complete | Cost/1000 calls |
|-------------------|---------|--------------|------------------|-----------------|
| Low (Sequential)  | 1       | 1000         | ~16 hours        | Baseline        |
| Medium            | 10      | 100          | ~1.6 hours       | +10% infra      |
| High              | 20      | 50           | ~50 minutes      | +20% infra      |
| **Recommended**   | **50**  | **20**       | **~20 minutes**  | **+30% infra**  |

### Technology Choices

#### Option A: Twilio Programmable Voice (Recommended)
```
Pros:
✅ Mature, reliable platform
✅ Excellent India coverage
✅ Built-in retry/failover
✅ Detailed call analytics
✅ Easy webhook integration

Cons:
❌ $0.013/min outbound (India)
❌ Requires webhook server
```

#### Option B: VAPI (Voice AI Platform)
```
Pros:
✅ Built for AI voice agents
✅ Native LLM integration
✅ Simpler setup
✅ Real-time transcription included

Cons:
❌ Newer platform
❌ $0.05/min (higher cost)
❌ Less customizable
```

### Recommended Stack for 1000 Calls

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SCHEDULING          QUEUE              WORKERS                  │
│  ───────────         ─────              ───────                  │
│  Cloud Scheduler  →  Redis Queue  →  20x Vercel Functions       │
│  (GCP/AWS)           (Upstash)        (Parallel execution)      │
│                                                                  │
│  TELEPHONY           AI SERVICES       STORAGE                   │
│  ─────────           ───────────       ───────                   │
│  Twilio Voice    →   OpenAI GPT   →   Upstash Redis             │
│  (Outbound)          ElevenLabs        (Conversations)          │
│                      (TTS)                                       │
│                                                                  │
│  MONITORING          ANALYTICS                                   │
│  ──────────          ─────────                                   │
│  Vercel Analytics    Custom Dashboard                           │
│  Sentry (Errors)     Call Success Rate                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Cost Estimation (1000 Calls/Day)

### Assumptions
- Average call duration: 2 minutes
- 70% answer rate (700 connected calls)
- Language: 60% Hindi, 40% English

### Monthly Costs (30 days × 1000 calls)

| Service | Usage | Unit Cost | Monthly Cost |
|---------|-------|-----------|--------------|
| **Twilio Voice** | 700 calls × 2 min × 30 days = 42,000 min | $0.013/min | **$546** |
| **OpenAI GPT-4o-mini** | ~100K tokens/day × 30 = 3M tokens | $0.15/1M input | **$4.50** |
| **ElevenLabs** | 700 × 200 chars × 30 = 4.2M chars | $0.30/1K chars | **$1,260** |
| **Upstash Redis** | ~100K requests/day | Free tier | **$0** |
| **Vercel** | Serverless functions | Pro plan | **$20** |

### Total Monthly: ~$1,830

### Cost Optimization Strategies

1. **Use OpenAI TTS instead of ElevenLabs**: Reduces TTS cost to ~$315/month (saves $945)
2. **Cache common responses**: 20% cache hit rate saves ~$100/month
3. **Shorter calls**: Reduce to 1.5 min average saves ~$140/month
4. **Off-peak calling**: Some providers offer lower rates

### Optimized Monthly Cost: ~$750-900

---

## Latency Optimization

### Current Response Time Breakdown

| Stage | Time | Optimization |
|-------|------|--------------|
| Speech-to-Text | 300-500ms | Use streaming STT |
| LLM Response (first token) | 200-400ms | Streaming, GPT-4o-mini |
| LLM Response (complete) | 800-1200ms | Limit to 150 tokens |
| Text-to-Speech | 400-600ms | ElevenLabs turbo model |
| **Total** | **1.7-2.7s** | **Target: <2s** |

### Optimization Techniques

1. **Streaming everything**: SSE for LLM, streaming TTS
2. **Predictive responses**: Cache common queries
3. **Edge deployment**: Vercel Edge for low latency
4. **Connection pooling**: Reuse API connections

---

## Conversation Memory Design

### Data Model

```javascript
// Session stored in Redis
{
  "sessionId": "ses_abc123",
  "customerId": "cust_456",
  "messages": [
    {
      "role": "assistant",
      "content": "Hello! This is Priya from Riverwood...",
      "timestamp": 1699500000000
    },
    {
      "role": "user", 
      "content": "What's the construction status?",
      "timestamp": 1699500030000
    }
  ],
  "metadata": {
    "language": "en",
    "lastCallDate": "2024-11-09",
    "totalCalls": 3,
    "interests": ["site_visit", "payment_plan"]
  }
}
```

### Memory Features

1. **Within-call context**: Last 20 messages sent to LLM
2. **Cross-call memory**: Customer history persists 30 days
3. **Personalization**: Remember name, language preference, interests
4. **Smart summarization**: Compress old conversations to save tokens

---

## Security Considerations

1. **API Key Protection**: All keys in environment variables
2. **Rate Limiting**: 30 requests/minute per session
3. **Input Validation**: Sanitize all user inputs
4. **Data Encryption**: Redis TLS, HTTPS only
5. **PII Handling**: No sensitive data logged
6. **Call Recording Consent**: Required by law in India

---

## Monitoring & Analytics

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Call Success Rate | >85% | <70% |
| Average Response Time | <2s | >3s |
| Customer Satisfaction | >4/5 | <3/5 |
| Cost per Call | <₹15 | >₹20 |

### Dashboard Components

1. Real-time call status
2. Daily/weekly call volume
3. Response time percentiles
4. Error rate by type
5. Cost tracking
6. Customer feedback scores
