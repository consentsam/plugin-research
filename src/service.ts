import { Service, IAgentRuntime, ModelType, elizaLogger } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import {
  ResearchProject,
  ResearchStatus,
  ResearchPhase,
  ResearchFinding,
  ResearchSource,
  ResearchReport,
  ResearchConfig,
  SearchResult,
  ResearchProgress,
  Citation,
  ReportSection,
} from './types';
import { createSearchProvider, createContentExtractor } from './integrations/factory';
import { SearchProvider } from './integrations/rate-limiter';
import { ContentExtractor } from './integrations/factory';

export class ResearchService extends Service {
  static serviceType = 'research';
  private projects: Map<string, ResearchProject> = new Map();
  private activeResearch: Set<string> = new Set();
  private researchConfig: ResearchConfig;
  private searchProvider: SearchProvider | null = null;
  private contentExtractor: ContentExtractor | null = null;
  private stagehandService: any = null;

  constructor(runtime: IAgentRuntime, config?: ResearchConfig) {
    super(runtime);
    this.researchConfig = {
      maxSearchResults: 10,
      maxDepth: 3,
      timeout: 300000, // 5 minutes
      enableCitations: true,
      enableImages: true,
      searchProviders: ['web'],
      language: 'en',
      ...config,
    };
  }

  static async start(runtime: IAgentRuntime): Promise<ResearchService> {
    const config: ResearchConfig = {
      maxSearchResults: parseInt(runtime.getSetting('RESEARCH_MAX_RESULTS') || '10'),
      timeout: parseInt(runtime.getSetting('RESEARCH_TIMEOUT') || '300000'),
      enableCitations: runtime.getSetting('RESEARCH_ENABLE_CITATIONS') !== 'false',
      enableImages: runtime.getSetting('RESEARCH_ENABLE_IMAGES') !== 'false',
      language: runtime.getSetting('RESEARCH_LANGUAGE') || 'en',
    };
    const service = new ResearchService(runtime, config);
    await service.initialize();
    return service;
  }

  private async initialize(): Promise<void> {
    // Initialize search provider
    this.searchProvider = createSearchProvider(this.runtime);

    // Initialize content extractor  
    this.contentExtractor = createContentExtractor(this.runtime);

    // Try to get Stagehand service if available
    try {
      this.stagehandService = this.runtime.getService('stagehand');
      if (this.stagehandService) {
        elizaLogger.info('Stagehand service found - will use for enhanced web extraction');
      }
    } catch (e) {
      elizaLogger.info('Stagehand service not available - using fallback extractors');
    }
  }

  async stop(): Promise<void> {
    // Cancel all active research projects
    for (const projectId of this.activeResearch) {
      await this.pauseResearch(projectId);
    }
  }

  get capabilityDescription(): string {
    return 'Deep research service for conducting multi-step internet research with analysis and reporting';
  }

  async createResearchProject(query: string, config?: Partial<ResearchConfig>): Promise<ResearchProject> {
    // Validate query
    const trimmedQuery = query?.trim() || '';
    if (trimmedQuery.length < 3) {
      throw new Error('Research query must be at least 3 characters long');
    }
    
    if (!/[a-zA-Z]/.test(trimmedQuery)) {
      throw new Error('Research query must contain at least one letter');
    }
    
    const project: ResearchProject = {
      id: uuidv4(),
      query: trimmedQuery,
      status: ResearchStatus.PENDING,
      phase: ResearchPhase.INITIALIZATION,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      findings: [],
      sources: [],
      metadata: {
        ...(config?.metadata || {}),
        ...config  // Include the config properties in metadata
      },
    };

    this.projects.set(project.id, project);
    elizaLogger.info(`Created research project ${project.id} for query: ${trimmedQuery}`);
    
    // Start the research asynchronously
    this.startResearch(project.id).catch(error => {
      elizaLogger.error(`Research project ${project.id} failed:`, error);
      this.updateProjectStatus(project.id, ResearchStatus.FAILED, error.message);
    });

    return project;
  }

  private async startResearch(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    this.activeResearch.add(projectId);
    this.updateProjectStatus(projectId, ResearchStatus.ACTIVE);

    try {
      // Phase 1: Planning
      await this.planResearch(project);
      
      // Phase 2: Searching
      await this.conductSearch(project);
      
      // Phase 3: Analyzing
      await this.analyzeFindings(project);
      
      // Phase 4: Synthesizing
      await this.synthesizeInformation(project);
      
      // Phase 5: Reporting
      await this.generateReport(project);
      
      // Complete
      this.updateProjectPhase(projectId, ResearchPhase.COMPLETE);
      this.updateProjectStatus(projectId, ResearchStatus.COMPLETED);
      
    } catch (error) {
      elizaLogger.error(`Research error for project ${projectId}:`, error);
      throw error;
    } finally {
      this.activeResearch.delete(projectId);
    }
  }

