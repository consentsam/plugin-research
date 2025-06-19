import { elizaLogger } from '@elizaos/core';
import { SearchResult } from '../types';

export interface ProcessingConfig {
  deduplicationThreshold: number; // Similarity threshold for duplicate detection
  qualityThreshold: number; // Minimum quality score to include
  maxResults: number; // Maximum results to return
  prioritizeRecent: boolean; // Prioritize more recent sources
  diversityWeight: number; // Weight for domain diversity
}

export interface ProcessedResults {
  results: SearchResult[];
  duplicatesRemoved: number;
  qualityFiltered: number;
  totalProcessed: number;
  diversityScore: number;
}

export class SearchResultProcessor {
  private config: ProcessingConfig;

  constructor(config: Partial<ProcessingConfig> = {}) {
    this.config = {
      deduplicationThreshold: 0.85,
      qualityThreshold: 0.3,
      maxResults: 50,
      prioritizeRecent: true,
      diversityWeight: 0.3,
      ...config,
    };
  }

  async processResults(results: SearchResult[]): Promise<ProcessedResults> {
    elizaLogger.info(`Processing ${results.length} search results`);
    const startTime = Date.now();

    let processed = [...results];
    let duplicatesRemoved = 0;
    let qualityFiltered = 0;

    // Step 1: Quality filtering
    const beforeQuality = processed.length;
    processed = this.filterByQuality(processed);
    qualityFiltered = beforeQuality - processed.length;

    // Step 2: Deduplication
    const beforeDedup = processed.length;
    processed = await this.deduplicateResults(processed);
    duplicatesRemoved = beforeDedup - processed.length;

    // Step 3: Ranking and scoring
    processed = this.rankResults(processed);

    // Step 4: Diversity optimization
    processed = this.optimizeForDiversity(processed);

    // Step 5: Limit results
    processed = processed.slice(0, this.config.maxResults);

    const diversityScore = this.calculateDiversityScore(processed);
    const duration = Date.now() - startTime;

    elizaLogger.info(
      `Result processing completed in ${duration}ms: ` +
      `${processed.length} final results (removed ${duplicatesRemoved} duplicates, ` +
      `${qualityFiltered} low-quality), diversity: ${diversityScore.toFixed(2)}`
    );

    return {
      results: processed,
      duplicatesRemoved,
      qualityFiltered,
      totalProcessed: results.length,
      diversityScore,
    };
  }

  private filterByQuality(results: SearchResult[]): SearchResult[] {
    return results.filter(result => {
      // Basic quality checks
      if (!result.title || !result.content || result.content.length < 50) {
        return false;
      }

      // Score-based filtering
      if (result.score && result.score < this.config.qualityThreshold) {
        return false;
      }

      // Content quality checks
      if (this.isLowQualityContent(result)) {
        return false;
      }

      return true;
    });
  }

  private isLowQualityContent(result: SearchResult): boolean {
    if (!result.content) return true;
    const content = result.content.toLowerCase();
    const title = result.title.toLowerCase();

    // Check for spam indicators
    const spamIndicators = [
      'click here',
      'buy now',
      'limited time',
      'free download',
      'miracle cure',
      'get rich quick',
      'weight loss',
      'casino',
      'porn',
      'xxx',
    ];

    if (spamIndicators.some(indicator => content.includes(indicator) || title.includes(indicator))) {
      return true;
    }

    // Check for very repetitive content
    const words = content.split(/\s+/);
    const wordCounts = words.reduce((counts, word) => {
      counts[word] = (counts[word] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const maxRepetition = Math.max(...Object.values(wordCounts));
    if (maxRepetition > words.length * 0.1) { // More than 10% repetition
      return true;
    }

    // Check for insufficient substantive content
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length < 3) {
      return true;
    }

    return false;
  }

  private async deduplicateResults(results: SearchResult[]): Promise<SearchResult[]> {
    const deduplicated: SearchResult[] = [];
    const processed = new Set<string>();

    for (const result of results) {
      let isDuplicate = false;

      // URL-based deduplication (exact match)
      if (processed.has(result.url)) {
        continue;
      }

      // Content similarity-based deduplication
      for (const existing of deduplicated) {
        const similarity = this.calculateContentSimilarity(result, existing);
        if (similarity > this.config.deduplicationThreshold) {
          isDuplicate = true;
          // Keep the one with higher score or more recent
          if (this.shouldReplaceExisting(result, existing)) {
            const index = deduplicated.indexOf(existing);
            deduplicated[index] = result;
          }
          break;
        }
      }

      if (!isDuplicate) {
        deduplicated.push(result);
        processed.add(result.url);
      }
    }

    return deduplicated;
  }

  private calculateContentSimilarity(a: SearchResult, b: SearchResult): number {
    // Calculate similarity based on title and content
    const titleSim = this.calculateTextSimilarity(a.title, b.title);
    const contentSim = this.calculateTextSimilarity(
      (a.content || '').substring(0, 500),
      (b.content || '').substring(0, 500)
    );
    const snippetSim = this.calculateTextSimilarity(a.snippet || '', b.snippet || '');

    // Weighted average
    return titleSim * 0.4 + contentSim * 0.4 + snippetSim * 0.2;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity based on word overlap
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private shouldReplaceExisting(newResult: SearchResult, existing: SearchResult): boolean {
    // Prefer higher scored results
    if (newResult.score && existing.score && newResult.score > existing.score) {
      return true;
    }

    // Prefer more recent sources if configured
    if (this.config.prioritizeRecent) {
      const newDate = this.extractDate(newResult);
      const existingDate = this.extractDate(existing);
      
      if (newDate && existingDate && newDate > existingDate) {
        return true;
      }
    }

    // Prefer longer, more substantive content
    if (newResult.content && existing.content && newResult.content.length > existing.content.length * 1.5) {
      return true;
    }

    return false;
  }

  private extractDate(result: SearchResult): Date | null {
    // Try to extract date from metadata
    if (result.metadata?.publishDate) {
      return new Date(result.metadata.publishDate);
    }

    // Try to extract from content
    if (result.content) {
      const dateMatches = result.content.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]20\d{2})\b/);
      if (dateMatches) {
        return new Date(dateMatches[0]);
      }
    }

    return null;
  }

