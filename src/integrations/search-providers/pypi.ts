import axios, { AxiosError } from 'axios';
import { SearchResult } from '../../types';
import { elizaLogger } from '@elizaos/core';
import { z } from 'zod';

// PyPI API response schema validation
const PyPIPackageSchema = z.object({
  info: z.object({
    name: z.string(),
    summary: z.string().optional(),
    description: z.string().optional(),
    home_page: z.string().optional(),
    author: z.string().optional(),
    author_email: z.string().optional(),
    maintainer: z.string().optional(),
    version: z.string(),
    keywords: z.string().optional(),
    license: z.string().optional(),
    classifiers: z.array(z.string()).optional(),
    project_urls: z.record(z.string()).optional(),
  }),
  urls: z.array(z.object({
    filename: z.string(),
    url: z.string(),
    upload_time: z.string().optional(),
  })).optional(),
});

const PyPISearchSchema = z.object({
  projects: z.array(z.object({
    name: z.string(),
    version: z.string(),
    description: z.string().optional(),
  })),
});

export interface PyPIConfig {
  maxResults?: number;
  includeClassifiers?: boolean;
}

export class PyPISearchProvider {
  public readonly name = 'pypi';
  private readonly baseUrl = 'https://pypi.org/pypi';
  private readonly searchUrl = 'https://pypi.org/search/';
  private readonly config: PyPIConfig;

  constructor(config: PyPIConfig = {}) {
    this.config = {
      maxResults: 20,
      includeClassifiers: true,
      ...config,
    };
  }

  async search(query: string, maxResults?: number): Promise<SearchResult[]> {
    const startTime = Date.now();
    const limit = maxResults || this.config.maxResults || 20;

    // Handle empty query
    if (!query || query.trim().length === 0) {
      elizaLogger.debug('[PyPI] Empty query, returning no results');
      return [];
    }

    try {
      elizaLogger.info(`[PyPI] Searching for: ${query}`);

      // Search PyPI (no official search API, using HTML scraping as fallback)
      // For production use, consider using a proper PyPI API client
      const searchUrl = `https://pypi.org/search/?q=${encodeURIComponent(query)}`;
      const searchResponse = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'ElizaOS-Research-Agent/1.0',
        },
        timeout: 10000,
      });

      // Extract package names from search results
      const packageMatches = searchResponse.data.match(
        /href="\/project\/([^\/]+)\//g
      ) || [];

      const packages = packageMatches
        .map((match: string) => {
          const name = match.match(/href="\/project\/([^\/]+)\//)?.[1];
          return name ? { name } : null;
        })
        .filter(Boolean)
        .slice(0, limit);

      // Get detailed information for each package
      const results = await Promise.all(
        packages.map(async (pkg: any, index: number) => {
          const details = await this.getPackageDetails(pkg.name);
          if (details) {
            return this.convertToSearchResult(details, index);
          }
          return null;
        })
      );

      const validResults = results.filter(Boolean) as SearchResult[];
      const duration = Date.now() - startTime;
      elizaLogger.info(`[PyPI] Found ${validResults.length} results in ${duration}ms`);

      return validResults;
    } catch (error) {
      const duration = Date.now() - startTime;
      elizaLogger.error(`[PyPI] Search failed after ${duration}ms:`, error);
      
      // Wrap the error to prevent serialization issues
      if (axios.isAxiosError(error)) {
        throw new Error(`PyPI search failed: ${error.message} (${error.response?.status || 'no status'})`);
      }
      throw new Error(`PyPI search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getPackageDetails(packageName: string): Promise<any | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/${packageName}/json`, {
        headers: {
          'User-Agent': 'ElizaOS-Research-Agent/1.0',
        },
        timeout: 5000,
      });

      return PyPIPackageSchema.parse(response.data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        elizaLogger.debug(`[PyPI] Package ${packageName} not found`);
      } else {
        elizaLogger.warn(`[PyPI] Failed to get details for ${packageName}:`, 
          error instanceof Error ? error.message : String(error));
      }
      return null;
    }
  }

  private convertToSearchResult(pkg: any, index: number): SearchResult {
    const info = pkg.info;
    const packageUrl = `https://pypi.org/project/${info.name}/`;
    
    // Create a comprehensive description
    let description = info.summary || info.description || '';
    if (info.keywords) {
      description += `\nKeywords: ${info.keywords}`;
    }
    if (info.license) {
      description += `\nLicense: ${info.license}`;
    }

    // Extract relevant classifiers for additional context
    let classifiers = '';
    if (this.config.includeClassifiers && info.classifiers) {
      const relevantClassifiers = info.classifiers
        .filter((c: string) => 
          c.includes('Development Status') || 
          c.includes('Intended Audience') ||
          c.includes('Programming Language') ||
          c.includes('Topic')
        )
        .slice(0, 5);
      
      if (relevantClassifiers.length > 0) {
        classifiers = `\nClassifiers: ${relevantClassifiers.join(', ')}`;
      }
    }

    return {
      title: `${info.name} v${info.version}`,
      url: packageUrl,
      snippet: description.substring(0, 300) + (description.length > 300 ? '...' : ''),
      content: description + classifiers,
      score: Math.max(0.1, 1.0 - (index * 0.05)), // Decrease score based on result order
      provider: 'pypi',
      metadata: {
        language: 'python',
        author: info.author || info.maintainer ? [info.author || info.maintainer] : [],
        type: 'package',
        domain: 'pypi.org',
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

      return this.convertToSearchResult(pkg, 0);
    } catch (error) {
      elizaLogger.error(`[PyPI] Failed to get package ${packageName}:`, error);
      return null;
    }
  }

  /**
   * Search for packages by category/classifier
   */
  async searchByCategory(category: string, maxResults?: number): Promise<SearchResult[]> {
    // This would require scraping PyPI's browse page or using alternative APIs
    // For now, return empty array and log the limitation
    elizaLogger.warn('[PyPI] Category search not implemented - use keyword search instead');
    return [];
  }
}