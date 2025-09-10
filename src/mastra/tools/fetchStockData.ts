import { createTool } from "@mastra/core/tools";
import { z } from "zod";

// Define interfaces for stock data
interface StockData {
  symbol: string;
  name: string;
  exchange: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: string;
}

interface StockWithEMA extends StockData {
  ema50: number;
  qualifies: boolean;
}

// Function to calculate EMA
function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // Start with simple moving average for first value
  let sum = 0;
  for (let i = 0; i < Math.min(period, prices.length); i++) {
    sum += prices[i];
  }
  ema[period - 1] = sum / Math.min(period, prices.length);
  
  // Calculate EMA for remaining values
  for (let i = period; i < prices.length; i++) {
    ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }
  
  return ema;
}

// Function to fetch stock data from Yahoo Finance
async function fetchStockFromYahoo(symbol: string): Promise<StockData | null> {
  try {
    const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`; // Add .NS for NSE stocks if not already present
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=1672531200&period2=${Math.floor(Date.now() / 1000)}&interval=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const result = data.chart.result[0];
    
    if (!result || !result.indicators || !result.indicators.quote[0]) {
      return null;
    }
    
    const meta = result.meta;
    const quotes = result.indicators.quote[0];
    const timestamps = result.timestamp;
    
    // Get the most recent complete trading day
    const lastIndex = quotes.close.length - 1;
    
    return {
      symbol: symbol,
      name: meta.longName || meta.shortName || symbol,
      exchange: symbol.includes('.BO') ? 'BSE' : 'NSE',
      open: quotes.open[lastIndex] || 0,
      high: quotes.high[lastIndex] || 0,
      low: quotes.low[lastIndex] || 0,
      close: quotes.close[lastIndex] || 0,
      volume: quotes.volume[lastIndex] || 0,
      date: new Date(timestamps[lastIndex] * 1000).toISOString().split('T')[0]
    };
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    return null;
  }
}

// Function to fetch historical prices for EMA calculation
async function fetchHistoricalPrices(symbol: string, days: number = 100): Promise<number[]> {
  try {
    const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - (days * 24 * 60 * 60); // Go back 'days' days
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${startDate}&period2=${endDate}&interval=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const result = data.chart.result[0];
    
    if (!result || !result.indicators || !result.indicators.quote[0]) {
      return [];
    }
    
    return result.indicators.quote[0].close.filter((price: number) => price !== null);
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    return [];
  }
}

export const fetchStockDataTool = createTool({
  id: "fetch-stock-data",
  description: `Fetches current stock data from NSE and BSE exchanges in India and calculates 50-day EMA`,
  inputSchema: z.object({
    symbols: z.array(z.string()).default([
      // Popular NSE stocks
      "RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR", "ICICIBANK", "KOTAKBANK", "LT", "SBIN", "BHARTIARTL",
      "ASIANPAINT", "ITC", "AXISBANK", "MARUTI", "SUNPHARMA", "TITAN", "ULTRACEMCO", "WIPRO", "NESTLEIND", "POWERGRID",
      "NTPC", "JSWSTEEL", "M&M", "TECHM", "HCLTECH", "TATAMOTORS", "INDUSINDBK", "GRASIM", "ADANIENT", "COALINDIA",
      // BSE stocks (with .BO suffix)
      "RELIANCE.BO", "TCS.BO", "HDFCBANK.BO", "INFY.BO", "HINDUNILVR.BO"
    ]).describe("Array of stock symbols to fetch. Defaults to popular NSE/BSE stocks"),
  }),
  outputSchema: z.object({
    totalStocks: z.number(),
    qualifyingStocks: z.number(),
    stocks: z.array(z.object({
      symbol: z.string(),
      name: z.string(),
      exchange: z.string(),
      open: z.number(),
      high: z.number(),
      low: z.number(),
      close: z.number(),
      volume: z.number(),
      date: z.string(),
      ema50: z.number(),
      qualifies: z.boolean()
    }))
  }),
  execute: async ({ context: { symbols }, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔧 [FetchStockData] Starting execution with symbols:', { symbolCount: symbols.length });

    const stocksWithEMA: StockWithEMA[] = [];
    let processedCount = 0;

    for (const symbol of symbols) {
      logger?.info(`📝 [FetchStockData] Processing ${symbol} (${processedCount + 1}/${symbols.length})`);
      
      // Fetch current stock data
      const stockData = await fetchStockFromYahoo(symbol);
      if (!stockData) {
        logger?.info(`⚠️ [FetchStockData] Failed to fetch data for ${symbol}`);
        continue;
      }

      // Fetch historical prices for EMA calculation
      const historicalPrices = await fetchHistoricalPrices(symbol, 100);
      if (historicalPrices.length < 50) {
        logger?.info(`⚠️ [FetchStockData] Insufficient historical data for ${symbol}`);
        continue;
      }

      // Calculate 50-day EMA
      const emaValues = calculateEMA(historicalPrices, 50);
      const currentEMA50 = emaValues[emaValues.length - 1];

      // Check if stock qualifies: low < 50 EMA AND close > 50 EMA
      const qualifies = stockData.low < currentEMA50 && stockData.close > currentEMA50;

      stocksWithEMA.push({
        ...stockData,
        ema50: currentEMA50,
        qualifies
      });

      processedCount++;
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    const qualifyingStocks = stocksWithEMA.filter(stock => stock.qualifies);
    
    logger?.info('✅ [FetchStockData] Completed successfully', { 
      totalProcessed: stocksWithEMA.length, 
      qualifying: qualifyingStocks.length 
    });

    return {
      totalStocks: stocksWithEMA.length,
      qualifyingStocks: qualifyingStocks.length,
      stocks: stocksWithEMA
    };
  }
});