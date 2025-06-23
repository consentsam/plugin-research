import { IAgentRuntime, elizaLogger, ModelType } from '@elizaos/core';
import {
  ResearchDomain,
  TaskType,
  ResearchDepth,
  QueryPlan,
  SubQuery,
  SearchStrategy,
  SearchApproach,
  DomainApproach,
  EvaluationCriteria,
  CriteriaDefinition,
  ScoringMethod,
  ResearchMetadata,
  ResultType,
  TemporalFocus,
  SourceType,
  RubricItem,
} from '../types';
import { safeModelCall } from '../utils/model-error-logger';

// Domain-specific research configurations
const DOMAIN_CONFIGS: Record<ResearchDomain, DomainConfig> = {
  [ResearchDomain.PHYSICS]: {
    keyTerms: ['quantum', 'relativity', 'particle', 'mechanics', 'thermodynamics', 'electromagnetism'],
    authoritySource: ['arxiv.org', 'physics.aps.org', 'nature.com/nphys', 'science.org'],
    methodology: 'theoretical-experimental',
    evaluationFocus: ['mathematical rigor', 'experimental validation', 'theoretical consistency'],
    preferredSources: [SourceType.ACADEMIC, SourceType.TECHNICAL],
  },
  [ResearchDomain.CHEMISTRY]: {
    keyTerms: ['synthesis', 'reaction', 'compound', 'molecular', 'organic', 'inorganic'],
    authoritySource: ['acs.org', 'rsc.org', 'chemistry.nature.com', 'sciencedirect.com'],
    methodology: 'experimental-analytical',
    evaluationFocus: ['reproducibility', 'yield', 'purity', 'mechanism'],
    preferredSources: [SourceType.ACADEMIC, SourceType.TECHNICAL],
  },
  [ResearchDomain.BIOLOGY]: {
    keyTerms: ['cell', 'gene', 'protein', 'evolution', 'ecology', 'physiology'],
    authoritySource: ['ncbi.nlm.nih.gov', 'nature.com', 'cell.com', 'biology.plos.org'],
    methodology: 'observational-experimental',
    evaluationFocus: ['statistical significance', 'reproducibility', 'biological relevance'],
    preferredSources: [SourceType.ACADEMIC, SourceType.GOVERNMENT],
  },
  [ResearchDomain.ENVIRONMENTAL_SCIENCE]: {
    keyTerms: ['climate', 'ecosystem', 'pollution', 'sustainability', 'biodiversity', 'conservation'],
    authoritySource: ['ipcc.ch', 'epa.gov', 'nature.com/nclimate', 'unep.org'],
    methodology: 'observational-modeling',
    evaluationFocus: ['data quality', 'model accuracy', 'policy implications'],
    preferredSources: [SourceType.GOVERNMENT, SourceType.ACADEMIC, SourceType.ORGANIZATION],
  },
  [ResearchDomain.ENGINEERING]: {
    keyTerms: ['design', 'optimization', 'materials', 'systems', 'control', 'manufacturing'],
    authoritySource: ['ieee.org', 'asme.org', 'engineeringvillage.com', 'asce.org'],
    methodology: 'design-testing',
    evaluationFocus: ['performance', 'efficiency', 'cost-effectiveness', 'safety'],
    preferredSources: [SourceType.TECHNICAL, SourceType.ACADEMIC],
  },
  [ResearchDomain.COMPUTER_SCIENCE]: {
    keyTerms: ['algorithm', 'data structure', 'machine learning', 'network', 'security', 'software'],
    authoritySource: ['acm.org', 'ieee.org', 'arxiv.org/cs', 'github.com'],
    methodology: 'theoretical-implementation',
    evaluationFocus: ['complexity', 'correctness', 'scalability', 'performance'],
    preferredSources: [SourceType.TECHNICAL, SourceType.ACADEMIC, SourceType.WEB],
  },
  [ResearchDomain.MATHEMATICS]: {
    keyTerms: ['theorem', 'proof', 'equation', 'topology', 'algebra', 'analysis'],
    authoritySource: ['ams.org', 'arxiv.org/math', 'mathscinet.ams.org', 'zbmath.org'],
    methodology: 'theoretical-proof',
    evaluationFocus: ['rigor', 'generality', 'elegance', 'applicability'],
    preferredSources: [SourceType.ACADEMIC],
  },
  [ResearchDomain.MEDICINE]: {
    keyTerms: ['diagnosis', 'treatment', 'clinical', 'pathology', 'pharmacology', 'epidemiology'],
    authoritySource: ['pubmed.ncbi.nlm.nih.gov', 'nejm.org', 'thelancet.com', 'who.int'],
    methodology: 'clinical-evidence',
    evaluationFocus: ['clinical significance', 'safety', 'efficacy', 'evidence level'],
    preferredSources: [SourceType.ACADEMIC, SourceType.GOVERNMENT],
  },
  [ResearchDomain.PSYCHOLOGY]: {
    keyTerms: ['behavior', 'cognition', 'emotion', 'development', 'personality', 'disorder'],
    authoritySource: ['apa.org', 'psychologicalscience.org', 'nature.com/nathumbehav', 'ncbi.nlm.nih.gov'],
    methodology: 'empirical-theoretical',
    evaluationFocus: ['validity', 'reliability', 'generalizability', 'ethical considerations'],
    preferredSources: [SourceType.ACADEMIC, SourceType.ORGANIZATION],
  },
  [ResearchDomain.ECONOMICS]: {
    keyTerms: ['market', 'policy', 'growth', 'inflation', 'trade', 'behavioral'],
    authoritySource: ['nber.org', 'imf.org', 'worldbank.org', 'aeaweb.org'],
    methodology: 'theoretical-empirical',
    evaluationFocus: ['model validity', 'data quality', 'policy relevance', 'predictive power'],
    preferredSources: [SourceType.ACADEMIC, SourceType.GOVERNMENT, SourceType.ORGANIZATION],
  },
  [ResearchDomain.FINANCE]: {
    keyTerms: ['investment', 'risk', 'portfolio', 'derivatives', 'banking', 'cryptocurrency'],
    authoritySource: ['bloomberg.com', 'reuters.com', 'ft.com', 'wsj.com'],
    methodology: 'quantitative-analytical',
    evaluationFocus: ['return', 'risk assessment', 'market efficiency', 'regulatory compliance'],
    preferredSources: [SourceType.NEWS, SourceType.TECHNICAL, SourceType.GOVERNMENT],
  },
  [ResearchDomain.BUSINESS]: {
    keyTerms: ['strategy', 'management', 'innovation', 'leadership', 'operations', 'entrepreneurship'],
    authoritySource: ['hbr.org', 'mckinsey.com', 'bcg.com', 'forbes.com'],
    methodology: 'case-analytical',
    evaluationFocus: ['practicality', 'ROI', 'scalability', 'competitive advantage'],
    preferredSources: [SourceType.NEWS, SourceType.ORGANIZATION, SourceType.ACADEMIC],
  },
  [ResearchDomain.MARKETING]: {
    keyTerms: ['consumer', 'branding', 'digital', 'segmentation', 'campaign', 'analytics'],
    authoritySource: ['marketingland.com', 'adweek.com', 'warc.com', 'ama.org'],
    methodology: 'empirical-creative',
    evaluationFocus: ['ROI', 'engagement', 'conversion', 'brand impact'],
    preferredSources: [SourceType.NEWS, SourceType.WEB, SourceType.ORGANIZATION],
  },
  [ResearchDomain.HUMAN_RESOURCES]: {
    keyTerms: ['recruitment', 'performance', 'culture', 'compensation', 'development', 'retention'],
    authoritySource: ['shrm.org', 'cipd.co.uk', 'hbr.org', 'gallup.com'],
    methodology: 'empirical-practical',
    evaluationFocus: ['employee satisfaction', 'productivity', 'retention', 'compliance'],
    preferredSources: [SourceType.ORGANIZATION, SourceType.NEWS, SourceType.ACADEMIC],
  },
  [ResearchDomain.LAW]: {
    keyTerms: ['statute', 'precedent', 'jurisdiction', 'litigation', 'compliance', 'regulation'],
    authoritySource: ['westlaw.com', 'lexisnexis.com', 'law.cornell.edu', 'supremecourt.gov'],
    methodology: 'precedent-analytical',
    evaluationFocus: ['legal validity', 'precedent', 'jurisdiction', 'practical application'],
    preferredSources: [SourceType.GOVERNMENT, SourceType.ACADEMIC],
  },
  [ResearchDomain.POLITICS]: {
    keyTerms: ['policy', 'election', 'governance', 'ideology', 'diplomacy', 'legislation'],
    authoritySource: ['politico.com', 'foreignaffairs.com', 'brookings.edu', 'cfr.org'],
    methodology: 'analytical-comparative',
    evaluationFocus: ['objectivity', 'source diversity', 'historical context', 'impact analysis'],
    preferredSources: [SourceType.NEWS, SourceType.ORGANIZATION, SourceType.GOVERNMENT],
  },
  [ResearchDomain.HISTORY]: {
    keyTerms: ['period', 'civilization', 'event', 'source', 'interpretation', 'archaeology'],
    authoritySource: ['jstor.org', 'archives.gov', 'history.com', 'britannica.com'],
    methodology: 'source-analytical',
    evaluationFocus: ['source reliability', 'historiography', 'context', 'multiple perspectives'],
    preferredSources: [SourceType.ACADEMIC, SourceType.BOOK, SourceType.GOVERNMENT],
  },
  [ResearchDomain.PHILOSOPHY]: {
    keyTerms: ['ethics', 'metaphysics', 'epistemology', 'logic', 'aesthetics', 'phenomenology'],
    authoritySource: ['plato.stanford.edu', 'iep.utm.edu', 'philpapers.org', 'jstor.org'],
    methodology: 'analytical-dialectical',
    evaluationFocus: ['logical consistency', 'clarity', 'originality', 'practical implications'],
    preferredSources: [SourceType.ACADEMIC, SourceType.BOOK],
  },
  [ResearchDomain.ART_DESIGN]: {
    keyTerms: ['aesthetic', 'composition', 'medium', 'movement', 'technique', 'critique'],
    authoritySource: ['artforum.com', 'moma.org', 'tate.org.uk', 'designboom.com'],
    methodology: 'critical-creative',
    evaluationFocus: ['originality', 'technique', 'cultural impact', 'aesthetic value'],
    preferredSources: [SourceType.WEB, SourceType.ORGANIZATION, SourceType.BOOK],
  },
  [ResearchDomain.ENTERTAINMENT]: {
    keyTerms: ['media', 'audience', 'production', 'distribution', 'content', 'platform'],
    authoritySource: ['variety.com', 'hollywoodreporter.com', 'rottentomatoes.com', 'imdb.com'],
    methodology: 'analytical-critical',
    evaluationFocus: ['audience reception', 'critical analysis', 'commercial success', 'cultural impact'],
    preferredSources: [SourceType.NEWS, SourceType.WEB],
  },
  [ResearchDomain.TRANSPORTATION]: {
    keyTerms: ['mobility', 'infrastructure', 'logistics', 'autonomous', 'sustainability', 'urban'],
    authoritySource: ['transportation.gov', 'itf-oecd.org', 'apta.com', 'railway-technology.com'],
    methodology: 'systems-analytical',
    evaluationFocus: ['efficiency', 'safety', 'sustainability', 'cost-effectiveness'],
    preferredSources: [SourceType.GOVERNMENT, SourceType.TECHNICAL, SourceType.ORGANIZATION],
  },
  [ResearchDomain.GENERAL]: {
    keyTerms: [],
    authoritySource: ['wikipedia.org', 'britannica.com', 'scholar.google.com'],
    methodology: 'mixed-methods',
    evaluationFocus: ['accuracy', 'comprehensiveness', 'clarity', 'source diversity'],
    preferredSources: [SourceType.WEB, SourceType.ACADEMIC, SourceType.NEWS],
  },
};

