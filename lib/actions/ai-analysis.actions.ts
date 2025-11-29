'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getStockQuote } from './quote.actions';
import { getPosts } from './social.actions';
import { getNews } from './finnhub.actions';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

// Helper to check available models via REST API
async function getAvailableModels(apiKey: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      console.warn('Could not fetch available models:', response.statusText);
      return [];
    }

    const data = await response.json();
    if (data.models && Array.isArray(data.models)) {
      return data.models
        .map((model: any) => model.name?.replace('models/', '') || '')
        .filter((name: string) => name && name.startsWith('gemini'));
    }
    return [];
  } catch (error) {
    console.warn('Error fetching available models:', error);
    return [];
  }
}

// Helper function to generate content with model fallback
async function generateContentWithFallback(prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  // Try to get list of available models from the API
  let availableModels: string[] = [];
  try {
    availableModels = await getAvailableModels(GEMINI_API_KEY);
    if (availableModels.length > 0) {
      console.log('Available Gemini models:', availableModels);
    }
  } catch (error) {
    console.warn('Could not fetch available models, will try common models');
  }

  // Build list of models to try
  const primaryModelName = GEMINI_MODEL;
  const commonModels = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-pro',
  ];

  // If we got available models from API, prioritize those
  let modelsToTry: string[];
  if (availableModels.length > 0) {
    const otherAvailable = availableModels.filter(m => m !== primaryModelName);
    modelsToTry = [primaryModelName, ...otherAvailable].filter(m =>
      availableModels.includes(m) || commonModels.includes(m)
    );
    if (!availableModels.includes(primaryModelName)) {
      modelsToTry = [...modelsToTry, ...commonModels.filter(m => !modelsToTry.includes(m))];
    }
  } else {
    const otherModels = commonModels.filter(m => m !== primaryModelName);
    modelsToTry = [primaryModelName, ...otherModels];
  }

  console.log(`Will try models in order: ${modelsToTry.join(', ')}`);

  // Try each model until one works
  let result;
  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`Attempting to use model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      result = await model.generateContent(prompt);
      console.log(`Successfully used model: ${modelName}`);
      break;
    } catch (apiError) {
      const apiErrorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      lastError = apiError instanceof Error ? apiError : new Error(String(apiError));

      console.warn(`Model ${modelName} failed:`, apiErrorMessage);

      // If it's a model-specific error (404, model not found), try next model
      if (apiErrorMessage.includes('model') || apiErrorMessage.includes('not found') || apiErrorMessage.includes('404')) {
        continue;
      }

      // For other errors, throw immediately (API key, quota, etc.)
      if (apiErrorMessage.includes('API_KEY') || apiErrorMessage.includes('authentication')) {
        throw new Error('Invalid or missing Gemini API key. Please check your GEMINI_API_KEY environment variable.');
      } else if (apiErrorMessage.includes('quota') || apiErrorMessage.includes('rate limit')) {
        throw new Error('Gemini API quota exceeded or rate limit reached. Please try again later.');
      } else if (apiErrorMessage.includes('403') || apiErrorMessage.includes('permission')) {
        throw new Error('Permission denied. Please check your API key permissions and billing status.');
      } else {
        // For other errors, try next model if available, otherwise throw
        if (modelsToTry.indexOf(modelName) === modelsToTry.length - 1) {
          throw new Error(`Gemini API error: ${apiErrorMessage}`);
        }
        continue;
      }
    }
  }

  // If we get here and result is still undefined, all models failed
  if (!result) {
    throw new Error(
      `Unable to generate content with any model. Tried: ${modelsToTry.join(', ')}. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  const response = result.response;
  if (!response) {
    throw new Error('No response received from Gemini API');
  }

  const text = response.text();
  if (!text || text.trim() === '') {
    throw new Error('Empty response received from Gemini API');
  }

  return text;
}

// ==================== SENTIMENT ANALYSIS ====================

export interface SentimentAnalysis {
  symbol: string;
  overallSentiment: 'very_bullish' | 'bullish' | 'neutral' | 'bearish' | 'very_bearish';
  sentimentScore: number; // -100 to 100
  newsSentiment: {
    score: number;
    summary: string;
  };
  socialSentiment: {
    score: number;
    summary: string;
    postCount: number;
  };
  keyFactors: string[];
  timestamp: Date;
}

