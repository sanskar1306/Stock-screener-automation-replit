import { createWorkflow, createStep } from "../inngest";
import { z } from "zod";

import { fetchStockDataTool } from "../tools/fetchStockData";
import { generateStockCSVTool } from "../tools/generateStockCSV";
import { sendStockEmailTool } from "../tools/sendStockEmail";

// Step 1: Fetch stock data and calculate 50 EMA
const fetchStockDataStep = createStep({
  id: "fetch-stock-data",
  description: "Fetches Indian stock data from NSE/BSE and calculates 50 EMA",
  inputSchema: z.object({
    recipientEmail: z.string().email().default("sanskarkabra1306@gmail.com").describe("Email address to send the report to"),
  }),
  outputSchema: z.object({
    recipientEmail: z.string(),
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
  execute: async ({ inputData, mastra, runtimeContext, tracingContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('🚀 [StockAnalysisWorkflow] Starting stock data fetch step');
    
    const { recipientEmail } = inputData;
    
    const result = await fetchStockDataTool.execute({
      context: {
        symbols: [
          // Popular NSE stocks
          "RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR", "ICICIBANK", "KOTAKBANK", 
          "LT", "SBIN", "BHARTIARTL", "ASIANPAINT", "ITC", "AXISBANK", "MARUTI", 
          "SUNPHARMA", "TITAN", "ULTRACEMCO", "WIPRO", "NESTLEIND", "POWERGRID",
          "NTPC", "JSWSTEEL", "M&M", "TECHM", "HCLTECH", "TATAMOTORS", "INDUSINDBK", 
          "GRASIM", "ADANIENT", "COALINDIA", "DRREDDY", "BAJFINANCE", "BAJAJFINSV",
          "HDFCLIFE", "SBILIFE", "DIVISLAB", "TATACONSUM", "BRITANNIA", "CIPLA",
          "EICHERMOT", "HEROMOTOCO", "APOLLOHOSP", "HINDALCO", "UPL", "ADANIPORTS",
          // BSE stocks
          "RELIANCE.BO", "TCS.BO", "HDFCBANK.BO", "INFY.BO", "HINDUNILVR.BO"
        ]
      },
      runtimeContext,
      tracingContext
    });
    
    logger?.info('📊 [StockAnalysisWorkflow] Stock data fetched', { 
      totalStocks: result.totalStocks,
      qualifyingStocks: result.qualifyingStocks 
    });
    
    return {
      recipientEmail,
      totalStocks: result.totalStocks,
      qualifyingStocks: result.qualifyingStocks,
      stocks: result.stocks
    };
  }
});

// Step 2: Generate CSV file
const generateCSVStep = createStep({
  id: "generate-csv",
  description: "Generates CSV file with qualifying stocks",
  inputSchema: z.object({
    recipientEmail: z.string(),
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
  outputSchema: z.object({
    recipientEmail: z.string(),
    totalStocks: z.number(),
    qualifyingStocks: z.number(),
    csvContent: z.string(),
    filename: z.string()
  }),
  execute: async ({ inputData, mastra, runtimeContext, tracingContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('📄 [StockAnalysisWorkflow] Starting CSV generation step');
    
    const { recipientEmail, totalStocks, qualifyingStocks, stocks } = inputData;
    
    const result = await generateStockCSVTool.execute({
      context: {
        stocks,
        filename: "indian_stocks_50ema_analysis"
      },
      runtimeContext,
      tracingContext
    });
    
    logger?.info('📊 [StockAnalysisWorkflow] CSV generated', { 
      filename: result.filename,
      qualifyingCount: result.qualifyingCount 
    });
    
    return {
      recipientEmail,
      totalStocks,
      qualifyingStocks,
      csvContent: result.csvContent,
      filename: result.filename
    };
  }
});

// Step 3: Send email with CSV attachment
const sendEmailStep = createStep({
  id: "send-email",
  description: "Sends email with stock analysis CSV attachment",
  inputSchema: z.object({
    recipientEmail: z.string(),
    totalStocks: z.number(),
    qualifyingStocks: z.number(),
    csvContent: z.string(),
    filename: z.string()
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    emailSent: z.boolean()
  }),
  execute: async ({ inputData, mastra, runtimeContext, tracingContext }) => {
    const logger = mastra?.getLogger();
    logger?.info('📧 [StockAnalysisWorkflow] Starting email sending step');
    
    const { recipientEmail, totalStocks, qualifyingStocks, csvContent, filename } = inputData;
    
    const result = await sendStockEmailTool.execute({
      context: {
        recipientEmail,
        csvContent,
        filename,
        qualifyingCount: qualifyingStocks,
        totalStocks,
        analysisDate: new Date().toISOString().split('T')[0]
      },
      runtimeContext,
      tracingContext
    });
    
    logger?.info('✅ [StockAnalysisWorkflow] Email sending completed', { 
      success: result.success,
      messageId: result.messageId 
    });
    
    return {
      success: result.success,
      messageId: result.messageId,
      emailSent: result.success
    };
  }
});

// Create the main workflow
export const stockAnalysisWorkflow = createWorkflow({
  id: "stock-analysis-workflow",
  description: "Daily Indian stock analysis workflow that identifies stocks meeting 50 EMA criteria and emails CSV report",
  inputSchema: z.object({}), // Empty for time-based workflows
  outputSchema: z.object({
    success: z.boolean(),
    totalStocksAnalyzed: z.number(),
    qualifyingStocks: z.number(),
    emailSent: z.boolean(),
    messageId: z.string().optional()
  })
})
.then(fetchStockDataStep)
.then(generateCSVStep)  
.then(sendEmailStep)
.commit();