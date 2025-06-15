# Deep Research Plugin - Real API Integration Guide

This guide shows how to integrate real search APIs with the deep research plugin for production use.

## Available Search API Providers

### 1. Tavily API Integration

Tavily provides a search API specifically designed for AI applications.

```typescript
// src/integrations/tavily.ts
import axios from 'axios';
import { SearchResult } from '../types';

export class TavilySearchProvider {
  private apiKey: string;
  private baseUrl = 'https://api.tavily.com/search';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    try {
      const response = await axios.post(this.baseUrl, {
        api_key: this.apiKey,
        query,
        search_depth: 'advanced',
        include_answer: true,
        include_raw_content: true,
        max_results: maxResults,
      });

      return response.data.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.snippet || result.content?.substring(0, 200),
        content: result.raw_content,
      }));
    } catch (error) {
      console.error('Tavily search error:', error);
      return [];
    }
  }
}
```

### 2. Serper API Integration

Serper provides Google search results via API.

```typescript
// src/integrations/serper.ts
import axios from 'axios';
import { SearchResult } from '../types';

export class SerperSearchProvider {
  private apiKey: string;
  private baseUrl = 'https://google.serper.dev/search';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    try {
      const response = await axios.post(
        this.baseUrl,
        {
          q: query,
          num: maxResults,
        },
        {
          headers: {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      const results: SearchResult[] = [];
      
      // Process organic results
      if (response.data.organic) {
        results.push(...response.data.organic.map((result: any) => ({
          title: result.title,
          url: result.link,
          snippet: result.snippet,
        })));
      }

      // Include knowledge graph if available
      if (response.data.knowledgeGraph) {
        results.unshift({
          title: response.data.knowledgeGraph.title,
          url: response.data.knowledgeGraph.website || '',
          snippet: response.data.knowledgeGraph.description,
        });
      }

      return results.slice(0, maxResults);
    } catch (error) {
      console.error('Serper search error:', error);
      return [];
    }
  }
}
```

### 3. Brave Search API Integration

```typescript
// src/integrations/brave.ts
import axios from 'axios';
import { SearchResult } from '../types';

export class BraveSearchProvider {
  private apiKey: string;
  private baseUrl = 'https://api.search.brave.com/res/v1/web/search';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, maxResults: number = 10): Promise<SearchResult[]> {
    try {
      const response = await axios.get(this.baseUrl, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.apiKey,
        },
        params: {
          q: query,
          count: maxResults,
        },
      });

      return response.data.web.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.description,
      }));
    } catch (error) {
      console.error('Brave search error:', error);
      return [];
    }
  }
}
```

## Content Extraction Integration

### 1. Firecrawl Integration

Firecrawl provides web scraping and content extraction.

```typescript
// src/integrations/firecrawl.ts
import axios from 'axios';

export class FirecrawlContentExtractor {
  private apiKey: string;
  private baseUrl = 'https://api.firecrawl.dev/v0';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async extractContent(url: string): Promise<string | null> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/scrape`,
        { url },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      return response.data.data.markdown || response.data.data.content;
    } catch (error) {
      console.error('Firecrawl extraction error:', error);
      return null;
    }
  }
}
```

### 2. Playwright/Puppeteer Integration

For JavaScript-heavy sites that require browser rendering:

```typescript
// src/integrations/browser-content.ts
import { chromium } from 'playwright';

export class BrowserContentExtractor {
  async extractContent(url: string): Promise<string | null> {
    let browser;
    
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      
      // Set a reasonable timeout
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait for content to load
      await page.waitForSelector('body', { timeout: 10000 });
      
      // Extract main content
      const content = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        // Try to find main content areas
        const mainContent = 
          document.querySelector('main')?.innerText ||
          document.querySelector('article')?.innerText ||
          document.querySelector('[role="main"]')?.innerText ||
          document.body.innerText;
        
        return mainContent;
      });
      
      return content;
    } catch (error) {
      console.error('Browser extraction error:', error);
      return null;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}
```

## Updating the Research Service

To integrate these providers into the ResearchService:

```typescript
// Update src/service.ts

import { TavilySearchProvider } from './integrations/tavily';
import { SerperSearchProvider } from './integrations/serper';
import { FirecrawlContentExtractor } from './integrations/firecrawl';
import { BrowserContentExtractor } from './integrations/browser-content';

export class ResearchService extends Service {
  private searchProvider: TavilySearchProvider | SerperSearchProvider | null = null;
  private contentExtractor: FirecrawlContentExtractor | BrowserContentExtractor | null = null;

  constructor(runtime: IAgentRuntime, config?: ResearchConfig) {
    super(runtime);
    
    // Initialize search provider based on available API keys
    const tavilyKey = runtime.getSetting('TAVILY_API_KEY');
    const serperKey = runtime.getSetting('SERPER_API_KEY');
    
    if (tavilyKey) {
      this.searchProvider = new TavilySearchProvider(tavilyKey);
    } else if (serperKey) {
      this.searchProvider = new SerperSearchProvider(serperKey);
    }
    
    // Initialize content extractor
    const firecrawlKey = runtime.getSetting('FIRECRAWL_API_KEY');
    if (firecrawlKey) {
      this.contentExtractor = new FirecrawlContentExtractor(firecrawlKey);
    } else {
      this.contentExtractor = new BrowserContentExtractor();
    }
  }