export async function analyzeSentiment(symbol: string): Promise<SentimentAnalysis | null> {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const [quote, posts] = await Promise.all([
      getStockQuote(symbol),
      getPosts(symbol, 20)
    ]);

    if (!quote) {
      throw new Error(`Unable to fetch stock quote for ${symbol}`);
    }

    // Analyze social posts for sentiment
    const socialContent = posts
      .slice(0, 10)
      .map(p => `${p.type}: ${p.content}`)
      .join('\n');

    const prompt = `Analyze the sentiment for stock ${symbol} based on the following data:

Stock Data:
- Current Price: $${quote.price.toFixed(2)}
- Change: ${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)
- Volume: ${quote.volume?.toLocaleString() || 'N/A'}

Recent Community Posts (${posts.length} posts):
${socialContent || 'No posts available'}

Please provide a sentiment analysis in the following JSON format:
{
  "overallSentiment": "very_bullish" | "bullish" | "neutral" | "bearish" | "very_bearish",
  "sentimentScore": <number between -100 and 100>,
  "newsSentiment": {
    "score": <number between -100 and 100>,
    "summary": "<brief summary of news sentiment>"
  },
  "socialSentiment": {
    "score": <number between -100 and 100>,
    "summary": "<brief summary of social media sentiment>",
    "postCount": ${posts.length}
  },
  "keyFactors": ["<factor 1>", "<factor 2>", "<factor 3>"]
}

Consider:
- Price movement and trends
- Community discussions and opinions
- Overall market sentiment
- Technical indicators

Only respond with valid JSON, no additional text.`;

    const text = await generateContentWithFallback(prompt);

    // Parse JSON from response
    let sentimentData;
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || [null, text];
      const jsonText = jsonMatch[1] || text;
      sentimentData = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('Error parsing sentiment analysis:', parseError);
      throw new Error('Unable to parse sentiment analysis response');
    }

    return {
      symbol: symbol.toUpperCase(),
      overallSentiment: sentimentData.overallSentiment || 'neutral',
      sentimentScore: parseFloat(sentimentData.sentimentScore) || 0,
      newsSentiment: {
        score: parseFloat(sentimentData.newsSentiment?.score) || 0,
        summary: sentimentData.newsSentiment?.summary || 'No news data available'
      },
      socialSentiment: {
        score: parseFloat(sentimentData.socialSentiment?.score) || 0,
        summary: sentimentData.socialSentiment?.summary || 'No social data available',
        postCount: posts.length
      },
      keyFactors: sentimentData.keyFactors || [],
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    throw error;
  }
}

// ==================== PATTERN RECOGNITION ====================

export interface ChartPattern {
  patternType: string;
  patternName: string;
  confidence: 'low' | 'medium' | 'high';
  description: string;
  bullish: boolean;
  targetPrice?: number;
  stopLoss?: number;
}

export interface PatternRecognition {
  symbol: string;
  patterns: ChartPattern[];
  overallOutlook: 'bullish' | 'neutral' | 'bearish';
  summary: string;
  timestamp: Date;
}

export async function recognizePatterns(symbol: string): Promise<PatternRecognition | null> {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const quote = await getStockQuote(symbol);
    if (!quote) {
      throw new Error(`Unable to fetch stock quote for ${symbol}`);
    }

    const prompt = `Analyze the stock ${symbol} for chart patterns based on the following data:

Stock Data:
- Current Price: $${quote.price.toFixed(2)}
- Previous Close: $${quote.previousClose?.toFixed(2) || quote.price.toFixed(2)}
- High: $${quote.high?.toFixed(2) || 'N/A'}
- Low: $${quote.low?.toFixed(2) || 'N/A'}
- Open: $${quote.open?.toFixed(2) || 'N/A'}
- Change: ${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)
- Volume: ${quote.volume?.toLocaleString() || 'N/A'}

Based on this price action, identify potential chart patterns such as:
- Head and Shoulders
- Double Top/Bottom
- Triangles (Ascending, Descending, Symmetrical)
- Flags and Pennants
- Wedges
- Support/Resistance levels
- Trend lines

Provide analysis in the following JSON format:
{
  "patterns": [
    {
      "patternType": "<pattern category>",
      "patternName": "<specific pattern name>",
      "confidence": "low" | "medium" | "high",
      "description": "<description of the pattern>",
      "bullish": <true or false>,
      "targetPrice": <optional target price>,
      "stopLoss": <optional stop loss price>
    }
  ],
  "overallOutlook": "bullish" | "neutral" | "bearish",
  "summary": "<overall pattern analysis summary>"
}

Only respond with valid JSON, no additional text.`;

    const text = await generateContentWithFallback(prompt);

    let patternData;
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || [null, text];
      const jsonText = jsonMatch[1] || text;
      patternData = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('Error parsing pattern recognition:', parseError);
      throw new Error('Unable to parse pattern recognition response');
    }

    return {
      symbol: symbol.toUpperCase(),
      patterns: patternData.patterns || [],
      overallOutlook: patternData.overallOutlook || 'neutral',
      summary: patternData.summary || 'No patterns detected',
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error recognizing patterns:', error);
    throw error;
  }
}

// ==================== RISK ASSESSMENT ====================

