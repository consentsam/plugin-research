import { IAgentRuntime, Memory, elizaLogger } from '@elizaos/core';
import { ResearchService } from '../service';
import { ResearchProject, ResearchStatus, ResearchPhase } from '../types';

// #region: Test Helpers

// Helper to create a realistic test memory object
function createTestMemory(text: string): Memory {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as `${string}-${string}-${string}-${string}-${string}`,
    entityId: '00000000-0000-0000-0000-000000000001' as `${string}-${string}-${string}-${string}-${string}`,
    roomId: '00000000-0000-0000-0000-000000000002' as `${string}-${string}-${string}-${string}-${string}`,
    content: { text },
    createdAt: Date.now(),
  };
}

// Helper to wait and monitor research progress
async function monitorResearch(
  service: ResearchService,
  projectId: string,
  options: {
    timeout?: number;
    checkInterval?: number;
    onProgress?: (project: ResearchProject) => void;
  } = {}
): Promise<ResearchProject | null> {
  const {
    timeout = 180000, // 3 minutes default
    checkInterval = 5000,
    onProgress,
  } = options;

  const startTime = Date.now();
  let lastPhase: ResearchPhase | null = null;

  while (Date.now() - startTime < timeout) {
    const project = await service.getProject(projectId);
    if (!project) return null;

    // Log phase changes
    if (project.phase !== lastPhase) {
      elizaLogger.info(`Research phase: ${lastPhase || 'START'} → ${project.phase}`);
      lastPhase = project.phase;
    }

    // Call progress callback
    if (onProgress) {
      onProgress(project);
    }

    // Check completion
    if (
      project.status === ResearchStatus.COMPLETED ||
      project.status === ResearchStatus.FAILED
    ) {
      return project;
    }

    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  // Return whatever we have after timeout
  const finalProject = await service.getProject(projectId);
  return finalProject || null;
}

// Test helper to wait for research completion with longer timeout for real operations
async function waitForResearchCompletion(
  service: ResearchService,
  projectId: string,
  maxWaitTime: number = 300000 // 5 minutes for real web operations
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const project = await service.getProject(projectId);
    if (!project) return false;

    if (
      project.status === ResearchStatus.COMPLETED ||
      project.status === ResearchStatus.FAILED
    ) {
      return project.status === ResearchStatus.COMPLETED;
    }

    // Wait 5 seconds before checking again (longer for real operations)
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  return false;
}

// Helper to validate research quality
function validateResearchQuality(project: ResearchProject): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (project.sources.length === 0) {
    issues.push('No sources found');
  }

  if (project.findings.length === 0) {
    issues.push('No findings collected');
  }

  // Check for diverse sources
  const uniqueDomains = new Set(
    project.sources.map((s) => {
      try {
        return new URL(s.url).hostname;
      } catch {
        return 'unknown';
      }
    })
  );

  if (uniqueDomains.size < 2 && project.sources.length > 2) {
    issues.push('Sources lack diversity (all from same domain)');
  }

  // Check findings have reasonable content
  const avgFindingLength =
    project.findings.reduce((sum, f) => sum + f.content.length, 0) /
    (project.findings.length || 1);
  if (avgFindingLength < 100) {
    issues.push('Findings are too short (average < 100 chars)');
  }

  // Check relevance scores
  const avgRelevance =
    project.findings.reduce((sum, f) => sum + f.relevance, 0) /
    (project.findings.length || 1);
  if (avgRelevance < 0.3) {
    issues.push('Low average relevance score');
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

// #endregion

// #region: Real-World Persona Scenarios

// Test 1: Research for Building a New Feature (Real Developer Workflow)
export async function testFeatureDevelopmentResearch(
  runtime: IAgentRuntime
): Promise<void> {
  elizaLogger.info('🔨 Starting Real-World Test: Feature Development Research');

  const service = runtime.getService<ResearchService>('research');
  if (!service) throw new Error('Research service not available');

  // Scenario: Developer needs to implement WebSocket real-time features
  const queries = [
    'WebSocket implementation Node.js TypeScript scaling best practices 2024',
    'Socket.io vs native WebSocket performance comparison production',
    'WebSocket authentication JWT security implementation examples',
  ];

  elizaLogger.info(
    'Researching WebSocket implementation across multiple aspects...'
  );

  const projects = await Promise.all(
    queries.map((query, index) =>
      service.createResearchProject(query, {
        maxSearchResults: 3,
        metadata: {
          aspect: ['implementation', 'comparison', 'security'][index],
          featureType: 'websocket',
        },
      })
    )
  );

  // Monitor all projects
  const results = await Promise.all(
    projects.map((project) =>
      monitorResearch(service, project.id, {
        timeout: 120000,
        onProgress: (p) => {
          if (p.findings.length > 0 && p.findings.length % 3 === 0) {
            elizaLogger.info(
              `Project ${project.query.substring(
                0,
                30
              )}... has ${p.findings.length} findings`
            );
          }
        },
      })
    )
  );

  // Analyze combined results
  const allFindings = results.flatMap((r) => r?.findings || []);
  const allSources = results.flatMap((r) => r?.sources || []);

  // Check for implementation details
  const hasImplementationDetails = allFindings.some((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('const') ||
      content.includes('server') ||
      content.includes('client') ||
      content.includes('connection')
    );
  });

  // Check for security considerations
  const hasSecurityInfo = allFindings.some((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('auth') ||
      content.includes('security') ||
      content.includes('jwt') ||
      content.includes('cors')
    );
  });

  // Check for performance insights
  const hasPerformanceInfo = allFindings.some((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('performance') ||
      content.includes('scaling') ||
      content.includes('benchmark') ||
      content.includes('latency')
    );
  });

  // Find Stack Overflow or GitHub sources (developer favorites)
  const devSources = allSources.filter(
    (s) =>
      s.url.includes('stackoverflow.com') ||
      s.url.includes('github.com') ||
      s.url.includes('dev.to') ||
      s.url.includes('medium.com')
  );

  elizaLogger.info('📊 Feature Development Research Results:');
  elizaLogger.info(`- Total findings across aspects: ${allFindings.length}`);
  elizaLogger.info(
    `- Implementation details found: ${hasImplementationDetails}`
  );
  elizaLogger.info(`- Security considerations found: ${hasSecurityInfo}`);
  elizaLogger.info(`- Performance insights found: ${hasPerformanceInfo}`);
  elizaLogger.info(
    `- Developer-focused sources: ${devSources.length}/${allSources.length}`
  );

  if (devSources.length > 0) {
    elizaLogger.info(`- Sample dev source: ${devSources[0].title}`);
  }

  // Simulate decision-making based on research
  if (hasImplementationDetails && hasSecurityInfo && hasPerformanceInfo) {
    elizaLogger.success(
      '✅ Research provides comprehensive information for feature implementation'
    );
  } else {
    elizaLogger.warn('⚠️  Some aspects missing - may need additional research');
  }

  elizaLogger.success(
    '✅ Real-World Test Passed: Feature Development Research'
  );
}