interface DomainConfig {
  keyTerms: string[];
  authoritySource: string[];
  methodology: string;
  evaluationFocus: string[];
  preferredSources: SourceType[];
}

export class ResearchStrategyFactory {
  constructor(private runtime: IAgentRuntime) {}

  async createStrategy(
    query: string,
    domain: ResearchDomain,
    taskType: TaskType,
    depth: ResearchDepth
  ): Promise<SearchStrategy> {
    const domainConfig = DOMAIN_CONFIGS[domain];
    
    // Determine search approach based on task type and depth
    const approach = this.determineSearchApproach(taskType, depth);
    
    // Determine temporal focus based on query analysis
    const temporalFocus = await this.analyzeTemporalFocus(query);
    
    return {
      approach,
      sourceTypes: domainConfig.preferredSources,
      qualityThreshold: this.getQualityThreshold(depth),
      diversityRequirement: taskType === TaskType.COMPARATIVE || taskType === TaskType.EVALUATIVE,
      temporalFocus,
      geographicScope: await this.extractGeographicScope(query),
      languagePreferences: ['en'], // Can be extended based on query
    };
  }

  private determineSearchApproach(taskType: TaskType, depth: ResearchDepth): SearchApproach {
    if (depth === ResearchDepth.PHD_LEVEL) {
      return SearchApproach.CITATION_CHAINING;
    }
    
    switch (taskType) {
      case TaskType.EXPLORATORY:
        return SearchApproach.BREADTH_FIRST;
      case TaskType.ANALYTICAL:
      case TaskType.SYNTHETIC:
        return SearchApproach.DEPTH_FIRST;
      case TaskType.COMPARATIVE:
      case TaskType.EVALUATIVE:
        return SearchApproach.ITERATIVE_REFINEMENT;
      case TaskType.PREDICTIVE:
        return SearchApproach.HYPOTHESIS_DRIVEN;
      default:
        return SearchApproach.BREADTH_FIRST;
    }
  }

