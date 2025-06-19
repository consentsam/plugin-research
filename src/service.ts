import { elizaLogger, IAgentRuntime, ModelType, Service } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { ResearchEvaluator } from './evaluation/research-evaluator';
import {
  ContentExtractor,
  createContentExtractor,
  createSearchProvider,
  SearchProvider,
} from './integrations';
import { createAcademicSearchProvider } from './integrations/factory';
import { PDFExtractor } from './integrations/content-extractors/pdf-extractor';
import {
  EvaluationCriteriaGenerator,
  QueryPlanner,
  ResearchStrategyFactory,
} from './strategies/research-strategies';
import {
  BibliographyEntry,
  Citation,
  DeepResearchBenchResult,
  EvaluationMetrics,
  EvaluationResults,
  FactualClaim,
  IterationRecord,
  PerformanceMetrics,
  PhaseTiming,
  ReportSection,
  ResearchConfig,
  ResearchDepth,
  ResearchDomain,
  ResearchFinding,
  ResearchMetadata,
  ResearchPhase,
  ResearchProgress,
  ResearchProject,
  ResearchSource,
  ResearchStatus,
  SearchResult,
  SourceType,
  TaskType,
  VerificationStatus,
} from './types';
import fs from 'fs/promises';
import path from 'path';

// Factory for creating search providers and content extractors
class SearchProviderFactory {
  private pdfExtractor: PDFExtractor;
  
  constructor(private runtime: IAgentRuntime) {
    this.pdfExtractor = new PDFExtractor();
  }

  getProvider(type: string): SearchProvider {
    // Use academic search for academic domains
    if (type === 'academic') {
      return createAcademicSearchProvider(this.runtime);
    }
    
    const provider = createSearchProvider(type, this.runtime);
    if (!provider) {
      throw new Error('No search provider available');
    }
    return provider;
  }

  getContentExtractor(): ContentExtractor {
    const extractor = createContentExtractor(this.runtime);
    if (!extractor) {
      throw new Error('No content extractor available');
    }
    return extractor;
  }
  
  getPDFExtractor(): PDFExtractor {
    return this.pdfExtractor;
  }
}

const DEFAULT_CONFIG: ResearchConfig = {
  maxSearchResults: 30, // Increased for more comprehensive coverage
  maxDepth: 5, // Deeper research iterations
  timeout: 600000, // 10 minutes for thorough research
  enableCitations: true,
  enableImages: false,
  searchProviders: ['web', 'academic'], // Include academic sources by default
  language: 'en',
  researchDepth: ResearchDepth.DEEP, // Default to deep research
  domain: ResearchDomain.GENERAL,
  evaluationEnabled: true,
  cacheEnabled: true,
  parallelSearches: 5, // More parallel searches for efficiency
  retryAttempts: 3,
  qualityThreshold: 0.85, // Higher quality threshold
};

export class ResearchService extends Service {
  private projects: Map<string, ResearchProject> = new Map();
  private activeResearch: Map<string, AbortController> = new Map();
  private searchProviderFactory: SearchProviderFactory;
  private queryPlanner: QueryPlanner;
  private strategyFactory: ResearchStrategyFactory;
  private criteriaGenerator: EvaluationCriteriaGenerator;
  private evaluator: ResearchEvaluator;
  private performanceData: Map<string, PerformanceMetrics> = new Map();

  static serviceName = 'research';
  public serviceName = 'research';

  static async start(runtime: IAgentRuntime) {
    const service = new ResearchService(runtime);
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    const service = new ResearchService(runtime);
    await service.stop();
  }