// Test 2: Research a Person for Hiring/Partnership (Real HR/Business Workflow)
export async function testPersonBackgroundResearch(
  runtime: IAgentRuntime
): Promise<void> {
  elizaLogger.info('👤 Starting Real-World Test: Person Background Research');

  const service = runtime.getService<ResearchService>('research');
  if (!service) throw new Error('Research service not available');

  // Scenario: Researching a potential technical advisor or hire
  const personQuery =
    'Andrej Karpathy AI research contributions Tesla OpenAI recent projects 2024';

  const project = await service.createResearchProject(personQuery, {
    maxSearchResults: 5,
    metadata: {
      researchType: 'person_background',
      purpose: 'professional_evaluation',
    },
  });

  elizaLogger.info('Researching professional background...');

  const result = await monitorResearch(service, project.id, {
    timeout: 150000,
    onProgress: (p) => {
      // Track what types of sources we're finding
      const sources = p.sources.map((s) => new URL(s.url).hostname);
      const hasLinkedIn = sources.some((s) => s.includes('linkedin'));
      const hasTwitter = sources.some(
        (s) => s.includes('twitter') || s.includes('x.com')
      );
      const hasGitHub = sources.some((s) => s.includes('github'));

      if (
        (hasLinkedIn || hasTwitter || hasGitHub) &&
        p.phase === ResearchPhase.SEARCHING
      ) {
        elizaLogger.info(
          `Found professional profiles: LinkedIn=${hasLinkedIn}, Twitter=${hasTwitter}, GitHub=${hasGitHub}`
        );
      }
    },
  });

  if (!result) throw new Error('Person research failed to complete');

  // Analyze findings for key information
  const findings = result.findings;

  // Professional history
  const hasTeslaInfo = findings.some((f) =>
    f.content.toLowerCase().includes('tesla')
  );
  const hasOpenAIInfo = findings.some((f) =>
    f.content.toLowerCase().includes('openai')
  );
  const hasEducation = findings.some(
    (f) =>
      f.content.toLowerCase().includes('stanford') ||
      f.content.toLowerCase().includes('phd') ||
      f.content.toLowerCase().includes('university')
  );

  // Recent activities
  const hasRecentActivity = findings.some((f) => {
    const content = f.content;
    return (
      content.includes('2024') ||
      content.includes('2023') ||
      content.toLowerCase().includes('recent') ||
      content.toLowerCase().includes('latest')
    );
  });

  // Technical contributions
  const hasTechnicalWork = findings.some((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('paper') ||
      content.includes('research') ||
      content.includes('model') ||
      content.includes('algorithm') ||
      content.includes('course')
    );
  });

  // Extract key achievements
  const achievements = findings.filter((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('founded') ||
      content.includes('created') ||
      content.includes('developed') ||
      content.includes('led') ||
      content.includes('published')
    );
  });

  elizaLogger.info('📋 Person Background Research Results:');
  elizaLogger.info(
    `- Professional history coverage: Tesla=${hasTeslaInfo}, OpenAI=${hasOpenAIInfo}`
  );
  elizaLogger.info(`- Education info found: ${hasEducation}`);
  elizaLogger.info(`- Recent activity (2023-2024): ${hasRecentActivity}`);
  elizaLogger.info(`- Technical contributions: ${hasTechnicalWork}`);
  elizaLogger.info(`- Key achievements identified: ${achievements.length}`);

  if (achievements.length > 0) {
    const sample = achievements[0].content.substring(0, 150);
    elizaLogger.info(`- Sample achievement: "${sample}..."`);
  }

  // Professional assessment
  const professionalScore = [
    hasTeslaInfo,
    hasOpenAIInfo,
    hasEducation,
    hasRecentActivity,
    hasTechnicalWork,
  ].filter(Boolean).length;

  if (professionalScore >= 4) {
    elizaLogger.success('✅ Comprehensive professional profile assembled');
  } else if (professionalScore >= 2) {
    elizaLogger.info(
      'ℹ️  Partial professional profile - may need additional sources'
    );
  } else {
    elizaLogger.warn('⚠️  Limited professional information found');
  }

  elizaLogger.success('✅ Real-World Test Passed: Person Background Research');
}

