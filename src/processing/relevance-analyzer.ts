import { elizaLogger, IAgentRuntime, ModelType } from '@elizaos/core';
import { SearchResult, ResearchSource, ResearchFinding } from '../types';

export interface RelevanceScore {
  score: number; // 0-1
  reasoning: string;
  queryAlignment: number; // How well it addresses the query
  topicRelevance: number; // How relevant to the topic
  specificity: number; // How specific vs generic
}

export interface RelevanceAnalysis {
  queryIntent: string;
  keyTopics: string[];
  requiredElements: string[];
  exclusionCriteria: string[];
}

/**
 * Analyzes and scores relevance of search results and findings to the original research query
 */
export class RelevanceAnalyzer {
  constructor(private runtime: IAgentRuntime) {}

  /**
   * Analyze the research query to understand what constitutes relevance
   */
  async analyzeQueryRelevance(query: string): Promise<RelevanceAnalysis> {
    elizaLogger.info(`[RelevanceAnalyzer] Analyzing query intent: ${query}`);

    const prompt = `Analyze this research query to define what makes a source or finding relevant:

Query: "${query}"

Extract:
1. Query Intent: What is the user really asking for?
2. Key Topics: Core topics that MUST be addressed
3. Required Elements: Specific elements that relevant sources should contain
4. Exclusion Criteria: What should be filtered out as irrelevant

Format as JSON:
{
  "queryIntent": "clear statement of what user wants",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "requiredElements": ["element1", "element2"],
  "exclusionCriteria": ["avoid1", "avoid2"]
}`;

    try {
      const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
        messages: [
          { 
            role: 'system', 
            content: 'You are a research query analyst. Extract query intent and relevance criteria precisely.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      });

      const responseContent = typeof response === 'string' ? response : (response as any).content || '';
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        elizaLogger.info(`[RelevanceAnalyzer] Query analysis complete:`, {
          intent: analysis.queryIntent,
          keyTopicsCount: analysis.keyTopics?.length || 0,
          requiredElementsCount: analysis.requiredElements?.length || 0
        });
        return analysis;
      }
    } catch (error) {
      elizaLogger.error('[RelevanceAnalyzer] Failed to analyze query relevance:', error);
    }

    // Fallback analysis
    return {
      queryIntent: query,
      keyTopics: this.extractKeywordsFromQuery(query),
      requiredElements: [],
      exclusionCriteria: []
    };
  }

  /**
   * Score search result relevance before content extraction
   */
  async scoreSearchResultRelevance(
    result: SearchResult, 
    queryAnalysis: RelevanceAnalysis
  ): Promise<RelevanceScore> {
    elizaLogger.debug(`[RelevanceAnalyzer] Scoring search result: ${result.title}`);

    const prompt = `Score the relevance of this search result to the research query:

QUERY INTENT: ${queryAnalysis.queryIntent}
KEY TOPICS: ${queryAnalysis.keyTopics.join(', ')}
REQUIRED ELEMENTS: ${queryAnalysis.requiredElements.join(', ')}

SEARCH RESULT:
Title: ${result.title}
Snippet: ${result.snippet}
URL: ${result.url}

Rate 0-1 for each dimension:
1. Query Alignment: How directly does this address the query intent?
2. Topic Relevance: How well does it cover the key topics?
3. Specificity: How specific (vs generic) is the content to the query?

Provide reasoning for the scores.

Format as JSON:
{
  "queryAlignment": 0.8,
  "topicRelevance": 0.9,
  "specificity": 0.7,
  "reasoning": "detailed explanation of why this result is/isn't relevant",
  "score": 0.8
}`;

    try {
      const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
        messages: [
          { 
            role: 'system', 
            content: 'You are a search result relevance scorer. Be critical - only high relevance should get high scores.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
      });

      const responseContent = typeof response === 'string' ? response : (response as any).content || '';
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const score = JSON.parse(jsonMatch[0]);
        const finalScore = (score.queryAlignment + score.topicRelevance + score.specificity) / 3;
        
        elizaLogger.debug(`[RelevanceAnalyzer] Search result scored:`, {
          url: result.url,
          score: finalScore,
          breakdown: {
            queryAlignment: score.queryAlignment,
            topicRelevance: score.topicRelevance,
            specificity: score.specificity
          }
        });

        return {
          score: finalScore,
          reasoning: score.reasoning,
          queryAlignment: score.queryAlignment,
          topicRelevance: score.topicRelevance,
          specificity: score.specificity
        };
      }
    } catch (error) {
      elizaLogger.error('[RelevanceAnalyzer] Failed to score search result:', error);
    }

    // Fallback: Simple keyword matching
    const titleScore = this.calculateKeywordScore(result.title, queryAnalysis.keyTopics);
    const snippetScore = this.calculateKeywordScore(result.snippet, queryAnalysis.keyTopics);
    const fallbackScore = (titleScore + snippetScore) / 2;

    return {
      score: fallbackScore,
      reasoning: `Fallback keyword scoring: title=${titleScore.toFixed(2)}, snippet=${snippetScore.toFixed(2)}`,
      queryAlignment: fallbackScore,
      topicRelevance: fallbackScore,
      specificity: 0.5
    };
  }

