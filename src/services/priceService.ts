const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;

export type MarketPriceMap = Record<string, number>;

type FinnhubQuoteResponse = {
  c?: number;
};

function toFinnhubSymbol(ticker: string): string {
  return `${ticker.toUpperCase()}.SA`;
}

export async function fetchPrices(
  tickers: string[]
): Promise<MarketPriceMap> {
  const uniqueTickers = Array.from(
    new Set(
      tickers
        .map((ticker) => ticker.trim().toUpperCase())
        .filter(Boolean)
    )
  );

  if (!FINNHUB_API_KEY || uniqueTickers.length === 0) {
    return {};
  }

  console.log('🔥 FETCH PRICES CHAMADO', uniqueTickers);

  const entries = await Promise.all(
    uniqueTickers.map(async (ticker) => {
      try {
        const symbol = toFinnhubSymbol(ticker);

        const response = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
        );

        if (!response.ok) {
          console.error(`❌ erro HTTP ao buscar ${ticker}:`, response.status);
          return [ticker, null] as const;
        }

        const data = (await response.json()) as FinnhubQuoteResponse;
        const price = typeof data.c === 'number' ? data.c : null;

        return [ticker, price] as const;
      } catch (error) {
        console.error(`❌ erro ao buscar ${ticker}:`, error);
        return [ticker, null] as const;
      }
    })
  );

  const prices: MarketPriceMap = {};

  for (const [ticker, price] of entries) {
    if (typeof price === 'number' && price > 0) {
      prices[ticker] = price;
    }
  }

  console.log('✅ preços recebidos', prices);

  return prices;
}