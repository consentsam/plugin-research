import axios from 'axios';
import { SearchResult } from '../../types';
import { elizaLogger } from '@elizaos/core';

export interface SerpAPIConfig {
  apiKey: string;
  country?: string;
  location?: string;
  language?: string;
  num?: number;
}

export class SerpAPISearchProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://serpapi.com/search';
  private readonly config: SerpAPIConfig;
  public readonly name = 'SerpAPI';

  constructor(config: SerpAPIConfig) {
    if (!config.apiKey) {
      throw new Error('SerpAPI key is required');
    }
    this.apiKey = config.apiKey;
    this.config = {
      country: 'us',
      language: 'en', 
      num: 10,
      ...config,
    };
  }

  async search(query: string, maxResults?: number): Promise<SearchResult[]> {
    try {
      elizaLogger.info(`[SerpAPI] Searching for: ${query}`);

      const params: any = {
        q: query,
        api_key: this.apiKey,
        engine: 'google',
        num: maxResults || this.config.num,
        gl: this.config.country,
        hl: this.config.language,
      };

      // Add location if specified
      if (this.config.location) {
        params['location'] = this.config.location;
      }

      const response = await axios.get(this.baseUrl, {
        params,
        timeout: 20000,
      });

      const data = response.data;
      const results: SearchResult[] = [];

      // Add answer box if available
      if (data.answer_box?.answer) {
        results.push({
          title: data.answer_box.title || 'Direct Answer',
          url: data.answer_box.link || '',
          snippet: data.answer_box.answer,
          score: 1.0,
          provider: 'serpapi',
          metadata: {
            language: this.config.language || 'en',
            type: 'answer_box',
          },
        });
      }

      // Add knowledge graph if available
      if (data.knowledge_graph) {
        const kg = data.knowledge_graph;
        results.push({
          title: kg.title,
          url: kg.source?.link || '',
          snippet: kg.description || '',
          content: JSON.stringify({
            ...kg,
            source: 'knowledge_graph',
          }),
          score: 0.9,
          provider: 'serpapi',
          metadata: {
            language: this.config.language || 'en',
            type: 'knowledge_graph',
            // Store kgmid in a generic property
            ...kg.kgmid ? { kgmid: kg.kgmid } : {},
          },
        });
      }

      // Add organic results
      if (data.organic_results) {
        results.push(
          ...data.organic_results.slice(0, maxResults || this.config.num).map((result: any, index: number) => ({
            title: result.title || 'Untitled',
            url: result.link,
            snippet: result.snippet || '',
            score: 0.8 - index * 0.05,
            provider: 'serpapi',
            metadata: {
              language: this.config.language || 'en',
              position: result.position,
              date: result.date,
              source: result.source,
              cached_page_link: result.cached_page_link,
            },
          }))
        );
      }

      elizaLogger.info(`[SerpAPI] Found ${results.length} results`);
      return results.slice(0, maxResults || this.config.num);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          elizaLogger.error('[SerpAPI] Invalid API key');
          throw new Error('Invalid SerpAPI key');
        } else if (error.response?.status === 429) {
          elizaLogger.error('[SerpAPI] Rate limit exceeded');
          throw new Error('SerpAPI rate limit exceeded');
        }
        elizaLogger.error(`[SerpAPI] API error: ${error.message}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
      }
      throw error;
    }
  }

  async searchNews(query: string, maxResults?: number): Promise<SearchResult[]> {
    try {
      elizaLogger.info(`[SerpAPI] Searching news for: ${query}`);

      const params = {
        q: query,
        api_key: this.apiKey,
        engine: 'google',
        tbm: 'nws', // News search
        num: maxResults || this.config.num,
        gl: this.config.country,
        hl: this.config.language,
      };

      const response = await axios.get(this.baseUrl, {
        params,
        timeout: 20000,
      });

      const data = response.data;
      const results: SearchResult[] = [];

      if (data.news_results) {
        results.push(
          ...data.news_results.map((item: any, index: number) => ({
            title: item.title,
            url: item.link,
            snippet: item.snippet || '',
            score: 0.8 - index * 0.05,
            provider: 'serpapi',
            metadata: {
              language: this.config.language || 'en',
              type: 'news',
              date: item.date,
              source: item.source,
              thumbnail: item.thumbnail,
            },
          }))
        );
      }

      elizaLogger.info(`[SerpAPI] Found ${results.length} news results`);
      return results;
    } catch (error) {
      elizaLogger.error('[SerpAPI] News search error:', error);
      throw error;
    }
  }

  async searchScholar(query: string, maxResults?: number): Promise<SearchResult[]> {
    try {
      elizaLogger.info(`[SerpAPI] Searching Google Scholar for: ${query}`);

      const params = {
        q: query,
        api_key: this.apiKey,
        engine: 'google_scholar',
        num: maxResults || this.config.num,
        hl: this.config.language,
      };

      const response = await axios.get(this.baseUrl, {
        params,
        timeout: 20000,
      });

      const data = response.data;
      const results: SearchResult[] = [];

      if (data.organic_results) {
        results.push(
          ...data.organic_results.map((item: any, index: number) => ({
            title: item.title,
            url: item.link,
            snippet: item.snippet || item.publication_info?.summary || '',
            content: JSON.stringify({
              authors: item.publication_info?.authors,
              cited_by: item.inline_links?.cited_by?.total,
              related_pages_link: item.inline_links?.related_pages_link,
              pdf_link: item.resources?.find((r: any) => r.file_format === 'PDF')?.link,
              type: 'academic',
            }),
            score: 0.9 - index * 0.05,
            provider: 'serpapi',
            metadata: {
              language: this.config.language || 'en',
              type: 'academic',
              author: item.publication_info?.authors?.join(', '),
              publishDate: item.publication_info?.summary,
              citations: item.inline_links?.cited_by?.total,
            },
          }))
        );
      }

      elizaLogger.info(`[SerpAPI] Found ${results.length} scholar results`);
      return results;
    } catch (error) {
      elizaLogger.error('[SerpAPI] Scholar search error:', error);
      throw error;
    }
  }

  async searchImages(query: string, maxResults?: number): Promise<Array<{ url: string; title: string; source: string }>> {
    try {
      elizaLogger.info(`[SerpAPI] Searching images for: ${query}`);

      const params = {
        q: query,
        api_key: this.apiKey,
        engine: 'google',
        tbm: 'isch', // Image search
        num: maxResults || 10,
        gl: this.config.country,
        hl: this.config.language,
      };

      const response = await axios.get(this.baseUrl, {
        params,
        timeout: 20000,
      });

      const data = response.data;
      const results: Array<{ url: string; title: string; source: string }> = [];

      if (data.images_results) {
        results.push(
          ...data.images_results.slice(0, maxResults || 10).map((img: any) => ({
            url: img.original || img.link,
            title: img.title || 'Untitled',
            source: img.source || img.link,
          }))
        );
      }

      elizaLogger.info(`[SerpAPI] Found ${results.length} image results`);
      return results;
    } catch (error) {
      elizaLogger.error('[SerpAPI] Image search error:', error);
      throw error;
    }
  }
} 