  /**
   * Score finding relevance after extraction
   */
  async scoreFindingRelevance(
    finding: ResearchFinding,
    queryAnalysis: RelevanceAnalysis,
    originalQuery: string
  ): Promise<RelevanceScore> {
    elizaLogger.debug(`[RelevanceAnalyzer] Scoring finding relevance`);

    const prompt = `Score how well this research finding answers the original query:

ORIGINAL QUERY: "${originalQuery}"
QUERY INTENT: ${queryAnalysis.queryIntent}
KEY TOPICS: ${queryAnalysis.keyTopics.join(', ')}

FINDING:
Content: ${finding.content}
Category: ${finding.category}
Source: ${finding.source.title}

Critical Assessment:
1. Does this finding DIRECTLY address the query intent?
2. Does it cover the key topics meaningfully?
3. Is it specific to the query or generic information?
4. Would this help someone answer the original question?

Rate 0-1 for each dimension and overall relevance.

Format as JSON:
{
  "queryAlignment": 0.8,
  "topicRelevance": 0.9,
  "specificity": 0.7,
  "reasoning": "detailed explanation of relevance to original query",
  "score": 0.8
}`;

    try {
      const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
        messages: [
          { 
            role: 'system', 
            content: 'You are a research finding relevance judge. Be strict - only findings that directly address the query should score high.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
      });

      const responseContent = typeof response === 'string' ? response : (response as any).content || '';
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const score = JSON.parse(jsonMatch[0]);
        const finalScore = (score.queryAlignment + score.topicRelevance + score.specificity) / 3;
        
        elizaLogger.debug(`[RelevanceAnalyzer] Finding scored:`, {
          score: finalScore,
          category: finding.category,
          sourceUrl: finding.source.url
        });

        return {
          score: finalScore,
          reasoning: score.reasoning,
          queryAlignment: score.queryAlignment,
          topicRelevance: score.topicRelevance,
          specificity: score.specificity
        };
      }
    } catch (error) {
      elizaLogger.error('[RelevanceAnalyzer] Failed to score finding:', error);
    }

    // Fallback scoring
    const keywordScore = this.calculateKeywordScore(finding.content, queryAnalysis.keyTopics);
    return {
      score: keywordScore,
      reasoning: `Fallback keyword scoring: ${keywordScore.toFixed(2)}`,
      queryAlignment: keywordScore,
      topicRelevance: keywordScore,
      specificity: 0.5
    };
  }

  /**
   * Verify that extracted findings actually answer the research query
   */
  async verifyQueryAnswering(
    findings: ResearchFinding[],
    originalQuery: string
  ): Promise<{
    coverage: number;
    gaps: string[];
    recommendations: string[];
  }> {
    elizaLogger.info(`[RelevanceAnalyzer] Verifying query answering for ${findings.length} findings`);

    const findingSummaries = findings
      .slice(0, 20) // Limit for prompt size
      .map((f, i) => `${i + 1}. ${f.content.substring(0, 200)}...`)
      .join('\n');

    const prompt = `Assess how well these research findings answer the original query:

ORIGINAL QUERY: "${originalQuery}"

FINDINGS:
${findingSummaries}

Assessment:
1. Coverage Score (0-1): How well do these findings collectively answer the query?
2. Gaps: What important aspects of the query are NOT addressed?
3. Recommendations: What additional research is needed?

Format as JSON:
{
  "coverage": 0.7,
  "gaps": ["gap1", "gap2"],
  "recommendations": ["rec1", "rec2"]
}`;

    try {
      const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
        messages: [
          { 
            role: 'system', 
            content: 'You are a research completeness assessor. Evaluate if findings actually answer the research question.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      });

      const responseContent = typeof response === 'string' ? response : (response as any).content || '';
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const assessment = JSON.parse(jsonMatch[0]);
        elizaLogger.info(`[RelevanceAnalyzer] Query answering assessment:`, {
          coverage: assessment.coverage,
          gapsCount: assessment.gaps?.length || 0,
          recommendationsCount: assessment.recommendations?.length || 0
        });
        return assessment;
      }
    } catch (error) {
      elizaLogger.error('[RelevanceAnalyzer] Failed to verify query answering:', error);
    }

    return {
      coverage: findings.length > 0 ? 0.5 : 0,
      gaps: ['Unable to assess coverage'],
      recommendations: ['Manual review recommended']
    };
  }

  private extractKeywordsFromQuery(query: string): string[] {
    // Simple keyword extraction as fallback
    const words = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['what', 'how', 'why', 'when', 'where', 'which', 'that', 'this', 'with', 'from', 'they', 'have', 'been', 'will', 'are'].includes(word));
    
    return words.slice(0, 5);
  }

  private calculateKeywordScore(text: string, keywords: string[]): number {
    if (!keywords.length) return 0.5;
    
    const lowerText = text.toLowerCase();
    const matches = keywords.filter(keyword => lowerText.includes(keyword.toLowerCase()));
    return matches.length / keywords.length;
  }
}