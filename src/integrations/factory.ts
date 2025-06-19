import { IAgentRuntime, elizaLogger } from '@elizaos/core';
import { SearchProvider, ContentExtractor } from './rate-limiter';
import { TavilySearchProvider } from './search-providers/tavily';
import { SerperSearchProvider } from './search-providers/serper';
import { AcademicSearchProvider } from './search-providers/academic';
import { FirecrawlContentExtractor, FirecrawlConfig } from './content-extractors/firecrawl';
import { PlaywrightContentExtractor } from './content-extractors/playwright';
import { CachedSearchProvider } from './cache';
import { RateLimitedSearchProvider } from './rate-limiter';
import { ExaSearchProvider } from './search-providers/exa';
import { SerpAPISearchProvider } from './search-providers/serpapi';
import { StagehandGoogleSearchProvider } from './search-providers/stagehand-google';

export type { SearchProvider, ContentExtractor };

// Wrapper to make FirecrawlContentExtractor compatible with ContentExtractor interface
class FirecrawlWrapper implements ContentExtractor {
  private extractor: FirecrawlContentExtractor;
  
  constructor(apiKey: string) {
    const config: FirecrawlConfig = { apiKey };
    this.extractor = new FirecrawlContentExtractor(config);
  }
  
  async extractContent(url: string): Promise<{ content: string; metadata?: any }> {
    const result = await this.extractor.extractContent(url);
    if (!result) {
      return { content: '', metadata: {} };
    }
    return result;
  }
}

// Wrapper to make PlaywrightContentExtractor compatible with ContentExtractor interface
class PlaywrightWrapper implements ContentExtractor {
  private extractor: PlaywrightContentExtractor;
  
  constructor() {
    this.extractor = new PlaywrightContentExtractor();
  }
  
  async extractContent(url: string): Promise<{ content: string; metadata?: any }> {
    const result = await this.extractor.extractContent(url);
    if (!result) {
      return { content: '', metadata: {} };
    }
    return result;
  }
}

// StagehandContentExtractor - uses browserbase/stagehand for extraction
class StagehandContentExtractor implements ContentExtractor {
  constructor(private runtime: IAgentRuntime) {}
  
  async extractContent(url: string): Promise<{ content: string; title?: string; metadata?: any }> {
    try {
      const stagehandService = this.runtime.getService('stagehand');
      if (!stagehandService) {
        return { content: '', title: undefined, metadata: undefined };
      }
      
      // Cast to any to access custom methods
      const stagehand = stagehandService as any;
      const session = await stagehand.getCurrentSession?.() || 
                     await stagehand.createSession?.(`extract-${Date.now()}`);
      
      if (!session) {
        return { content: '', title: undefined, metadata: undefined };
      }
      
      await session.page.goto(url);
      await session.page.waitForLoadState('domcontentloaded');
      
      // Extract main content using AI
      const extracted = await session.stagehand.extract({
        instruction: 'Extract the main article content, title, and any important metadata. Exclude navigation, ads, and sidebars.',
        schema: {
          title: 'string',
          content: 'string',
          author: 'string?',
          publishDate: 'string?',
          description: 'string?'
        }
      });
      
      return {
        content: extracted.content || '',
        title: extracted.title,
        metadata: {
          author: extracted.author,
          publishDate: extracted.publishDate,
          description: extracted.description
        }
      };
    } catch (error) {
      elizaLogger.error('Stagehand content extraction error:', error);
      return { content: '', title: undefined, metadata: undefined };
    }
  }
}

export function createSearchProvider(type: string, runtime: any): SearchProvider {
  const apiKey = runtime.getSetting(`${type.toUpperCase()}_API_KEY`);

  switch (type) {
    case 'tavily':
      if (!apiKey) {
        elizaLogger.info('Tavily API key not found, search features will be limited');
        // Return a mock provider that returns empty results
        return {
          name: 'tavily-mock',
          search: async () => []
        };
      }
      return new TavilySearchProvider({ apiKey });

    case 'serper':
      if (!apiKey) {
        elizaLogger.info('Serper API key not found, search features will be limited');
        return {
          name: 'serper-mock',
          search: async () => []
        };
      }
      return new SerperSearchProvider({ apiKey });
      
    case 'exa':
      if (!apiKey) {
        elizaLogger.info('Exa API key not found, search features will be limited');
        return {
          name: 'exa-mock',
          search: async () => []
        };
      }
      return new ExaSearchProvider({ apiKey });
      
    case 'serpapi':
      if (!apiKey) {
        elizaLogger.info('SerpAPI key not found, search features will be limited');
        return {
          name: 'serpapi-mock', 
          search: async () => []
        };
      }
      return new SerpAPISearchProvider({ apiKey });

    case 'academic':
      return new AcademicSearchProvider(runtime);

    case 'web':
    default:
      // Try different providers in order of preference
      const providers = ['TAVILY', 'EXA', 'SERPAPI', 'SERPER'];
      for (const provider of providers) {
        const key = runtime.getSetting(`${provider}_API_KEY`);
        if (key) {
          elizaLogger.info(`Using ${provider} as web search provider`);
          switch (provider) {
            case 'TAVILY':
              return new TavilySearchProvider({ apiKey: key });
            case 'EXA':
              return new ExaSearchProvider({ apiKey: key });
            case 'SERPAPI':
              return new SerpAPISearchProvider({ apiKey: key });
            case 'SERPER':
              return new SerperSearchProvider({ apiKey: key });
          }
        }
      }
      
      elizaLogger.info('No web search provider configured, using mock provider');
      return {
        name: 'mock-web',
        search: async () => []
      };
  }
}

export function createContentExtractor(runtime: IAgentRuntime): ContentExtractor | null {
  // Priority order:
  // 1. Stagehand/Browserbase (if available) - preferred as it's less likely to be blocked
  try {
    const stagehandService = runtime.getService('stagehand');
    if (stagehandService) {
      elizaLogger.info('Using Stagehand content extractor (via browserbase)');
      return new StagehandContentExtractor(runtime);
    }
  } catch (e) {
    // Service not available
  }
  
  // 2. Firecrawl (if API key present)
  const firecrawlKey = runtime.getSetting('FIRECRAWL_API_KEY');
  if (firecrawlKey) {
    elizaLogger.info('Using Firecrawl content extractor');
    return new FirecrawlWrapper(firecrawlKey);
  }
  
  // 3. Playwright (as fallback - can get blocked)
  elizaLogger.info('Using Playwright content extractor (may get blocked on some sites)');
  return new PlaywrightWrapper();
}

export function createAcademicSearchProvider(runtime: IAgentRuntime): SearchProvider {
  const semanticScholarKey = runtime.getSetting('SEMANTIC_SCHOLAR_API_KEY');
  elizaLogger.info('Using Academic search provider (Semantic Scholar, arXiv, CrossRef)');
  
  const provider = new AcademicSearchProvider({
    semanticScholarApiKey: semanticScholarKey,
    timeout: 30000,
  });
  
  // Wrap with rate limiting and caching
  const rateLimited = new RateLimitedSearchProvider(provider, {
    tokensPerInterval: 100, // Academic sources allow more requests
    interval: 'minute'
  });
  
  return new CachedSearchProvider(rateLimited);
} 