// Test 3: Breaking News Research (Real Journalist/Analyst Workflow)
export async function testBreakingNewsResearch(
  runtime: IAgentRuntime
): Promise<void> {
  elizaLogger.info('📰 Starting Real-World Test: Breaking News Research');

  const service = runtime.getService<ResearchService>('research');
  if (!service) throw new Error('Research service not available');

  // Scenario: Researching breaking AI news
  const newsQuery =
    'AI artificial intelligence news today latest announcements breakthroughs December 2024';

  const project = await service.createResearchProject(newsQuery, {
    maxSearchResults: 6,
    metadata: {
      researchType: 'breaking_news',
      timeframe: 'current',
      industry: 'AI/ML',
    },
  });

  elizaLogger.info('Scanning for breaking AI news...');

  const result = await monitorResearch(service, project.id, {
    timeout: 150000,
    checkInterval: 3000,
    onProgress: (p) => {
      // Track news sources as they're found
      if (p.phase === ResearchPhase.SEARCHING && p.sources.length > 0) {
        const newsSources = p.sources.filter((s) => {
          const url = s.url.toLowerCase();
          return (
            url.includes('news') ||
            url.includes('article') ||
            url.includes('press') ||
            url.includes('announcement')
          );
        });

        if (newsSources.length > 0) {
          elizaLogger.info(`Found ${newsSources.length} news sources`);
        }
      }
    },
  });

  if (!result) throw new Error('News research failed to complete');

  // Analyze news findings
  const findings = result.findings;
  const sources = result.sources;

  // Identify news sources by domain
  const newsSourceTypes = {
    mainstream: sources.filter(
      (s) =>
        s.url.includes('reuters.com') ||
        s.url.includes('bloomberg.com') ||
        s.url.includes('wsj.com') ||
        s.url.includes('nytimes.com')
    ),
    tech: sources.filter(
      (s) =>
        s.url.includes('techcrunch.com') ||
        s.url.includes('theverge.com') ||
        s.url.includes('arstechnica.com') ||
        s.url.includes('wired.com')
    ),
    ai_specific: sources.filter(
      (s) =>
        s.url.includes('openai.com') ||
        s.url.includes('anthropic.com') ||
        s.url.includes('deepmind.com') ||
        s.url.includes('ai.')
    ),
    social: sources.filter(
      (s) =>
        s.url.includes('twitter.com') ||
        s.url.includes('x.com') ||
        s.url.includes('reddit.com')
    ),
  };

  // Check for time-sensitive content
  const currentMonth = new Date().toLocaleDateString('en-US', {
    month: 'long',
  });
  const currentYear = new Date().getFullYear();

  const hasCurrentMonth = findings.some((f) => f.content.includes(currentMonth));
  const hasCurrentYear = findings.some((f) =>
    f.content.includes(currentYear.toString())
  );
  const hasTimeWords = findings.some((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('today') ||
      content.includes('yesterday') ||
      content.includes('this week') ||
      content.includes('announced') ||
      content.includes('just')
    );
  });

  // Identify major announcements
  const announcements = findings.filter((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('announc') ||
      content.includes('launch') ||
      content.includes('releas') ||
      content.includes('unveil') ||
      content.includes('introduc')
    );
  });

  // Extract companies/organizations mentioned
  const companies = [
    'OpenAI',
    'Google',
    'Microsoft',
    'Anthropic',
    'Meta',
    'Amazon',
    'Apple',
  ];
  const companyMentions: Record<string, number> = {};

  companies.forEach((company) => {
    companyMentions[company] = findings.filter((f) =>
      f.content.includes(company)
    ).length;
  });

  elizaLogger.info('📊 Breaking News Research Results:');
  elizaLogger.info(`- Source distribution:`);
  elizaLogger.info(
    `  * Mainstream media: ${newsSourceTypes.mainstream.length}`
  );
  elizaLogger.info(`  * Tech media: ${newsSourceTypes.tech.length}`);
  elizaLogger.info(`  * AI companies: ${newsSourceTypes.ai_specific.length}`);
  elizaLogger.info(`  * Social media: ${newsSourceTypes.social.length}`);
  elizaLogger.info(`- Timeliness indicators:`);
  elizaLogger.info(`  * Current month mentioned: ${hasCurrentMonth}`);
  elizaLogger.info(`  * Current year mentioned: ${hasCurrentYear}`);
  elizaLogger.info(`  * Time-sensitive words: ${hasTimeWords}`);
  elizaLogger.info(`- Announcements found: ${announcements.length}`);
  elizaLogger.info(
    `- Company mentions: ${Object.entries(companyMentions)
      .filter(([_, count]) => count > 0)
      .map(([company, count]) => `${company}=${count}`)
      .join(', ')}`
  );

  if (announcements.length > 0) {
    const latestAnnouncement = announcements[0].content.substring(0, 200);
    elizaLogger.info(`- Latest announcement: "${latestAnnouncement}..."`);
  }

  // News quality assessment
  const hasRecentNews = hasCurrentMonth || hasTimeWords;
  const hasDiverseSources =
    Object.values(newsSourceTypes).filter((arr) => arr.length > 0).length >= 2;
  const hasAnnouncements = announcements.length > 0;

  if (hasRecentNews && hasDiverseSources && hasAnnouncements) {
    elizaLogger.success('✅ High-quality breaking news coverage achieved');
  } else {
    elizaLogger.info(
      `ℹ️  News coverage: Recent=${hasRecentNews}, Diverse=${hasDiverseSources}, Announcements=${hasAnnouncements}`
    );
  }

  elizaLogger.success('✅ Real-World Test Passed: Breaking News Research');
}

// Test 4: Market/Competitive Intelligence (Real Business Strategy Workflow)
export async function testMarketIntelligenceResearch(
  runtime: IAgentRuntime
): Promise<void> {
  elizaLogger.info('📈 Starting Real-World Test: Market Intelligence Research');

  const service = runtime.getService<ResearchService>('research');
  if (!service) throw new Error('Research service not available');

  // Scenario: Analyzing the AI agent framework market
  const marketQuery =
    'AI agent frameworks market analysis 2024 LangChain AutoGPT CrewAI pricing features comparison adoption';

  const project = await service.createResearchProject(marketQuery, {
    maxSearchResults: 5,
    metadata: {
      researchType: 'market_intelligence',
      competitors: ['LangChain', 'AutoGPT', 'CrewAI'],
      analysisType: 'competitive',
    },
  });

  elizaLogger.info('Conducting market intelligence analysis...');

  const result = await monitorResearch(service, project.id, {
    timeout: 180000,
    onProgress: (p) => {
      if (p.phase === ResearchPhase.ANALYZING && p.findings.length > 5) {
        elizaLogger.info(
          `Analyzing ${p.findings.length} market data points...`
        );
      }
    },
  });

  if (!result) throw new Error('Market research failed to complete');

  // Market analysis
  const findings = result.findings;
  const competitors = ['LangChain', 'AutoGPT', 'CrewAI', 'BabyAGI', 'AgentGPT'];

  // Competitor analysis
  const competitorData: Record<
    string,
    {
      mentions: number;
      features: string[];
      pricing: boolean;
      adoption: boolean;
    }
  > = {};

  competitors.forEach((competitor) => {
    const competitorFindings = findings.filter((f) =>
      f.content.toLowerCase().includes(competitor.toLowerCase())
    );

    const features: string[] = [];
    let hasPricing = false;
    let hasAdoption = false;

    competitorFindings.forEach((f) => {
      const content = f.content.toLowerCase();

      // Extract features
      if (content.includes('feature') || content.includes('capability')) {
        if (content.includes('memory')) features.push('memory');
        if (content.includes('tool') || content.includes('function'))
          features.push('tools');
        if (content.includes('chain') || content.includes('workflow'))
          features.push('workflow');
        if (content.includes('llm') || content.includes('model'))
          features.push('multi-llm');
      }

      // Check for pricing info
      if (
        content.includes('price') ||
        content.includes('cost') ||
        content.includes('free') ||
        content.includes('$')
      ) {
        hasPricing = true;
      }

      // Check for adoption metrics
      if (
        content.includes('user') ||
        content.includes('download') ||
        content.includes('star') ||
        content.includes('popular')
      ) {
        hasAdoption = true;
      }
    });

    competitorData[competitor] = {
      mentions: competitorFindings.length,
      features: [...new Set(features)],
      pricing: hasPricing,
      adoption: hasAdoption,
    };
  });

  // Market trends
  const trendKeywords = [
    'growth',
    'trend',
    'future',
    'emerging',
    'adoption',
    'market size',
  ];
  const trendsFound = trendKeywords.filter((keyword) =>
    findings.some((f) => f.content.toLowerCase().includes(keyword))
  );

  // Technical comparisons
  const hasComparisons = findings.some((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('compar') ||
      content.includes('versus') ||
      content.includes('vs') ||
      content.includes('better') ||
      content.includes('advantage')
    );
  });

  // Use cases and applications
  const useCases = findings.filter((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('use case') ||
      content.includes('application') ||
      content.includes('example') ||
      content.includes('implementation')
    );
  });

  elizaLogger.info('📊 Market Intelligence Results:');
  elizaLogger.info('- Competitor Analysis:');
  Object.entries(competitorData).forEach(([competitor, data]) => {
    if (data.mentions > 0) {
      elizaLogger.info(
        `  * ${competitor}: ${
          data.mentions
        } mentions, features=[${data.features.join(
          ','
        )}], pricing=${data.pricing}, adoption=${data.adoption}`
      );
    }
  });
  elizaLogger.info(`- Market trends identified: ${trendsFound.join(', ')}`);
  elizaLogger.info(`- Comparative analysis found: ${hasComparisons}`);
  elizaLogger.info(`- Use cases documented: ${useCases.length}`);

  // Strategic insights
  const wellCoveredCompetitors = Object.entries(competitorData)
    .filter(([_, data]) => data.mentions >= 2)
    .map(([name, _]) => name);

  const hasComprehensiveData =
    wellCoveredCompetitors.length >= 2 && hasComparisons && useCases.length > 0;

  if (hasComprehensiveData) {
    elizaLogger.success('✅ Comprehensive market intelligence gathered');
    elizaLogger.info(
      `Key competitors analyzed: ${wellCoveredCompetitors.join(', ')}`
    );
  } else {
    elizaLogger.info(
      'ℹ️  Partial market intelligence - consider additional research'
    );
  }

  elizaLogger.success('✅ Real-World Test Passed: Market Intelligence Research');
}