  private getQualityThreshold(depth: ResearchDepth): number {
    switch (depth) {
      case ResearchDepth.SURFACE:
        return 0.6;
      case ResearchDepth.MODERATE:
        return 0.7;
      case ResearchDepth.DEEP:
        return 0.8;
      case ResearchDepth.PHD_LEVEL:
        return 0.9;
    }
  }

  private async analyzeTemporalFocus(query: string): Promise<TemporalFocus | undefined> {
    const prompt = `Analyze this research query and determine its temporal focus:
Query: "${query}"

Options:
- historical: Focus on past events, history, origins
- current: Focus on present state, current situation
- recent: Focus on recent developments (last 1-2 years)
- future-oriented: Focus on predictions, trends, future scenarios

Respond with just the option name.`;

    try {
      const response = await safeModelCall(
        this.runtime,
        ModelType.TEXT_LARGE,
        {
          prompt: `System: You are a temporal focus analyzer. Respond with only the temporal focus option, nothing else.

User: ${prompt}`,
          temperature: 0.3,
        },
        'ResearchStrategyFactory.analyzeTemporalFocus'
      );

      const focus = (typeof response === 'string' ? response : (response as any).content || '').trim().toLowerCase();
      
      if (focus.includes('historical')) return TemporalFocus.HISTORICAL;
      if (focus.includes('current')) return TemporalFocus.CURRENT;
      if (focus.includes('recent')) return TemporalFocus.RECENT;
      if (focus.includes('future')) return TemporalFocus.FUTURE_ORIENTED;
      
      return undefined;
    } catch (error) {
      elizaLogger.error('Error analyzing temporal focus:', error);
      return undefined;
    }
  }

