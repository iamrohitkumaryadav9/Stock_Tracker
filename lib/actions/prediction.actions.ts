'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getStockQuote } from './quote.actions';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Default to gemini-1.5-flash as it's the most commonly available model
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


export interface PricePrediction {
  symbol: string;
  currentPrice: number;
  predictedPrice: number;
  predictedChange: number;
  predictedChangePercent: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  timeframe: '1d' | '1w' | '1m' | '3m';
  timestamp: Date;
}

interface HistoricalData {
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
}

export async function getPricePrediction(
  symbol: string,
  timeframe: '1d' | '1w' | '1m' | '3m' = '1d'
): Promise<PricePrediction | null> {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '') {
      console.error('Gemini API key not configured');
      throw new Error('GEMINI_API_KEY is not configured. Please set it in your environment variables.');
    }

    // Get current quote
    const currentQuote = await getStockQuote(symbol);
    if (!currentQuote) {
      throw new Error(`Unable to fetch stock quote for ${symbol}`);
    }

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
      'gemini-1.5-flash', // Most commonly available
      'gemini-1.5-pro', // More capable
      'gemini-pro', // Original model
    ];
    
    // If we got available models from API, prioritize those
    let modelsToTry: string[];
    if (availableModels.length > 0) {
      // Use available models, but prioritize the configured/default one
      const otherAvailable = availableModels.filter(m => m !== primaryModelName);
      modelsToTry = [primaryModelName, ...otherAvailable].filter(m => 
        availableModels.includes(m) || commonModels.includes(m)
      );
      // If primary model not in available list, add common models as fallback
      if (!availableModels.includes(primaryModelName)) {
        modelsToTry = [...modelsToTry, ...commonModels.filter(m => !modelsToTry.includes(m))];
      }
    } else {
      // Fallback to common models if we couldn't fetch available ones
      const otherModels = commonModels.filter(m => m !== primaryModelName);
      modelsToTry = [primaryModelName, ...otherModels];
    }
    
    console.log(`Will try models in order: ${modelsToTry.join(', ')}`);

    // Build prompt for price prediction
    const prompt = `You are a financial analyst AI. Analyze the following stock data and provide a price prediction.

Stock Symbol: ${symbol}
Current Price: $${currentQuote.price.toFixed(2)}
Previous Close: $${currentQuote.previousClose?.toFixed(2) || currentQuote.price.toFixed(2)}
Change: ${currentQuote.change >= 0 ? '+' : ''}${currentQuote.change.toFixed(2)} (${currentQuote.changePercent >= 0 ? '+' : ''}${currentQuote.changePercent.toFixed(2)}%)
High: $${currentQuote.high?.toFixed(2) || 'N/A'}
Low: $${currentQuote.low?.toFixed(2) || 'N/A'}
Open: $${currentQuote.open?.toFixed(2) || 'N/A'}
Volume: ${currentQuote.volume?.toLocaleString() || 'N/A'}

Timeframe for prediction: ${timeframe === '1d' ? '1 day' : timeframe === '1w' ? '1 week' : timeframe === '1m' ? '1 month' : '3 months'}

Please provide a price prediction in the following JSON format:
{
  "predictedPrice": <predicted price as number>,
  "predictedChange": <predicted change from current price as number>,
  "predictedChangePercent": <predicted change percentage as number>,
  "confidence": "low" | "medium" | "high",
  "reasoning": "<brief explanation of your prediction reasoning, 2-3 sentences>"
}

Consider:
- Current price trends and momentum
- Technical indicators (if price is near high/low)
- Volume patterns
- Market conditions
- Historical volatility

Be realistic and conservative in your predictions. Only respond with valid JSON, no additional text.`;

    // Try each model until one works
    let result;
    let lastError: Error | null = null;
    
    for (const modelName of modelsToTry) {
      try {
        console.log(`Attempting to generate prediction with model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        result = await model.generateContent(prompt);
        console.log(`Successfully used model: ${modelName}`);
        break; // Success, exit loop
      } catch (apiError) {
        const apiErrorMessage = apiError instanceof Error ? apiError.message : String(apiError);
        lastError = apiError instanceof Error ? apiError : new Error(String(apiError));
        
        console.warn(`Model ${modelName} failed:`, apiErrorMessage);
        
        // If it's a model-specific error (404, model not found), try next model
        if (apiErrorMessage.includes('model') || apiErrorMessage.includes('not found') || apiErrorMessage.includes('404')) {
          // Continue to next model
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
            // Last model, throw error
            throw new Error(`Gemini API error: ${apiErrorMessage}`);
          }
          // Otherwise continue to next model
          continue;
        }
      }
    }
    
    // If we get here and result is still undefined, all models failed
    if (!result) {
      const errorDetails = lastError?.message || 'Unknown error';
      throw new Error(
        `Unable to generate prediction with any model.\n` +
        `Tried models: ${modelsToTry.join(', ')}\n` +
        `Last error: ${errorDetails}\n\n` +
        `Please check:\n` +
        `1. Your GEMINI_API_KEY is valid and has access to Gemini models\n` +
        `2. Your API key has billing enabled (required for some models)\n` +
        `3. The models are available in your region\n` +
        `4. Try setting GEMINI_MODEL=gemini-1.5-flash in your .env file`
      );
    }
    
    const response = result.response;
    
    if (!response) {
      throw new Error('No response received from Gemini API');
    }
    
    let text: string;
    try {
      text = response.text();
    } catch (textError) {
      const textErrorMessage = textError instanceof Error ? textError.message : String(textError);
      throw new Error(`Error extracting text from Gemini response: ${textErrorMessage}`);
    }
    
    if (!text || text.trim() === '') {
      throw new Error('Empty response received from Gemini API');
    }

    // Parse JSON from response
    let predictionData;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || [null, text];
      const jsonText = jsonMatch[1] || text;
      predictionData = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // Fallback: try to extract numbers from text
      const priceMatch = text.match(/\$?(\d+\.?\d*)/);
      if (priceMatch) {
        const predictedPrice = parseFloat(priceMatch[1]);
        predictionData = {
          predictedPrice,
          predictedChange: predictedPrice - currentQuote.price,
          predictedChangePercent: ((predictedPrice - currentQuote.price) / currentQuote.price) * 100,
          confidence: 'medium',
          reasoning: 'AI-generated prediction based on current market data'
        };
      } else {
        throw new Error('Unable to parse prediction data from AI response');
      }
    }

    const predictedPrice = parseFloat(predictionData.predictedPrice) || currentQuote.price;
    const predictedChange = predictedPrice - currentQuote.price;
    const predictedChangePercent = (predictedChange / currentQuote.price) * 100;

    return {
      symbol: symbol.toUpperCase(),
      currentPrice: currentQuote.price,
      predictedPrice,
      predictedChange,
      predictedChangePercent,
      confidence: predictionData.confidence || 'medium',
      reasoning: predictionData.reasoning || 'AI-generated prediction',
      timeframe,
      timestamp: new Date()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error getting price prediction:', {
      error: errorMessage,
      symbol,
      timeframe,
      stack: error instanceof Error ? error.stack : undefined
    });
    // Re-throw with a more descriptive message
    throw new Error(`Failed to generate prediction: ${errorMessage}`);
  }
}

