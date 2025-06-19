import axios, { AxiosError } from 'axios';
import { SearchResult } from '../../types';
import { elizaLogger } from '@elizaos/core';
import { z } from 'zod';

// NPM Registry API response schema validation
const NPMPackageSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  version: z.string(),
  keywords: z.array(z.string()).optional(),
  author: z.union([
    z.string(),
    z.object({
      name: z.string(),
      email: z.string().optional(),
    })
  ]).optional(),
  maintainers: z.array(z.object({
    name: z.string(),
    email: z.string().optional(),
  })).optional(),
  repository: z.union([
    z.string(),
    z.object({
      type: z.string().optional(),
      url: z.string(),
    })
  ]).optional(),
  homepage: z.string().optional(),
  license: z.string().optional(),
  readme: z.string().optional(),
  'dist-tags': z.object({
    latest: z.string(),
  }).optional(),
  time: z.record(z.string()).optional(),
});

const NPMSearchSchema = z.object({
  objects: z.array(z.object({
    package: z.object({
      name: z.string(),
      version: z.string(),
      description: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      author: z.union([
        z.string(),
        z.object({
          name: z.string(),
          email: z.string().optional(),
        })
      ]).optional(),
      maintainers: z.array(z.object({
        username: z.string(),
        email: z.string().optional(),
      })).optional(),
      repository: z.union([
        z.string(),
        z.object({
          type: z.string().optional(),
          url: z.string(),
        })
      ]).optional(),
      links: z.object({
        npm: z.string().optional(),
        homepage: z.string().optional(),
        repository: z.string().optional(),
        bugs: z.string().optional(),
      }).optional(),
    }),
    score: z.object({
      final: z.number(),
      detail: z.object({
        quality: z.number(),
        popularity: z.number(),
        maintenance: z.number(),
      }),
    }),
    searchScore: z.number().optional(),
  })),
  total: z.number(),
  time: z.string(),
});

export interface NPMConfig {
  maxResults?: number;
  includeDetails?: boolean;
  quality?: number; // Minimum quality score (0-1)
  popularity?: number; // Minimum popularity score (0-1)
}

export class NPMSearchProvider {
  public readonly name = 'npm';
  private readonly registryUrl = 'https://registry.npmjs.org';
  private readonly searchUrl = 'https://registry.npmjs.com/-/v1/search';
  private readonly config: NPMConfig;

  constructor(config: NPMConfig = {}) {
    this.config = {
      maxResults: 20,
      includeDetails: true,
      quality: 0.3,
      popularity: 0.1,
      ...config,
    };
  }

