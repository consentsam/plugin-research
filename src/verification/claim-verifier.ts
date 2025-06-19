import { IAgentRuntime, elizaLogger } from '@elizaos/core';
import crypto from 'crypto';
import { RESEARCH_PROMPTS, formatPrompt, getPromptConfig } from '../prompts/research-prompts';
import {
    FactualClaim,
    ResearchSource,
    VerificationStatus
} from '../types';

export interface VerificationEvidence {
  sourceUrl: string;
  relevantExcerpt: string;
  supports: boolean;
  confidence: number;
  reasoning: string;
}

export interface CrossReferenceResult {
  claim: FactualClaim;
  primaryEvidence: VerificationEvidence;
  corroboratingEvidence: VerificationEvidence[];
  contradictingEvidence: VerificationEvidence[];
  overallVerificationStatus: VerificationStatus;
  aggregateConfidence: number;
  consensusLevel: 'strong' | 'moderate' | 'weak' | 'disputed';
}

export interface SourceReliability {
  domain: string;
  score: number;
  factors: {
    peerReviewed: boolean;
    authorCredentials: boolean;
    publicationReputation: number;
    citationCount: number;
  };
}

/**
 * Advanced claim verification system that actually checks sources
 */
export class ClaimVerifier {
  private verificationCache = new Map<string, CrossReferenceResult>();
  private sourceReliabilityCache = new Map<string, SourceReliability>();

  constructor(
    private runtime: IAgentRuntime,
    private contentExtractor: any
  ) {}

  /**
   * Verify a claim by retrieving actual source content and cross-referencing
   */
  async verifyClaim(
    claim: FactualClaim,
    primarySource: ResearchSource,
    allSources: ResearchSource[]
  ): Promise<CrossReferenceResult> {
    const cacheKey = this.generateCacheKey(claim);
    
    // Check cache first
    if (this.verificationCache.has(cacheKey)) {
      return this.verificationCache.get(cacheKey)!;
    }

    elizaLogger.info(`[ClaimVerifier] Verifying claim: "${claim.statement}"`);

    // Step 1: Verify against primary source
    const primaryEvidence = await this.verifyAgainstSource(claim, primarySource);

    // Step 2: Find corroborating sources
    const relatedSources = this.findRelatedSources(claim, allSources, primarySource);
    const corroboratingEvidence: VerificationEvidence[] = [];
    const contradictingEvidence: VerificationEvidence[] = [];

    // Step 3: Cross-reference with related sources
    for (const source of relatedSources) {
      const evidence = await this.verifyAgainstSource(claim, source);
      
      if (evidence.supports) {
        corroboratingEvidence.push(evidence);
      } else if (evidence.confidence > 0.6) {
        // Only count as contradicting if we're confident it contradicts
        contradictingEvidence.push(evidence);
      }
    }

    // Step 4: Determine overall verification status
    const result = this.aggregateVerificationResults(
      claim,
      primaryEvidence,
      corroboratingEvidence,
      contradictingEvidence
    );

    // Cache the result
    this.verificationCache.set(cacheKey, result);

    elizaLogger.info(`[ClaimVerifier] Verification complete: ${result.overallVerificationStatus} (${result.aggregateConfidence})`);

    return result;
  }

  /**
   * Verify claim against a specific source by retrieving content
   */
  private async verifyAgainstSource(
    claim: FactualClaim,
    source: ResearchSource
  ): Promise<VerificationEvidence> {
    try {
      // Get source content (from cache or fresh extraction)
      let sourceContent = source.fullContent;
      
      if (!sourceContent || sourceContent.length < 1000) {
        // Re-extract if we don't have enough content
        elizaLogger.info(`[ClaimVerifier] Extracting content from ${source.url}`);
        const extracted = await this.contentExtractor.extractContent(source.url);
        sourceContent = extracted?.content || source.snippet || '';
      }

      // Ensure sourceContent is defined
      if (!sourceContent) {
        sourceContent = '';
      }

      // Find relevant excerpt
      const relevantExcerpt = this.findRelevantExcerpt(claim.statement, sourceContent);

      // Use advanced prompt to verify
      const verificationPrompt = formatPrompt(RESEARCH_PROMPTS.CLAIM_VERIFICATION, {
        claim: claim.statement,
        sourceUrl: source.url,
        evidence: claim.supportingEvidence.join(' '),
        sourceContent: relevantExcerpt
      });

      const config = getPromptConfig('verification');
      const response = await this.runtime.useModel(config.modelType, {
        messages: [
          { 
            role: 'system', 
            content: 'You are a rigorous fact-checker. Be extremely strict about verification.' 
          },
          { role: 'user', content: verificationPrompt }
        ],
        temperature: config.temperature,
        max_tokens: config.maxTokens || 1500,
      });

      const result = this.parseVerificationResponse(response);

      return {
        sourceUrl: source.url,
        relevantExcerpt,
        supports: result.status === 'VERIFIED' || result.status === 'PARTIAL',
        confidence: result.confidence,
        reasoning: result.reasoning
      };

    } catch (error) {
      elizaLogger.error(`[ClaimVerifier] Error verifying against ${source.url}:`, error);
      return {
        sourceUrl: source.url,
        relevantExcerpt: '',
        supports: false,
        confidence: 0,
        reasoning: 'Failed to verify due to extraction error'
      };
    }
  }

