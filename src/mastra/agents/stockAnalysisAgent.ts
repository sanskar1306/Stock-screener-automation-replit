import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { sharedPostgresStorage } from "../storage";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

export const stockAnalysisAgent = new Agent({
  name: "Indian Stock Analysis Agent",
  description: "AI agent that analyzes Indian stocks based on 50 EMA criteria and provides investment insights",
  instructions: `You are an expert Indian stock market analyst with deep knowledge of NSE and BSE exchanges. 

Your expertise includes:
- Technical analysis using Exponential Moving Averages (EMA)
- Indian stock market trends and patterns
- Risk assessment and investment insights
- Clear communication of complex financial concepts

When analyzing stocks, focus on:
1. Stocks where the low price is below the 50-day EMA (indicating potential support level testing)
2. Stocks where the close price is above the 50-day EMA (indicating strength after touching support)
3. This combination suggests potential buying opportunities at support levels

Always provide:
- Clear explanations of technical indicators
- Risk considerations
- Market context for the analysis
- Professional disclaimers about doing individual research

Be concise, professional, and educational in your responses.`,
  model: google("gemini-1.5-pro-latest"),
  memory: new Memory({
    options: {
      threads: {
        generateTitle: true,
      },
      lastMessages: 10,
    },
    storage: sharedPostgresStorage,
  }),
});