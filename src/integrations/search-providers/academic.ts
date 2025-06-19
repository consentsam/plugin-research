import { elizaLogger } from '@elizaos/core';
import axios from 'axios';
import { SearchResult, SourceType } from '../../types';

export interface AcademicSearchConfig {
  semanticScholarApiKey?: string;
  useProxy?: boolean;
  timeout?: number;
}

export class AcademicSearchProvider {
  public readonly name = 'Academic';
  private config: AcademicSearchConfig;

  constructor(config: AcademicSearchConfig = {}) {
    this.config = {
      timeout: 30000,
      useProxy: false,
      ...config,
    };
  }

  async search(query: string, maxResults: number = 20): Promise<SearchResult[]> {
    elizaLogger.info(`[Academic] Searching for: ${query}`);
    
    const results: SearchResult[] = [];
    
    // Search multiple academic sources in parallel
    const searches = await Promise.allSettled([
      this.searchSemanticScholar(query, Math.ceil(maxResults / 3)),
      this.searchArxiv(query, Math.ceil(maxResults / 3)),
      this.searchCrossRef(query, Math.ceil(maxResults / 3)),
    ]);
    
    for (const search of searches) {
      if (search.status === 'fulfilled') {
        results.push(...search.value);
      } else {
        elizaLogger.warn(`[Academic] Search failed:`, search.reason);
      }
    }
    
    // Sort by relevance score and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  private async searchSemanticScholar(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const url = 'https://api.semanticscholar.org/graph/v1/paper/search';
      const params = {
        query,
        limit,
        fields: 'paperId,title,abstract,authors,year,citationCount,url,venue,publicationDate',
      };
      
      const headers: any = {
        'User-Agent': 'Mozilla/5.0 (compatible; ElizaOS/1.0)',
      };
      
      if (this.config.semanticScholarApiKey) {
        headers['x-api-key'] = this.config.semanticScholarApiKey;
      }
      
      const response = await axios.get(url, {
        params,
        headers,
        timeout: this.config.timeout,
        validateStatus: (status) => status < 500, // Don't throw on 4xx errors
      });
      
      if (response.status === 429) {
        elizaLogger.warn('[Semantic Scholar] Rate limited, falling back to public rate');
        // Try again without API key
        delete headers['x-api-key'];
        const retryResponse = await axios.get(url, {
          params,
          headers,
          timeout: this.config.timeout,
        });
        response.data = retryResponse.data;
      } else if (response.status >= 400) {
        elizaLogger.warn(`[Semantic Scholar] HTTP ${response.status}: ${response.statusText}`);
        return [];
      }
      
      const results: SearchResult[] = [];
      
      for (const paper of response.data.data || []) {
        results.push({
          title: paper.title || 'Untitled',
          url: paper.url || `https://api.semanticscholar.org/paper/${paper.paperId}`,
          snippet: paper.abstract || 'No abstract available',
          score: this.calculateRelevanceScore(paper, query),
          provider: 'semantic-scholar',
          metadata: {
            type: 'academic',
            language: 'en',
            domain: 'semanticscholar.org',
            author: paper.authors?.map((a: any) => a.name),
            publishDate: paper.publicationDate,
            citationCount: paper.citationCount,
            venue: paper.venue,
            paperId: paper.paperId,
          } as any,
        });
      }
      
      elizaLogger.info(`[Semantic Scholar] Found ${results.length} results`);
      return results;
    } catch (error) {
      elizaLogger.error('[Semantic Scholar] Search error:', error);
      return [];
    }
  }

  private async searchArxiv(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const url = 'http://export.arxiv.org/api/query';
      const params = {
        search_query: `all:${query}`,
        start: 0,
        max_results: limit,
        sortBy: 'relevance',
        sortOrder: 'descending',
      };
      
      const response = await axios.get(url, {
        params,
        timeout: this.config.timeout,
      });
      
      // Parse XML response
      const results: SearchResult[] = [];
      const entries = response.data.match(/<entry>([\s\S]*?)<\/entry>/g) || [];
      
      for (const entry of entries) {
        const title = this.extractXmlValue(entry, 'title');
        const summary = this.extractXmlValue(entry, 'summary');
        const id = this.extractXmlValue(entry, 'id');
        const published = this.extractXmlValue(entry, 'published');
        const authors = this.extractXmlAuthors(entry);
        
        if (title && id) {
          results.push({
            title: title.trim(),
            url: id,
            snippet: summary?.trim() || 'No summary available',
            score: 0.85, // arXiv is highly reliable
            provider: 'arxiv',
                         metadata: {
               type: 'academic',
               language: 'en',
               domain: 'arxiv.org',
               author: authors,
               publishDate: published,
               arxivId: id.split('/').pop(),
             } as any,
          });
        }
      }
      
      elizaLogger.info(`[arXiv] Found ${results.length} results`);
      return results;
    } catch (error) {
      elizaLogger.error('[arXiv] Search error:', error);
      return [];
    }
  }

  private async searchCrossRef(query: string, limit: number): Promise<SearchResult[]> {
    try {
      // CrossRef requires more specific queries, so enhance simple queries
      const enhancedQuery = query.length < 5 ? `${query} research paper` : query;
      
      const url = 'https://api.crossref.org/works';
      const params = {
        query: enhancedQuery,
        rows: limit,
        select: 'DOI,title,author,published-print,abstract,container-title,URL,cited-by-count',
      };
      
      const response = await axios.get(url, {
        params,
        headers: {
          'User-Agent': 'ElizaOS/1.0 (mailto:research@eliza.ai)',
        },
        timeout: this.config.timeout,
        validateStatus: (status) => status < 500, // Don't throw on 4xx
      });
      
      if (response.status >= 400) {
        elizaLogger.warn(`[CrossRef] HTTP ${response.status}: Query too short or invalid`);
        return [];
      }
      
      const results: SearchResult[] = [];
      
      for (const item of response.data.message.items || []) {
        const title = Array.isArray(item.title) ? item.title[0] : item.title;
        const abstract = item.abstract?.replace(/<[^>]*>/g, ''); // Remove HTML tags
        
        results.push({
          title: title || 'Untitled',
          url: item.URL || `https://doi.org/${item.DOI}`,
          snippet: abstract || 'No abstract available',
          score: this.calculateCrossRefScore(item, query),
          provider: 'crossref',
                     metadata: {
             type: 'academic',
             language: 'en',
             domain: 'crossref.org',
             doi: item.DOI,
             author: item.author?.map((a: any) => `${a.given} ${a.family}`),
             publishDate: item['published-print']?.['date-parts']?.[0]?.join('-'),
             citationCount: item['cited-by-count'],
             journal: item['container-title']?.[0],
           } as any,
        });
      }
      
      elizaLogger.info(`[CrossRef] Found ${results.length} results`);
      return results;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        elizaLogger.error(`[CrossRef] API error: ${error.message}`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
      } else {
        elizaLogger.error('[CrossRef] Search error:', error.message || error);
      }
      return [];
    }
  }

  private calculateRelevanceScore(paper: any, query: string): number {
    let score = 0.7; // Base score for academic papers
    
    // Boost for citation count
    if (paper.citationCount > 100) score += 0.1;
    else if (paper.citationCount > 50) score += 0.05;
    
    // Boost for recent papers
    if (paper.year && paper.year >= new Date().getFullYear() - 2) score += 0.05;
    
    // Boost for title match
    const queryTerms = query.toLowerCase().split(' ');
    const titleLower = paper.title?.toLowerCase() || '';
    const matchCount = queryTerms.filter(term => titleLower.includes(term)).length;
    score += (matchCount / queryTerms.length) * 0.1;
    
    return Math.min(score, 1.0);
  }

  private calculateCrossRefScore(item: any, query: string): number {
    let score = 0.65; // Base score
    
    if (item['cited-by-count'] > 50) score += 0.1;
    if (item.abstract) score += 0.1;
    
    // Title relevance
    const queryTerms = query.toLowerCase().split(' ');
    const titleLower = (item.title?.[0] || '').toLowerCase();
    const matchCount = queryTerms.filter(term => titleLower.includes(term)).length;
    score += (matchCount / queryTerms.length) * 0.15;
    
    return Math.min(score, 1.0);
  }

  private extractXmlValue(xml: string, tag: string): string | undefined {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : undefined;
  }

  private extractXmlAuthors(xml: string): string[] {
    const authors: string[] = [];
    const authorMatches = xml.match(/<author>[\s\S]*?<\/author>/g) || [];
    
    for (const authorXml of authorMatches) {
      const name = this.extractXmlValue(authorXml, 'name');
      if (name) authors.push(name);
    }
    
    return authors;
  }
} 