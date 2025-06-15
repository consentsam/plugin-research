import { SearchResult } from '../types';
import { elizaLogger } from '@elizaos/core';
import { SearchProvider } from './rate-limiter';
import crypto from 'crypto';

export interface CacheConfig {
  ttlMinutes?: number;
  maxSize?: number;
  sizeCalculation?: (value: SearchResult[], key: string) => number;
}

// Built-in LRU cache implementation
class SimpleLRUCache<K, V> {
  private cache: Map<K, { value: V; timestamp: number }> = new Map();
  private maxSize: number;
  private ttl: number;

  constructor(options: { max: number; ttl: number }) {
    this.maxSize = options.max;
    this.ttl = options.ttl;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    
    // Check if expired
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }
    
    // Move to end (LRU behavior)
    this.cache.delete(key);
    this.cache.set(key, item);
    
    return item.value;
  }

  set(key: K, value: V): void {
    // Remove item if it exists (to reinsert at end)
    this.cache.delete(key);
    
    // Remove oldest items if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export class CachedSearchProvider implements SearchProvider {
  private cache: SimpleLRUCache<string, SearchResult[]>;
  public readonly name: string;

  constructor(
    private provider: SearchProvider,
    config: CacheConfig = {}
  ) {
    this.name = `Cached(${provider.name || 'Unknown'})`;
    
    this.cache = new SimpleLRUCache<string, SearchResult[]>({
      max: config.maxSize || 1000,
      ttl: (config.ttlMinutes || 60) * 60 * 1000, // Convert to milliseconds
    });
  }

  private getCacheKey(query: string, maxResults?: number): string {
    const keyData = `${query}:${maxResults || 'default'}`;
    return crypto.createHash('md5').update(keyData).digest('hex');
  }

  async search(query: string, maxResults?: number): Promise<SearchResult[]> {
    const cacheKey = this.getCacheKey(query, maxResults);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      elizaLogger.info(`[Cache] Hit for query: ${query}`);
      return cached;
    }
    
    elizaLogger.info(`[Cache] Miss for query: ${query}`);
    
    // Fetch from underlying provider
    const results = await this.provider.search(query, maxResults);
    
    // Store in cache
    if (results && results.length > 0) {
      this.cache.set(cacheKey, results);
    }
    
    return results;
  }
  
  // Cache management methods
  clear(): void {
    this.cache.clear();
  }
  
  getCacheStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.cache.size,
      hits: 0, // Could track this if needed
      misses: 0,
    };
  }
}

// Helper to create a cached provider with default settings
export function withCache(
  provider: SearchProvider,
  ttlMinutes: number = 60
): CachedSearchProvider {
  return new CachedSearchProvider(provider, { ttlMinutes });
} 