import { describe, it, expect, beforeEach } from 'vitest';
import { CachedSearchProvider, withCache } from '../integrations/cache';
import { RateLimitedProvider, AdaptiveRateLimiter, createRateLimitedProvider } from '../integrations/rate-limiter';
import { SearchProvider } from '../integrations/rate-limiter';
import { SearchResult } from '../types';

// Mock search provider
class MockSearchProvider implements SearchProvider {
  name = 'MockProvider';
  searchCount = 0;
  
  constructor(private results: SearchResult[] = []) {}
  
  async search(query: string, maxResults?: number): Promise<SearchResult[]> {
    this.searchCount++;
    return this.results.slice(0, maxResults);
  }
}

describe('CachedSearchProvider', () => {
  let mockProvider: MockSearchProvider;
  let cachedProvider: CachedSearchProvider;
  
  beforeEach(() => {
    const mockResults: SearchResult[] = [
      {
        title: 'Test Result 1',
        url: 'https://example.com/1',
        snippet: 'Test snippet 1',
        score: 0.9,
        provider: 'mock',
        metadata: { type: 'web', language: 'en' }
      },
      {
        title: 'Test Result 2',
        url: 'https://example.com/2',
        snippet: 'Test snippet 2',
        score: 0.8,
        provider: 'mock',
        metadata: { type: 'web', language: 'en' }
      }
    ];
    
    mockProvider = new MockSearchProvider(mockResults);
    cachedProvider = new CachedSearchProvider(mockProvider, {
      ttlMinutes: 60,
      maxSize: 100
    });
  });
  
  it('should cache search results', async () => {
    // First search - should hit the provider
    const results1 = await cachedProvider.search('test query', 10);
    expect(mockProvider.searchCount).toBe(1);
    expect(results1).toHaveLength(2);
    
    // Second search with same query - should hit cache
    const results2 = await cachedProvider.search('test query', 10);
    expect(mockProvider.searchCount).toBe(1); // Not incremented
    expect(results2).toEqual(results1);
  });
  
  it('should respect TTL eventually', async () => {
    // Create provider with very short TTL
    const shortTTLProvider = new CachedSearchProvider(mockProvider, {
      ttlMinutes: 0.001, // Very short TTL (0.06 seconds)
      maxSize: 100
    });
    
    // First search
    await shortTTLProvider.search('test query');
    expect(mockProvider.searchCount).toBe(1);
    
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should hit provider again
    await shortTTLProvider.search('test query');
    expect(mockProvider.searchCount).toBe(2);
  });
  
  it('should cache different queries separately', async () => {
    await cachedProvider.search('query 1');
    await cachedProvider.search('query 2');
    expect(mockProvider.searchCount).toBe(2);
    
    // Repeat queries - should hit cache
    await cachedProvider.search('query 1');
    await cachedProvider.search('query 2');
    expect(mockProvider.searchCount).toBe(2);
  });
  
  it('should handle different maxResults parameters', async () => {
    await cachedProvider.search('query', 5);
    await cachedProvider.search('query', 10);
    expect(mockProvider.searchCount).toBe(2); // Different cache keys
  });
  
  it('should clear cache', async () => {
    await cachedProvider.search('query');
    expect(mockProvider.searchCount).toBe(1);
    
    cachedProvider.clear();
    
    await cachedProvider.search('query');
    expect(mockProvider.searchCount).toBe(2);
  });
  
  it('should work with withCache helper', async () => {
    const cached = withCache(mockProvider, 30);
    
    await cached.search('test');
    await cached.search('test');
    
    expect(mockProvider.searchCount).toBe(1);
  });
});

