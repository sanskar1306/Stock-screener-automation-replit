import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { sendEmail, zSmtpMessage, type SmtpMessage } from "../../utils/replitmail";

export const sendStockEmailTool = createTool({
  id: "send-stock-email",
  description: `Sends email with stock analysis CSV attachment to specified recipient`,
  inputSchema: z.object({
    recipientEmail: z.string().email().default("sanskarkabra1306@gmail.com").describe("Email address to send the report to"),
    csvContent: z.string().describe("CSV content to attach"),
    filename: z.string().describe("Filename for the CSV attachment"),
    qualifyingCount: z.number().describe("Number of stocks that qualify the criteria"),
    totalStocks: z.number().describe("Total number of stocks analyzed"),
    analysisDate: z.string().default(new Date().toISOString().split('T')[0]).describe("Date of the analysis")
  }),
  outputSchema: z.object({
    success: z.boolean(),
    messageId: z.string().optional(),
    accepted: z.array(z.string()),
    rejected: z.array(z.string()),
    error: z.string().optional()
  }),
  execute: async ({ context: { recipientEmail, csvContent, filename, qualifyingCount, totalStocks, analysisDate }, mastra }) => {
    const logger = mastra?.getLogger();
    logger?.info('🔧 [SendStockEmail] Starting email preparation', { 
      recipient: recipientEmail,
      filename,
      qualifyingCount,
      totalStocks 
    });

    try {
      // Convert CSV content to base64 for attachment
      const base64Content = Buffer.from(csvContent).toString('base64');

      // Create HTML email content
      const htmlContent = `
        <h2>🔍 Indian Stock Analysis Report - ${analysisDate}</h2>
        <p>Your daily stock analysis based on 50 EMA criteria has been completed.</p>
        
        <h3>📊 Analysis Summary</h3>
        <ul>
          <li><strong>Total Stocks Analyzed:</strong> ${totalStocks}</li>
          <li><strong>Qualifying Stocks:</strong> ${qualifyingCount}</li>
          <li><strong>Analysis Date:</strong> ${analysisDate}</li>
        </ul>
        
        <h3>📋 Selection Criteria</h3>
        <p>Stocks included in the attached CSV meet the following criteria:</p>
        <ul>
          <li>✅ <strong>Low price</strong> is below the 50-day Exponential Moving Average (EMA)</li>
          <li>✅ <strong>Close price</strong> is above the 50-day Exponential Moving Average (EMA)</li>
        </ul>
        
        <p>This indicates potential buying opportunities where the stock touched support (50 EMA) but closed strong.</p>
        
        <h3>📎 Attachment</h3>
        <p>The detailed analysis is attached as a CSV file: <strong>${filename}</strong></p>
        
        <p>The CSV includes the following columns:</p>
        <ul>
          <li>Symbol, Name, Exchange, Date</li>
          <li>OHLCV data (Open, High, Low, Close, Volume)</li>
          <li>50-day EMA value</li>
          <li>Comparison indicators (Low vs EMA, Close vs EMA)</li>
        </ul>
        
        <hr>
        <p style="font-size: 12px; color: #666;">
          This report was generated automatically by your AI Stock Analysis Agent.<br>
          Analysis covers stocks from NSE and BSE exchanges.<br>
          <em>Please do your own research before making investment decisions.</em>
        </p>
      `;

      const textContent = `Indian Stock Analysis Report - ${analysisDate}

Your daily stock analysis based on 50 EMA criteria has been completed.

ANALYSIS SUMMARY:
- Total Stocks Analyzed: ${totalStocks}
- Qualifying Stocks: ${qualifyingCount}  
- Analysis Date: ${analysisDate}

SELECTION CRITERIA:
Stocks included in the attached CSV meet the following criteria:
✓ Low price is below the 50-day Exponential Moving Average (EMA)
✓ Close price is above the 50-day Exponential Moving Average (EMA)

This indicates potential buying opportunities where the stock touched support (50 EMA) but closed strong.

ATTACHMENT:
The detailed analysis is attached as a CSV file: ${filename}

The CSV includes Symbol, Name, Exchange, Date, OHLCV data, 50-day EMA value, and comparison indicators.

---
This report was generated automatically by your AI Stock Analysis Agent.
Analysis covers stocks from NSE and BSE exchanges.
Please do your own research before making investment decisions.`;

      logger?.info('📝 [SendStockEmail] Sending email with attachment', { 
        attachmentSize: base64Content.length,
        contentType: 'text/csv'
      });

      const emailMessage: SmtpMessage = {
        to: recipientEmail,
        subject: `📈 Indian Stock Analysis Report - ${qualifyingCount} Qualifying Stocks (${analysisDate})`,
        html: htmlContent,
        text: textContent,
        attachments: [{
          filename: filename,
          content: base64Content,
          contentType: 'text/csv',
          encoding: 'base64'
        }]
      };

      const result = await sendEmail(emailMessage);

      logger?.info('✅ [SendStockEmail] Email sent successfully', { 
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected 
      });

      return {
        success: true,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      logger?.error('❌ [SendStockEmail] Failed to send email', { error: errorMessage });

      return {
        success: false,
        accepted: [],
        rejected: [recipientEmail],
        error: errorMessage
      };
    }
  }
});