  private async extractGeographicScope(query: string): Promise<string[]> {
    const prompt = `Extract any geographic locations or regions mentioned in this query:
Query: "${query}"

List any countries, regions, cities, or geographic areas mentioned. If none, return "global".
Respond with a comma-separated list.`;

    try {
      const response = await safeModelCall(
        this.runtime,
        ModelType.TEXT_LARGE,
        {
          prompt: `System: You are a geographic scope extractor. Return only a comma-separated list of locations or "global".

User: ${prompt}`,
          temperature: 0.3,
        },
        'ResearchStrategyFactory.extractGeographicScope'
      );

      const locations = (typeof response === 'string' ? response : (response as any).content || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s && s !== 'global');
      
      return locations.length > 0 ? locations : [];
    } catch (error) {
      elizaLogger.error('Error extracting geographic scope:', error);
      return [];
    }
  }
}

export class QueryPlanner {
  constructor(private runtime: IAgentRuntime) {}

  async createQueryPlan(
    mainQuery: string,
    metadata: Partial<ResearchMetadata>
  ): Promise<QueryPlan> {
    const domain = metadata.domain || ResearchDomain.GENERAL;
    const taskType = metadata.taskType || TaskType.EXPLORATORY;
    const depth = metadata.depth || ResearchDepth.MODERATE;
    
    const domainConfig = DOMAIN_CONFIGS[domain];
    
    // Generate sub-queries based on domain and task type
    const subQueries = await this.generateSubQueries(
      mainQuery,
      domain,
      taskType,
      domainConfig
    );
    
    // Create search strategy
    const strategyFactory = new ResearchStrategyFactory(this.runtime);
    const searchStrategy = await strategyFactory.createStrategy(
      mainQuery,
      domain,
      taskType,
      depth
    );
    
    // Determine iteration count based on depth
    const iterationCount = this.getIterationCount(depth);
    
    return {
      mainQuery,
      subQueries,
      searchStrategy,
      expectedSources: this.getExpectedSources(depth),
      iterationCount,
      adaptiveRefinement: depth === ResearchDepth.DEEP || depth === ResearchDepth.PHD_LEVEL,
      domainSpecificApproach: {
        methodology: domainConfig.methodology,
        keyTerms: domainConfig.keyTerms,
        authoritySource: domainConfig.authoritySource,
        evaluationFocus: domainConfig.evaluationFocus,
      },
    };
  }