  private async performWebSearch(query: string): Promise<SearchResult[]> {
    if (this.searchProvider) {
      return this.searchProvider.search(query, this.researchConfig.maxSearchResults);
    }
    
    // Fallback to mock results if no provider configured
    return this.generateMockResults(query);
  }

  private async fetchWebContent(url: string): Promise<string | null> {
    if (this.contentExtractor) {
      return this.contentExtractor.extractContent(url);
    }
    
    // Fallback to mock content
    return this.generateMockContent(url);
  }
}
```

## Environment Configuration

Add these to your `.env` file:

```bash
# Search API Keys (choose one)
TAVILY_API_KEY=your_tavily_api_key_here
SERPER_API_KEY=your_serper_api_key_here
BRAVE_SEARCH_API_KEY=your_brave_api_key_here

# Content Extraction
FIRECRAWL_API_KEY=your_firecrawl_api_key_here

# Optional: Configure search preferences
RESEARCH_MAX_RESULTS=10
RESEARCH_TIMEOUT=300000
RESEARCH_ENABLE_CITATIONS=true
RESEARCH_LANGUAGE=en
```

## Production Deployment Considerations

### 1. Rate Limiting
Most APIs have rate limits. Implement rate limiting:

```typescript
import { RateLimiter } from 'limiter';

class RateLimitedSearchProvider {
  private limiter: RateLimiter;
  
  constructor(requestsPerMinute: number = 60) {
    this.limiter = new RateLimiter({
      tokensPerInterval: requestsPerMinute,
      interval: 'minute',
    });
  }
  
  async search(query: string): Promise<SearchResult[]> {
    await this.limiter.removeTokens(1);
    return this.performSearch(query);
  }
}
```

### 2. Caching
Cache search results to reduce API calls:

```typescript
import { LRUCache } from 'lru-cache';

class CachedSearchProvider {
  private cache: LRUCache<string, SearchResult[]>;
  
  constructor() {
    this.cache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 60, // 1 hour
    });
  }
  
  async search(query: string): Promise<SearchResult[]> {
    const cached = this.cache.get(query);
    if (cached) return cached;
    
    const results = await this.performSearch(query);
    this.cache.set(query, results);
    return results;
  }
}
```

### 3. Error Handling and Fallbacks
Implement robust error handling with fallbacks:

```typescript
class ResilientSearchService {
  private providers: SearchProvider[] = [];
  
  async search(query: string): Promise<SearchResult[]> {
    for (const provider of this.providers) {
      try {
        const results = await provider.search(query);
        if (results.length > 0) return results;
      } catch (error) {
        console.error(`Provider ${provider.name} failed:`, error);
        // Continue to next provider
      }
    }
    
    // All providers failed, return empty results
    return [];
  }
}
```

## Testing with Real APIs

Update your E2E tests to use real APIs:

```typescript
// src/tests/real-api-test.ts
import { ResearchService } from '../service';

describe('Real API Integration Tests', () => {
  let service: ResearchService;
  
  beforeAll(() => {
    // Ensure API keys are set in environment
    if (!process.env.TAVILY_API_KEY && !process.env.SERPER_API_KEY) {
      throw new Error('No search API keys configured for testing');
    }
    
    service = new ResearchService(runtime);
  });
  
  it('should perform real web search', async () => {
    const project = await service.createResearchProject(
      'Latest TypeScript features in 2024'
    );
    
    // Wait for research to complete
    await waitForCompletion(project.id, 120000); // 2 minutes
    
    const completed = await service.getProject(project.id);
    expect(completed.sources.length).toBeGreaterThan(0);
    expect(completed.findings.length).toBeGreaterThan(0);
    expect(completed.report).toBeDefined();
  });
});
```

## Monitoring and Observability

Add logging and metrics:

```typescript
import { Logger } from 'winston';
import { Counter, Histogram } from 'prom-client';

const searchCounter = new Counter({
  name: 'research_searches_total',
  help: 'Total number of searches performed',
  labelNames: ['provider', 'status'],
});

const searchDuration = new Histogram({
  name: 'research_search_duration_seconds',
  help: 'Duration of search operations',
  labelNames: ['provider'],
});

class MonitoredSearchProvider {
  async search(query: string): Promise<SearchResult[]> {
    const timer = searchDuration.startTimer({ provider: this.name });
    
    try {
      const results = await this.performSearch(query);
      searchCounter.inc({ provider: this.name, status: 'success' });
      return results;
    } catch (error) {
      searchCounter.inc({ provider: this.name, status: 'error' });
      throw error;
    } finally {
      timer();
    }
  }
}
```

## Cost Optimization

Different APIs have different pricing models:

- **Tavily**: $0.001 per search (as of 2024)
- **Serper**: $0.05 per 100 searches
- **Firecrawl**: $0.001 per page scraped

Implement cost tracking and budgets:

```typescript
class CostAwareSearchService {
  private monthlyBudget: number;
  private currentSpend: number = 0;
  
  async search(query: string): Promise<SearchResult[]> {
    const estimatedCost = this.calculateSearchCost();
    
    if (this.currentSpend + estimatedCost > this.monthlyBudget) {
      throw new Error('Monthly search budget exceeded');
    }
    
    const results = await this.performSearch(query);
    this.currentSpend += estimatedCost;
    
    return results;
  }
}
``` 