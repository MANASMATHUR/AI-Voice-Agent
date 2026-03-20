import * as memoryStorage from './storage.js';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const useRedis = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

const SESSION_TTL = 60 * 60 * 24 * 7;
const MAX_MESSAGES_STORED = 50;

async function redisRequest(command, args = []) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return null;
  }

  try {
    const response = await fetch(`${UPSTASH_URL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command, ...args]),
    });

    if (!response.ok) {
      console.error('Redis error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.result;
  } catch (err) {
    console.error('Redis connection error:', err.message);
    return null;
  }
}

export async function getConversation(sessionId) {
  if (!sessionId) return [];

  if (!useRedis) {
    return memoryStorage.getConversation(sessionId);
  }

  const key = `conv:${sessionId}`;
  const data = await redisRequest('GET', [key]);

  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveConversation(sessionId, messages) {
  if (!sessionId || !Array.isArray(messages)) return false;

  if (!useRedis) {
    return memoryStorage.saveConversation(sessionId, messages);
  }

  const key = `conv:${sessionId}`;
  const trimmed = messages.slice(-MAX_MESSAGES_STORED);

  await redisRequest('SET', [key, JSON.stringify(trimmed), 'EX', SESSION_TTL]);
  return true;
}

export async function appendMessage(sessionId, message) {
  if (!sessionId || !message) return false;

  if (!useRedis) {
    return memoryStorage.appendMessage(sessionId, message);
  }

  const messages = await getConversation(sessionId);
  messages.push({
    ...message,
    timestamp: Date.now(),
  });

  return saveConversation(sessionId, messages);
}

export async function clearConversation(sessionId) {
  if (!sessionId) return false;

  if (!useRedis) {
    return memoryStorage.clearConversation(sessionId);
  }

  const key = `conv:${sessionId}`;
  await redisRequest('DEL', [key]);
  return true;
}

export async function getSessionMetadata(sessionId) {
  if (!sessionId) return null;

  if (!useRedis) {
    return memoryStorage.getSessionMetadata(sessionId);
  }

  const key = `meta:${sessionId}`;
  const data = await redisRequest('GET', [key]);

  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function saveSessionMetadata(sessionId, metadata) {
  if (!sessionId) return false;

  if (!useRedis) {
    return memoryStorage.saveSessionMetadata(sessionId, metadata);
  }

  const key = `meta:${sessionId}`;
  const data = {
    ...metadata,
    lastActive: Date.now(),
  };

  await redisRequest('SET', [key, JSON.stringify(data), 'EX', SESSION_TTL]);
  return true;
}

export function isRedisConfigured() {
  return useRedis;
}

export function isStorageAvailable() {
  return true;
}

export async function incrementRateLimit(identifier, windowSeconds = 60) {
  if (!useRedis) {
    return memoryStorage.incrementRateLimit(identifier, windowSeconds);
  }

  const key = `rate:${identifier}`;
  const count = await redisRequest('INCR', [key]);

  if (count === 1) {
    await redisRequest('EXPIRE', [key, windowSeconds]);
  }

  const limit = 30;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    count,
  };
}
