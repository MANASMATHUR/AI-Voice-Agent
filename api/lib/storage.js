const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_MESSAGES = 50;

// In-memory store (persists during serverless function lifecycle)
const memoryStore = new Map();

// Cleanup old sessions periodically
function cleanup() {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.expiresAt && value.expiresAt < now) {
      memoryStore.delete(key);
    }
  }
}

export async function getConversation(sessionId) {
  if (!sessionId) return [];
  
  cleanup();
  const data = memoryStore.get(`conv:${sessionId}`);
  return data?.messages || [];
}

export async function saveConversation(sessionId, messages) {
  if (!sessionId || !Array.isArray(messages)) return false;
  
  const trimmed = messages.slice(-MAX_MESSAGES);
  memoryStore.set(`conv:${sessionId}`, {
    messages: trimmed,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return true;
}

export async function appendMessage(sessionId, message) {
  if (!sessionId || !message) return false;
  
  const messages = await getConversation(sessionId);
  messages.push({
    ...message,
    timestamp: Date.now(),
  });
  
  return saveConversation(sessionId, messages);
}

export async function clearConversation(sessionId) {
  if (!sessionId) return false;
  memoryStore.delete(`conv:${sessionId}`);
  return true;
}

export async function getSessionMetadata(sessionId) {
  if (!sessionId) return null;
  const data = memoryStore.get(`meta:${sessionId}`);
  return data?.metadata || null;
}

export async function saveSessionMetadata(sessionId, metadata) {
  if (!sessionId) return false;
  memoryStore.set(`meta:${sessionId}`, {
    metadata: { ...metadata, lastActive: Date.now() },
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return true;
}

export function isStorageConfigured() {
  return true; // Always available
}

export async function incrementRateLimit(identifier, windowSeconds = 60) {
  const key = `rate:${identifier}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  
  let data = memoryStore.get(key);
  
  if (!data || data.windowStart + windowMs < now) {
    data = { count: 0, windowStart: now };
  }
  
  data.count++;
  memoryStore.set(key, data);
  
  const limit = 30;
  return {
    allowed: data.count <= limit,
    remaining: Math.max(0, limit - data.count),
    count: data.count,
  };
}

// Simple cache for responses
const responseCache = new Map();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function getCachedResponse(query, lang) {
  const key = `cache:${lang}:${normalizeQuery(query)}`;
  const data = responseCache.get(key);
  
  if (!data) return null;
  if (data.expiresAt < Date.now()) {
    responseCache.delete(key);
    return null;
  }
  
  return data;
}

export async function setCachedResponse(query, lang, response) {
  const key = `cache:${lang}:${normalizeQuery(query)}`;
  responseCache.set(key, {
    reply: response,
    cachedAt: Date.now(),
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return true;
}

function normalizeQuery(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}