  /**
   * Find the most relevant excerpt from source content
   */
  private findRelevantExcerpt(claim: string, content: string): string {
    const claimTerms = claim.toLowerCase().split(/\s+/).filter(term => term.length > 3);
    const sentences = content.split(/[.!?]+/);
    
    // Score each sentence by term overlap
    const scoredSentences = sentences.map(sentence => {
      const sentenceLower = sentence.toLowerCase();
      const termMatches = claimTerms.filter(term => sentenceLower.includes(term)).length;
      const score = termMatches / claimTerms.length;
      return { sentence, score };
    });

    // Sort by relevance
    scoredSentences.sort((a, b) => b.score - a.score);

    // Take top 5 most relevant sentences and their context
    const relevantSentences = scoredSentences.slice(0, 5);
    
    // Build excerpt with context
    let excerpt = '';
    for (const { sentence } of relevantSentences) {
      const sentenceIndex = sentences.indexOf(sentence);
      const contextStart = Math.max(0, sentenceIndex - 1);
      const contextEnd = Math.min(sentences.length - 1, sentenceIndex + 1);
      
      const contextualExcerpt = sentences.slice(contextStart, contextEnd + 1).join('. ');
      if (!excerpt.includes(contextualExcerpt)) {
        excerpt += contextualExcerpt + '\n\n[...]\n\n';
      }
    }

    return excerpt.substring(0, 5000); // Limit to 5k chars
  }

