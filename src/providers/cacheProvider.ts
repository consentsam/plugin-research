import { Provider, IAgentRuntime, Memory, State, ProviderResult } from '@elizaos/core';

// Cache manager interface
interface CacheManager {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, expirationTTL?: number) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

// Extend IAgentRuntime to include cacheManager
interface ExtendedRuntime extends IAgentRuntime {
  cacheManager?: CacheManager;
  logger?: any;
}

/**
 * Provider that adds caching context to agent conversations
 */
export const cacheProvider: Provider = {
  name: 'cacheProvider',
  description: 'Provides caching context and capabilities',

  get: async (
    runtime: ExtendedRuntime,
    message: Memory,
    state?: State
  ): Promise<ProviderResult> => {
    if (!runtime.cacheManager) {
      runtime.logger?.warn('Cache manager not available');
      return {
        text: 'Cache service is not available.',
        values: {},
      };
    }

    // Get cache statistics
    let cacheStats;
    try {
      cacheStats = await runtime.cacheManager.get('_stats');
    } catch (error) {
      runtime.logger?.error('Error getting cache stats:', error);
    }

    const stats = cacheStats ? JSON.parse(cacheStats) : { hits: 0, misses: 0, size: 0 };

    return {
      text: `Cache Status:
- Cache hits: ${stats.hits}
- Cache misses: ${stats.misses}
- Cache size: ${stats.size} items
- Cache is operational and ready for use`,
      values: {
        cacheAvailable: true,
        cacheStats: stats,
      },
    };
  },
};

/**
 * Middleware to add caching functionality to runtime functions
 */
export function cacheMiddleware(runtime: ExtendedRuntime) {
  if (!runtime.cacheManager) {
    runtime.logger?.warn('Cache middleware initialized without cache manager');
    return;
  }

  const originalComposeState = runtime.composeState;
  const originalProcessAction = runtime.processActions;

  // Wrap composeState with caching
  runtime.composeState = async (message: Memory, includeList?: string[], onlyInclude?: boolean) => {
    if (!runtime.cacheManager) {
      return originalComposeState.call(runtime, message, includeList, onlyInclude);
    }

    const cacheKey = `state:${message.agentId}:${message.roomId}:${message.entityId}`;

    try {
      const cached = await runtime.cacheManager.get(cacheKey);
      if (cached) {
        runtime.logger?.debug('Cache hit for state composition');
        const stats = await runtime.cacheManager.get('_stats');
        const currentStats = stats ? JSON.parse(stats) : { hits: 0, misses: 0, size: 0 };
        currentStats.hits++;
        await runtime.cacheManager.set('_stats', JSON.stringify(currentStats));
        return JSON.parse(cached);
      }
    } catch (error) {
      runtime.logger?.error('Error reading from cache:', error);
    }

    // Cache miss - compute and cache
    const state = await originalComposeState.call(runtime, message, includeList, onlyInclude);

    try {
      await runtime.cacheManager.set(cacheKey, JSON.stringify(state), 300); // 5 minute TTL
      runtime.logger?.debug('State cached successfully');

      const stats = await runtime.cacheManager.get('_stats');
      const currentStats = stats ? JSON.parse(stats) : { hits: 0, misses: 0, size: 0 };
      currentStats.misses++;
      currentStats.size++;
      await runtime.cacheManager.set('_stats', JSON.stringify(currentStats));
    } catch (error) {
      runtime.logger?.error('Error writing to cache:', error);
    }

    return state;
  };

  // Wrap processActions with cache invalidation
  runtime.processActions = async (
    message: Memory,
    responses: Memory[],
    state?: State,
    callback?: any
  ) => {
    const result = await originalProcessAction.call(runtime, message, responses, state, callback);

    if (runtime.cacheManager) {
      // Invalidate relevant caches after processing actions
      const cacheKey = `state:${message.agentId}:${message.roomId}:${message.entityId}`;
      try {
        await runtime.cacheManager.delete(cacheKey);
        runtime.logger?.debug('Cache invalidated after action processing');
      } catch (error) {
        runtime.logger?.error('Error invalidating cache:', error);
      }
    }

    return result;
  };
}
