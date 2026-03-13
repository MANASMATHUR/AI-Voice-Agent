import * as memoryStorage from './storage.js';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const useRedis = Boolean(UPSTASH_URL && UPSTASH_TOKEN);
const CACHE_TTL = 60 * 60 * 2; // 2 hours

async function redisRequest(command, args = []) {
  if (!useRedis) return null;

  try {
    const response = await fetch(`${UPSTASH_URL}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command, ...args]),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.result;
  } catch {
    return null;
  }
}

function normalizeQuery(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function hashQuery(text, lang) {
  const normalized = normalizeQuery(text);
  let hash = 0;
  const str = `${lang}:${normalized}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `cache:${Math.abs(hash).toString(36)}`;
}

const CACHEABLE_PATTERNS = [
  /what.*progress/i,
  /construction.*update/i,
  /when.*complete/i,
  /site.*visit/i,
  /hello|hi|namaste|namaskar/i,
  /thank.*you|thanks|dhanyavad/i,
  /bye|goodbye|alvida/i,
];

function isCacheable(query) {
  const normalized = query.toLowerCase();
  return CACHEABLE_PATTERNS.some(pattern => pattern.test(normalized));
}

export async function getCachedResponse(query, lang) {
  if (!isCacheable(query)) return null;
  
  // Use memory storage fallback if Redis not configured
  if (!useRedis) {
    return memoryStorage.getCachedResponse(query, lang);
  }
  
  const key = hashQuery(query, lang);
  const data = await redisRequest('GET', [key]);
  
  if (!data) return null;
  
  try {
    const cached = JSON.parse(data);
    return cached;
  } catch {
    return null;
  }
}

export async function setCachedResponse(query, lang, response) {
  if (!isCacheable(query)) return false;
  
  // Use memory storage fallback if Redis not configured
  if (!useRedis) {
    return memoryStorage.setCachedResponse(query, lang, response);
  }
  
  const key = hashQuery(query, lang);
  const data = {
    reply: response,
    cachedAt: Date.now(),
  };
  
  await redisRequest('SET', [key, JSON.stringify(data), 'EX', CACHE_TTL]);
  return true;
}