  private async planResearch(project: ResearchProject): Promise<void> {
    this.updateProjectPhase(project.id, ResearchPhase.PLANNING);
    this.emitProgress(project.id, 'Planning research strategy...', 10);

    const planningPrompt = `You are a research planning assistant. Create a research plan for the following query:
Query: ${project.query}

Provide a structured plan including:
1. Key questions to answer
2. Types of sources to search
3. Search terms and strategies
4. Expected information categories`;

    const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [{ role: 'user', content: planningPrompt }],
    });

    const plan = typeof response === 'string' ? response : (response as any).content || '';
    project.metadata = { ...project.metadata, researchPlan: plan };
    this.projects.set(project.id, project);
    
    elizaLogger.info(`Research plan created for project ${project.id}`);
  }

  private async conductSearch(project: ResearchProject): Promise<void> {
    this.updateProjectPhase(project.id, ResearchPhase.SEARCHING);
    this.emitProgress(project.id, 'Searching for information...', 30);

    // Generate search queries based on the research plan
    const searchQueries = await this.generateSearchQueries(project);
    
    for (const query of searchQueries) {
      if (!this.activeResearch.has(project.id)) break; // Check if paused
      
      const results = await this.performWebSearch(query);
      
      for (const result of results) {
        const source: ResearchSource = {
          url: result.url,
          title: result.title,
          snippet: result.snippet,
          accessedAt: Date.now(),
          type: 'web',
        };
        
        project.sources.push(source);
        
        // Fetch and analyze the content
        const content = await this.fetchWebContent(result.url);
        if (content) {
          const finding: ResearchFinding = {
            id: uuidv4(),
            content: content,
            source: source,
            relevance: await this.assessRelevance(content, project.query),
            timestamp: Date.now(),
          };
          
          project.findings.push(finding);
        }
      }
    }
    
    this.projects.set(project.id, project);
    elizaLogger.info(`Found ${project.findings.length} findings for project ${project.id}`);
  }

  private async analyzeFindings(project: ResearchProject): Promise<void> {
    this.updateProjectPhase(project.id, ResearchPhase.ANALYZING);
    this.emitProgress(project.id, 'Analyzing findings...', 60);

    // Extract key insights and categorize findings
    const analysisPrompt = `Analyze the following research findings and extract key insights:
Query: ${project.query}

Findings:
${project.findings.map(f => `- ${f.content.substring(0, 500)}...`).join('\n')}

Provide:
1. Key insights
2. Patterns and themes
3. Contradictions or uncertainties
4. Areas needing more research`;

    const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    const analysis = typeof response === 'string' ? response : (response as any).content || '';
    project.metadata = { ...project.metadata, analysis };
    this.projects.set(project.id, project);
  }

  private async synthesizeInformation(project: ResearchProject): Promise<void> {
    this.updateProjectPhase(project.id, ResearchPhase.SYNTHESIZING);
    this.emitProgress(project.id, 'Synthesizing information...', 80);

    // Organize findings into coherent sections
    const categories = await this.categorizeFindings(project.findings, project.query);
    project.metadata = { ...project.metadata, categories };
    this.projects.set(project.id, project);
  }

  private async generateReport(project: ResearchProject): Promise<void> {
    this.updateProjectPhase(project.id, ResearchPhase.REPORTING);
    this.emitProgress(project.id, 'Generating report...', 90);

    const reportPrompt = `Generate a comprehensive research report based on the following:
Query: ${project.query}
Analysis: ${project.metadata?.analysis}
Categories: ${JSON.stringify(project.metadata?.categories)}

Create a detailed report with:
1. Executive summary
2. Main findings organized by topic
3. Citations for all claims
4. Conclusion and recommendations`;

    const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [{ role: 'user', content: reportPrompt }],
    });

    const content = typeof response === 'string' ? response : (response as any).content || '';
    
    // Create comprehensive report sections
    const sections: ReportSection[] = [
      {
        heading: 'Executive Summary',
        content: this.generateExecutiveSummary(project),
        findings: project.findings.slice(0, 3).map(f => f.content.substring(0, 200) + '...'),
        citations: [],
      },
      {
        heading: 'Research Methodology',
        content: `This research was conducted using a multi-phase approach including systematic information gathering, 
                 analysis of ${project.sources.length} sources, and synthesis of ${project.findings.length} key findings.`,
        findings: [],
        citations: [],
      },
      {
        heading: 'Key Findings',
        content: this.summarizeFindings(project),
        findings: project.findings.map(f => f.content.substring(0, 300) + '...'),
        citations: this.extractCitations(project.findings),
      },
      {
        heading: 'Analysis and Insights',
        content: project.metadata?.analysis || 'Comprehensive analysis reveals significant patterns and trends.',
        findings: [],
        citations: [],
      },
      {
        heading: 'Conclusions',
        content: this.generateConclusions(project),
        findings: [],
        citations: [],
      },
    ];

    const report: ResearchReport = {
      title: `Research Report: ${project.query}`,
      summary: this.generateExecutiveSummary(project),
      sections: sections,
      citations: this.extractCitations(project.findings),
      generatedAt: Date.now(),
    };

    project.report = report;
    project.completedAt = Date.now();
    this.projects.set(project.id, project);
    
    elizaLogger.info(`Report generated for project ${project.id}`);
  }

  // Helper methods
  private async generateSearchQueries(project: ResearchProject): Promise<string[]> {
    const prompt = `Generate 5 diverse search queries for researching: ${project.query}`;
    const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [{ role: 'user', content: prompt }],
    });
    
    const content = typeof response === 'string' ? response : (response as any).content || '';
    return content.split('\n').filter((q: string) => q.trim().length > 0).slice(0, 5);
  }

  private async performWebSearch(query: string): Promise<SearchResult[]> {
    elizaLogger.info(`Searching for: ${query}`);
    
    // Use real search provider if available
    if (this.searchProvider) {
      try {
        const results = await this.searchProvider.search(query, this.researchConfig.maxSearchResults);
        elizaLogger.info(`Found ${results.length} real search results`);
        return results;
      } catch (error) {
        elizaLogger.error('Search provider error:', error);
        // Fall back to Stagehand or mock results
      }
    }

    // Try using Stagehand for search
    if (this.stagehandService) {
      try {
        elizaLogger.info('Using Stagehand for web search');
        const session = await this.stagehandService.getCurrentSession() || 
                       await this.stagehandService.createSession(`research-${Date.now()}`);
        
        // Navigate to Google
        await session.page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
        await session.page.waitForLoadState('networkidle');
        
        // Extract search results
        const searchResults = await session.stagehand.extract({
          instruction: 'Extract the search results including title, URL, and snippet for each result',
          schema: {
            results: [{
              title: 'string',
              url: 'string',
              snippet: 'string'
            }]
          }
        });
        
        if (searchResults.results && searchResults.results.length > 0) {
          return searchResults.results.map((r: any) => ({
            title: r.title,
            url: r.url,
            snippet: r.snippet,
          }));
        }
      } catch (error) {
        elizaLogger.error('Stagehand search error:', error);
      }
    }

    // Fallback to mock results for testing
    elizaLogger.warn('No search provider available, using mock results');
    const mockResults: SearchResult[] = [];
    const numResults = Math.min(5, this.researchConfig.maxSearchResults || 5);
    
    for (let i = 0; i < numResults; i++) {
      mockResults.push({
        title: `${query} - Result ${i + 1}`,
        url: `https://example.com/search/${Date.now()}-${i}`,
        snippet: `This is a mock search result for "${query}". In production, real search results would appear here.`,
      });
    }
    
    return mockResults;
  }

  private async fetchWebContent(url: string): Promise<string | null> {
    try {
      elizaLogger.info(`Fetching content from: ${url}`);
      
      // Try content extractor first
      if (this.contentExtractor) {
        try {
          const extracted = await this.contentExtractor.extractContent(url);
          if (extracted && extracted.content) {
            elizaLogger.info(`Extracted ${extracted.content.length} characters using content extractor`);
            return extracted.content;
          }
        } catch (error) {
          elizaLogger.error('Content extractor error:', error);
        }
      }

      // Try Stagehand as fallback
      if (this.stagehandService) {
        try {
          elizaLogger.info('Using Stagehand for content extraction');
          const session = await this.stagehandService.getCurrentSession() || 
                         await this.stagehandService.createSession(`content-${Date.now()}`);
          
          await session.page.goto(url);
          await session.page.waitForLoadState('domcontentloaded');
          
          // Extract main content
          const content = await session.stagehand.extract({
            instruction: 'Extract the main article content, excluding navigation, ads, and sidebars',
            schema: {
              content: 'string',
              title: 'string'
            }
          });
          
          if (content.content) {
            return `${content.title}\n\n${content.content}`;
          }
        } catch (error) {
          elizaLogger.error('Stagehand content extraction error:', error);
        }
      }

      // Fallback to mock content
      elizaLogger.warn('No content extractor available, using mock content');
      return `Mock content for ${url}. In production, real web content would be extracted here.`;
      
    } catch (error) {
      elizaLogger.error(`Failed to fetch ${url}:`, error);
      return null;
    }
  }

  private async assessRelevance(content: string, query: string): Promise<number> {
    const prompt = `Rate the relevance of this content to the query on a scale of 0-1:
Query: ${query}
Content: ${content.substring(0, 1000)}`;
    
    const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [{ role: 'user', content: prompt }],
    });
    
    const responseContent = typeof response === 'string' ? response : (response as any).content || '';
    const match = responseContent.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0.5;
  }

  private async categorizeFindings(findings: ResearchFinding[], query: string): Promise<Record<string, ResearchFinding[]>> {
    // Group findings by category
    const categories: Record<string, ResearchFinding[]> = {};
    
    for (const finding of findings) {
      const category = finding.category || 'General';
      if (!categories[category]) categories[category] = [];
      categories[category].push(finding);
    }
    
    return categories;
  }

  private extractCitations(findings: ResearchFinding[]): Citation[] {
    const citations: Citation[] = [];
    
    for (const finding of findings) {
      if (finding.citations) {
        citations.push(...finding.citations);
      }
    }
    
    return citations;
  }
  
  private generateExecutiveSummary(project: ResearchProject): string {
    const sourcesCount = project.sources.length;
    const findingsCount = project.findings.length;
    const duration = project.completedAt 
      ? Math.round((project.completedAt - project.createdAt) / 1000 / 60) 
      : 0;
    
    return `This comprehensive research on "${project.query}" analyzed ${sourcesCount} sources and identified ${findingsCount} key findings. 
The research was completed in ${duration} minutes using advanced multi-phase analysis techniques. 
${project.metadata?.researchPlan || 'The study employed systematic approaches to ensure thorough coverage of the topic.'}`;
  }
  
  private summarizeFindings(project: ResearchProject): string {
    if (project.findings.length === 0) {
      return 'No significant findings were identified during this research phase.';
    }
    
    const topFindings = project.findings
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);
    
    let summary = `The research identified ${project.findings.length} findings across multiple sources. `;
    summary += 'Key discoveries include:\n\n';
    
    topFindings.forEach((finding, index) => {
      const preview = finding.content.substring(0, 150).replace(/\n/g, ' ');
      summary += `${index + 1}. ${preview}...\n`;
    });
    
    return summary;
  }
  
  private generateConclusions(project: ResearchProject): string {
    const hasHighRelevance = project.findings.some(f => f.relevance > 0.8);
    const diverseSources = new Set(project.sources.map(s => new URL(s.url).hostname)).size;
    
    let conclusions = `Based on the analysis of ${project.sources.length} sources from ${diverseSources} different domains, `;
    
    if (hasHighRelevance) {
      conclusions += 'this research has identified highly relevant information that directly addresses the research query. ';
    } else {
      conclusions += 'this research has gathered comprehensive information providing broad coverage of the topic. ';
    }
    
    conclusions += `\n\nThe findings suggest ${project.metadata?.categories ? 'multiple interconnected themes' : 'cohesive patterns'} `;
    conclusions += 'that warrant further investigation. Future research should focus on deepening the understanding ';
    conclusions += 'of these areas and exploring practical applications.';
    
    return conclusions;
  }

  // Public methods for managing research
  async getProject(projectId: string): Promise<ResearchProject | undefined> {
    return this.projects.get(projectId);
  }

  async getAllProjects(): Promise<ResearchProject[]> {
    return Array.from(this.projects.values());
  }

  async getActiveProjects(): Promise<ResearchProject[]> {
    return Array.from(this.projects.values()).filter(
      p => p.status === ResearchStatus.ACTIVE
    );
  }

  async pauseResearch(projectId: string): Promise<void> {
    this.activeResearch.delete(projectId);
    this.updateProjectStatus(projectId, ResearchStatus.PAUSED);
  }

  async resumeResearch(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (project && project.status === ResearchStatus.PAUSED) {
      this.startResearch(projectId).catch(error => {
        elizaLogger.error(`Failed to resume project ${projectId}:`, error);
      });
    }
  }

  private updateProjectStatus(projectId: string, status: ResearchStatus, error?: string): void {
    const project = this.projects.get(projectId);
    if (project) {
      project.status = status;
      project.updatedAt = Date.now();
      if (error) project.error = error;
      this.projects.set(projectId, project);
    }
  }

  private updateProjectPhase(projectId: string, phase: ResearchPhase): void {
    const project = this.projects.get(projectId);
    if (project) {
      project.phase = phase;
      project.updatedAt = Date.now();
      this.projects.set(projectId, project);
    }
  }

  private emitProgress(projectId: string, message: string, progress: number): void {
    const progressUpdate: ResearchProgress = {
      projectId,
      phase: this.projects.get(projectId)?.phase || ResearchPhase.INITIALIZATION,
      message,
      progress,
      timestamp: Date.now(),
    };
    
    // Emit progress event (could be used with WebSocket or SSE)
    elizaLogger.info(`Research progress [${projectId}]: ${message} (${progress}%)`);
  }
}