  private async generateSubQueries(
    mainQuery: string,
    domain: ResearchDomain,
    taskType: TaskType,
    domainConfig: DomainConfig
  ): Promise<SubQuery[]> {
    // Try to use AI model if available
    if (typeof this.runtime.useModel === 'function') {
      try {
        const prompt = `Generate sub-queries for this research task:
Main Query: "${mainQuery}"
Domain: ${domain}
Task Type: ${taskType}
Key Terms: ${domainConfig.keyTerms.join(', ')}

Generate 3-7 specific sub-queries that will help answer the main query comprehensively.
Consider different aspects based on the task type:
- Exploratory: broad coverage of the topic
- Comparative: queries for each item being compared
- Analytical: queries for different analytical dimensions
- Synthetic: queries for different perspectives to synthesize
- Evaluative: queries for criteria and evidence
- Predictive: queries for historical patterns and indicators

Format each sub-query as:
PURPOSE: [why this query is needed]
QUERY: [the actual search query]
TYPE: [factual/statistical/theoretical/practical/comparative]
PRIORITY: [high/medium/low]

Separate each sub-query with ---`;

        const response = await safeModelCall(
          this.runtime,
          ModelType.TEXT_LARGE,
          {
            prompt: `System: You are an expert research query planner. Generate detailed sub-queries following the exact format requested.

User: ${prompt}`,
            temperature: 0.7,
          },
          'QueryPlanner.generateSubQueries'
        );

        const responseText = typeof response === 'string' ? response : (response as any).content || '';
        const subQueryTexts = responseText.split('---').filter((s: string) => s.trim());
        
        const subQueries: SubQuery[] = [];
        
        for (let i = 0; i < subQueryTexts.length; i++) {
          const text = subQueryTexts[i];
          const purposeMatch = text.match(/PURPOSE:\s*(.+)/i);
          const queryMatch = text.match(/QUERY:\s*(.+)/i);
          const typeMatch = text.match(/TYPE:\s*(.+)/i);
          const priorityMatch = text.match(/PRIORITY:\s*(.+)/i);
          
          if (queryMatch && purposeMatch) {
            const resultType = this.parseResultType(typeMatch?.[1] || 'factual');
            const priority = this.parsePriority(priorityMatch?.[1] || 'medium');
            
            subQueries.push({
              id: `sq_${i + 1}`,
              query: queryMatch[1].trim(),
              purpose: purposeMatch[1].trim(),
              priority,
              dependsOn: this.determineDependencies(i, subQueries),
              searchProviders: this.selectSearchProviders(resultType, domain),
              expectedResultType: resultType,
              completed: false,
            });
          }
        }
        
        if (subQueries.length > 0) {
          return subQueries;
        }
      } catch (error) {
        elizaLogger.warn('Error generating sub-queries with AI, using fallback:', error);
      }
    }
    
    // Fallback: Generate sub-queries based on task type
    return this.generateFallbackSubQueries(mainQuery, domain, taskType, domainConfig);
  }
  
