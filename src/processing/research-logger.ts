import { elizaLogger, IAgentRuntime } from '@elizaos/core';
import { SearchResult, ResearchSource, ResearchFinding, ResearchProject } from '../types';
import { RelevanceScore, RelevanceAnalysis } from './relevance-analyzer';
import fs from 'fs/promises';
import path from 'path';

export interface SearchLog {
  timestamp: number;
  projectId: string;
  query: string;
  originalQuery: string;
  provider: string;
  resultsCount: number;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    relevanceScore?: RelevanceScore;
    processed: boolean;
    contentExtracted: boolean;
    findingsExtracted: number;
  }>;
}

export interface ContentExtractionLog {
  timestamp: number;
  projectId: string;
  url: string;
  sourceTitle: string;
  method: string; // 'stagehand', 'firecrawl', 'playwright', 'pdf'
  success: boolean;
  contentLength: number;
  error?: string;
  relevanceScore?: RelevanceScore;
}

export interface FindingExtractionLog {
  timestamp: number;
  projectId: string;
  sourceUrl: string;
  originalQuery: string;
  contentLength: number;
  findingsExtracted: number;
  findings: Array<{
    content: string;
    relevance: number;
    confidence: number;
    category: string;
    relevanceScore?: RelevanceScore;
  }>;
  queryAlignment: number;
}

export interface ResearchSession {
  projectId: string;
  originalQuery: string;
  startTime: number;
  queryAnalysis: RelevanceAnalysis;
  searchLogs: SearchLog[];
  extractionLogs: ContentExtractionLog[];
  findingLogs: FindingExtractionLog[];
  summary: {
    totalSearches: number;
    totalResults: number;
    relevantResults: number;
    totalSources: number;
    successfulExtractions: number;
    totalFindings: number;
    relevantFindings: number;
    overallRelevance: number;
    gaps: string[];
    recommendations: string[];
  };
}

/**
 * Comprehensive logging system for research operations to track relevance throughout the pipeline
 */
export class ResearchLogger {
  private sessions: Map<string, ResearchSession> = new Map();
  private logsDir: string;

  constructor(private runtime: IAgentRuntime) {
    this.logsDir = path.join(process.cwd(), 'research_logs');
  }

  async initializeSession(
    projectId: string, 
    originalQuery: string, 
    queryAnalysis: RelevanceAnalysis
  ): Promise<void> {
    elizaLogger.info(`[ResearchLogger] Initializing session for project: ${projectId}`);

    const session: ResearchSession = {
      projectId,
      originalQuery,
      startTime: Date.now(),
      queryAnalysis,
      searchLogs: [],
      extractionLogs: [],
      findingLogs: [],
      summary: {
        totalSearches: 0,
        totalResults: 0,
        relevantResults: 0,
        totalSources: 0,
        successfulExtractions: 0,
        totalFindings: 0,
        relevantFindings: 0,
        overallRelevance: 0,
        gaps: [],
        recommendations: []
      }
    };

    this.sessions.set(projectId, session);

    // Create logs directory
    await fs.mkdir(this.logsDir, { recursive: true });
  }