export interface RiskMetrics {
  volatility: 'low' | 'medium' | 'high';
  volatilityScore: number; // 0-100
  beta?: number;
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  riskScore: number; // 0-100
  diversification: string;
  recommendations: string[];
}

export interface RiskAssessment {
  symbol: string;
  metrics: RiskMetrics;
  portfolioRisk?: {
    concentration: number;
    sectorRisk: string;
    overallRisk: 'low' | 'medium' | 'high';
  };
  summary: string;
  timestamp: Date;
}

export async function assessRisk(symbol: string, portfolioSymbols?: string[]): Promise<RiskAssessment | null> {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const quote = await getStockQuote(symbol);
    if (!quote) {
      throw new Error(`Unable to fetch stock quote for ${symbol}`);
    }

    const portfolioContext = portfolioSymbols && portfolioSymbols.length > 0
      ? `\nPortfolio Context:\n- Other holdings: ${portfolioSymbols.filter(s => s !== symbol).join(', ')}\n- Portfolio size: ${portfolioSymbols.length} positions`
      : '';

    const prompt = `Assess the risk level for stock ${symbol} based on the following data:

Stock Data:
- Current Price: $${quote.price.toFixed(2)}
- Change: ${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)
- High: $${quote.high?.toFixed(2) || 'N/A'}
- Low: $${quote.low?.toFixed(2) || 'N/A'}
- Volume: ${quote.volume?.toLocaleString() || 'N/A'}
- PE Ratio: ${quote.peRatio?.toFixed(2) || 'N/A'}${portfolioContext}

Analyze:
- Price volatility based on recent movements
- Risk factors (high price swings, low volume, etc.)
- Portfolio diversification impact
- Overall risk assessment

Provide analysis in the following JSON format:
{
  "metrics": {
    "volatility": "low" | "medium" | "high",
    "volatilityScore": <number 0-100>,
    "riskLevel": "low" | "medium" | "high" | "very_high",
    "riskScore": <number 0-100>,
    "diversification": "<diversification assessment>",
    "recommendations": ["<recommendation 1>", "<recommendation 2>"]
  },
  "summary": "<overall risk assessment summary>"
}${portfolioSymbols && portfolioSymbols.length > 0 ? `\n\nIf portfolio context is provided, also include:\n"portfolioRisk": {\n  "concentration": <percentage of portfolio in this stock>,\n  "sectorRisk": "<sector risk assessment>",\n  "overallRisk": "low" | "medium" | "high"\n}` : ''}

Only respond with valid JSON, no additional text.`;

    const text = await generateContentWithFallback(prompt);

    let riskData;
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || [null, text];
      const jsonText = jsonMatch[1] || text;
      riskData = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('Error parsing risk assessment:', parseError);
      throw new Error('Unable to parse risk assessment response');
    }

    return {
      symbol: symbol.toUpperCase(),
      metrics: {
        volatility: riskData.metrics?.volatility || 'medium',
        volatilityScore: parseFloat(riskData.metrics?.volatilityScore) || 50,
        riskLevel: riskData.metrics?.riskLevel || 'medium',
        riskScore: parseFloat(riskData.metrics?.riskScore) || 50,
        diversification: riskData.metrics?.diversification || 'Moderate diversification',
        recommendations: riskData.metrics?.recommendations || []
      },
      portfolioRisk: riskData.portfolioRisk,
      summary: riskData.summary || 'Risk assessment completed',
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error assessing risk:', error);
    throw error;
  }
}

// ==================== TRADING SIGNALS ====================

export interface TradingSignal {
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: 'low' | 'medium' | 'high';
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  reasoning: string;
  timeframe: 'short_term' | 'medium_term' | 'long_term';
}

export interface TradingSignals {
  symbol: string;
  signals: TradingSignal[];
  overallSignal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  summary: string;
  timestamp: Date;
}