  private generateFallbackSubQueries(
    mainQuery: string,
    domain: ResearchDomain,
    taskType: TaskType,
    domainConfig: DomainConfig
  ): SubQuery[] {
    const subQueries: SubQuery[] = [];
    
    // Base sub-queries based on task type
    switch (taskType) {
      case TaskType.COMPARATIVE:
        // Extract items to compare from query
        const items = mainQuery.match(/compare\s+(\w+)\s+and\s+(\w+)/i);
        if (items) {
          subQueries.push({
            id: 'sq_1',
            query: `${items[1]} ${domainConfig.keyTerms[0] || 'overview'}`,
            purpose: `Understand first item: ${items[1]}`,
            priority: 1,
            dependsOn: [],
            searchProviders: ['web'],
            expectedResultType: ResultType.FACTUAL,
            completed: false,
          });
          subQueries.push({
            id: 'sq_2',
            query: `${items[2]} ${domainConfig.keyTerms[0] || 'overview'}`,
            purpose: `Understand second item: ${items[2]}`,
            priority: 1,
            dependsOn: [],
            searchProviders: ['web'],
            expectedResultType: ResultType.FACTUAL,
            completed: false,
          });
        }
        break;
        
      case TaskType.ANALYTICAL:
        subQueries.push({
          id: 'sq_1',
          query: `${mainQuery} analysis`,
          purpose: 'Find analytical perspectives',
          priority: 1,
          dependsOn: [],
          searchProviders: ['web', 'academic'],
          expectedResultType: ResultType.THEORETICAL,
          completed: false,
        });
        break;
        
      default:
        // Generic sub-queries
        subQueries.push({
          id: 'sq_1',
          query: mainQuery,
          purpose: 'General search for main topic',
          priority: 1,
          dependsOn: [],
          searchProviders: ['web'],
          expectedResultType: ResultType.FACTUAL,
          completed: false,
        });
    }
    
    // Add domain-specific sub-query
    if (domainConfig.keyTerms.length > 0) {
      subQueries.push({
        id: `sq_${subQueries.length + 1}`,
        query: `${mainQuery} ${domainConfig.keyTerms[0]}`,
        purpose: `Domain-specific search for ${domain}`,
        priority: 2,
        dependsOn: [],
        searchProviders: this.selectSearchProviders(ResultType.THEORETICAL, domain),
        expectedResultType: ResultType.THEORETICAL,
        completed: false,
      });
    }
    
    return subQueries;
  }

