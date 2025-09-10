import { createTool } from "@mastra/core/tools";
import { z } from "zod";

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
  ema50: number;
  qualifies: boolean;
}

function generateCSV(stocks: StockData[]): string {
  const headers = [
    'Symbol',
    'Name',
    'Exchange',
    'Date',
    'Open',
    'High', 
    'Low',
    'Close',
    'Volume',
    '50_EMA',
    'Low_vs_EMA',
    'Close_vs_EMA',
    'Qualifies'
  ];

  const csvRows = [headers.join(',')];

  // Filter only qualifying stocks
  const qualifyingStocks = stocks.filter(stock => stock.qualifies);

  qualifyingStocks.forEach(stock => {
    const row = [
      stock.symbol,
      `"${stock.name}"`, // Quote names to handle commas
      stock.exchange,
      stock.date,
      stock.open.toFixed(2),
      stock.high.toFixed(2),
      stock.low.toFixed(2),
      stock.close.toFixed(2),
      stock.volume.toString(),
      stock.ema50.toFixed(2),
      stock.low < stock.ema50 ? 'Below' : 'Above',
      stock.close > stock.ema50 ? 'Above' : 'Below',
      stock.qualifies ? 'YES' : 'NO'
    ];
    csvRows.push(row.join(','));
  });

  return csvRows.join('\n');
}

export const generateStockCSVTool = createTool({
  id: "generate-stock-csv",
  description: `Generates CSV file with stocks that qualify for 50 EMA criteria (low < 50 EMA and close > 50 EMA)`,
  inputSchema: z.object({
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
    })).describe("Array of stock data with EMA calculations"),
    filename: z.string().default("indian_stocks_50ema_analysis").describe("Base filename for the CSV (without extension)")
  }),
  outputSchema: z.object({
    csvContent: z.string(),
    filename: z.string(),
    qualifyingCount: z.number(),
    totalStocks: z.number()
  }),
  execute: async ({ context: { stocks, filename }, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔧 [GenerateStockCSV] Starting CSV generation', { totalStocks: stocks.length });

    const csvContent = generateCSV(stocks);
    const qualifyingStocks = stocks.filter(stock => stock.qualifies);
    const timestamp = new Date().toISOString().split('T')[0];
    const finalFilename = `${filename}_${timestamp}.csv`;

    logger?.info('📝 [GenerateStockCSV] CSV content generated', { 
      qualifyingStocks: qualifyingStocks.length,
      totalStocks: stocks.length,
      filename: finalFilename 
    });

    logger?.info('✅ [GenerateStockCSV] Completed successfully', { 
      csvLength: csvContent.length,
      filename: finalFilename 
    });

    return {
      csvContent,
      filename: finalFilename,
      qualifyingCount: qualifyingStocks.length,
      totalStocks: stocks.length
    };
  }
});