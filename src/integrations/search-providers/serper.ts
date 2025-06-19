import axios, { AxiosError } from 'axios';
import { SearchResult } from '../../types';
import { elizaLogger } from '@elizaos/core';
import { z } from 'zod';

// Serper API response schema validation
const SerperOrganicResultSchema = z.object({
  title: z.string(),
  link: z.string(),
  snippet: z.string().optional(),
  position: z.number(),
  date: z.string().optional(),
});

const SerperKnowledgeGraphSchema = z.object({
  title: z.string(),
  type: z.string().optional(),
  website: z.string().optional(),
  description: z.string().optional(),
  descriptionSource: z.string().optional(),
  imageUrl: z.string().optional(),
  attributes: z.record(z.string()).optional(),
});

const SerperResponseSchema = z.object({
  searchParameters: z.object({
    q: z.string(),
    type: z.string().optional(),
    engine: z.string().optional(),
  }),
  organic: z.array(SerperOrganicResultSchema).optional(),
  knowledgeGraph: SerperKnowledgeGraphSchema.optional(),
  answerBox: z
    .object({
      title: z.string().optional(),
      answer: z.string().optional(),
      snippet: z.string().optional(),
      link: z.string().optional(),
    })
    .optional(),
  searchInformation: z
    .object({
      totalResults: z.string().optional(),
      timeTaken: z.number().optional(),
    })
    .optional(),
});

export interface SerperConfig {
  apiKey: string;
  country?: string;
  location?: string;
  language?: string;
  num?: number;
  autocorrect?: boolean;
}

