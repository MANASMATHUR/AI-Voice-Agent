import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root (parent of backend/)
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Riverwood AI Voice Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Config from env ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "rachel")
AGENT_LANGUAGE = os.getenv("AGENT_PRIMARY_LANGUAGE", "both")

SYSTEM_PROMPT = """You are a warm, professional AI voice agent for Riverwood Projects LLP. You represent Riverwood Estate, a 25-acre DDJAY residential township in Sector 7, Kharkhauda, near IMT Kharkhauda and Maruti Suzuki.

Your role: give customers friendly updates about construction progress and project milestones. Be concise (1-3 short sentences per turn), natural, and welcoming. You may greet and respond in Hindi or English depending on the user's language. Keep a human-like, conversational tone. Do not use markdown or lists in replies."""


class ChatRequest(BaseModel):
    messages: list[dict[str, str]]


class ChatResponse(BaseModel):
    reply: str


class SpeakRequest(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"status": "ok", "openai_configured": bool(OPENAI_API_KEY), "elevenlabs_configured": bool(ELEVENLABS_API_KEY)}


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not OPENAI_API_KEY:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not set in .env")
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        msgs = [{"role": "system", "content": SYSTEM_PROMPT}] + req.messages
        r = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=msgs,
            max_tokens=150,
        )
        reply = (r.choices[0].message.content or "").strip()
        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/speak")
async def speak(req: SpeakRequest):
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=503, detail="ELEVENLABS_API_KEY not set in .env")
    try:
        from elevenlabs.client import ElevenLabs
        from fastapi.responses import Response
        client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        audio = client.text_to_speech.convert(
            text=req.text,
            voice_id=ELEVENLABS_VOICE_ID,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )
        if isinstance(audio, bytes):
            content = audio
        else:
            content = b"".join(c if isinstance(c, bytes) else c.read() for c in audio)
        return Response(content=content, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("APP_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
