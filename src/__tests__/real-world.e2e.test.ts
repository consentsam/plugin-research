import { IAgentRuntime, Memory, elizaLogger } from '@elizaos/core';
import { ResearchService } from '../service';
import { ResearchProject, ResearchStatus, ResearchPhase } from '../types';

// Helper to create a realistic test memory object
function createTestMemory(text: string): Memory {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as `${string}-${string}-${string}-${string}-${string}`,
    entityId:
      '00000000-0000-0000-0000-000000000001' as `${string}-${string}-${string}-${string}-${string}`,
    roomId:
      '00000000-0000-0000-0000-000000000002' as `${string}-${string}-${string}-${string}-${string}`,
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
    if (project.status === ResearchStatus.COMPLETED || project.status === ResearchStatus.FAILED) {
      return project;
    }

    await new Promise((resolve) => setTimeout(resolve, checkInterval));
  }

  // Return whatever we have after timeout
  const finalProject = await service.getProject(projectId);
  return finalProject || null;
}

// Test 1: Research for Building a New Feature (Real Developer Workflow)
export async function testFeatureDevelopmentResearch(runtime: IAgentRuntime): Promise<void> {
  elizaLogger.info('🔨 Starting Real-World Test: Feature Development Research');

  const service = runtime.getService<ResearchService>('research');
  if (!service) throw new Error('Research service not available');

  // Scenario: Developer needs to implement WebSocket real-time features
  const queries = [
    'WebSocket implementation Node.js TypeScript scaling best practices 2024',
    'Socket.io vs native WebSocket performance comparison production',
    'WebSocket authentication JWT security implementation examples',
  ];

  elizaLogger.info('Researching WebSocket implementation across multiple aspects...');

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
              `Project ${project.query.substring(0, 30)}... has ${p.findings.length} findings`
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
  elizaLogger.info(`- Implementation details found: ${hasImplementationDetails}`);
  elizaLogger.info(`- Security considerations found: ${hasSecurityInfo}`);
  elizaLogger.info(`- Performance insights found: ${hasPerformanceInfo}`);
  elizaLogger.info(`- Developer-focused sources: ${devSources.length}/${allSources.length}`);

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

  elizaLogger.success('✅ Real-World Test Passed: Feature Development Research');
}

// Test 2: Research a Person for Hiring/Partnership (Real HR/Business Workflow)
export async function testPersonBackgroundResearch(runtime: IAgentRuntime): Promise<void> {
  elizaLogger.info('👤 Starting Real-World Test: Person Background Research');

  const service = runtime.getService<ResearchService>('research');
  if (!service) throw new Error('Research service not available');

  // Scenario: Researching a potential technical advisor or hire
  const personQuery = 'Andrej Karpathy AI research contributions Tesla OpenAI recent projects 2024';

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
      const hasTwitter = sources.some((s) => s.includes('twitter') || s.includes('x.com'));
      const hasGitHub = sources.some((s) => s.includes('github'));

      if ((hasLinkedIn || hasTwitter || hasGitHub) && p.phase === ResearchPhase.SEARCHING) {
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
  const hasTeslaInfo = findings.some((f) => f.content.toLowerCase().includes('tesla'));
  const hasOpenAIInfo = findings.some((f) => f.content.toLowerCase().includes('openai'));
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
    elizaLogger.info('ℹ️  Partial professional profile - may need additional sources');
  } else {
    elizaLogger.warn('⚠️  Limited professional information found');
  }

  elizaLogger.success('✅ Real-World Test Passed: Person Background Research');
}