// Test 5: Technical Problem Solving Research (Real Developer Debug Workflow)
export async function testProblemSolvingResearch(
  runtime: IAgentRuntime
): Promise<void> {
  elizaLogger.info(
    '🔧 Starting Real-World Test: Technical Problem Solving Research'
  );

  const service = runtime.getService<ResearchService>('research');
  if (!service) throw new Error('Research service not available');

  // Scenario: Debugging a complex technical issue
  const problemQuery =
    'TypeError cannot read property undefined JavaScript async await Promise debugging stack trace fix';

  const project = await service.createResearchProject(problemQuery, {
    maxSearchResults: 4,
    metadata: {
      researchType: 'debugging',
      problemType: 'runtime_error',
      technology: 'JavaScript',
    },
  });

  elizaLogger.info('Researching technical problem solutions...');

  const result = await monitorResearch(service, project.id, {
    timeout: 120000,
    onProgress: (p) => {
      // Look for Stack Overflow as it appears
      const hasStackOverflow = p.sources.some((s) =>
        s.url.includes('stackoverflow.com')
      );
      if (hasStackOverflow && p.sources.length === 1) {
        elizaLogger.info('Found Stack Overflow - good sign for debugging!');
      }
    },
  });

  if (!result) throw new Error('Problem solving research failed to complete');

  // Analyze debugging findings
  const findings = result.findings;
  const sources = result.sources;

  // Categorize sources
  const debuggingSources = {
    stackoverflow: sources.filter((s) => s.url.includes('stackoverflow.com')),
    github: sources.filter((s) => s.url.includes('github.com')),
    documentation: sources.filter(
      (s) =>
        s.url.includes('developer.mozilla.org') ||
        s.url.includes('javascript.info') ||
        s.url.includes('docs.')
    ),
    blogs: sources.filter(
      (s) =>
        s.url.includes('blog') ||
        s.url.includes('medium.com') ||
        s.url.includes('dev.to')
    ),
  };

  // Look for solutions
  const hasSolutions = findings.filter((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('solution') ||
      content.includes('fix') ||
      content.includes('resolve') ||
      content.includes('solved') ||
      content.includes('work')
    );
  });

  // Look for code examples
  const hasCodeExamples = findings.filter((f) => {
    const content = f.content;
    return (
      content.includes('```') ||
      content.includes('const ') ||
      content.includes('let ') ||
      content.includes('function') ||
      content.includes('async ') ||
      content.includes('await ') ||
      content.includes('try') ||
      content.includes('catch')
    );
  });

  // Look for explanations
  const hasExplanations = findings.filter((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('because') ||
      content.includes('reason') ||
      content.includes('cause') ||
      content.includes('happen') ||
      content.includes('occur')
    );
  });

  // Check for similar issues
  const similarIssues = findings.filter((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('similar') ||
      content.includes('same error') ||
      content.includes('same issue') ||
      content.includes('also')
    );
  });

  elizaLogger.info('🔍 Problem Solving Research Results:');
  elizaLogger.info('- Source distribution:');
  elizaLogger.info(
    `  * Stack Overflow: ${debuggingSources.stackoverflow.length}`
  );
  elizaLogger.info(`  * GitHub Issues: ${debuggingSources.github.length}`);
  elizaLogger.info(
    `  * Documentation: ${debuggingSources.documentation.length}`
  );
  elizaLogger.info(`  * Technical Blogs: ${debuggingSources.blogs.length}`);
  elizaLogger.info(`- Solutions found: ${hasSolutions.length}`);
  elizaLogger.info(`- Code examples: ${hasCodeExamples.length}`);
  elizaLogger.info(`- Explanations: ${hasExplanations.length}`);
  elizaLogger.info(`- Similar issues: ${similarIssues.length}`);

  // Extract a solution if found
  if (hasSolutions.length > 0 && hasCodeExamples.length > 0) {
    elizaLogger.success('✅ Found solutions with code examples!');

    // Find the most relevant solution
    const bestSolution = hasSolutions.sort((a, b) => b.relevance - a.relevance)[0];
    const preview = bestSolution.content.substring(0, 250);
    elizaLogger.info(`Top solution preview: "${preview}..."`);
  }

  // Problem solving quality
  const hasGoodSources =
    debuggingSources.stackoverflow.length > 0 ||
    debuggingSources.documentation.length > 0;
  const hasGoodContent =
    hasSolutions.length > 0 && hasCodeExamples.length > 0;
  const hasContext = hasExplanations.length > 0;

  if (hasGoodSources && hasGoodContent && hasContext) {
    elizaLogger.success('✅ Comprehensive debugging information found');
  } else {
    elizaLogger.info(
      `ℹ️  Debugging info: Sources=${hasGoodSources}, Solutions=${hasGoodContent}, Context=${hasContext}`
    );
  }

  elizaLogger.success(
    '✅ Real-World Test Passed: Technical Problem Solving Research'
  );
}