  /**
   * Find sources that might corroborate or contradict the claim
   */
  private findRelatedSources(
    claim: FactualClaim,
    allSources: ResearchSource[],
    excludeSource: ResearchSource
  ): ResearchSource[] {
    // Extract key entities and concepts from claim
    const claimTerms = this.extractKeyTerms(claim.statement);
    
    return allSources
      .filter(source => source.id !== excludeSource.id)
      .map(source => {
        // Score relevance based on term overlap
        const sourceText = (source.title + ' ' + source.snippet).toLowerCase();
        const matchCount = claimTerms.filter(term => sourceText.includes(term.toLowerCase())).length;
        const relevanceScore = matchCount / claimTerms.length;
        
        return { source, relevanceScore };
      })
      .filter(item => item.relevanceScore > 0.3)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5) // Top 5 most relevant
      .map(item => item.source);
  }

  /**
   * Extract key terms from a claim for matching
   */
  private extractKeyTerms(claim: string): string[] {
    // Remove common words and extract significant terms
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'that', 'with', 'for', 'of', 'in', 'to']);
    
    return claim
      .split(/\s+/)
      .map(word => word.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(word => word.length > 3 && !stopWords.has(word));
  }

  /**
   * Parse LLM verification response
   */
  private parseVerificationResponse(response: any): {
    status: string;
    confidence: number;
    reasoning: string;
  } {
    try {
      const content = typeof response === 'string' ? response : response.content || '';
      
      // Try to parse as JSON first
      if (content.includes('{') && content.includes('}')) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            status: parsed.status || 'UNVERIFIED',
            confidence: parsed.confidence || 0,
            reasoning: parsed.reasoning || parsed.justification || ''
          };
        }
      }
      
      // Fallback: Extract from text
      const statusMatch = content.match(/Status:\s*(VERIFIED|PARTIALLY_VERIFIED|UNVERIFIED|CONTRADICTED)/i);
      const confidenceMatch = content.match(/Confidence:\s*([0-9.]+)/i);
      
      return {
        status: statusMatch?.[1] || 'UNVERIFIED',
        confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0,
        reasoning: content
      };
    } catch (error) {
      elizaLogger.error('[ClaimVerifier] Error parsing verification response:', error);
      return {
        status: 'UNVERIFIED',
        confidence: 0,
        reasoning: 'Failed to parse verification response'
      };
    }
  }

  /**
   * Aggregate verification results from multiple sources
   */
  private aggregateVerificationResults(
    claim: FactualClaim,
    primaryEvidence: VerificationEvidence,
    corroboratingEvidence: VerificationEvidence[],
    contradictingEvidence: VerificationEvidence[]
  ): CrossReferenceResult {
    // Calculate aggregate confidence
    const supportingEvidence = primaryEvidence.supports 
      ? [primaryEvidence, ...corroboratingEvidence]
      : corroboratingEvidence;
    
    const totalSupporting = supportingEvidence.length;
    const totalContradicting = contradictingEvidence.length;
    const totalEvidence = totalSupporting + totalContradicting;

    // Weighted confidence calculation
    let aggregateConfidence = 0;
    if (totalEvidence > 0) {
      const supportWeight = supportingEvidence.reduce((sum, e) => sum + e.confidence, 0);
      const contradictWeight = contradictingEvidence.reduce((sum, e) => sum + e.confidence, 0);
      
      aggregateConfidence = (supportWeight - contradictWeight * 0.5) / totalEvidence;
      aggregateConfidence = Math.max(0, Math.min(1, aggregateConfidence));
    }

    // Determine verification status
    let overallStatus: VerificationStatus;
    let consensusLevel: 'strong' | 'moderate' | 'weak' | 'disputed';

    if (totalContradicting > totalSupporting) {
      overallStatus = VerificationStatus.DISPUTED;
      consensusLevel = 'disputed';
    } else if (totalSupporting === 0) {
      overallStatus = VerificationStatus.UNVERIFIED;
      consensusLevel = 'weak';
    } else if (totalContradicting === 0 && totalSupporting >= 2) {
      overallStatus = VerificationStatus.VERIFIED;
      consensusLevel = 'strong';
    } else if (totalSupporting > totalContradicting) {
      overallStatus = VerificationStatus.PARTIAL;
      consensusLevel = totalContradicting > 0 ? 'moderate' : 'weak';
    } else {
      overallStatus = VerificationStatus.UNVERIFIED;
      consensusLevel = 'weak';
    }

    return {
      claim,
      primaryEvidence,
      corroboratingEvidence,
      contradictingEvidence,
      overallVerificationStatus: overallStatus,
      aggregateConfidence,
      consensusLevel
    };
  }

  /**
   * Generate cache key for claim
   */
  private generateCacheKey(claim: FactualClaim): string {
    return crypto
      .createHash('md5')
      .update(claim.statement + claim.sourceUrls.join(','))
      .digest('hex');
  }

  /**
   * Batch verify multiple claims efficiently
   */
  async batchVerifyClaims(
    claims: Array<{
      claim: FactualClaim;
      primarySource: ResearchSource;
    }>,
    allSources: ResearchSource[]
  ): Promise<CrossReferenceResult[]> {
    elizaLogger.info(`[ClaimVerifier] Batch verifying ${claims.length} claims`);

    // Process in parallel with rate limiting
    const batchSize = 5;
    const results: CrossReferenceResult[] = [];

    for (let i = 0; i < claims.length; i += batchSize) {
      const batch = claims.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(({ claim, primarySource }) => 
          this.verifyClaim(claim, primarySource, allSources)
        )
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get verification summary statistics
   */
  getVerificationStats(results: CrossReferenceResult[]): {
    verified: number;
    partiallyVerified: number;
    unverified: number;
    disputed: number;
    averageConfidence: number;
    strongConsensus: number;
  } {
    const stats = {
      verified: 0,
      partiallyVerified: 0,
      unverified: 0,
      disputed: 0,
      totalConfidence: 0,
      strongConsensus: 0,
    };

    for (const result of results) {
      switch (result.overallVerificationStatus) {
        case VerificationStatus.VERIFIED:
          stats.verified++;
          break;
        case VerificationStatus.PARTIAL:
          stats.partiallyVerified++;
          break;
        case VerificationStatus.UNVERIFIED:
          stats.unverified++;
          break;
        case VerificationStatus.DISPUTED:
          stats.disputed++;
          break;
      }

      stats.totalConfidence += result.aggregateConfidence;
      if (result.consensusLevel === 'strong') {
        stats.strongConsensus++;
      }
    }

    return {
      verified: stats.verified,
      partiallyVerified: stats.partiallyVerified,
      unverified: stats.unverified,
      disputed: stats.disputed,
      averageConfidence: results.length > 0 ? stats.totalConfidence / results.length : 0,
      strongConsensus: stats.strongConsensus,
    };
  }
} 