  async search(query: string, maxResults?: number): Promise<SearchResult[]> {
    const startTime = Date.now();
    const limit = Math.min(maxResults || this.config.maxResults || 20, 100); // NPM search API limit

    // Handle empty query
    if (!query || query.trim().length === 0) {
      elizaLogger.debug('[NPM] Empty query, returning no results');
      return [];
    }

    try {
      elizaLogger.info(`[NPM] Searching for: ${query}`);

      const searchResponse = await axios.get(this.searchUrl, {
        params: {
          text: query,
          size: limit,
          quality: this.config.quality,
          popularity: this.config.popularity,
        },
        headers: {
          'User-Agent': 'ElizaOS-Research-Agent/1.0',
        },
        timeout: 10000,
      });

      const searchData = NPMSearchSchema.parse(searchResponse.data);
      
      // Get detailed information if requested
      let results: SearchResult[] = [];
      
      if (this.config.includeDetails) {
        // Get detailed package info for top results
        const topPackages = searchData.objects.slice(0, Math.min(limit, 10));
        const detailedResults = await Promise.all(
          topPackages.map(async (item) => {
            const details = await this.getPackageDetails(item.package.name);
            return this.convertToSearchResult(item, details);
          })
        );
        results = detailedResults.filter(Boolean);
      } else {
        // Use search results directly
        results = searchData.objects
          .slice(0, limit)
          .map((item) => this.convertToSearchResult(item, null));
      }

      const duration = Date.now() - startTime;
      elizaLogger.info(`[NPM] Found ${results.length} results in ${duration}ms`);

      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      elizaLogger.error(`[NPM] Search failed after ${duration}ms:`, error);
      
      // Wrap the error to prevent serialization issues
      if (axios.isAxiosError(error)) {
        throw new Error(`NPM search failed: ${error.message} (${error.response?.status || 'no status'})`);
      }
      throw new Error(`NPM search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getPackageDetails(packageName: string): Promise<any | null> {
    try {
      const response = await axios.get(`${this.registryUrl}/${encodeURIComponent(packageName)}`, {
        headers: {
          'User-Agent': 'ElizaOS-Research-Agent/1.0',
        },
        timeout: 5000,
      });

      return NPMPackageSchema.parse(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        elizaLogger.debug(`[NPM] Package ${packageName} not found`);
      } else {
        elizaLogger.warn(`[NPM] Failed to get details for ${packageName}:`, 
          error instanceof Error ? error.message : String(error));
      }
      return null;
    }
  }

  private convertToSearchResult(item: any, details?: any): SearchResult {
    const pkg = item.package;
    const score = item.score || { final: 0.5, detail: { quality: 0.5, popularity: 0.5, maintenance: 0.5 } };
    
    // Use detailed info if available, fallback to search result data
    const packageData = details || pkg;
    const packageUrl = `https://www.npmjs.com/package/${pkg.name}`;
    
    // Extract author information
    let author = '';
    if (packageData.author) {
      if (typeof packageData.author === 'string') {
        author = packageData.author;
      } else if (packageData.author.name) {
        author = packageData.author.name;
      }
    }

    // Extract repository URL
    let repositoryUrl = '';
    if (packageData.repository) {
      if (typeof packageData.repository === 'string') {
        repositoryUrl = packageData.repository;
      } else if (packageData.repository.url) {
        repositoryUrl = packageData.repository.url
          .replace(/^git\+/, '')
          .replace(/\.git$/, '')
          .replace(/^git:\/\//, 'https://');
      }
    }

    // Create comprehensive description
    let description = pkg.description || packageData.description || '';
    if (pkg.keywords && pkg.keywords.length > 0) {
      description += `\nKeywords: ${pkg.keywords.join(', ')}`;
    }
    if (packageData.license) {
      description += `\nLicense: ${packageData.license}`;
    }

    // Add quality metrics
    let qualityInfo = '';
    if (score.detail) {
      qualityInfo = `\nQuality: ${(score.detail.quality * 100).toFixed(0)}% | ` +
                   `Popularity: ${(score.detail.popularity * 100).toFixed(0)}% | ` +
                   `Maintenance: ${(score.detail.maintenance * 100).toFixed(0)}%`;
    }

    return {
      title: `${pkg.name} v${pkg.version}`,
      url: packageUrl,
      snippet: description.substring(0, 300) + (description.length > 300 ? '...' : ''),
      content: description + qualityInfo,
      score: score.final,
      provider: 'npm',
      metadata: {
        language: 'javascript',
        author: author ? [author] : [],
        type: 'package',
        domain: 'npmjs.com',
      },
    };
  }

  /**
   * Get specific package information by name
   */
  async getPackage(packageName: string): Promise<SearchResult | null> {
    try {
      const pkg = await this.getPackageDetails(packageName);
      if (!pkg) return null;

      // Create a mock search item for conversion
      const mockSearchItem = {
        package: {
          name: pkg.name,
          version: pkg['dist-tags']?.latest || pkg.version,
          description: pkg.description,
          keywords: pkg.keywords,
          author: pkg.author,
          links: {
            npm: `https://www.npmjs.com/package/${pkg.name}`,
            homepage: pkg.homepage,
          },
        },
        score: {
          final: 1.0, // Assume high relevance for direct lookup
          detail: {
            quality: 0.8,
            popularity: 0.7,
            maintenance: 0.8,
          },
        },
      };

      return this.convertToSearchResult(mockSearchItem, pkg);
    } catch (error) {
      elizaLogger.error(`[NPM] Failed to get package ${packageName}:`, error);
      return null;
    }
  }

  /**
   * Search for packages by scope (e.g., @types, @angular)
   */
  async searchByScope(scope: string, maxResults?: number): Promise<SearchResult[]> {
    const query = `scope:${scope}`;
    return this.search(query, maxResults);
  }

  /**
   * Search for packages by maintainer
   */
  async searchByMaintainer(maintainer: string, maxResults?: number): Promise<SearchResult[]> {
    const query = `maintainer:${maintainer}`;
    return this.search(query, maxResults);
  }

  /**
   * Search for packages with specific keywords
   */
  async searchByKeywords(keywords: string[], maxResults?: number): Promise<SearchResult[]> {
    const query = `keywords:${keywords.join(',')}`;
    return this.search(query, maxResults);
  }

  /**
   * Get trending/popular packages in a category
   */
  async getTrendingPackages(category?: string, maxResults?: number): Promise<SearchResult[]> {
    let query = 'boost-exact:false';
    if (category) {
      query += ` ${category}`;
    }
    
    return this.search(query, maxResults);
  }
}