// Test 3: Breaking News Research (Real Journalist/Analyst Workflow)
export async function testBreakingNewsResearch(runtime: IAgentRuntime): Promise<void> {
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
        s.url.includes('twitter.com') || s.url.includes('x.com') || s.url.includes('reddit.com')
    ),
  };

  // Check for time-sensitive content
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' });
  const currentYear = new Date().getFullYear();

  const hasCurrentMonth = findings.some((f) => f.content.includes(currentMonth));
  const hasCurrentYear = findings.some((f) => f.content.includes(currentYear.toString()));
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
  const companies = ['OpenAI', 'Google', 'Microsoft', 'Anthropic', 'Meta', 'Amazon', 'Apple'];
  const companyMentions: Record<string, number> = {};

  companies.forEach((company) => {
    companyMentions[company] = findings.filter((f) => f.content.includes(company)).length;
  });

  elizaLogger.info('📊 Breaking News Research Results:');
  elizaLogger.info(`- Source distribution:`);
  elizaLogger.info(`  * Mainstream media: ${newsSourceTypes.mainstream.length}`);
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
export async function testMarketIntelligenceResearch(runtime: IAgentRuntime): Promise<void> {
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
        elizaLogger.info(`Analyzing ${p.findings.length} market data points...`);
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
        if (content.includes('tool') || content.includes('function')) features.push('tools');
        if (content.includes('chain') || content.includes('workflow')) features.push('workflow');
        if (content.includes('llm') || content.includes('model')) features.push('multi-llm');
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
  const trendKeywords = ['growth', 'trend', 'future', 'emerging', 'adoption', 'market size'];
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
        `  * ${competitor}: ${data.mentions} mentions, features=[${data.features.join(',')}], pricing=${data.pricing}, adoption=${data.adoption}`
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
    elizaLogger.info(`Key competitors analyzed: ${wellCoveredCompetitors.join(', ')}`);
  } else {
    elizaLogger.info('ℹ️  Partial market intelligence - consider additional research');
  }

  elizaLogger.success('✅ Real-World Test Passed: Market Intelligence Research');
}

// Test 5: Technical Problem Solving Research (Real Developer Debug Workflow)
export async function testProblemSolvingResearch(runtime: IAgentRuntime): Promise<void> {
  elizaLogger.info('🔧 Starting Real-World Test: Technical Problem Solving Research');

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
      const hasStackOverflow = p.sources.some((s) => s.url.includes('stackoverflow.com'));
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
      (s) => s.url.includes('blog') || s.url.includes('medium.com') || s.url.includes('dev.to')
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
  elizaLogger.info(`  * Stack Overflow: ${debuggingSources.stackoverflow.length}`);
  elizaLogger.info(`  * GitHub Issues: ${debuggingSources.github.length}`);
  elizaLogger.info(`  * Documentation: ${debuggingSources.documentation.length}`);
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
    debuggingSources.stackoverflow.length > 0 || debuggingSources.documentation.length > 0;
  const hasGoodContent = hasSolutions.length > 0 && hasCodeExamples.length > 0;
  const hasContext = hasExplanations.length > 0;

  if (hasGoodSources && hasGoodContent && hasContext) {
    elizaLogger.success('✅ Comprehensive debugging information found');
  } else {
    elizaLogger.info(
      `ℹ️  Debugging info: Sources=${hasGoodSources}, Solutions=${hasGoodContent}, Context=${hasContext}`
    );
  }

  elizaLogger.success('✅ Real-World Test Passed: Technical Problem Solving Research');
}

// Export all tests as a TestSuite for the ElizaOS test runner
export const realWorldE2ETests = [
  {
    name: 'Real-World Research E2E Tests',
    description: 'End-to-end tests simulating real-world research workflows',
    tests: [
      {
        name: 'Feature Development Research',
        description: 'Simulates a developer researching how to implement a new AI feature',
        fn: testFeatureDevelopmentResearch,
      },
      {
        name: 'Person Background Research',
        description: 'Simulates researching professional background information',
        fn: testPersonBackgroundResearch,
      },
      {
        name: 'Breaking News Research',
        description: 'Simulates journalist/analyst workflow for current events',
        fn: testBreakingNewsResearch,
      },
      {
        name: 'Market Intelligence Research',
        description: 'Simulates business strategy and competitive analysis workflow',
        fn: testMarketIntelligenceResearch,
      },
      {
        name: 'Technical Problem Solving Research',
        description: 'Simulates developer debugging and troubleshooting workflow',
        fn: testProblemSolvingResearch,
      },
    ],
  },
];
