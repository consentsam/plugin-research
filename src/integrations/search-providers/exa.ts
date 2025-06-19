import axios from 'axios';
import { SearchResult } from '../../types';
import { elizaLogger } from '@elizaos/core';

export interface ExaConfig {
  apiKey: string;
  searchType?: 'neural' | 'keyword' | 'auto';
  category?: string;
  language?: string;
}

export class ExaSearchProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.exa.ai';
  private readonly config: ExaConfig;
  public readonly name = 'Exa';

  constructor(config: ExaConfig) {
    if (!config.apiKey) {
      throw new Error('Exa API key is required');
    }
    this.apiKey = config.apiKey;
    this.config = {
      searchType: 'auto',
      language: 'en',
      ...config,
    };
  }

  async search(query: string, maxResults?: number): Promise<SearchResult[]> {
    try {
      elizaLogger.info(`[Exa] Searching for: ${query}`);

      const response = await axios.post(
        `${this.baseUrl}/search`,
        {
          query,
          type: this.config.searchType || 'auto',
          numResults: maxResults || 10,
          text: true, // Get text content
          summary: {
            query: "Key points and main findings"
          },
          highlights: {
            numSentences: 3,
            highlightsPerUrl: 2
          }
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data || !response.data.results) {
        elizaLogger.warn('[Exa] No results found');
        return [];
      }

      const results: SearchResult[] = response.data.results.map((result: any, index: number) => ({
        title: result.title || 'Untitled',
        url: result.url,
        snippet: result.summary || result.text?.substring(0, 200) || 'No description available',
        score: result.score || (0.95 - index * 0.05),
        provider: 'exa',
        metadata: {
          language: this.config.language || 'en',
          type: this.config.searchType || 'auto',
          resolvedSearchType: response.data.resolvedSearchType,
          author: result.author,
          publishedDate: result.publishedDate,
          highlights: result.highlights,
          image: result.image,
          favicon: result.favicon,
        },
      }));

      elizaLogger.info(`[Exa] Found ${results.length} results`);
      return results;
    } catch (error: any) {
      if (error.response) {
        elizaLogger.error(`[Exa] API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        if (error.response.status === 401) {
          throw new Error('Invalid Exa API key');
        }
        if (error.response.status === 429) {
          throw new Error('Exa API rate limit exceeded');
        }
      } else {
        elizaLogger.error(`[Exa] Search error:`, error);
      }
      throw error;
    }
  }

  async searchAcademic(query: string, maxResults?: number): Promise<SearchResult[]> {
    try {
      elizaLogger.info(`[Exa] Searching academic papers for: ${query}`);

      const response = await axios.post(
        `${this.baseUrl}/search`,
        {
          query,
          type: 'neural', // Neural search works better for academic content
          category: 'research paper',
          numResults: maxResults || 10,
          text: true,
          summary: {
            query: "Main contributions and findings"
          },
          highlights: {
            numSentences: 5,
            highlightsPerUrl: 3
          }
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data || !response.data.results) {
        elizaLogger.warn('[Exa] No academic results found');
        return [];
      }

      const results: SearchResult[] = response.data.results.map((result: any, index: number) => ({
        title: result.title || 'Untitled',
        url: result.url,
        snippet: result.summary || result.text?.substring(0, 300) || 'No abstract available',
        score: result.score || (0.95 - index * 0.03),
        provider: 'exa',
        metadata: {
          language: 'en',
          type: 'research_paper',
          category: 'research paper',
          author: result.author,
          publishedDate: result.publishedDate,
          highlights: result.highlights,
          image: result.image,
        },
      }));

      elizaLogger.info(`[Exa] Found ${results.length} academic results`);
      return results;
    } catch (error: any) {
      elizaLogger.error(`[Exa] Academic search error:`, error);
      throw error;
    }
  }

  async findSimilar(url: string, maxResults?: number): Promise<SearchResult[]> {
    try {
      elizaLogger.info(`[Exa] Finding similar pages to: ${url}`);

      const response = await axios.post(
        `${this.baseUrl}/findSimilar`,
        {
          url,
          numResults: maxResults || 10,
          text: true,
          summary: {
            query: "Key similarities and main points"
          }
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data || !response.data.results) {
        elizaLogger.warn('[Exa] No similar results found');
        return [];
      }

      const results: SearchResult[] = response.data.results.map((result: any, index: number) => ({
        title: result.title || 'Untitled',
        url: result.url,
        snippet: result.summary || result.text?.substring(0, 200) || 'No description available',
        score: result.score || (0.9 - index * 0.05),
        provider: 'exa',
        metadata: {
          language: 'en',
          type: 'similar',
          author: result.author,
          publishedDate: result.publishedDate,
          image: result.image,
        },
      }));

      elizaLogger.info(`[Exa] Found ${results.length} similar results`);
      return results;
    } catch (error: any) {
      elizaLogger.error(`[Exa] Find similar error:`, error);
      throw error;
    }
  }
} 