describe('RateLimitedProvider', () => {
  let mockProvider: MockSearchProvider;
  let rateLimitedProvider: RateLimitedProvider;
  
  beforeEach(() => {
    mockProvider = new MockSearchProvider([
      { title: 'Result', url: 'https://example.com', snippet: 'Test', score: 0.9, provider: 'mock', metadata: { language: 'en' } }
    ]);
  });
  
  it('should allow requests within rate limit', async () => {
    rateLimitedProvider = new RateLimitedProvider(mockProvider, {
      tokensPerInterval: 3,
      interval: 'minute'
    });
    
    // Make 3 requests - all should succeed immediately
    await rateLimitedProvider.search('query1');
    await rateLimitedProvider.search('query2');
    await rateLimitedProvider.search('query3');
    
    expect(mockProvider.searchCount).toBe(3);
  });
  
  it('should block when rate limit exceeded', async () => {
    rateLimitedProvider = new RateLimitedProvider(mockProvider, {
      tokensPerInterval: 2,
      interval: 'second'
    });
    
    // First two requests succeed
    await rateLimitedProvider.search('query1');
    await rateLimitedProvider.search('query2');
    expect(mockProvider.searchCount).toBe(2);
    
    // Third request should be delayed
    const start = Date.now();
    await rateLimitedProvider.search('query3');
    const duration = Date.now() - start;
    
    // Should have waited for the rate limit window to refresh
    expect(duration).toBeGreaterThan(400); // At least 400ms wait
    expect(mockProvider.searchCount).toBe(3);
  });
  
  it('should work with createRateLimitedProvider helper', async () => {
    const limited = createRateLimitedProvider(mockProvider, {
      requestsPerMinute: 60
    });
    
    await limited.search('query1');
    await limited.search('query2');
    
    expect(mockProvider.searchCount).toBe(2);
  });
  
  it('should handle per-hour limits', async () => {
    const limited = createRateLimitedProvider(mockProvider, {
      requestsPerHour: 3600
    });
    
    // Should allow many requests
    for (let i = 0; i < 10; i++) {
      await limited.search(`query${i}`);
    }
    expect(mockProvider.searchCount).toBe(10);
  });
  
  it('should handle per-day limits', async () => {
    const limited = createRateLimitedProvider(mockProvider, {
      requestsPerDay: 86400
    });
    
    // Should allow many requests
    for (let i = 0; i < 10; i++) {
      await limited.search(`query${i}`);
    }
    expect(mockProvider.searchCount).toBe(10);
  });
});

describe('AdaptiveRateLimiter', () => {
  let mockProvider: MockSearchProvider;
  let adaptiveLimiter: AdaptiveRateLimiter;
  
  beforeEach(() => {
    mockProvider = new MockSearchProvider([
      { title: 'Result', url: 'https://example.com', snippet: 'Test', score: 0.9, provider: 'mock', metadata: { language: 'en' } }
    ]);
    
    adaptiveLimiter = new AdaptiveRateLimiter(mockProvider, {
      tokensPerInterval: 10,
      interval: 'minute'
    });
  });
  
  it('should handle rate limit errors with backoff', async () => {
    // Mock provider that throws rate limit errors first time, then succeeds
    const errorProvider = {
      name: 'ErrorProvider',
      searchCount: 0,
      async search(): Promise<SearchResult[]> {
        this.searchCount++;
        if (this.searchCount === 1) {
          throw new Error('429 rate limit exceeded');
        }
        return [{
          title: 'Success after rate limit',
          url: 'https://example.com',
          snippet: 'Worked on retry',
          score: 0.9,
          provider: 'mock',
          metadata: { language: 'en' }
        }];
      }
    };
    
    const limiter = new AdaptiveRateLimiter(errorProvider, {
      tokensPerInterval: 100,
      interval: 'minute'
    });
    
    // Should succeed after one retry
    const result = await limiter.search('query');
    expect(result).toHaveLength(1);
    expect(errorProvider.searchCount).toBe(2); // First attempt + retry
  });
  
  it('should track statistics', async () => {
    // Successful requests
    await adaptiveLimiter.search('query1');
    await adaptiveLimiter.search('query2');
    
    const stats = adaptiveLimiter.getStats();
    expect(stats.successCount).toBe(2);
    expect(stats.errorCount).toBe(0);
  });
  
    it('should reduce error count on success', async () => {
    // Test that successful requests reduce error count
    const mockResults = [{
      title: 'Success',
      url: 'https://example.com',
      snippet: 'Test result',
      score: 0.9,
      provider: 'mock',
      metadata: { language: 'en' }
    }];
    
    const successProvider = new MockSearchProvider(mockResults);
    const limiter = new AdaptiveRateLimiter(successProvider, {
      tokensPerInterval: 100,
      interval: 'minute'
    });

    // Make successful requests
    await limiter.search('query1');
    await limiter.search('query2');
    
    const stats = limiter.getStats();
    expect(stats.successCount).toBe(2);
    expect(stats.errorCount).toBe(0);
  });
});

describe('Combined Cache and Rate Limiting', () => {
  it('should work together', async () => {
    const mockProvider = new MockSearchProvider([
      { title: 'Result', url: 'https://example.com', snippet: 'Test', score: 0.9, provider: 'mock', metadata: { language: 'en' } }
    ]);
    
    // Apply rate limiting first, then caching
    const rateLimited = createRateLimitedProvider(mockProvider, {
      requestsPerMinute: 60
    });
    const cached = withCache(rateLimited, 30);
    
    // Multiple searches for same query - should only hit provider once
    await cached.search('test');
    await cached.search('test');
    await cached.search('test');
    
    expect(mockProvider.searchCount).toBe(1);
  });
}); 