  public capabilityDescription =
    'PhD-level deep research across 22 domains with RACE/FACT evaluation';

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;
    this.searchProviderFactory = new SearchProviderFactory(runtime);
    this.queryPlanner = new QueryPlanner(runtime);
    this.strategyFactory = new ResearchStrategyFactory(runtime);
    this.criteriaGenerator = new EvaluationCriteriaGenerator(runtime);
    this.evaluator = new ResearchEvaluator(runtime);
  }

  async createResearchProject(
    query: string,
    config?: Partial<ResearchConfig>
  ): Promise<ResearchProject> {
    const projectId = uuidv4();
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };

    // Always use full research pipeline for best quality
    elizaLogger.info(`[ResearchService] Starting comprehensive research for: ${query}`);
    
    // Extract metadata from query
    const metadata = await this.extractMetadata(query, mergedConfig);

    const project: ResearchProject = {
      id: projectId,
      query,
      status: ResearchStatus.PENDING,
      phase: ResearchPhase.INITIALIZATION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      findings: [],
      sources: [],
      metadata,
    };

    this.projects.set(projectId, project);

    // Start research asynchronously
    this.startResearch(projectId, mergedConfig).catch((error) => {
      elizaLogger.error(`Research failed for project ${projectId}:`, error);
      project.status = ResearchStatus.FAILED;
      project.error = error.message;
    });

    return project;
  }

  private async extractMetadata(query: string, config: ResearchConfig): Promise<ResearchMetadata> {
    // Extract domain if not provided
    const domain = config.domain || (await this.extractDomain(query));

    // Extract task type
    const taskType = await this.extractTaskType(query);

    // Create query plan
    const queryPlan = await this.queryPlanner.createQueryPlan(query, {
      domain,
      taskType,
      depth: config.researchDepth,
    });

    // Generate evaluation criteria
    const evaluationCriteria = await this.criteriaGenerator.generateCriteria(query, domain);

    // Initialize performance metrics
    const performanceMetrics: PerformanceMetrics = {
      totalDuration: 0,
      phaseBreakdown: {} as Record<ResearchPhase, PhaseTiming>,
      searchQueries: 0,
      sourcesProcessed: 0,
      tokensGenerated: 0,
      cacheHits: 0,
      parallelOperations: 0,
    };

    return {
      domain,
      taskType,
      language: config.language,
      depth: config.researchDepth,
      queryPlan,
      evaluationCriteria,
      iterationHistory: [],
      performanceMetrics,
    };
  }

  private async extractDomain(query: string): Promise<ResearchDomain> {
    // Simple heuristic-based domain extraction for testing
    const lowerQuery = query.toLowerCase();
    
    // Check for domain keywords
    if (lowerQuery.includes('quantum') || lowerQuery.includes('physics') || lowerQuery.includes('particle')) {
      return ResearchDomain.PHYSICS;
    }
    if (lowerQuery.includes('biology') || lowerQuery.includes('gene') || lowerQuery.includes('cell') || lowerQuery.includes('dna')) {
      return ResearchDomain.BIOLOGY;
    }
    if (lowerQuery.includes('computer') || lowerQuery.includes('software') || lowerQuery.includes('algorithm') || lowerQuery.includes('programming')) {
      return ResearchDomain.COMPUTER_SCIENCE;
    }
    if (lowerQuery.includes('economic') || lowerQuery.includes('finance') || lowerQuery.includes('market') || lowerQuery.includes('currency')) {
      return ResearchDomain.ECONOMICS;
    }
    if (lowerQuery.includes('medicine') || lowerQuery.includes('health') || lowerQuery.includes('disease') || lowerQuery.includes('treatment')) {
      return ResearchDomain.MEDICINE;
    }
    if (lowerQuery.includes('psychology') || lowerQuery.includes('mental') || lowerQuery.includes('behavior')) {
      return ResearchDomain.PSYCHOLOGY;
    }
    if (lowerQuery.includes('chemistry') || lowerQuery.includes('chemical') || lowerQuery.includes('molecule')) {
      return ResearchDomain.CHEMISTRY;
    }
    if (lowerQuery.includes('ai') || lowerQuery.includes('artificial intelligence') || lowerQuery.includes('machine learning')) {
      return ResearchDomain.COMPUTER_SCIENCE;
    }
    
    // If we have a working runtime.useModel, use it for more accurate classification
    if (this.runtime.useModel) {
      const prompt = `Analyze this research query and determine the most appropriate research domain.

Query: "${query}"

Available domains:
${Object.values(ResearchDomain).map(d => `- ${d}`).join('\n')}

Respond with ONLY the domain name from the list above. Be precise.`;

      try {
        const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
          messages: [
            { 
              role: 'system', 
              content: 'You are a research domain classifier. Respond with only the domain name, nothing else.' 
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
        });

        const domainText = (
          typeof response === 'string' ? response : (response as any).content || ''
        ).trim().toLowerCase();

        // Exact match first
        for (const domain of Object.values(ResearchDomain)) {
          if (domainText === domain.toLowerCase()) {
            return domain as ResearchDomain;
          }
        }

        // Partial match fallback
        for (const domain of Object.values(ResearchDomain)) {
          if (domainText.includes(domain.toLowerCase())) {
            return domain as ResearchDomain;
          }
        }

        elizaLogger.warn(`Could not extract domain from response: ${domainText}`);
      } catch (error) {
        elizaLogger.warn('Error using model for domain extraction, falling back to heuristics:', error);
      }
    }
    
    return ResearchDomain.GENERAL;
  }

  private async extractTaskType(query: string): Promise<TaskType> {
    // Simple heuristic-based task type extraction for testing
    const lowerQuery = query.toLowerCase();
    
    // Check for task type keywords
    if (lowerQuery.includes('compar') || lowerQuery.includes('versus') || lowerQuery.includes('vs')) {
      return TaskType.COMPARATIVE;
    }
    if (lowerQuery.includes('analyz') || lowerQuery.includes('analysis') || lowerQuery.includes('examine')) {
      return TaskType.ANALYTICAL;
    }
    if (lowerQuery.includes('synthes') || lowerQuery.includes('combin') || lowerQuery.includes('integrat')) {
      return TaskType.SYNTHETIC;
    }
    if (lowerQuery.includes('evaluat') || lowerQuery.includes('assess') || lowerQuery.includes('judge')) {
      return TaskType.EVALUATIVE;
    }
    if (lowerQuery.includes('predict') || lowerQuery.includes('forecast') || lowerQuery.includes('future')) {
      return TaskType.PREDICTIVE;
    }
    
    // If we have a working runtime.useModel, use it for more accurate classification
    if (this.runtime.useModel) {
      const prompt = `Analyze this research query and determine the primary task type.

Query: "${query}"

Task Types:
- ${TaskType.EXPLORATORY}: General exploration of a topic
- ${TaskType.COMPARATIVE}: Comparing different items, approaches, or solutions
- ${TaskType.ANALYTICAL}: Deep analysis of a specific subject
- ${TaskType.SYNTHETIC}: Combining multiple perspectives or sources
- ${TaskType.EVALUATIVE}: Assessment or evaluation of something
- ${TaskType.PREDICTIVE}: Forecasting or predicting future trends

Respond with ONLY the task type (e.g., "analytical"). Be precise.`;

      try {
        const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
          messages: [
            { 
              role: 'system', 
              content: 'You are a research task classifier. Respond with only the task type, nothing else.' 
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
        });

        const taskText = (
          typeof response === 'string' ? response : (response as any).content || ''
        ).trim().toLowerCase();

        // Check for exact matches
        for (const taskType of Object.values(TaskType)) {
          if (taskText === taskType.toLowerCase()) {
            return taskType as TaskType;
          }
        }

        // Check for keyword matches
        if (taskText.includes('compar')) return TaskType.COMPARATIVE;
        if (taskText.includes('analy')) return TaskType.ANALYTICAL;
        if (taskText.includes('synth')) return TaskType.SYNTHETIC;
        if (taskText.includes('eval')) return TaskType.EVALUATIVE;
        if (taskText.includes('pred') || taskText.includes('forecast')) return TaskType.PREDICTIVE;

        elizaLogger.warn(`Could not extract task type from response: ${taskText}`);
      } catch (error) {
        elizaLogger.warn('Error using model for task type extraction, falling back to heuristics:', error);
      }
    }
    
    return TaskType.EXPLORATORY;
  }

  private async startResearch(projectId: string, config: ResearchConfig): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) return;

    const controller = new AbortController();
    this.activeResearch.set(projectId, controller);

    try {
      project.status = ResearchStatus.ACTIVE;
      const startTime = Date.now();

      // Phase 1: Planning
      await this.updatePhase(project, ResearchPhase.PLANNING);

      // Phase 2: Searching
      await this.updatePhase(project, ResearchPhase.SEARCHING);
      await this.executeSearch(project, config, controller.signal);

      // Phase 3: Analyzing
      await this.updatePhase(project, ResearchPhase.ANALYZING);
      await this.analyzeFindings(project, config);

      // Synthesize findings
      await this.updatePhase(project, ResearchPhase.SYNTHESIZING);
      await this.synthesizeFindings(project);

      // Generate report (before evaluation)
      await this.updatePhase(project, ResearchPhase.REPORTING);
      await this.generateReport(project);

      // Evaluate if configured (optional)
      if (config.evaluationEnabled) {
        try {
          await this.updatePhase(project, ResearchPhase.EVALUATING);
          await this.evaluateProject(project.id);
        } catch (evalError) {
          elizaLogger.warn('[ResearchService] Evaluation failed, but research completed:', evalError);
          // Don't fail the entire research if evaluation fails
        }
      }

      // Complete
      await this.updatePhase(project, ResearchPhase.COMPLETE);
      project.status = ResearchStatus.COMPLETED;
      project.completedAt = Date.now();

      // Update performance metrics
      const totalDuration = Date.now() - startTime;
      if (project.metadata.performanceMetrics) {
        project.metadata.performanceMetrics.totalDuration = totalDuration;
      }
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        project.status = ResearchStatus.PAUSED;
      } else {
        project.status = ResearchStatus.FAILED;
        project.error = error instanceof Error ? error.message : String(error);
      }
      throw error;
    } finally {
      this.activeResearch.delete(projectId);
      project.updatedAt = Date.now();
    }
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const unique: SearchResult[] = [];
    
    for (const result of results) {
      // Use URL as unique identifier
      if (!seen.has(result.url)) {
        seen.add(result.url);
        unique.push(result);
      }
    }
    
    // Sort by score descending
    return unique.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  private async updatePhase(project: ResearchProject, phase: ResearchPhase): Promise<void> {
    const previousPhase = project.phase;
    project.phase = phase;
    project.updatedAt = Date.now();

    // Update phase timing
    if (project.metadata.performanceMetrics) {
      const phaseKey = previousPhase;
      if (phaseKey && project.metadata.performanceMetrics.phaseBreakdown[phaseKey]) {
        project.metadata.performanceMetrics.phaseBreakdown[phaseKey].endTime = Date.now();
      }

      project.metadata.performanceMetrics.phaseBreakdown[phase] = {
        startTime: Date.now(),
        endTime: 0,
        duration: 0,
        retries: 0,
        errors: [],
      };
    }

    // Emit progress
    this.emitProgress(project, `Starting ${phase} phase`);
  }

  private async executeSearch(
    project: ResearchProject,
    config: ResearchConfig,
    signal: AbortSignal
  ): Promise<void> {
    const queryPlan = project.metadata.queryPlan;
    
    // Use multiple search providers for comprehensive coverage
    const isAcademicDomain = [
      ResearchDomain.PHYSICS,
      ResearchDomain.CHEMISTRY,
      ResearchDomain.BIOLOGY,
      ResearchDomain.MEDICINE,
      ResearchDomain.COMPUTER_SCIENCE,
      ResearchDomain.MATHEMATICS,
      ResearchDomain.ENGINEERING,
      ResearchDomain.PSYCHOLOGY,
    ].includes(project.metadata.domain);
    
    const allResults: SearchResult[] = [];
    
    // Always search web sources
    const webProvider = this.searchProviderFactory.getProvider('web');
    const webResults = await webProvider.search(queryPlan.mainQuery, config.maxSearchResults);
    allResults.push(...webResults);
    
    // Also search academic sources if configured or if academic domain
    if (config.searchProviders.includes('academic') || isAcademicDomain) {
      try {
        const academicProvider = this.searchProviderFactory.getProvider('academic');
        const academicResults = await academicProvider.search(queryPlan.mainQuery, config.maxSearchResults);
        allResults.push(...academicResults);
      } catch (error) {
        elizaLogger.warn('Academic search failed, continuing with web results:', error);
      }
    }
    
    // Deduplicate and sort by relevance
    const uniqueResults = this.deduplicateResults(allResults);
    const mainResults = uniqueResults.slice(0, config.maxSearchResults);

    // Process main results
    for (const result of mainResults) {
      if (signal.aborted) break;

      const source = await this.processSearchResult(result, project);
      if (source) {
        project.sources.push(source);
      }
    }

    // Execute sub-queries
    for (const subQuery of queryPlan.subQueries) {
      if (signal.aborted) break;

      // Check dependencies
      const dependenciesMet = subQuery.dependsOn.every(
        (depId) => queryPlan.subQueries.find((sq) => sq.id === depId)?.completed
      );

      if (!dependenciesMet) continue;

      const subResults = await webProvider.search(
        subQuery.query,
        Math.floor(config.maxSearchResults / 2)
      );

      for (const result of subResults) {
        if (signal.aborted) break;

        const source = await this.processSearchResult(result, project);
        if (source) {
          project.sources.push(source);
        }
      }

      subQuery.completed = true;
    }

    // Update iteration history
    const iteration: IterationRecord = {
      iteration: project.metadata.iterationHistory.length + 1,
      timestamp: Date.now(),
      queriesUsed: [queryPlan.mainQuery, ...queryPlan.subQueries.map((sq) => sq.query)],
      sourcesFound: project.sources.length,
      findingsExtracted: 0,
      qualityScore: 0,
    };

    project.metadata.iterationHistory.push(iteration);

    // Adaptive refinement if needed
    if (queryPlan.adaptiveRefinement && project.sources.length < queryPlan.expectedSources) {
      await this.performAdaptiveRefinement(project, config, signal);
    }
  }

  private async processSearchResult(
    result: SearchResult,
    project: ResearchProject
  ): Promise<ResearchSource | null> {
    try {
      // Extract content if not already present
      let fullContent = result.content;
      if (!fullContent) {
        // Check if it's a PDF
        if (PDFExtractor.isPDFUrl(result.url)) {
          const pdfExtractor = this.searchProviderFactory.getPDFExtractor();
          const pdfContent = await pdfExtractor.extractFromURL(result.url);
          fullContent = pdfContent?.markdown || pdfContent?.content || '';
        } else {
          const contentExtractor = this.searchProviderFactory.getContentExtractor();
          const extracted = await contentExtractor.extractContent(result.url);
          fullContent = extracted.content;
        }
      }

      // Categorize source
      const sourceType = this.categorizeSource(result);

      const source: ResearchSource = {
        id: uuidv4(),
        url: result.url,
        title: result.title,
        snippet: result.snippet,
        fullContent,
        accessedAt: Date.now(),
        type: sourceType,
        reliability: await this.assessReliability(result, sourceType),
        domain: result.metadata?.domain,
        author: result.metadata?.author ? [result.metadata.author].flat() : undefined,
        publishDate: result.metadata?.publishDate,
        metadata: {
          language: result.metadata?.language || 'en',
          journal: result.metadata?.type === 'academic' ? result.metadata.domain : undefined,
        },
      };

      return source;
    } catch (error) {
      elizaLogger.warn(`Failed to process search result ${result.url}:`, error);
      return null;
    }
  }

  private categorizeSource(result: SearchResult): SourceType {
    const url = result.url.toLowerCase();
    const metadata = result.metadata;

    if (url.includes('arxiv.org') || url.includes('pubmed') || url.includes('.edu')) {
      return SourceType.ACADEMIC;
    }
    if (metadata?.type === 'news' || url.includes('news')) {
      return SourceType.NEWS;
    }
    if (url.includes('github.com') || url.includes('docs.')) {
      return SourceType.TECHNICAL;
    }
    if (url.includes('.gov')) {
      return SourceType.GOVERNMENT;
    }
    if (url.includes('.org') && !url.includes('wikipedia')) {
      return SourceType.ORGANIZATION;
    }

    return SourceType.WEB;
  }

  private async assessReliability(result: SearchResult, sourceType: SourceType): Promise<number> {
    let baseScore = 0.5;

    // Adjust based on source type
    switch (sourceType) {
      case SourceType.ACADEMIC:
        baseScore = 0.9;
        break;
      case SourceType.GOVERNMENT:
        baseScore = 0.85;
        break;
      case SourceType.TECHNICAL:
        baseScore = 0.8;
        break;
      case SourceType.NEWS:
        baseScore = 0.7;
        break;
      case SourceType.ORGANIZATION:
        baseScore = 0.75;
        break;
    }

    // Adjust based on metadata
    if (result.metadata?.author) baseScore += 0.05;
    if (result.metadata?.publishDate) baseScore += 0.05;

    return Math.min(baseScore, 1.0);
  }

  private async performAdaptiveRefinement(
    project: ResearchProject,
    config: ResearchConfig,
    signal: AbortSignal
  ): Promise<void> {
    const currentFindings = project.findings.slice(0, 5).map((f) => f.content);
    const refinedQueries = await this.queryPlanner.refineQuery(
      project.query,
      currentFindings,
      project.metadata.iterationHistory.length
    );

    const searchProvider = this.searchProviderFactory.getProvider(config.searchProviders[0]);

    for (const query of refinedQueries) {
      if (signal.aborted) break;

      const results = await searchProvider.search(query, Math.floor(config.maxSearchResults / 3));

      for (const result of results) {
        const source = await this.processSearchResult(result, project);
        if (source) {
          project.sources.push(source);
        }
      }
    }
  }

  private async analyzeFindings(project: ResearchProject, config: ResearchConfig): Promise<void> {
    elizaLogger.info(`[ResearchService] Analyzing ${project.sources.length} sources`);
    
    for (const source of project.sources) {
      // Use fullContent if available, otherwise fall back to snippet
      const contentToAnalyze = source.fullContent || source.snippet || source.title;
      
      if (!contentToAnalyze) {
        elizaLogger.warn(`[ResearchService] No content available for source: ${source.url}`);
        continue;
      }

      // Extract key findings
      const findings = await this.extractFindings(source, project.query, contentToAnalyze);

      // Extract factual claims
      const claims = await this.extractFactualClaims(source, contentToAnalyze);

      // Create research findings
      for (const finding of findings) {
        const researchFinding: ResearchFinding = {
          id: uuidv4(),
          content: finding.content,
          source,
          relevance: finding.relevance,
          confidence: finding.confidence,
          timestamp: Date.now(),
          category: finding.category,
          citations: [],
          factualClaims: claims.filter((c) =>
            finding.content.toLowerCase().includes(c.statement.substring(0, 30).toLowerCase())
          ),
          relatedFindings: [],
          verificationStatus: VerificationStatus.PENDING,
          extractionMethod: source.fullContent ? 'llm-extraction' : 'snippet-extraction',
        };

        project.findings.push(researchFinding);
      }
    }

    elizaLogger.info(`[ResearchService] Extracted ${project.findings.length} findings`);

    // Update quality score
    const lastIteration =
      project.metadata.iterationHistory[project.metadata.iterationHistory.length - 1];
    if (lastIteration) {
      lastIteration.findingsExtracted = project.findings.length;
      lastIteration.qualityScore = this.calculateQualityScore(project);
    }
  }

  private async extractFindings(
    source: ResearchSource,
    query: string,
    content: string
  ): Promise<Array<{ content: string; relevance: number; confidence: number; category: string }>> {
    const prompt = `Extract key findings from this source that are relevant to the research query.
    
Research Query: "${query}"
Source: ${source.title}
URL: ${source.url}
Content: ${content.substring(0, 3000)}...

For each finding:
1. Extract the specific finding/insight
2. Rate relevance to query (0-1)
3. Rate confidence in the finding (0-1)
4. Categorize (fact, opinion, data, theory, method, result)

Format as JSON array:
[{
  "content": "finding text",
  "relevance": 0.9,
  "confidence": 0.8,
  "category": "fact"
}]`;

    const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [
        {
          role: 'system',
          content: 'You are a research analyst extracting key findings from sources.',
        },
        { role: 'user', content: prompt },
      ],
    });

    try {
      const responseContent = typeof response === 'string' ? response : (response as any).content || '';
      // Try to extract JSON from the response
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      // Fallback: create a single finding from the snippet
      return [{
        content: content.substring(0, 200) + '...',
        relevance: 0.7,
        confidence: 0.6,
        category: 'fact',
      }];
    } catch (e) {
      elizaLogger.warn('[ResearchService] Failed to parse findings, using fallback');
      // Fallback finding based on snippet
      return [{
        content: `From ${source.title}: ${content.substring(0, 200)}...`,
        relevance: 0.7,
        confidence: 0.6,
        category: 'fact',
      }];
    }
  }

  private async extractFactualClaims(source: ResearchSource, content: string): Promise<FactualClaim[]> {
    const prompt = `Extract specific factual claims from this source that can be verified.
    
Source: ${source.title}
Content: ${content.substring(0, 2000)}...

For each factual claim:
1. Extract the exact statement
2. Identify supporting evidence in the text
3. Rate confidence (0-1)

Format as JSON array:
[{
  "statement": "claim text",
  "evidence": ["supporting text 1", "supporting text 2"],
  "confidence": 0.9
}]`;

    const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [
        {
          role: 'system',
          content: 'You are a fact-checker extracting verifiable claims from sources.',
        },
        { role: 'user', content: prompt },
      ],
    });

    try {
      const responseContent = typeof response === 'string' ? response : (response as any).content || '';
      // Try to extract JSON from the response
      const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const claims = JSON.parse(jsonMatch[0]);
        return claims.map((claim: any) => ({
          id: uuidv4(),
          statement: claim.statement,
          supportingEvidence: claim.evidence || [],
          sourceUrls: [source.url],
          verificationStatus: VerificationStatus.UNVERIFIED,
          confidenceScore: claim.confidence || 0.5,
          relatedClaims: [],
        }));
      }
      return [];
    } catch (e) {
      elizaLogger.warn('[ResearchService] Failed to parse claims');
      return [];
    }
  }

  private calculateQualityScore(project: ResearchProject): number {
    const sourceQuality =
      project.sources.reduce((sum, s) => sum + s.reliability, 0) / project.sources.length;
    const findingQuality =
      project.findings.reduce((sum, f) => sum + f.relevance * f.confidence, 0) /
      project.findings.length;
    const coverage = Math.min(
      project.sources.length / project.metadata.queryPlan.expectedSources,
      1
    );

    return sourceQuality * 0.3 + findingQuality * 0.5 + coverage * 0.2;
  }

  private async synthesizeFindings(project: ResearchProject): Promise<void> {
    // Group findings by category
    const categories = new Map<string, ResearchFinding[]>();
    for (const finding of project.findings) {
      const existing = categories.get(finding.category) || [];
      existing.push(finding);
      categories.set(finding.category, existing);
    }

    // Synthesize by category
    const categoryAnalysis: Record<string, string> = {};
    for (const [category, findings] of categories) {
      const synthesis = await this.synthesizeCategory(category, findings);
      categoryAnalysis[category] = synthesis;
    }

    // Overall synthesis
    const overallSynthesis = await this.createOverallSynthesis(project, categoryAnalysis);

    // Update metadata
    project.metadata.categoryAnalysis = categoryAnalysis;
    project.metadata.synthesis = overallSynthesis;
  }

  private async synthesizeCategory(category: string, findings: ResearchFinding[]): Promise<string> {
    const findingTexts = findings.map((f) => f.content).join('\n\n');

    const prompt = `Synthesize these ${category} findings into a coherent summary:
    
${findingTexts}

Create a comprehensive synthesis that:
1. Identifies common themes
2. Notes contradictions or debates
3. Highlights key insights
4. Maintains academic rigor`;

    const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [{ role: 'user', content: prompt }],
    });

    return typeof response === 'string' ? response : (response as any).content || '';
  }

  private async createOverallSynthesis(
    project: ResearchProject,
    categoryAnalysis: Record<string, string>
  ): Promise<string> {
    const prompt = `Create an overall synthesis of this research project:
    
Research Query: "${project.query}"
Domain: ${project.metadata.domain}
Task Type: ${project.metadata.taskType}

Category Analyses:
${Object.entries(categoryAnalysis)
  .map(([cat, analysis]) => `${cat}:\n${analysis}`)
  .join('\n\n')}

Create a comprehensive synthesis that:
1. Answers the original research question
2. Integrates insights across categories
3. Identifies knowledge gaps
4. Suggests future research directions`;

    const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [{ role: 'user', content: prompt }],
    });

    return typeof response === 'string' ? response : (response as any).content || '';
  }

  private async generateReport(project: ResearchProject): Promise<void> {
    if (!project.findings.length) {
      elizaLogger.warn('No findings to generate report from');
      return;
    }

    const sections: ReportSection[] = [];

    // Executive summary
    sections.push({
      id: 'summary',
      heading: 'Executive Summary',
      level: 1,
      content: project.metadata.synthesis || 'No synthesis available',
      findings: [],
      citations: [],
      metadata: {
        wordCount: (project.metadata.synthesis || '').split(' ').length,
        citationDensity: 0,
        readabilityScore: 0,
        keyTerms: [],
      },
    });

    // Category sections
    if (project.metadata.categoryAnalysis) {
      for (const [category, analysis] of Object.entries(project.metadata.categoryAnalysis)) {
        const categoryFindings = project.findings.filter((f) => f.category === category);

        sections.push({
          id: `cat-${category}`,
          heading: this.formatCategoryHeading(category),
          level: 1,
          content: analysis,
          findings: categoryFindings.map((f) => f.id),
          citations: this.extractCitations(categoryFindings),
          metadata: {
            wordCount: analysis.split(' ').length,
            citationDensity: categoryFindings.length / (analysis.split(' ').length / 100),
            readabilityScore: 0,
            keyTerms: [],
          },
        });
      }
    }

    // Create bibliography
    const bibliography = this.createBibliography(project);

    // Calculate metrics
    const wordCount = sections.reduce((sum, s) => sum + s.metadata.wordCount, 0);
    const readingTime = Math.ceil(wordCount / 200); // 200 words per minute

    project.report = {
      id: uuidv4(),
      title: `Research Report: ${project.query}`,
      abstract: project.metadata.synthesis?.substring(0, 300) + '...' || '',
      summary: project.metadata.synthesis || '',
      sections,
      citations: this.extractAllCitations(project),
      bibliography,
      generatedAt: Date.now(),
      wordCount,
      readingTime,
      evaluationMetrics: {
        raceScore: {
          overall: 0,
          comprehensiveness: 0,
          depth: 0,
          instructionFollowing: 0,
          readability: 0,
          breakdown: [],
        },
        factScore: {
          citationAccuracy: 0,
          effectiveCitations: 0,
          totalCitations: 0,
          verifiedCitations: 0,
          disputedCitations: 0,
          citationCoverage: 0,
          sourceCredibility: 0,
          breakdown: [],
        },
        timestamp: Date.now(),
        evaluatorVersion: '1.0',
      },
      exportFormats: [
        { format: 'json', generated: false },
        { format: 'markdown', generated: false },
        { format: 'deepresearch', generated: false },
      ],
    };

    // Save to file if FILE_LOGGING is enabled
    if (this.runtime.getSetting('FILE_LOGGING') === 'true' || process.env.FILE_LOGGING === 'true') {
      await this.saveReportToFile(project);
    }
  }

  private async saveReportToFile(project: ResearchProject): Promise<void> {
    try {
      // Create logs directory
      const logsDir = path.join(process.cwd(), 'research_logs');
      await fs.mkdir(logsDir, { recursive: true });

      // Generate filename with timestamp and sanitized query
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedQuery = project.query
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .substring(0, 50);
      const filename = `${timestamp}_${sanitizedQuery}.md`;
      const filepath = path.join(logsDir, filename);

      // Export as markdown
      const markdownContent = this.exportAsMarkdown(project);
      
      // Add metadata header
      const fullContent = `---
id: ${project.id}
query: ${project.query}
status: ${project.status}
domain: ${project.metadata.domain}
taskType: ${project.metadata.taskType}
createdAt: ${new Date(project.createdAt).toISOString()}
completedAt: ${project.completedAt ? new Date(project.completedAt).toISOString() : 'In Progress'}
sources: ${project.sources.length}
findings: ${project.findings.length}
---

${markdownContent}

## Metadata

- **Research Domain**: ${project.metadata.domain}
- **Task Type**: ${project.metadata.taskType}
- **Research Depth**: ${project.metadata.depth}
- **Sources Analyzed**: ${project.sources.length}
- **Key Findings**: ${project.findings.length}
- **Word Count**: ${project.report?.wordCount || 'N/A'}
- **Estimated Reading Time**: ${project.report?.readingTime || 'N/A'} minutes

## Source URLs

${project.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join('\n')}
`;

      await fs.writeFile(filepath, fullContent, 'utf-8');
      elizaLogger.info(`[ResearchService] Report saved to: ${filepath}`);

      // Also save JSON version
      const jsonFilepath = filepath.replace('.md', '.json');
      await fs.writeFile(jsonFilepath, JSON.stringify(project, null, 2), 'utf-8');
      elizaLogger.info(`[ResearchService] JSON data saved to: ${jsonFilepath}`);

    } catch (error) {
      elizaLogger.error('[ResearchService] Failed to save report to file:', error);
    }
  }

  private formatCategoryHeading(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
  }

  private extractCitations(findings: ResearchFinding[]): Citation[] {
    const citations: Citation[] = [];

    for (const finding of findings) {
      for (const claim of finding.factualClaims) {
        citations.push({
          id: uuidv4(),
          text: claim.statement,
          source: finding.source,
          confidence: claim.confidenceScore,
          verificationStatus: claim.verificationStatus,
          context: finding.content,
          usageCount: 1,
        });
      }
    }

    return citations;
  }

  private extractAllCitations(project: ResearchProject): Citation[] {
    return this.extractCitations(project.findings);
  }

  private createBibliography(project: ResearchProject): BibliographyEntry[] {
    const entries: BibliographyEntry[] = [];
    const processedUrls = new Set<string>();

    for (const source of project.sources) {
      if (processedUrls.has(source.url)) continue;
      processedUrls.add(source.url);

      const authors = source.author?.join(', ') || 'Unknown';
      const year = source.publishDate ? new Date(source.publishDate).getFullYear() : 'n.d.';
      const citation = `${authors} (${year}). ${source.title}. Retrieved from ${source.url}`;

      entries.push({
        id: source.id,
        citation,
        format: 'APA',
        source,
        accessCount: project.findings.filter((f) => f.source.id === source.id).length,
      });
    }

    return entries.sort((a, b) => a.citation.localeCompare(b.citation));
  }

  async evaluateProject(projectId: string): Promise<EvaluationResults> {
    const project = this.projects.get(projectId);
    if (!project || !project.report) {
      throw new Error('Project not found or report not generated');
    }

    const evaluationMetrics = await this.evaluator.evaluateProject(
      project,
      project.metadata.evaluationCriteria
    );

    // Construct the full EvaluationResults object
    const evaluation: EvaluationResults = {
      projectId: project.id,
      raceEvaluation: {
        scores: evaluationMetrics.raceScore,
        detailedFeedback: [],
      },
      factEvaluation: {
        scores: evaluationMetrics.factScore,
        citationMap: {
          claims: new Map(),
          sources: new Map(),
          verification: new Map(),
        },
        verificationDetails: [],
      },
      overallScore: evaluationMetrics.raceScore.overall,
      recommendations: this.generateRecommendations(evaluationMetrics),
      timestamp: Date.now(),
    };

    // Update project with evaluation results
    project.evaluationResults = evaluation;

    // Update report metrics
    if (project.report) {
      project.report.evaluationMetrics = {
        raceScore: evaluationMetrics.raceScore,
        factScore: evaluationMetrics.factScore,
        timestamp: evaluation.timestamp,
        evaluatorVersion: '1.0',
      };
    }

    return evaluation;
  }

  private generateRecommendations(metrics: EvaluationMetrics): string[] {
    const recommendations: string[] = [];
    const race = metrics.raceScore;
    const fact = metrics.factScore;

    if (race.comprehensiveness < 0.7) {
      recommendations.push('Expand coverage to include more aspects of the research topic');
    }
    if (race.depth < 0.7) {
      recommendations.push('Provide deeper analysis and more detailed explanations');
    }
    if (race.readability < 0.7) {
      recommendations.push('Improve clarity and structure for better readability');
    }
    if (fact.citationAccuracy < 0.7) {
      recommendations.push('Verify citations and ensure claims are properly supported');
    }
    if (fact.effectiveCitations < fact.totalCitations * 0.8) {
      recommendations.push('Remove duplicate or redundant citations');
    }

    return recommendations;
  }

  async exportProject(
    projectId: string,
    format: 'json' | 'markdown' | 'deepresearch'
  ): Promise<string> {
    const project = this.projects.get(projectId);
    if (!project || !project.report) {
      throw new Error('Project not found or report not generated');
    }

    switch (format) {
      case 'json':
        return JSON.stringify(project, null, 2);

      case 'markdown':
        return this.exportAsMarkdown(project);

      case 'deepresearch':
        return JSON.stringify(this.exportAsDeepResearchBench(project));

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private exportAsMarkdown(project: ResearchProject): string {
    if (!project.report) return '';

    let markdown = `# ${project.report.title}\n\n`;
    markdown += `**Generated:** ${new Date(project.report.generatedAt).toISOString()}\n\n`;
    markdown += `## Abstract\n\n${project.report.abstract}\n\n`;

    for (const section of project.report.sections) {
      const heading = '#'.repeat(section.level + 1);
      markdown += `${heading} ${section.heading}\n\n`;
      markdown += `${section.content}\n\n`;
    }

    markdown += `## References\n\n`;
    for (const entry of project.report.bibliography) {
      markdown += `- ${entry.citation}\n`;
    }

    return markdown;
  }

  private exportAsDeepResearchBench(project: ResearchProject): DeepResearchBenchResult {
    if (!project.report) throw new Error('Report not generated');

    const article = project.report.sections.map((s) => `${s.heading}\n\n${s.content}`).join('\n\n');

    return {
      id: project.id,
      prompt: project.query,
      article,
      metadata: {
        domain: project.metadata.domain,
        taskType: project.metadata.taskType,
        generatedAt: new Date().toISOString(),
        modelVersion: 'eliza-research-1.0',
        evaluationScores: project.report.evaluationMetrics ? {
          race: project.report.evaluationMetrics.raceScore,
          fact: project.report.evaluationMetrics.factScore,
        } : {
          race: {
            overall: 0,
            comprehensiveness: 0,
            depth: 0,
            instructionFollowing: 0,
            readability: 0,
            breakdown: [],
          },
          fact: {
            citationAccuracy: 0,
            effectiveCitations: 0,
            totalCitations: 0,
            verifiedCitations: 0,
            disputedCitations: 0,
            citationCoverage: 0,
            sourceCredibility: 0,
            breakdown: [],
          },
        },
      },
    };
  }

  async compareProjects(projectIds: string[]): Promise<any> {
    const projects = projectIds
      .map((id) => this.projects.get(id))
      .filter(Boolean) as ResearchProject[];

    if (projects.length < 2) {
      throw new Error('Need at least 2 projects to compare');
    }

    // Calculate similarity
    const similarity = await this.calculateProjectSimilarity(projects);

    // Find differences
    const differences = await this.findProjectDifferences(projects);

    // Extract unique insights
    const uniqueInsights = await this.extractUniqueInsights(projects);

    // Compare quality
    const qualityComparison = this.compareProjectQuality(projects);

    return {
      projectIds,
      similarity,
      differences,
      uniqueInsights,
      qualityComparison,
      recommendation: await this.generateComparisonRecommendation(
        projects,
        similarity,
        differences
      ),
    };
  }

  private async calculateProjectSimilarity(projects: ResearchProject[]): Promise<number> {
    // Compare domains, findings overlap, source overlap
    const domainMatch = projects.every((p) => p.metadata.domain === projects[0].metadata.domain)
      ? 0.2
      : 0;

    // Compare findings
    const allFindings = projects.flatMap((p) => p.findings.map((f) => f.content));
    const uniqueFindings = new Set(allFindings);
    const overlapRatio = 1 - uniqueFindings.size / allFindings.length;

    return domainMatch + overlapRatio * 0.8;
  }

  private async findProjectDifferences(projects: ResearchProject[]): Promise<string[]> {
    const differences: string[] = [];

    // Domain differences
    const domains = new Set(projects.map((p) => p.metadata.domain));
    if (domains.size > 1) {
      differences.push(
        `Projects span ${domains.size} different domains: ${Array.from(domains).join(', ')}`
      );
    }

    // Approach differences
    const taskTypes = new Set(projects.map((p) => p.metadata.taskType));
    if (taskTypes.size > 1) {
      differences.push(`Different research approaches used: ${Array.from(taskTypes).join(', ')}`);
    }

    // Source type differences
    const sourceTypes = projects.map((p) => {
      const types = new Set(p.sources.map((s) => s.type));
      return Array.from(types);
    });

    return differences;
  }

  private async extractUniqueInsights(
    projects: ResearchProject[]
  ): Promise<Record<string, string[]>> {
    const insights: Record<string, string[]> = {};

    for (const project of projects) {
      const projectInsights = project.findings
        .filter((f) => f.relevance > 0.8 && f.confidence > 0.8)
        .slice(0, 3)
        .map((f) => f.content.substring(0, 200) + '...');

      insights[project.id] = projectInsights;
    }

    return insights;
  }

  private compareProjectQuality(projects: ResearchProject[]): any[] {
    return projects.map((p) => ({
      projectId: p.id,
      sourceCount: p.sources.length,
      findingCount: p.findings.length,
      avgSourceReliability: p.sources.reduce((sum, s) => sum + s.reliability, 0) / p.sources.length,
      evaluationScore: p.evaluationResults?.overallScore || 0,
    }));
  }

  private async generateComparisonRecommendation(
    projects: ResearchProject[],
    similarity: number,
    differences: string[]
  ): Promise<string> {
    if (similarity > 0.8) {
      return 'These projects are highly similar and could be merged or one could be used as validation for the other.';
    } else if (similarity > 0.5) {
      return 'These projects have moderate overlap but explore different aspects. Consider synthesizing insights from both.';
    } else {
      return 'These projects are quite different and provide complementary perspectives on related topics.';
    }
  }

  async addRefinedQueries(projectId: string, queries: string[]): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    // Add as new sub-queries
    const newSubQueries = queries.map((query, index) => ({
      id: `refined_${Date.now()}_${index}`,
      query,
      purpose: 'Refined based on initial findings',
      priority: 2,
      dependsOn: [],
      searchProviders: ['web'],
      expectedResultType:
        project.metadata.taskType === TaskType.ANALYTICAL
          ? ('theoretical' as any)
          : ('factual' as any),
      completed: false,
    }));

    project.metadata.queryPlan.subQueries.push(...newSubQueries);

    // Continue research if active
    if (project.status === ResearchStatus.ACTIVE) {
      const controller = this.activeResearch.get(projectId);
      if (controller) {
        // Execute new queries
        const config = { ...DEFAULT_CONFIG, domain: project.metadata.domain };
        await this.executeSearch(project, config, controller.signal);
      }
    }
  }

  async pauseResearch(projectId: string): Promise<void> {
    const controller = this.activeResearch.get(projectId);
    if (controller) {
      controller.abort();
    }

    const project = this.projects.get(projectId);
    if (project) {
      project.status = ResearchStatus.PAUSED;
      project.updatedAt = Date.now();
    }
  }

  async resumeResearch(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project || project.status !== ResearchStatus.PAUSED) {
      throw new Error('Project not found or not paused');
    }

    // Restart research from current phase
    const config = { ...DEFAULT_CONFIG, domain: project.metadata.domain };
    this.startResearch(projectId, config).catch((error) => {
      elizaLogger.error(`Failed to resume research ${projectId}:`, error);
    });
  }

  private emitProgress(project: ResearchProject, message: string): void {
    const progress: ResearchProgress = {
      projectId: project.id,
      phase: project.phase,
      message,
      progress: this.calculateProgress(project),
      timestamp: Date.now(),
    };

    // In a real implementation, this would emit to event system
    elizaLogger.info(`Research progress: ${JSON.stringify(progress)}`);
  }

  private calculateProgress(project: ResearchProject): number {
    const phases = Object.values(ResearchPhase);
    const currentIndex = phases.indexOf(project.phase);
    return (currentIndex / (phases.length - 1)) * 100;
  }

  // Service lifecycle methods
  async stop(): Promise<void> {
    // Abort all active research
    for (const [projectId, controller] of this.activeResearch) {
      controller.abort();
      const project = this.projects.get(projectId);
      if (project) {
        project.status = ResearchStatus.PAUSED;
      }
    }
    this.activeResearch.clear();
  }

  async getProject(projectId: string): Promise<ResearchProject | undefined> {
    return this.projects.get(projectId);
  }

  async getAllProjects(): Promise<ResearchProject[]> {
    return Array.from(this.projects.values());
  }

  async getActiveProjects(): Promise<ResearchProject[]> {
    return Array.from(this.projects.values()).filter((p) => p.status === ResearchStatus.ACTIVE);
  }
}