  private parseResultType(type: string): ResultType {
    const normalized = type.toLowerCase().trim();
    if (normalized.includes('statistical')) return ResultType.STATISTICAL;
    if (normalized.includes('theoretical')) return ResultType.THEORETICAL;
    if (normalized.includes('practical')) return ResultType.PRACTICAL;
    if (normalized.includes('comparative')) return ResultType.COMPARATIVE;
    return ResultType.FACTUAL;
  }

  private parsePriority(priority: string): number {
    const normalized = priority.toLowerCase().trim();
    if (normalized === 'high') return 3;
    if (normalized === 'low') return 1;
    return 2; // medium
  }

  private determineDependencies(index: number, existingQueries: SubQuery[]): string[] {
    // First query has no dependencies
    if (index === 0) return [];
    
    // Comparative queries might depend on factual queries
    // This is a simplified logic - in production, would use more sophisticated dependency analysis
    const dependencies: string[] = [];
    
    for (let i = 0; i < index && i < existingQueries.length; i++) {
      if (existingQueries[i].priority > 2) {
        dependencies.push(existingQueries[i].id);
      }
    }
    
    return dependencies;
  }

  private selectSearchProviders(resultType: ResultType, domain: ResearchDomain): string[] {
    const providers: string[] = ['web']; // Always include general web search
    
    // Add specialized providers based on result type and domain
    if (resultType === ResultType.STATISTICAL || domain === ResearchDomain.ECONOMICS) {
      providers.push('statistics');
    }
    
    if ([ResearchDomain.PHYSICS, ResearchDomain.MATHEMATICS, ResearchDomain.COMPUTER_SCIENCE].includes(domain)) {
      providers.push('arxiv');
    }
    
    if ([ResearchDomain.MEDICINE, ResearchDomain.BIOLOGY, ResearchDomain.PSYCHOLOGY].includes(domain)) {
      providers.push('pubmed');
    }
    
    if (resultType === ResultType.COMPARATIVE || resultType === ResultType.PRACTICAL) {
      providers.push('news');
    }
    
    return providers;
  }

  private getIterationCount(depth: ResearchDepth): number {
    switch (depth) {
      case ResearchDepth.SURFACE:
        return 1;
      case ResearchDepth.MODERATE:
        return 2;
      case ResearchDepth.DEEP:
        return 3;
      case ResearchDepth.PHD_LEVEL:
        return 5;
    }
  }

  private getExpectedSources(depth: ResearchDepth): number {
    switch (depth) {
      case ResearchDepth.SURFACE:
        return 10;
      case ResearchDepth.MODERATE:
        return 25;
      case ResearchDepth.DEEP:
        return 50;
      case ResearchDepth.PHD_LEVEL:
        return 100;
    }
  }

  async refineQuery(
    originalQuery: string,
    currentFindings: string[],
    iteration: number
  ): Promise<string[]> {
    const prompt = `Based on the current research findings, generate refined search queries for iteration ${iteration + 1}.

Original Query: "${originalQuery}"

Current Findings Summary:
${currentFindings.join('\n\n')}

Generate 2-4 refined queries that:
1. Address gaps in the current findings
2. Explore new angles or perspectives
3. Seek more specific or technical information
4. Verify or challenge existing findings

Format: One query per line`;

    const response = await safeModelCall(
      this.runtime,
      ModelType.TEXT_LARGE,
      {
        prompt: `System: You are a research query refinement expert. Generate refined queries based on current findings.

User: ${prompt}`,
        temperature: 0.7,
      },
      'QueryPlanner.refineQuery'
    );

    const responseText = typeof response === 'string' ? response : (response as any).content || '';
    return responseText
      .split('\n')
      .map((s: string) => s.trim())
      .filter((s: string) => s && !s.match(/^\d+\./)); // Remove numbering
  }
}