  async logSearch(
    projectId: string,
    query: string,
    provider: string,
    results: SearchResult[],
    relevanceScores?: Map<string, RelevanceScore>
  ): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) return;

    elizaLogger.info(`[ResearchLogger] Logging search: ${query} (${results.length} results)`);

    const searchLog: SearchLog = {
      timestamp: Date.now(),
      projectId,
      query,
      originalQuery: session.originalQuery,
      provider,
      resultsCount: results.length,
      results: results.map(result => ({
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        relevanceScore: relevanceScores?.get(result.url),
        processed: false,
        contentExtracted: false,
        findingsExtracted: 0
      }))
    };

    session.searchLogs.push(searchLog);
    session.summary.totalSearches++;
    session.summary.totalResults += results.length;

    // Count relevant results (score >= 0.6)
    const relevantCount = searchLog.results.filter(r => (r.relevanceScore?.score || 0) >= 0.6).length;
    session.summary.relevantResults += relevantCount;

    elizaLogger.info(`[ResearchLogger] Search logged: ${relevantCount}/${results.length} relevant results`);
  }

  async logContentExtraction(
    projectId: string,
    url: string,
    sourceTitle: string,
    method: string,
    success: boolean,
    contentLength: number,
    error?: string,
    relevanceScore?: RelevanceScore
  ): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) return;

    elizaLogger.info(`[ResearchLogger] Logging content extraction: ${url} (${success ? 'success' : 'failed'})`);

    const extractionLog: ContentExtractionLog = {
      timestamp: Date.now(),
      projectId,
      url,
      sourceTitle,
      method,
      success,
      contentLength,
      error,
      relevanceScore
    };

    session.extractionLogs.push(extractionLog);
    session.summary.totalSources++;

    if (success) {
      session.summary.successfulExtractions++;
    }

    // Update search log
    for (const searchLog of session.searchLogs) {
      const result = searchLog.results.find(r => r.url === url);
      if (result) {
        result.processed = true;
        result.contentExtracted = success;
        break;
      }
    }

    elizaLogger.debug(`[ResearchLogger] Content extraction logged: ${sourceTitle} - ${contentLength} chars`);
  }

  async logFindingExtraction(
    projectId: string,
    sourceUrl: string,
    contentLength: number,
    findings: Array<{
      content: string;
      relevance: number;
      confidence: number;
      category: string;
    }>,
    findingRelevanceScores?: Map<string, RelevanceScore>
  ): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) return;

    elizaLogger.info(`[ResearchLogger] Logging finding extraction: ${sourceUrl} (${findings.length} findings)`);

    const findingsWithScores = findings.map(finding => ({
      ...finding,
      relevanceScore: findingRelevanceScores?.get(finding.content)
    }));

    const findingLog: FindingExtractionLog = {
      timestamp: Date.now(),
      projectId,
      sourceUrl,
      originalQuery: session.originalQuery,
      contentLength,
      findingsExtracted: findings.length,
      findings: findingsWithScores,
      queryAlignment: findingsWithScores.reduce((sum, f) => sum + (f.relevanceScore?.queryAlignment || f.relevance), 0) / Math.max(findings.length, 1)
    };

    session.findingLogs.push(findingLog);
    session.summary.totalFindings += findings.length;

    // Count relevant findings (relevance >= 0.7)
    const relevantCount = findings.filter(f => f.relevance >= 0.7).length;
    session.summary.relevantFindings += relevantCount;

    // Update search log
    for (const searchLog of session.searchLogs) {
      const result = searchLog.results.find(r => r.url === sourceUrl);
      if (result) {
        result.findingsExtracted = findings.length;
        break;
      }
    }

    elizaLogger.info(`[ResearchLogger] Finding extraction logged: ${relevantCount}/${findings.length} relevant findings`);
  }

  async finalizeSession(
    projectId: string,
    gaps: string[],
    recommendations: string[]
  ): Promise<ResearchSession> {
    const session = this.sessions.get(projectId);
    if (!session) throw new Error('Session not found');

    elizaLogger.info(`[ResearchLogger] Finalizing session for project: ${projectId}`);

    // Calculate overall relevance
    const totalRelevanceScore = session.findingLogs.reduce((sum, log) => sum + log.queryAlignment, 0);
    session.summary.overallRelevance = totalRelevanceScore / Math.max(session.findingLogs.length, 1);

    session.summary.gaps = gaps;
    session.summary.recommendations = recommendations;

    // Save detailed log to file
    await this.saveSessionLog(session);

    // Log summary
    elizaLogger.info(`[ResearchLogger] Session summary for ${projectId}:`, {
      duration: Date.now() - session.startTime,
      searches: session.summary.totalSearches,
      results: session.summary.totalResults,
      relevantResults: session.summary.relevantResults,
      sources: session.summary.totalSources,
      successfulExtractions: session.summary.successfulExtractions,
      findings: session.summary.totalFindings,
      relevantFindings: session.summary.relevantFindings,
      overallRelevance: session.summary.overallRelevance,
      gaps: gaps.length,
      recommendations: recommendations.length
    });

    return session;
  }

  private async saveSessionLog(session: ResearchSession): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedQuery = session.originalQuery
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 50);
      
      const filename = `${timestamp}_${sanitizedQuery}_research-log.json`;
      const filepath = path.join(this.logsDir, filename);

      // Create comprehensive log with all details
      const logData = {
        ...session,
        metadata: {
          savedAt: Date.now(),
          version: '1.0',
          description: 'Comprehensive research session log with relevance tracking'
        },
        analysis: {
          relevanceByPhase: {
            searchResults: session.summary.relevantResults / Math.max(session.summary.totalResults, 1),
            contentExtraction: session.summary.successfulExtractions / Math.max(session.summary.totalSources, 1),
            findingExtraction: session.summary.relevantFindings / Math.max(session.summary.totalFindings, 1)
          },
          bottlenecks: this.identifyBottlenecks(session),
          recommendations: this.generateTechnicalRecommendations(session)
        }
      };

      await fs.writeFile(filepath, JSON.stringify(logData, null, 2), 'utf-8');
      elizaLogger.info(`[ResearchLogger] Session log saved to: ${filepath}`);

      // Also create a summary report
      const summaryPath = filepath.replace('.json', '_summary.md');
      const summaryContent = this.generateSummaryReport(session);
      await fs.writeFile(summaryPath, summaryContent, 'utf-8');
      elizaLogger.info(`[ResearchLogger] Summary report saved to: ${summaryPath}`);

    } catch (error) {
      elizaLogger.error('[ResearchLogger] Failed to save session log:', error);
    }
  }

  private identifyBottlenecks(session: ResearchSession): string[] {
    const bottlenecks: string[] = [];

    const relevanceRatio = session.summary.relevantResults / Math.max(session.summary.totalResults, 1);
    const extractionRatio = session.summary.successfulExtractions / Math.max(session.summary.totalSources, 1);
    const findingRatio = session.summary.relevantFindings / Math.max(session.summary.totalFindings, 1);

    if (relevanceRatio < 0.5) {
      bottlenecks.push('Low search result relevance - improve query generation or search provider selection');
    }
    
    if (extractionRatio < 0.7) {
      bottlenecks.push('Poor content extraction success rate - improve extraction methods or fallbacks');
    }
    
    if (findingRatio < 0.6) {
      bottlenecks.push('Low finding relevance - improve extraction prompts or relevance filtering');
    }

    if (session.summary.overallRelevance < 0.7) {
      bottlenecks.push('Overall low relevance - review entire pipeline for query alignment');
    }

    return bottlenecks;
  }

  private generateTechnicalRecommendations(session: ResearchSession): string[] {
    const recommendations: string[] = [];

    // Search quality recommendations
    const avgResultsPerSearch = session.summary.totalResults / Math.max(session.summary.totalSearches, 1);
    if (avgResultsPerSearch < 10) {
      recommendations.push('Increase search breadth - too few results per search');
    }

    // Finding quality recommendations
    const avgFindingsPerSource = session.summary.totalFindings / Math.max(session.summary.successfulExtractions, 1);
    if (avgFindingsPerSource < 2) {
      recommendations.push('Improve finding extraction - too few findings per source');
    }

    // Relevance recommendations
    if (session.summary.overallRelevance < 0.8) {
      recommendations.push('Enhance relevance filtering throughout pipeline');
    }

    return recommendations;
  }

  private generateSummaryReport(session: ResearchSession): string {
    const duration = Date.now() - session.startTime;
    const durationMin = Math.round(duration / 60000);

    return `# Research Session Summary

## Query
**Original Query:** ${session.originalQuery}

**Duration:** ${durationMin} minutes

## Query Analysis
- **Intent:** ${session.queryAnalysis.queryIntent}
- **Key Topics:** ${session.queryAnalysis.keyTopics.join(', ')}
- **Required Elements:** ${session.queryAnalysis.requiredElements.join(', ')}

## Results Summary
- **Searches:** ${session.summary.totalSearches}
- **Total Results:** ${session.summary.totalResults}
- **Relevant Results:** ${session.summary.relevantResults} (${(session.summary.relevantResults / Math.max(session.summary.totalResults, 1) * 100).toFixed(1)}%)
- **Sources Processed:** ${session.summary.totalSources}
- **Successful Extractions:** ${session.summary.successfulExtractions} (${(session.summary.successfulExtractions / Math.max(session.summary.totalSources, 1) * 100).toFixed(1)}%)
- **Total Findings:** ${session.summary.totalFindings}
- **Relevant Findings:** ${session.summary.relevantFindings} (${(session.summary.relevantFindings / Math.max(session.summary.totalFindings, 1) * 100).toFixed(1)}%)

## Relevance Score
**Overall Relevance:** ${(session.summary.overallRelevance * 100).toFixed(1)}%

## Identified Gaps
${session.summary.gaps.map(gap => `- ${gap}`).join('\n')}

## Recommendations
${session.summary.recommendations.map(rec => `- ${rec}`).join('\n')}

## Search Details
${session.searchLogs.map((log, i) => `
### Search ${i + 1}: ${log.query}
- Provider: ${log.provider}
- Results: ${log.resultsCount}
- Relevant: ${log.results.filter(r => (r.relevanceScore?.score || 0) >= 0.6).length}
`).join('\n')}

## Content Extraction
${session.extractionLogs.map((log, i) => `
### Extraction ${i + 1}: ${log.sourceTitle}
- URL: ${log.url}
- Method: ${log.method}
- Success: ${log.success ? 'Yes' : 'No'}
- Content Length: ${log.contentLength} chars
${log.error ? `- Error: ${log.error}` : ''}
`).join('\n')}
`;
  }

  getSessionSummary(projectId: string): ResearchSession | undefined {
    return this.sessions.get(projectId);
  }
}