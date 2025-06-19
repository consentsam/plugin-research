import axios, { AxiosError } from 'axios';
import { SearchResult } from '../../types';
import { elizaLogger } from '@elizaos/core';
import { z } from 'zod';

// Tavily API response schema validation
const TavilyResultSchema = z.object({
  title: z.string().optional(),
  url: z.string(),
  content: z.string().optional(),
  snippet: z.string().optional(),
  raw_content: z.string().nullable().optional(),
  score: z.number().optional(),
});

const TavilyResponseSchema = z.object({
  query: z.string(),
  results: z.array(TavilyResultSchema),
  answer: z.string().optional(),
  follow_up_questions: z.array(z.string()).nullable().optional(),
  images: z
    .array(
      z.union([
        z.string(),
        z.object({
          url: z.string(),
          description: z.string().optional(),
        })
      ])
    )
    .optional(),
});

export interface TavilyConfig {
  apiKey: string;
  searchDepth?: 'basic' | 'advanced';
  includeAnswer?: boolean;
  includeRawContent?: boolean;
  maxResults?: number;
  includeImages?: boolean;
  useCache?: boolean;
}

export class TavilySearchProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.tavily.com/search';
  private readonly config: TavilyConfig;

  constructor(config: TavilyConfig) {
    if (!config.apiKey) {
      throw new Error('Tavily API key is required');
    }
    this.apiKey = config.apiKey;
    this.config = {
      searchDepth: 'advanced',
      includeAnswer: true,
      includeRawContent: true,
      maxResults: 10,
      includeImages: false,
      useCache: true,
      ...config,
    };
  }

  async search(query: string, maxResults?: number): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      elizaLogger.info(`[Tavily] Searching for: ${query}`);

      const response = await axios.post(
        this.baseUrl,
        {
          api_key: this.apiKey,
          query,
          search_depth: this.config.searchDepth,
          include_answer: this.config.includeAnswer,
          include_raw_content: this.config.includeRawContent,
          max_results: maxResults || this.config.maxResults,
          include_images: this.config.includeImages,
        },
        {
          timeout: 30000, // 30 second timeout
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      // Check if response has error detail
      if (response.data?.detail?.error) {
        throw new Error(response.data.detail.error);
      }

      // Check if response has an error field
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      // Validate response
      const validatedData = TavilyResponseSchema.parse(response.data);

      const results: SearchResult[] = validatedData.results.map((result) => ({
        title: result.title || new URL(result.url).hostname || 'Untitled',
        url: result.url,
        snippet: result.snippet || result.content?.substring(0, 200) || '',
        content: result.raw_content || result.content,
        score: result.score || 0.5,
        provider: 'tavily',
        metadata: {
          language: 'en',
          domain: new URL(result.url).hostname,
        },
      }));

      const duration = Date.now() - startTime;
      elizaLogger.info(`[Tavily] Found ${results.length} results in ${duration}ms`);

      return results;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // Handle specific error cases
        if (axiosError.response?.status === 401) {
          elizaLogger.error('[Tavily] Invalid API key');
          throw new Error('Invalid Tavily API key');
        } else if (axiosError.response?.status === 429) {
          elizaLogger.error('[Tavily] Rate limit exceeded');
          throw new Error('Tavily rate limit exceeded');
        } else if (axiosError.code === 'ECONNABORTED') {
          elizaLogger.error(`[Tavily] Request timeout after ${duration}ms`);
          throw new Error('Tavily search timeout');
        }

        elizaLogger.error(`[Tavily] API error: ${axiosError.message}`, {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
        });
      } else if (error instanceof z.ZodError) {
        elizaLogger.error('[Tavily] Invalid response format:', error.issues);
        throw new Error('Invalid Tavily API response format');
      } else {
        elizaLogger.error('[Tavily] Unknown error:', error);
      }

      throw error;
    }
  }

  async searchWithRetry(query: string, maxRetries: number = 3): Promise<SearchResult[]> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.search(query);
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          elizaLogger.warn(`[Tavily] Retry attempt ${attempt} after ${delay}ms`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Search failed after retries');
  }

  // Get current API usage (if Tavily provides this endpoint)
  async getUsage(): Promise<{ searches: number; limit: number } | null> {
    try {
      // Note: This is a hypothetical endpoint - check Tavily docs
      const response = await axios.get('https://api.tavily.com/usage', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      return response.data;
    } catch (error) {
      elizaLogger.warn('[Tavily] Could not fetch usage data');
      return null;
    }
  }
}