export class EvaluationCriteriaGenerator {
  constructor(private runtime: IAgentRuntime) {}

  async generateCriteria(
    query: string,
    domain?: ResearchDomain
  ): Promise<EvaluationCriteria> {
    const domainConfig = domain ? DOMAIN_CONFIGS[domain] : DOMAIN_CONFIGS[ResearchDomain.GENERAL];
    
    // Generate base criteria
    const baseCriteria: EvaluationCriteria = {
      comprehensiveness: await this.generateCriterion(
        'Comprehensiveness',
        'How thoroughly the research covers all relevant aspects of the query',
        0.25
      ),
      depth: await this.generateCriterion(
        'Depth',
        'The level of detail and expertise demonstrated in the analysis',
        0.25
      ),
      instructionFollowing: await this.generateCriterion(
        'Instruction Following',
        'How well the research addresses the specific requirements of the query',
        0.25
      ),
      readability: await this.generateCriterion(
        'Readability',
        'The clarity, organization, and accessibility of the research report',
        0.25
      ),
    };
    
    // Add domain-specific criteria if applicable
    if (domain && domain !== ResearchDomain.GENERAL) {
      baseCriteria.domainSpecific = {};
      
      for (const focus of domainConfig.evaluationFocus) {
        baseCriteria.domainSpecific[focus] = await this.generateCriterion(
          focus,
          `Domain-specific evaluation of ${focus} for ${domain} research`,
          0.2
        );
      }
    }
    
    return baseCriteria;
  }

  private async generateCriterion(
    name: string,
    description: string,
    weight: number
  ): Promise<CriteriaDefinition> {
    // Try to use AI model if available
    if (typeof this.runtime.useModel === 'function') {
      try {
        const prompt = `Generate a detailed evaluation rubric for the following criterion:
Name: ${name}
Description: ${description}

Create a 5-point rubric (0-4) with specific descriptions for each score level.
Format:
0: [Description of failing/missing]
1: [Description of poor/minimal]
2: [Description of adequate/satisfactory]
3: [Description of good/strong]
4: [Description of excellent/exceptional]`;

        const response = await safeModelCall(
          this.runtime,
          ModelType.TEXT_LARGE,
          {
            prompt: `System: You are an evaluation criteria expert. Generate a detailed rubric following the exact format requested.

User: ${prompt}`,
            temperature: 0.5,
          },
          'EvaluationCriteriaGenerator.generateCriterion'
        );

        const responseText = typeof response === 'string' ? response : (response as any).content || '';
        const rubricItems = this.parseRubric(responseText);
        
        return {
          name,
          description,
          weight,
          rubric: rubricItems,
          scoringMethod: ScoringMethod.RUBRIC,
        };
      } catch (error) {
        elizaLogger.warn('Error generating criterion with AI, using fallback:', error);
      }
    }
    
    // Fallback: Generate default rubric
    return {
      name,
      description,
      weight,
      rubric: [
        { score: 0, description: `${name} is completely missing or fails to meet any requirements` },
        { score: 1, description: `${name} shows minimal effort with significant gaps` },
        { score: 2, description: `${name} meets basic requirements but lacks depth` },
        { score: 3, description: `${name} is good with solid coverage and analysis` },
        { score: 4, description: `${name} is excellent with comprehensive and insightful treatment` }
      ],
      scoringMethod: ScoringMethod.RUBRIC,
    };
  }

  private parseRubric(rubricText: string): RubricItem[] {
    const items: RubricItem[] = [];
    const lines = rubricText.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^(\d):\s*(.+)/);
      if (match) {
        const score = parseInt(match[1]);
        const description = match[2].trim();
        items.push({ score, description });
      }
    }
    
    // Ensure we have all scores 0-4
    for (let i = 0; i <= 4; i++) {
      if (!items.find(item => item.score === i)) {
        items.push({
          score: i,
          description: `Score level ${i}`,
        });
      }
    }
    
    return items.sort((a, b) => a.score - b.score);
  }
} 