import axios, { AxiosError } from 'axios';
import { elizaLogger } from '@elizaos/core';
import { z } from 'zod';

// Firecrawl API response schema
const FirecrawlResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    content: z.string().optional(),
    markdown: z.string().optional(),
    html: z.string().optional(),
    metadata: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      language: z.string().optional(),
      keywords: z.string().optional(),
      robots: z.string().optional(),
      ogTitle: z.string().optional(),
      ogDescription: z.string().optional(),
      ogImage: z.string().optional(),
      ogUrl: z.string().optional(),
      canonical: z.string().optional(),
    }).optional(),
    links: z.array(z.string()).optional(),
    images: z.array(z.string()).optional(),
  }).optional(),
  error: z.string().optional(),
});

export interface FirecrawlConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  includeHtml?: boolean;
  includeMarkdown?: boolean;
  includeMetadata?: boolean;
  includeLinks?: boolean;
  waitFor?: number;
  screenshot?: boolean;
}

export interface ExtractedContent {
  content: string;
  markdown?: string;
  html?: string;
  metadata?: {
    title?: string;
    description?: string;
    language?: string;
    ogImage?: string;
    [key: string]: any;
  };
  links?: string[];
  images?: string[];
}

export class FirecrawlContentExtractor {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly config: FirecrawlConfig;

  constructor(config: FirecrawlConfig) {
    if (!config.apiKey) {
      throw new Error('Firecrawl API key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.firecrawl.dev/v0';
    this.config = {
      timeout: 60000, // 60 seconds default
      includeHtml: false,
      includeMarkdown: true,
      includeMetadata: true,
      includeLinks: true,
      waitFor: 0,
      screenshot: false,
      ...config,
    };
  }

  async extractContent(url: string): Promise<ExtractedContent | null> {
    const startTime = Date.now();
    
    try {
      elizaLogger.info(`[Firecrawl] Extracting content from: ${url}`);
      
      const response = await axios.post(
        `${this.baseUrl}/scrape`,
        {
          url,
          formats: this.getFormats(),
          waitFor: this.config.waitFor,
          screenshot: this.config.screenshot,
          includeTags: ['main', 'article', 'section', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'code', 'pre'],
          excludeTags: ['nav', 'footer', 'aside', 'script', 'style'],
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: this.config.timeout,
        }
      );

      // Validate response
      const validatedData = FirecrawlResponseSchema.parse(response.data);
      
      if (!validatedData.success || !validatedData.data) {
        elizaLogger.error(`[Firecrawl] Failed to extract content: ${validatedData.error}`);
        return null;
      }

      const data = validatedData.data;
      const content = data.markdown || data.content || '';
      
      if (!content) {
        elizaLogger.warn(`[Firecrawl] No content extracted from ${url}`);
        return null;
      }

      const duration = Date.now() - startTime;
      elizaLogger.info(`[Firecrawl] Content extracted in ${duration}ms (${content.length} characters)`);
      
      return {
        content,
        markdown: data.markdown,
        html: this.config.includeHtml ? data.html : undefined,
        metadata: data.metadata,
        links: data.links,
        images: data.images,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        // Handle specific error cases
        if (axiosError.response?.status === 401) {
          elizaLogger.error('[Firecrawl] Invalid API key');
          throw new Error('Invalid Firecrawl API key');
        } else if (axiosError.response?.status === 429) {
          elizaLogger.error('[Firecrawl] Rate limit exceeded');
          throw new Error('Firecrawl rate limit exceeded');
        } else if (axiosError.response?.status === 402) {
          elizaLogger.error('[Firecrawl] Payment required - check your plan');
          throw new Error('Firecrawl payment required');
        } else if (axiosError.code === 'ECONNABORTED') {
          elizaLogger.error(`[Firecrawl] Request timeout after ${duration}ms`);
          throw new Error('Firecrawl extraction timeout');
        }
        
        elizaLogger.error(`[Firecrawl] API error: ${axiosError.message}`, {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
        });
      } else if (error instanceof z.ZodError) {
        elizaLogger.error('[Firecrawl] Invalid response format:', error.issues);
      } else {
        elizaLogger.error('[Firecrawl] Unknown error:', error);
      }
      
      return null;
    }
  }

  async extractBatch(urls: string[]): Promise<Map<string, ExtractedContent | null>> {
    elizaLogger.info(`[Firecrawl] Extracting content from ${urls.length} URLs`);
    
    const results = new Map<string, ExtractedContent | null>();
    
    // Process in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchPromises = batch.map(url => 
        this.extractContent(url)
          .then(content => ({ url, content }))
          .catch(error => {
            elizaLogger.error(`[Firecrawl] Failed to extract ${url}:`, error);
            return { url, content: null };
          })
      );
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ url, content }) => {
        results.set(url, content);
      });
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  async crawlSite(startUrl: string, maxPages: number = 50): Promise<Map<string, ExtractedContent | null>> {
    try {
      elizaLogger.info(`[Firecrawl] Starting site crawl from: ${startUrl}`);
      
      const response = await axios.post(
        `${this.baseUrl}/crawl`,
        {
          url: startUrl,
          crawlerOptions: {
            maxCrawledLinks: maxPages,
            includes: [], // Add patterns to include
            excludes: ['*/tag/*', '*/category/*', '*/page/*'], // Common pagination patterns
          },
          pageOptions: {
            includeMarkdown: true,
            includeHtml: false,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: (this.config.timeout || 60000) * 2, // Longer timeout for crawls
        }
      );

      const jobId = response.data?.jobId;
      
      if (!jobId) {
        elizaLogger.error('[Firecrawl] No job ID returned from crawl request');
        return new Map();
      }
      
      // Poll for completion
      return await this.pollCrawlJob(jobId, maxPages);
    } catch (error) {
      elizaLogger.error('[Firecrawl] Site crawl error:', error);
      return new Map();
    }
  }

  private async pollCrawlJob(jobId: string, maxPages: number): Promise<Map<string, ExtractedContent | null>> {
    const maxAttempts = 60; // 5 minutes max
    const pollInterval = 5000; // 5 seconds
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/crawl/status/${jobId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
            },
          }
        );

        const { status, data } = response.data;
        
        if (status === 'completed' && data) {
          const results = new Map<string, ExtractedContent | null>();
          
          data.forEach((page: any) => {
            if (page.markdown || page.content) {
              results.set(page.url, {
                content: page.markdown || page.content,
                markdown: page.markdown,
                metadata: page.metadata,
              });
            }
          });
          
          elizaLogger.info(`[Firecrawl] Crawl completed: ${results.size} pages extracted`);
          return results;
        } else if (status === 'failed') {
          elizaLogger.error('[Firecrawl] Crawl job failed');
          return new Map();
        }
        
        // Still processing
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        elizaLogger.error('[Firecrawl] Error polling crawl job:', error);
        return new Map();
      }
    }
    
    elizaLogger.error('[Firecrawl] Crawl job timeout');
    return new Map();
  }

  private getFormats(): string[] {
    const formats: string[] = ['text'];
    if (this.config.includeMarkdown) formats.push('markdown');
    if (this.config.includeHtml) formats.push('html');
    return formats;
  }

  // Get current API usage
  async getUsage(): Promise<{ used: number; limit: number; remaining: number } | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/usage`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      
      return {
        used: response.data.used || 0,
        limit: response.data.limit || 0,
        remaining: response.data.remaining || 0,
      };
    } catch (error) {
      elizaLogger.warn('[Firecrawl] Could not fetch usage data');
      return null;
    }
  }
} 