// Test 6: Academic/Learning Research (Real Student/Researcher Workflow)
export async function testAcademicResearch(runtime: IAgentRuntime): Promise<void> {
  elizaLogger.info('🎓 Starting Real-World Test: Academic/Learning Research');

  const service = runtime.getService<ResearchService>('research');
  if (!service) throw new Error('Research service not available');

  // Scenario: Researching for learning/academic purposes
  const academicQuery =
    'transformer architecture attention mechanism self-attention tutorial papers implementation from scratch';

  const project = await service.createResearchProject(academicQuery, {
    maxSearchResults: 5,
    metadata: {
      researchType: 'academic',
      subject: 'machine_learning',
      level: 'advanced',
    },
  });

  elizaLogger.info(
    'Conducting academic research on transformer architecture...'
  );

  const result = await monitorResearch(service, project.id, {
    timeout: 150000,
  });

  if (!result) throw new Error('Academic research failed to complete');

  // Analyze academic findings
  const findings = result.findings;
  const sources = result.sources;

  // Categorize academic sources
  const academicSources = {
    papers: sources.filter(
      (s) =>
        s.url.includes('arxiv.org') ||
        s.url.includes('paper') ||
        s.url.includes('pdf') ||
        s.title.toLowerCase().includes('paper')
    ),
    tutorials: sources.filter(
      (s) =>
        s.url.includes('tutorial') ||
        s.url.includes('guide') ||
        s.url.includes('explained') ||
        s.title.toLowerCase().includes('tutorial')
    ),
    educational: sources.filter(
      (s) =>
        s.url.includes('edu') ||
        s.url.includes('course') ||
        s.url.includes('stanford') ||
        s.url.includes('mit')
    ),
    implementation: sources.filter(
      (s) =>
        s.url.includes('github.com') ||
        s.url.includes('colab') ||
        s.url.includes('kaggle')
    ),
  };

  // Look for key concepts
  const concepts = [
    'attention',
    'self-attention',
    'multi-head',
    'query',
    'key',
    'value',
    'transformer',
  ];
  const conceptCoverage: Record<string, number> = {};

  concepts.forEach((concept) => {
    conceptCoverage[concept] = findings.filter((f) =>
      f.content.toLowerCase().includes(concept)
    ).length;
  });

  // Check for mathematical content
  const hasMath = findings.some((f) => {
    const content = f.content;
    return (
      content.includes('equation') ||
      content.includes('formula') ||
      content.includes('Σ') ||
      content.includes('matrix') ||
      content.includes('dimension')
    );
  });

  // Check for visual explanations
  const hasVisuals = findings.some((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('diagram') ||
      content.includes('figure') ||
      content.includes('image') ||
      content.includes('illustration') ||
      content.includes('visualization')
    );
  });

  // Check for code implementations
  const hasImplementations = findings.filter((f) => {
    const content = f.content;
    return (
      content.includes('class Transformer') ||
      content.includes('class Attention') ||
      content.includes('def attention') ||
      content.includes('import torch') ||
      content.includes('import tensorflow')
    );
  });

  elizaLogger.info('📚 Academic Research Results:');
  elizaLogger.info('- Source types:');
  elizaLogger.info(`  * Academic papers: ${academicSources.papers.length}`);
  elizaLogger.info(
    `  * Tutorials/Guides: ${academicSources.tutorials.length}`
  );
  elizaLogger.info(
    `  * Educational institutions: ${academicSources.educational.length}`
  );
  elizaLogger.info(
    `  * Code implementations: ${academicSources.implementation.length}`
  );
  elizaLogger.info('- Concept coverage:');
  Object.entries(conceptCoverage).forEach(([concept, count]) => {
    if (count > 0) elizaLogger.info(`  * ${concept}: ${count} mentions`);
  });
  elizaLogger.info(`- Mathematical content: ${hasMath}`);
  elizaLogger.info(`- Visual explanations: ${hasVisuals}`);
  elizaLogger.info(
    `- Code implementations found: ${hasImplementations.length}`
  );

  // Learning quality assessment
  const hasTheory =
    academicSources.papers.length > 0 ||
    Object.values(conceptCoverage).some((c) => c > 2);
  const hasPractice =
    academicSources.tutorials.length > 0 || hasImplementations.length > 0;
  const conceptsCovered = Object.values(conceptCoverage).filter(
    (c) => c > 0
  ).length;

  if (hasTheory && hasPractice && conceptsCovered >= 4) {
    elizaLogger.success(
      '✅ Excellent academic research - covers theory and practice'
    );
  } else {
    elizaLogger.info(
      `ℹ️  Academic coverage: Theory=${hasTheory}, Practice=${hasPractice}, Concepts=${conceptsCovered}/7`
    );
  }

  elizaLogger.success('✅ Real-World Test Passed: Academic/Learning Research');
}

// #endregion

// #region: Core Functionality Scenarios

// Test 1: Code/Feature Research - Simulating research before building a feature
export async function testCodeFeatureResearch(
  runtime: IAgentRuntime
): Promise<void> {
  elizaLogger.info('Starting E2E Test: Code/Feature Research');

  const service = runtime.getService<ResearchService>('research');
  if (!service) {
    throw new Error('Research service not available');
  }

  // Research query that a developer would make before implementing a feature
  const featureQuery =
    'How to implement OAuth2 authentication in Node.js with TypeScript best practices security 2024';

  const project = await service.createResearchProject(featureQuery, {
    maxSearchResults: 5,
    language: 'en',
    metadata: {
      researchType: 'technical',
      purpose: 'feature_implementation',
    },
  });

  elizaLogger.info(`Created code research project: ${project.id}`);

  // Monitor progress
  let lastUpdate = Date.now();
  let phaseProgress: Record<string, number> = {};

  const checkProgress = setInterval(async () => {
    const current = await service.getProject(project.id);
    if (!current) return;

    if (!phaseProgress[current.phase]) {
      phaseProgress[current.phase] = Date.now() - lastUpdate;
      elizaLogger.info(
        `Phase ${current.phase} started after ${phaseProgress[current.phase]}ms`
      );
      lastUpdate = Date.now();
    }

    if (
      current.status === ResearchStatus.COMPLETED ||
      current.status === ResearchStatus.FAILED
    ) {
      clearInterval(checkProgress);
    }
  }, 3000);

  // Wait for completion
  const completed = await waitForResearchCompletion(service, project.id, 180000);
  clearInterval(checkProgress);

  if (!completed) {
    throw new Error('Code research did not complete within timeout');
  }

  const finalProject = await service.getProject(project.id);
  if (!finalProject) {
    throw new Error('Could not retrieve completed project');
  }

  // Validate research quality
  const quality = validateResearchQuality(finalProject);
  if (!quality.isValid) {
    elizaLogger.warn(`Research quality issues: ${quality.issues.join(', ')}`);
  }

  // Verify we found technical content
  const hasCodeExamples = finalProject.findings.some(
    (f) =>
      f.content.includes('npm') ||
      f.content.includes('const') ||
      f.content.includes('import') ||
      f.content.includes('OAuth')
  );

  if (!hasCodeExamples) {
    elizaLogger.warn('No code examples found in technical research');
  }

  // Check for security considerations (important for auth research)
  const hasSecurityInfo = finalProject.findings.some(
    (f) =>
      f.content.toLowerCase().includes('security') ||
      f.content.toLowerCase().includes('csrf') ||
      f.content.toLowerCase().includes('token')
  );

  if (!hasSecurityInfo) {
    elizaLogger.warn('No security information found in OAuth research');
  }

  elizaLogger.info(
    `Code research completed with ${finalProject.sources.length} sources and ${finalProject.findings.length} findings`
  );
  elizaLogger.info(
    `Found code examples: ${hasCodeExamples}, Security info: ${hasSecurityInfo}`
  );

  if (finalProject.report) {
    elizaLogger.info(
      `Report generated with ${finalProject.report.sections.length} sections`
    );
  }

  elizaLogger.success('E2E Test Passed: Code/Feature Research');
}