export async function generateTradingSignals(symbol: string): Promise<TradingSignals | null> {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const quote = await getStockQuote(symbol);
    if (!quote) {
      throw new Error(`Unable to fetch stock quote for ${symbol}`);
    }

    const prompt = `Generate trading signals for stock ${symbol} based on the following data:

Stock Data:
- Current Price: $${quote.price.toFixed(2)}
- Previous Close: $${quote.previousClose?.toFixed(2) || quote.price.toFixed(2)}
- High: $${quote.high?.toFixed(2) || 'N/A'}
- Low: $${quote.low?.toFixed(2) || 'N/A'}
- Open: $${quote.open?.toFixed(2) || 'N/A'}
- Change: ${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)
- Volume: ${quote.volume?.toLocaleString() || 'N/A'}
- PE Ratio: ${quote.peRatio?.toFixed(2) || 'N/A'}

Analyze and provide trading signals for different timeframes:
- Short-term (1-5 days)
- Medium-term (1-4 weeks)
- Long-term (1-3 months)

Consider:
- Price momentum
- Volume patterns
- Support/resistance levels
- Technical indicators
- Risk/reward ratios

Provide analysis in the following JSON format:
{
  "signals": [
    {
      "signal": "strong_buy" | "buy" | "hold" | "sell" | "strong_sell",
      "confidence": "low" | "medium" | "high",
      "entryPrice": <optional entry price>,
      "targetPrice": <optional target price>,
      "stopLoss": <optional stop loss price>,
      "reasoning": "<reasoning for this signal>",
      "timeframe": "short_term" | "medium_term" | "long_term"
    }
  ],
  "overallSignal": "strong_buy" | "buy" | "hold" | "sell" | "strong_sell",
  "summary": "<overall trading signal summary>"
}

Only respond with valid JSON, no additional text.`;

    const text = await generateContentWithFallback(prompt);

    let signalData;
    try {
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || [null, text];
      const jsonText = jsonMatch[1] || text;
      signalData = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('Error parsing trading signals:', parseError);
      throw new Error('Unable to parse trading signals response');
    }

    return {
      symbol: symbol.toUpperCase(),
      signals: signalData.signals || [],
      overallSignal: signalData.overallSignal || 'hold',
      summary: signalData.summary || 'No trading signals generated',
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error generating trading signals:', error);
    throw error;
  }
}


// ==================== PORTFOLIO OPTIMIZATION ====================

export interface PortfolioOptimization {
  recommendations: {
    symbol: string;
    action: 'buy' | 'sell' | 'hold';
    quantity?: number;
    reason: string;
  }[];
  analysis: string;
  riskScore: number;
  timestamp: Date;
}

export async function optimizePortfolio(positions: any[]): Promise<PortfolioOptimization | null> {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const positionsSummary = positions.map(p =>
      `- ${p.symbol}: ${p.quantity} shares @ $${p.averagePrice.toFixed(2)} (Current: $${p.currentPrice.toFixed(2)})`
    ).join('\n');

    const prompt = `Analyze this portfolio and suggest optimization strategies:
    
Portfolio:
${positionsSummary}

Provide a JSON response with:
{
  "recommendations": [
    { "symbol": "AAPL", "action": "buy" | "sell" | "hold", "quantity": 10, "reason": "..." }
  ],
  "analysis": "Overall portfolio analysis...",
  "riskScore": 0-100
}`;

    const text = await generateContentWithFallback(prompt);

    // Parse JSON safely
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || [null, text];
    const jsonText = jsonMatch[1] || text;
    const data = JSON.parse(jsonText.trim());

    return {
      recommendations: data.recommendations || [],
      analysis: data.analysis || 'Analysis failed',
      riskScore: data.riskScore || 50,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error optimizing portfolio:', error);
    return null;
  }
}

// ==================== NEWS SENTIMENT ====================

export interface NewsSentimentAnalysis {
  symbol: string;
  score: number; // -100 to 100
  summary: string;
  articles: { headline: string; sentiment: 'bullish' | 'bearish' | 'neutral' }[];
  timestamp: Date;
}

export async function analyzeNewsSentiment(symbol: string): Promise<NewsSentimentAnalysis | null> {
  try {
    const articles = await getNews([symbol]);
    if (!articles || articles.length === 0) return null;

    const newsText = articles.slice(0, 5).map(a => `- ${a.headline}: ${a.summary}`).join('\n');

    const prompt = `Analyze the sentiment of these news articles for ${symbol}:

${newsText}

Provide a JSON response with:
{
  "score": -100 (very bearish) to 100 (very bullish),
  "summary": "Brief summary of news sentiment...",
  "articles": [
    { "headline": "...", "sentiment": "bullish" | "bearish" | "neutral" }
  ]
}`;

    const text = await generateContentWithFallback(prompt);

    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || [null, text];
    const jsonText = jsonMatch[1] || text;
    const data = JSON.parse(jsonText.trim());

    return {
      symbol,
      score: data.score || 0,
      summary: data.summary || 'No sentiment available',
      articles: data.articles || [],
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Error analyzing news sentiment:', error);
    return null;
  }
}

// ==================== CHAT WITH DATA ====================

export async function chatWithData(message: string, context?: any): Promise<string> {
  try {
    const contextStr = context ? `Context: ${JSON.stringify(context)}` : '';
    const prompt = `You are Quantis Bot, a financial assistant. Answer the user's question.
    
${contextStr}

User: ${message}
Bot:`;

    return await generateContentWithFallback(prompt);
  } catch (error) {
    console.error('Error in chat with data:', error);
    return "I'm having trouble processing your request right now.";
  }
}