export class SerperSearchProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://google.serper.dev/search';
  private readonly config: SerperConfig;

  constructor(config: SerperConfig) {
    if (!config.apiKey) {
      throw new Error('Serper API key is required');
    }
    this.apiKey = config.apiKey;
    this.config = {
      country: 'us',
      language: 'en',
      num: 10,
      autocorrect: true,
      ...config,
    };
  }

  async search(query: string, maxResults?: number): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      elizaLogger.info(`[Serper] Searching for: ${query}`);

      const response = await axios.post(
        this.baseUrl,
        {
          q: query,
          num: maxResults || this.config.num,
          gl: this.config.country,
          hl: this.config.language,
          autocorrect: this.config.autocorrect,
        },
        {
          headers: {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 20000, // 20 second timeout
        }
      );

      // Validate response
      const validatedData = SerperResponseSchema.parse(response.data);

      const results: SearchResult[] = [];

      // Add answer box if available
      if (validatedData.answerBox?.answer) {
        results.push({
          title: validatedData.answerBox.title || 'Direct Answer',
          url: validatedData.answerBox.link || '',
          snippet: validatedData.answerBox.answer,
          content: validatedData.answerBox.snippet || validatedData.answerBox.answer,
          score: 1.0, // Answer box has highest relevance
          provider: 'serper',
          metadata: {
            language: this.config.language || 'en',
            type: 'answer_box',
          },
        });
      }

      // Add knowledge graph if available
      if (validatedData.knowledgeGraph) {
        results.push({
          title: validatedData.knowledgeGraph.title,
          url: validatedData.knowledgeGraph.website || '',
          snippet: validatedData.knowledgeGraph.description || '',
          content: JSON.stringify({
            ...validatedData.knowledgeGraph,
            source: 'knowledge_graph',
          }),
          score: 0.9, // Knowledge graph is highly relevant
          provider: 'serper',
          metadata: {
            language: this.config.language || 'en',
            type: 'knowledge_graph',
          },
        });
      }

      // Add organic results
      if (validatedData.organic) {
        results.push(
          ...validatedData.organic.map((result, index) => ({
            title: result.title,
            url: result.link,
            snippet: result.snippet || '',
            content: undefined, // Serper doesn't provide full content
            score: 0.8 - index * 0.05, // Decreasing score by position
            provider: 'serper',
            metadata: {
              language: this.config.language || 'en',
              position: result.position,
              date: result.date,
            },
          }))
        );
      }

      const duration = Date.now() - startTime;
      elizaLogger.info(`[Serper] Found ${results.length} results in ${duration}ms`);

      return results.slice(0, maxResults || this.config.num);
    } catch (error) {
      const duration = Date.now() - startTime;

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // Handle specific error cases
        if (axiosError.response?.status === 401) {
          elizaLogger.error('[Serper] Invalid API key');
          throw new Error('Invalid Serper API key');
        } else if (axiosError.response?.status === 429) {
          elizaLogger.error('[Serper] Rate limit exceeded');
          throw new Error('Serper rate limit exceeded');
        } else if (axiosError.response?.status === 403) {
          elizaLogger.error('[Serper] Forbidden - check API key permissions', {
            data: axiosError.response?.data,
            headers: axiosError.response?.headers
          });
          throw new Error(`Serper API access forbidden: ${JSON.stringify(axiosError.response?.data)}`);
        } else if (axiosError.code === 'ECONNABORTED') {
          elizaLogger.error(`[Serper] Request timeout after ${duration}ms`);
          throw new Error('Serper search timeout');
        }

        elizaLogger.error(`[Serper] API error: ${axiosError.message}`, {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
        });
      } else if (error instanceof z.ZodError) {
        elizaLogger.error('[Serper] Invalid response format:', error.issues);
        throw new Error('Invalid Serper API response format');
      } else {
        elizaLogger.error('[Serper] Unknown error:', error);
      }

      throw error;
    }
  }

  async searchNews(query: string, maxResults?: number): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      elizaLogger.info(`[Serper] Searching news for: ${query}`);

      const response = await axios.post(
        'https://google.serper.dev/news',
        {
          q: query,
          num: maxResults || this.config.num,
          gl: this.config.country,
          hl: this.config.language,
        },
        {
          headers: {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );

      const results: SearchResult[] =
        response.data.news?.map((item: any, index: number) => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet || '',
          content: JSON.stringify({
            date: item.date,
            source: item.source,
            imageUrl: item.imageUrl,
          }),
          score: 0.8 - index * 0.05,
          provider: 'serper',
          metadata: {
            language: this.config.language || 'en',
            type: 'news',
            date: item.date,
            source: item.source,
          },
        })) || [];

      const duration = Date.now() - startTime;
      elizaLogger.info(`[Serper] Found ${results.length} news results in ${duration}ms`);

      return results;
    } catch (error) {
      elizaLogger.error('[Serper] News search error:', error);
      throw error;
    }
  }

  async searchImages(
    query: string,
    maxResults?: number
  ): Promise<Array<{ url: string; title: string; source: string }>> {
    try {
      elizaLogger.info(`[Serper] Searching images for: ${query}`);

      const response = await axios.post(
        'https://google.serper.dev/images',
        {
          q: query,
          num: maxResults || 10,
          gl: this.config.country,
        },
        {
          headers: {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );

      return (
        response.data.images?.map((img: any) => ({
          url: img.imageUrl,
          title: img.title,
          source: img.source,
        })) || []
      );
    } catch (error) {
      elizaLogger.error('[Serper] Image search error:', error);
      throw error;
    }
  }

  async searchScholar(query: string, maxResults?: number): Promise<SearchResult[]> {
    try {
      elizaLogger.info(`[Serper] Searching Google Scholar for: ${query}`);

      const response = await axios.post(
        'https://google.serper.dev/scholar',
        {
          q: query,
          num: maxResults || this.config.num,
        },
        {
          headers: {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );

      const results: SearchResult[] =
        response.data.organic?.map((item: any, index: number) => ({
          title: item.title,
          url: item.link,
          snippet: item.snippet || item.publication_info?.summary || '',
          content: JSON.stringify({
            authors: item.publication_info?.authors,
            year: item.year,
            citations: item.inline_links?.cited_by?.total,
            type: 'academic',
          }),
          score: 0.9 - index * 0.05, // Academic results have higher base score
          provider: 'serper',
          metadata: {
            language: this.config.language || 'en',
            type: 'academic',
            author: item.publication_info?.authors,
            publishDate: item.year,
          },
        })) || [];

      elizaLogger.info(`[Serper] Found ${results.length} scholar results`);

      return results;
    } catch (error) {
      elizaLogger.error('[Serper] Scholar search error:', error);
      throw error;
    }
  }

  // Get current API usage
  async getUsage(): Promise<{ searches: number; limit: number; remaining: number } | null> {
    try {
      const response = await axios.get('https://google.serper.dev/account', {
        headers: { 'X-API-KEY': this.apiKey },
      });

      return {
        searches: response.data.searches || 0,
        limit: response.data.limit || 0,
        remaining: response.data.remaining || 0,
      };
    } catch (error) {
      elizaLogger.warn('[Serper] Could not fetch usage data');
      return null;
    }
  }
}