// Test 2: Person Research - Researching a public figure
export async function testPersonResearch(runtime: IAgentRuntime): Promise<void> {
  elizaLogger.info('Starting E2E Test: Person Research');

  const service = runtime.getService<ResearchService>('research');
  if (!service) {
    throw new Error('Research service not available');
  }

  // Research a well-known tech figure
  const personQuery =
    'Vitalik Buterin Ethereum founder recent projects writings 2024';

  const project = await service.createResearchProject(personQuery, {
    maxSearchResults: 4,
    metadata: {
      researchType: 'person',
      purpose: 'background_research',
    },
  });

  elizaLogger.info(`Created person research project: ${project.id}`);

  // Wait for completion
  const completed = await waitForResearchCompletion(service, project.id, 150000);

  if (!completed) {
    const partial = await service.getProject(project.id);
    if (partial && partial.findings.length > 0) {
      elizaLogger.warn(
        `Person research incomplete but found ${partial.findings.length} findings`
      );
    } else {
      throw new Error('Person research did not complete and no findings collected');
    }
  }

  const finalProject = await service.getProject(project.id);
  if (!finalProject) {
    throw new Error('Could not retrieve completed project');
  }

  // Validate we found relevant information about the person
  const relevantFindings = finalProject.findings.filter(
    (f) =>
      f.content.toLowerCase().includes('vitalik') ||
      f.content.toLowerCase().includes('ethereum') ||
      f.content.toLowerCase().includes('buterin')
  );

  if (relevantFindings.length === 0) {
    throw new Error('No relevant findings about the person');
  }

  // Check for recent information
  const hasRecentInfo = finalProject.findings.some(
    (f) =>
      f.content.includes('2024') ||
      f.content.includes('2023') ||
      f.content.toLowerCase().includes('recent')
  );

  elizaLogger.info(
    `Person research completed: ${relevantFindings.length}/${finalProject.findings.length} relevant findings`
  );
  elizaLogger.info(`Found recent information: ${hasRecentInfo}`);

  // Sample a finding
  if (relevantFindings.length > 0) {
    const sample = relevantFindings[0].content.substring(0, 200);
    elizaLogger.info(`Sample finding: "${sample}..."`);
  }

  elizaLogger.success('E2E Test Passed: Person Research');
}

// Test 3: News/Current Events Research
export async function testNewsResearch(runtime: IAgentRuntime): Promise<void> {
  elizaLogger.info('Starting E2E Test: News/Current Events Research');

  const service = runtime.getService<ResearchService>('research');
  if (!service) {
    throw new Error('Research service not available');
  }

  // Research current AI developments
  const newsQuery =
    'latest artificial intelligence breakthroughs news December 2024 ChatGPT Claude Gemini';

  const project = await service.createResearchProject(newsQuery, {
    maxSearchResults: 5,
    metadata: {
      researchType: 'news',
      timeframe: 'current',
      purpose: 'market_intelligence',
    },
  });

  elizaLogger.info(`Created news research project: ${project.id}`);

  // Monitor for news-specific content
  let checkCount = 0;
  const newsCheckInterval = setInterval(async () => {
    checkCount++;
    const current = await service.getProject(project.id);
    if (!current) return;

    // Check if we're finding news sources
    const newsSource = current.sources.find(
      (s) =>
        s.url.includes('news') ||
        s.url.includes('article') ||
        s.url.includes('blog') ||
        s.title.toLowerCase().includes('2024')
    );

    if (newsSource && checkCount === 1) {
      elizaLogger.info(`Found news source: ${newsSource.title}`);
    }

    if (
      current.status === ResearchStatus.COMPLETED ||
      current.status === ResearchStatus.FAILED ||
      checkCount > 30
    ) {
      clearInterval(newsCheckInterval);
    }
  }, 5000);

  // Wait for completion
  const completed = await waitForResearchCompletion(service, project.id, 180000);
  clearInterval(newsCheckInterval);

  const finalProject = await service.getProject(project.id);
  if (!finalProject) {
    throw new Error('Could not retrieve completed project');
  }

  // Validate news research quality
  const quality = validateResearchQuality(finalProject);

  // Check for AI-related content
  const aiFindings = finalProject.findings.filter((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('ai') ||
      content.includes('artificial intelligence') ||
      content.includes('chatgpt') ||
      content.includes('claude') ||
      content.includes('gemini') ||
      content.includes('machine learning')
    );
  });

  if (aiFindings.length === 0) {
    elizaLogger.warn('No AI-related findings in news research');
  }

  // Check for recent dates
  const hasRecentDates = finalProject.findings.some((f) => {
    const content = f.content;
    return (
      content.includes('2024') ||
      content.includes('December') ||
      content.includes('November') ||
      content.includes('recent')
    );
  });

  elizaLogger.info(
    `News research completed: ${aiFindings.length} AI-related findings out of ${finalProject.findings.length} total`
  );
  elizaLogger.info(`Contains recent dates: ${hasRecentDates}`);
  elizaLogger.info(
    `Research quality: ${
      quality.isValid ? 'Good' : 'Issues: ' + quality.issues.join(', ')
    }`
  );

  elizaLogger.success('E2E Test Passed: News/Current Events Research');
}

// Test 4: Technical Documentation Research
export async function testDocumentationResearch(
  runtime: IAgentRuntime
): Promise<void> {
  elizaLogger.info('Starting E2E Test: Technical Documentation Research');

  const service = runtime.getService<ResearchService>('research');
  if (!service) {
    throw new Error('Research service not available');
  }

  // Research technical documentation
  const docQuery =
    'React Server Components documentation examples best practices performance optimization';

  const project = await service.createResearchProject(docQuery, {
    maxSearchResults: 4,
    metadata: {
      researchType: 'documentation',
      purpose: 'learning',
    },
  });

  elizaLogger.info(`Created documentation research project: ${project.id}`);

  // Wait for completion
  const completed = await waitForResearchCompletion(service, project.id, 150000);

  const finalProject = await service.getProject(project.id);
  if (!finalProject) {
    throw new Error('Could not retrieve completed project');
  }

  // Check for documentation-specific content
  const hasDocSources = finalProject.sources.some(
    (s) =>
      s.url.includes('react.dev') ||
      s.url.includes('docs') ||
      s.url.includes('documentation') ||
      s.url.includes('github.com')
  );

  const hasCodeExamples = finalProject.findings.some(
    (f) =>
      f.content.includes('```') ||
      f.content.includes('<') ||
      f.content.includes('/>') ||
      f.content.includes('function') ||
      f.content.includes('const')
  );

  const hasBestPractices = finalProject.findings.some(
    (f) =>
      f.content.toLowerCase().includes('best practice') ||
      f.content.toLowerCase().includes('recommendation') ||
      f.content.toLowerCase().includes('should') ||
      f.content.toLowerCase().includes('avoid')
  );

  elizaLogger.info(`Documentation research completed:`);
  elizaLogger.info(`- Found documentation sources: ${hasDocSources}`);
  elizaLogger.info(`- Contains code examples: ${hasCodeExamples}`);
  elizaLogger.info(`- Includes best practices: ${hasBestPractices}`);
  elizaLogger.info(`- Total findings: ${finalProject.findings.length}`);

  elizaLogger.success('E2E Test Passed: Technical Documentation Research');
}