  private rankResults(results: SearchResult[]): SearchResult[] {
    return results.map(result => {
      let score = result.score || 0.5;

      // Boost academic sources
      if (result.provider === 'academic' || this.isAcademicSource(result)) {
        score *= 1.3;
      }

      // Boost reputable domains
      if (this.isReputableDomain(result.url)) {
        score *= 1.2;
      }

      // Boost recent content
      const date = this.extractDate(result);
      if (date) {
        const ageInDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays < 365) {
          score *= 1.1;
        }
      }

      // Boost longer, more comprehensive content
      if (result.content && result.content.length > 2000) {
        score *= 1.1;
      }

      return {
        ...result,
        score: Math.min(score, 1.0), // Cap at 1.0
      };
    }).sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  private isAcademicSource(result: SearchResult): boolean {
    const academicDomains = [
      'scholar.google.com',
      'arxiv.org',
      'pubmed.ncbi.nlm.nih.gov',
      'ieee.org',
      'acm.org',
      'springer.com',
      'sciencedirect.com',
      'wiley.com',
      'nature.com',
      'science.org',
      '.edu',
      '.ac.uk',
    ];

    return academicDomains.some(domain => result.url.includes(domain));
  }

  private isReputableDomain(url: string): boolean {
    const reputableDomains = [
      'wikipedia.org',
      'britannica.com',
      'stanford.edu',
      'mit.edu',
      'harvard.edu',
      'nytimes.com',
      'bbc.com',
      'reuters.com',
      'ap.org',
      'cnn.com',
      'washingtonpost.com',
      'theguardian.com',
      'economist.com',
      'github.com',
      'stackoverflow.com',
    ];

    return reputableDomains.some(domain => url.includes(domain));
  }

  private optimizeForDiversity(results: SearchResult[]): SearchResult[] {
    if (this.config.diversityWeight === 0) {
      return results;
    }

    const diversified: SearchResult[] = [];
    const domainCounts = new Map<string, number>();
    const providerCounts = new Map<string, number>();

    for (const result of results) {
      const domain = new URL(result.url).hostname;
      const provider = result.provider || 'unknown';

      const domainCount = domainCounts.get(domain) || 0;
      const providerCount = providerCounts.get(provider) || 0;

      // Apply diversity penalty for over-represented domains/providers
      let diversityPenalty = 1.0;
      if (domainCount > 2) {
        diversityPenalty *= 0.8;
      }
      if (providerCount > 5) {
        diversityPenalty *= 0.9;
      }

      const adjustedScore = (result.score || 0.5) * 
        (1 - this.config.diversityWeight + this.config.diversityWeight * diversityPenalty);

      diversified.push({
        ...result,
        score: adjustedScore,
      });

      domainCounts.set(domain, domainCount + 1);
      providerCounts.set(provider, providerCount + 1);
    }

    return diversified.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  private calculateDiversityScore(results: SearchResult[]): number {
    if (results.length === 0) return 0;

    const domains = new Set(results.map(r => new URL(r.url).hostname));
    const providers = new Set(results.map(r => r.provider));

    // Calculate diversity as ratio of unique domains/providers to total results
    const domainDiversity = domains.size / results.length;
    const providerDiversity = providers.size / results.length;

    return (domainDiversity + providerDiversity) / 2;
  }
}