type PriceCacheEntry = {
  price: number;
  timestamp: number;
};

const CACHE_KEY = 'invest-smart-price-cache';
const CACHE_TTL = 1000 * 60 * 10; // 10 minutos

const loadCache = (): Record<string, PriceCacheEntry> => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveCache = (cache: Record<string, PriceCacheEntry>) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
};

export const getCachedPrices = (tickers: string[]): Record<string, number> => {
  const cache = loadCache();
  const now = Date.now();

  const result: Record<string, number> = {};

  for (const ticker of tickers) {
    const entry = cache[ticker];

    if (entry && now - entry.timestamp < CACHE_TTL) {
      result[ticker] = entry.price;
    }
  }

  return result;
};

export const setCachedPrices = (prices: Record<string, number>) => {
  const cache = loadCache();
  const now = Date.now();

  for (const ticker in prices) {
    cache[ticker] = {
      price: prices[ticker],
      timestamp: now,
    };
  }

  saveCache(cache);
};