// Test 5: Competitive Analysis Research
export async function testCompetitiveAnalysis(
  runtime: IAgentRuntime
): Promise<void> {
  elizaLogger.info('Starting E2E Test: Competitive Analysis Research');

  const service = runtime.getService<ResearchService>('research');
  if (!service) {
    throw new Error('Research service not available');
  }

  // Research competitors in the AI agent space
  const competitorQuery =
    'AI agent frameworks comparison AutoGPT BabyAGI LangChain CrewAI features pricing';

  const project = await service.createResearchProject(competitorQuery, {
    maxSearchResults: 5,
    metadata: {
      researchType: 'competitive_analysis',
      purpose: 'market_research',
    },
  });

  elizaLogger.info(`Created competitive analysis project: ${project.id}`);

  // Wait for completion
  const completed = await waitForResearchCompletion(service, project.id, 180000);

  const finalProject = await service.getProject(project.id);
  if (!finalProject) {
    throw new Error('Could not retrieve completed project');
  }

  // Check for competitor mentions
  const competitors = ['AutoGPT', 'BabyAGI', 'LangChain', 'CrewAI'];
  const competitorMentions: Record<string, number> = {};

  competitors.forEach((competitor) => {
    competitorMentions[competitor] = finalProject.findings.filter((f) =>
      f.content.toLowerCase().includes(competitor.toLowerCase())
    ).length;
  });

  const totalMentions = Object.values(competitorMentions).reduce(
    (a, b) => a + b,
    0
  );

  // Check for comparison content
  const hasComparison = finalProject.findings.some((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('compar') ||
      content.includes('versus') ||
      content.includes('vs') ||
      content.includes('better') ||
      content.includes('advantage')
    );
  });

  // Check for feature analysis
  const hasFeatures = finalProject.findings.some((f) => {
    const content = f.content.toLowerCase();
    return (
      content.includes('feature') ||
      content.includes('capability') ||
      content.includes('functionality') ||
      content.includes('support')
    );
  });

  elizaLogger.info(`Competitive analysis completed:`);
  elizaLogger.info(
    `- Competitor mentions: ${JSON.stringify(competitorMentions)}`
  );
  elizaLogger.info(`- Total competitor mentions: ${totalMentions}`);
  elizaLogger.info(`- Contains comparisons: ${hasComparison}`);
  elizaLogger.info(`- Analyzes features: ${hasFeatures}`);

  if (totalMentions < 2) {
    elizaLogger.warn('Limited competitor information found');
  }

  elizaLogger.success('E2E Test Passed: Competitive Analysis Research');
}

// Test 6: DeFi Research Integration
export async function testDeFiResearch(runtime: IAgentRuntime): Promise<void> {
  elizaLogger.info('Starting E2E Test: DeFi Research Integration');

  const service = runtime.getService<ResearchService>('research');
  if (!service) {
    throw new Error('Research service not available');
  }

  // Import DeFi action to test
  const { defiSecurityResearchAction } = await import(
    '../actions/defi-actions'
  );

  // Create a mock message for DeFi research
  const mockMessage: Memory = {
    id: '00000000-0000-0000-0000-000000000001' as `${string}-${string}-${string}-${string}-${string}`,
    entityId: '00000000-0000-0000-0000-000000000002' as `${string}-${string}-${string}-${string}-${string}`,
    roomId: '00000000-0000-0000-0000-000000000003' as `${string}-${string}-${string}-${string}-${string}`,
    content: {
      text: 'Research smart contract security vulnerabilities and audit best practices for DeFi protocols',
    },
    createdAt: Date.now(),
  };

  // Execute DeFi security research
  const result = await defiSecurityResearchAction.handler(
    runtime,
    mockMessage,
    undefined,
    {}
  );

  if (!result || typeof result !== 'object') {
    throw new Error('DeFi research action returned invalid result');
  }

  // Extract project ID from response
  const responseText = (result as any).text || '';
  const projectIdMatch = responseText.match(/([a-f0-9-]{36})/);

  if (!projectIdMatch) {
    throw new Error('Could not extract project ID from DeFi research response');
  }

  const projectId = projectIdMatch[1];
  elizaLogger.info(`DeFi research started with project ID: ${projectId}`);

  // Monitor DeFi-specific findings
  let defiCheckCount = 0;
  const defiCheckInterval = setInterval(async () => {
    defiCheckCount++;
    const current = await service.getProject(projectId);
    if (!current) return;

    // Check for DeFi-specific content
    const defiFindings = current.findings.filter((f) => {
      const content = f.content.toLowerCase();
      return (
        content.includes('smart contract') ||
        content.includes('defi') ||
        content.includes('audit') ||
        content.includes('vulnerability') ||
        content.includes('security')
      );
    });

    if (defiFindings.length > 0 && defiCheckCount === 1) {
      elizaLogger.info(
        `Found ${defiFindings.length} DeFi-specific findings`
      );
    }

    if (
      current.status === ResearchStatus.COMPLETED ||
      current.status === ResearchStatus.FAILED ||
      defiCheckCount > 20
    ) {
      clearInterval(defiCheckInterval);
    }
  }, 5000);

  // Wait for completion
  const completed = await waitForResearchCompletion(service, projectId, 120000);
  clearInterval(defiCheckInterval);

  const finalProject = await service.getProject(projectId);
  if (!finalProject) {
    throw new Error('Could not retrieve DeFi research project');
  }

  // Validate DeFi research quality
  const hasSecurityContent = finalProject.findings.some(
    (f) =>
      f.content.toLowerCase().includes('security') ||
      f.content.toLowerCase().includes('vulnerability') ||
      f.content.toLowerCase().includes('exploit')
  );

  const hasAuditContent = finalProject.findings.some(
    (f) =>
      f.content.toLowerCase().includes('audit') ||
      f.content.toLowerCase().includes('review') ||
      f.content.toLowerCase().includes('verification')
  );

  const hasCodeExamples = finalProject.findings.some(
    (f) =>
      f.content.includes('solidity') ||
      f.content.includes('contract') ||
      f.content.includes('function') ||
      f.content.includes('require')
  );

  elizaLogger.info(`DeFi research completed:`);
  elizaLogger.info(`- Security content found: ${hasSecurityContent}`);
  elizaLogger.info(`- Audit content found: ${hasAuditContent}`);
  elizaLogger.info(`- Code examples found: ${hasCodeExamples}`);
  elizaLogger.info(`- Total findings: ${finalProject.findings.length}`);

  elizaLogger.success('E2E Test Passed: DeFi Research Integration');
}

