import { IAgentRuntime, elizaLogger } from '@elizaos/core';
import { CachedSearchProvider } from './cache';
import { RateLimitedSearchProvider, SearchProvider, ContentExtractor } from './rate-limiter';
import { TavilySearchProvider } from './search-providers/tavily';
import { SerperSearchProvider } from './search-providers/serper';
import { DuckDuckGoSearchProvider } from './search-providers/duckduckgo';
import { StagehandGoogleSearchProvider } from './search-providers/stagehand-google';
import { FirecrawlContentExtractor, FirecrawlConfig } from './content-extractors/firecrawl';
import { PlaywrightContentExtractor } from './content-extractors/playwright';

export { SearchProvider, ContentExtractor };

// Wrapper to make FirecrawlContentExtractor compatible with ContentExtractor interface
class FirecrawlWrapper implements ContentExtractor {
  private extractor: FirecrawlContentExtractor;
  
  constructor(apiKey: string) {
    const config: FirecrawlConfig = { apiKey };
    this.extractor = new FirecrawlContentExtractor(config);
  }
  
  async extractContent(url: string): Promise<{ content: string; title?: string; metadata?: any }> {
    const result = await this.extractor.extractContent(url);
    if (!result) {
      return { content: '', title: undefined, metadata: undefined };
    }
    // Handle both string and ExtractedContent types
    if (typeof result === 'string') {
      return { content: result, title: undefined, metadata: undefined };
    }
    return {
      content: result.content || '',
      title: result.metadata?.title,
      metadata: result.metadata
    };
  }
}

// Wrapper to make PlaywrightContentExtractor compatible with ContentExtractor interface
class PlaywrightWrapper implements ContentExtractor {
  private extractor: PlaywrightContentExtractor;
  
  constructor() {
    this.extractor = new PlaywrightContentExtractor();
  }
  
  async extractContent(url: string): Promise<{ content: string; title?: string; metadata?: any }> {
    const result = await this.extractor.extractContent(url);
    if (!result) {
      return { content: '', title: undefined, metadata: undefined };
    }
    // Handle both string and ExtractedContent types
    if (typeof result === 'string') {
      return { content: result, title: undefined, metadata: undefined };
    }
    return {
      content: result.content || '',
      title: result.metadata?.title,
      metadata: result.metadata
    };
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

export function createSearchProvider(runtime: IAgentRuntime): SearchProvider | null {
  let provider: SearchProvider | null = null;
  
  // Priority order:
  // 1. Tavily (if API key present)
  const tavilyKey = runtime.getSetting('TAVILY_API_KEY');
  if (tavilyKey) {
    elizaLogger.info('Using Tavily search provider');
    provider = new TavilySearchProvider(tavilyKey);
  }
  
  // 2. Serper (if API key present)
  if (!provider) {
    const serperKey = runtime.getSetting('SERPER_API_KEY');
    if (serperKey) {
      elizaLogger.info('Using Serper search provider');
      provider = new SerperSearchProvider(serperKey);
    }
  }
  
  // 3. Stagehand/Google (if browserbase available)
  if (!provider) {
    try {
      const stagehandService = runtime.getService('stagehand');
      if (stagehandService) {
        elizaLogger.info('Using Stagehand Google search provider');
        provider = new StagehandGoogleSearchProvider(runtime);
      }
    } catch (e) {
      // Service not available
    }
  }
  
  // 4. DuckDuckGo (always available as fallback)
  if (!provider) {
    elizaLogger.info('Using DuckDuckGo search provider (no API key required)');
    provider = new DuckDuckGoSearchProvider();
  }
  
  // Wrap with rate limiting and caching
  if (provider) {
    const rateLimited = new RateLimitedSearchProvider(provider, {
      tokensPerInterval: 60,
      interval: 'minute'
    });
    return new CachedSearchProvider(rateLimited);
  }
  
  return null;
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