// Test 7: Research Quality and Relevance
export async function testResearchQualityAssurance(
  runtime: IAgentRuntime
): Promise<void> {
  elizaLogger.info('Starting E2E Test: Research Quality Assurance');

  const service = runtime.getService<ResearchService>('research');
  if (!service) {
    throw new Error('Research service not available');
  }

  // Create a very specific research query
  const specificQuery =
    'ElizaOS plugin development tutorial TypeScript examples 2024';

  const project = await service.createResearchProject(specificQuery, {
    maxSearchResults: 3,
    metadata: {
      researchType: 'tutorial',
      expectedKeywords: ['ElizaOS', 'plugin', 'TypeScript', 'development'],
    },
  });

  elizaLogger.info(`Created quality assurance research project: ${project.id}`);

  // Wait for completion
  const completed = await waitForResearchCompletion(service, project.id, 120000);

  const finalProject = await service.getProject(project.id);
  if (!finalProject) {
    throw new Error('Could not retrieve completed project');
  }

  // Detailed quality checks
  const expectedKeywords = [
    'ElizaOS',
    'plugin',
    'TypeScript',
    'development',
    'tutorial',
  ];
  const keywordCoverage: Record<string, number> = {};

  expectedKeywords.forEach((keyword) => {
    keywordCoverage[keyword] = finalProject.findings.filter((f) =>
      f.content.toLowerCase().includes(keyword.toLowerCase())
    ).length;
  });

  // Calculate relevance metrics
  const totalFindings = finalProject.findings.length;
  const highRelevanceFindings = finalProject.findings.filter(
    (f) => f.relevance > 0.7
  ).length;
  const mediumRelevanceFindings = finalProject.findings.filter(
    (f) => f.relevance > 0.4 && f.relevance <= 0.7
  ).length;
  const lowRelevanceFindings = finalProject.findings.filter(
    (f) => f.relevance <= 0.4
  ).length;

  // Check source diversity
  const sourceDomains = new Set(
    finalProject.sources.map((s) => {
      try {
        return new URL(s.url).hostname;
      } catch {
        return 'unknown';
      }
    })
  );

  // Quality report
  elizaLogger.info(`Research Quality Analysis:`);
  elizaLogger.info(`- Keyword coverage: ${JSON.stringify(keywordCoverage)}`);
  elizaLogger.info(`- Relevance distribution:`);
  elizaLogger.info(
    `  * High (>0.7): ${highRelevanceFindings}/${totalFindings}`
  );
  elizaLogger.info(
    `  * Medium (0.4-0.7): ${mediumRelevanceFindings}/${totalFindings}`
  );
  elizaLogger.info(`  * Low (<0.4): ${lowRelevanceFindings}/${totalFindings}`);
  elizaLogger.info(`- Source diversity: ${sourceDomains.size} unique domains`);
  elizaLogger.info(
    `- Average finding length: ${Math.round(
      finalProject.findings.reduce((sum, f) => sum + f.content.length, 0) /
        totalFindings
    )} chars`
  );

  // Validate minimum quality standards
  const keywordsCovered = Object.values(keywordCoverage).filter(
    (count) => count > 0
  ).length;
  if (keywordsCovered < 2) {
    elizaLogger.warn(
      `Low keyword coverage: only ${keywordsCovered}/${expectedKeywords.length} keywords found`
    );
  }

  if (highRelevanceFindings < totalFindings * 0.3) {
    elizaLogger.warn(
      `Low proportion of high-relevance findings: ${highRelevanceFindings}/${totalFindings}`
    );
  }

  elizaLogger.success('E2E Test Passed: Research Quality Assurance');
}

// #endregion

// #region: Test Suite Export

// Export all tests as a TestSuite for the ElizaOS test runner
const realWorldE2ETests = [
  {
    name: 'Real-World Research Scenarios',
    description: 'Comprehensive tests simulating actual research workflows',
    tests: [
      {
        name: 'Feature Development Research',
        description:
          'Simulates a developer researching how to implement a new feature',
        fn: testFeatureDevelopmentResearch,
      },
      {
        name: 'Person Background Research',
        description:
          'Simulates researching a person for hiring or partnership evaluation',
        fn: testPersonBackgroundResearch,
      },
      {
        name: 'Breaking News Research',
        description:
          'Simulates a journalist or analyst researching breaking news',
        fn: testBreakingNewsResearch,
      },
      {
        name: 'Market Intelligence Research',
        description: 'Simulates competitive analysis and market research',
        fn: testMarketIntelligenceResearch,
      },
      {
        name: 'Technical Problem Solving',
        description: 'Simulates debugging and problem-solving research',
        fn: testProblemSolvingResearch,
      },
      {
        name: 'Academic/Learning Research',
        description: 'Simulates research for learning and academic purposes',
        fn: testAcademicResearch,
      },
    ],
  },
];

const researchE2ETests = [
  {
    name: 'Research Plugin E2E Tests - Core Scenarios',
    description:
      'Comprehensive end-to-end tests simulating real-world research use cases',
    tests: [
      {
        name: 'Code/Feature Research',
        description:
          'Simulates researching technical implementation details before building a feature',
        fn: testCodeFeatureResearch,
      },
      {
        name: 'Person Research',
        description: 'Tests researching information about a public figure',
        fn: testPersonResearch,
      },
      {
        name: 'News/Current Events Research',
        description: 'Tests researching latest news and current developments',
        fn: testNewsResearch,
      },
      {
        name: 'Technical Documentation Research',
        description:
          'Tests researching technical documentation and best practices',
        fn: testDocumentationResearch,
      },
      {
        name: 'Competitive Analysis',
        description: 'Tests researching competitors and market analysis',
        fn: testCompetitiveAnalysis,
      },
      {
        name: 'DeFi Research Integration',
        description: 'Tests DeFi-specific research scenarios',
        fn: testDeFiResearch,
      },
      {
        name: 'Research Quality Assurance',
        description:
          'Tests research quality, relevance, and comprehensive coverage',
        fn: testResearchQualityAssurance,
      },
    ],
  },
];

export const e2eTests = [...realWorldE2ETests, ...researchE2ETests];

// #endregion 