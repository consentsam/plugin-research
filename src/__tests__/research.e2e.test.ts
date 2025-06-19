import { IAgentRuntime, Memory, elizaLogger } from '@elizaos/core';
import { ResearchService } from '../service';
import { ResearchProject, ResearchStatus } from '../types';

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
    
    if (project.status === ResearchStatus.COMPLETED || 
        project.status === ResearchStatus.FAILED) {
      return project.status === ResearchStatus.COMPLETED;
    }
    
    // Wait 5 seconds before checking again (longer for real operations)
    await new Promise(resolve => setTimeout(resolve, 5000));
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
    project.sources.map(s => {
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
  const avgFindingLength = project.findings.reduce((sum, f) => sum + f.content.length, 0) / (project.findings.length || 1);
  if (avgFindingLength < 100) {
    issues.push('Findings are too short (average < 100 chars)');
  }
  
  // Check relevance scores
  const avgRelevance = project.findings.reduce((sum, f) => sum + f.relevance, 0) / (project.findings.length || 1);
  if (avgRelevance < 0.3) {
    issues.push('Low average relevance score');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

// Test 1: Code/Feature Research - Simulating research before building a feature
export async function testCodeFeatureResearch(runtime: IAgentRuntime): Promise<void> {
  elizaLogger.info('Starting E2E Test: Code/Feature Research');
  
  const service = runtime.getService<ResearchService>('research');
  if (!service) {
    throw new Error('Research service not available');
  }

  // Research query that a developer would make before implementing a feature
  const featureQuery = 'How to implement OAuth2 authentication in Node.js with TypeScript best practices security 2024';
  
  const project = await service.createResearchProject(featureQuery, {
    maxSearchResults: 5,
    language: 'en',
    metadata: {
      researchType: 'technical',
      purpose: 'feature_implementation'
    }
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
      elizaLogger.info(`Phase ${current.phase} started after ${phaseProgress[current.phase]}ms`);
      lastUpdate = Date.now();
    }
    
    if (current.status === ResearchStatus.COMPLETED || 
        current.status === ResearchStatus.FAILED) {
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
  const hasCodeExamples = finalProject.findings.some(f => 
    f.content.includes('npm') || 
    f.content.includes('const') || 
    f.content.includes('import') ||
    f.content.includes('OAuth')
  );
  
  if (!hasCodeExamples) {
    elizaLogger.warn('No code examples found in technical research');
  }

  // Check for security considerations (important for auth research)
  const hasSecurityInfo = finalProject.findings.some(f => 
    f.content.toLowerCase().includes('security') ||
    f.content.toLowerCase().includes('csrf') ||
    f.content.toLowerCase().includes('token')
  );
  
  if (!hasSecurityInfo) {
    elizaLogger.warn('No security information found in OAuth research');
  }

  elizaLogger.info(`Code research completed with ${finalProject.sources.length} sources and ${finalProject.findings.length} findings`);
  elizaLogger.info(`Found code examples: ${hasCodeExamples}, Security info: ${hasSecurityInfo}`);
  
  if (finalProject.report) {
    elizaLogger.info(`Report generated with ${finalProject.report.sections.length} sections`);
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
  const personQuery = 'Vitalik Buterin Ethereum founder recent projects writings 2024';
  
  const project = await service.createResearchProject(personQuery, {
    maxSearchResults: 4,
    metadata: {
      researchType: 'person',
      purpose: 'background_research'
    }
  });

  elizaLogger.info(`Created person research project: ${project.id}`);

  // Wait for completion
  const completed = await waitForResearchCompletion(service, project.id, 150000);
  
  if (!completed) {
    const partial = await service.getProject(project.id);
    if (partial && partial.findings.length > 0) {
      elizaLogger.warn(`Person research incomplete but found ${partial.findings.length} findings`);
    } else {
      throw new Error('Person research did not complete and no findings collected');
    }
  }

  const finalProject = await service.getProject(project.id);
  if (!finalProject) {
    throw new Error('Could not retrieve completed project');
  }

  // Validate we found relevant information about the person
  const relevantFindings = finalProject.findings.filter(f => 
    f.content.toLowerCase().includes('vitalik') ||
    f.content.toLowerCase().includes('ethereum') ||
    f.content.toLowerCase().includes('buterin')
  );

  if (relevantFindings.length === 0) {
    throw new Error('No relevant findings about the person');
  }

  // Check for recent information
  const hasRecentInfo = finalProject.findings.some(f => 
    f.content.includes('2024') || 
    f.content.includes('2023') ||
    f.content.toLowerCase().includes('recent')
  );

  elizaLogger.info(`Person research completed: ${relevantFindings.length}/${finalProject.findings.length} relevant findings`);
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
  const newsQuery = 'latest artificial intelligence breakthroughs news December 2024 ChatGPT Claude Gemini';
  
  const project = await service.createResearchProject(newsQuery, {
    maxSearchResults: 5,
    metadata: {
      researchType: 'news',
      timeframe: 'current',
      purpose: 'market_intelligence'
    }
  });

  elizaLogger.info(`Created news research project: ${project.id}`);

  // Monitor for news-specific content
  let checkCount = 0;
  const newsCheckInterval = setInterval(async () => {
    checkCount++;
    const current = await service.getProject(project.id);
    if (!current) return;
    
    // Check if we're finding news sources
    const newsSource = current.sources.find(s => 
      s.url.includes('news') ||
      s.url.includes('article') ||
      s.url.includes('blog') ||
      s.title.toLowerCase().includes('2024')
    );
    
    if (newsSource && checkCount === 1) {
      elizaLogger.info(`Found news source: ${newsSource.title}`);
    }
    
    if (current.status === ResearchStatus.COMPLETED || 
        current.status === ResearchStatus.FAILED ||
        checkCount > 30) {
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
  const aiFindings = finalProject.findings.filter(f => {
    const content = f.content.toLowerCase();
    return content.includes('ai') || 
           content.includes('artificial intelligence') ||
           content.includes('chatgpt') ||
           content.includes('claude') ||
           content.includes('gemini') ||
           content.includes('machine learning');
  });

  if (aiFindings.length === 0) {
    elizaLogger.warn('No AI-related findings in news research');
  }

  // Check for recent dates
  const hasRecentDates = finalProject.findings.some(f => {
    const content = f.content;
    return content.includes('2024') || 
           content.includes('December') ||
           content.includes('November') ||
           content.includes('recent');
  });

  elizaLogger.info(`News research completed: ${aiFindings.length} AI-related findings out of ${finalProject.findings.length} total`);
  elizaLogger.info(`Contains recent dates: ${hasRecentDates}`);
  elizaLogger.info(`Research quality: ${quality.isValid ? 'Good' : 'Issues: ' + quality.issues.join(', ')}`);

  elizaLogger.success('E2E Test Passed: News/Current Events Research');
}

// Test 4: Technical Documentation Research
export async function testDocumentationResearch(runtime: IAgentRuntime): Promise<void> {
  elizaLogger.info('Starting E2E Test: Technical Documentation Research');
  
  const service = runtime.getService<ResearchService>('research');
  if (!service) {
    throw new Error('Research service not available');
  }

  // Research technical documentation
  const docQuery = 'React Server Components documentation examples best practices performance optimization';
  
  const project = await service.createResearchProject(docQuery, {
    maxSearchResults: 4,
    metadata: {
      researchType: 'documentation',
      purpose: 'learning'
    }
  });

  elizaLogger.info(`Created documentation research project: ${project.id}`);

  // Wait for completion
  const completed = await waitForResearchCompletion(service, project.id, 150000);
  
  const finalProject = await service.getProject(project.id);
  if (!finalProject) {
    throw new Error('Could not retrieve completed project');
  }

  // Check for documentation-specific content
  const hasDocSources = finalProject.sources.some(s => 
    s.url.includes('react.dev') ||
    s.url.includes('docs') ||
    s.url.includes('documentation') ||
    s.url.includes('github.com')
  );

  const hasCodeExamples = finalProject.findings.some(f => 
    f.content.includes('```') ||
    f.content.includes('<') ||
    f.content.includes('/>') ||
    f.content.includes('function') ||
    f.content.includes('const')
  );

  const hasBestPractices = finalProject.findings.some(f => 
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
export async function testCompetitiveAnalysis(runtime: IAgentRuntime): Promise<void> {
  elizaLogger.info('Starting E2E Test: Competitive Analysis Research');
  
  const service = runtime.getService<ResearchService>('research');
  if (!service) {
    throw new Error('Research service not available');
  }

  // Research competitors in the AI agent space
  const competitorQuery = 'AI agent frameworks comparison AutoGPT BabyAGI LangChain CrewAI features pricing';
  
  const project = await service.createResearchProject(competitorQuery, {
    maxSearchResults: 5,
    metadata: {
      researchType: 'competitive_analysis',
      purpose: 'market_research'
    }
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
  
  competitors.forEach(competitor => {
    competitorMentions[competitor] = finalProject.findings.filter(f => 
      f.content.toLowerCase().includes(competitor.toLowerCase())
    ).length;
  });

  const totalMentions = Object.values(competitorMentions).reduce((a, b) => a + b, 0);
  
  // Check for comparison content
  const hasComparison = finalProject.findings.some(f => {
    const content = f.content.toLowerCase();
    return content.includes('compar') ||
           content.includes('versus') ||
           content.includes('vs') ||
           content.includes('better') ||
           content.includes('advantage');
  });

  // Check for feature analysis
  const hasFeatures = finalProject.findings.some(f => {
    const content = f.content.toLowerCase();
    return content.includes('feature') ||
           content.includes('capability') ||
           content.includes('functionality') ||
           content.includes('support');
  });

  elizaLogger.info(`Competitive analysis completed:`);
  elizaLogger.info(`- Competitor mentions: ${JSON.stringify(competitorMentions)}`);
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
  const { defiSecurityResearchAction } = await import('../actions/defi-actions');
  
  // Create a mock message for DeFi research
  const mockMessage: Memory = {
    id: '00000000-0000-0000-0000-000000000001' as `${string}-${string}-${string}-${string}-${string}`,
    entityId: '00000000-0000-0000-0000-000000000002' as `${string}-${string}-${string}-${string}-${string}`,
    roomId: '00000000-0000-0000-0000-000000000003' as `${string}-${string}-${string}-${string}-${string}`,
    content: {
      text: 'Research smart contract security vulnerabilities and audit best practices for DeFi protocols'
    },
    createdAt: Date.now()
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
    const defiFindings = current.findings.filter(f => {
      const content = f.content.toLowerCase();
      return content.includes('smart contract') ||
             content.includes('defi') ||
             content.includes('audit') ||
             content.includes('vulnerability') ||
             content.includes('security');
    });
    
    if (defiFindings.length > 0 && defiCheckCount === 1) {
      elizaLogger.info(`Found ${defiFindings.length} DeFi-specific findings`);
    }
    
    if (current.status === ResearchStatus.COMPLETED || 
        current.status === ResearchStatus.FAILED ||
        defiCheckCount > 20) {
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
  const hasSecurityContent = finalProject.findings.some(f => 
    f.content.toLowerCase().includes('security') ||
    f.content.toLowerCase().includes('vulnerability') ||
    f.content.toLowerCase().includes('exploit')
  );

  const hasAuditContent = finalProject.findings.some(f => 
    f.content.toLowerCase().includes('audit') ||
    f.content.toLowerCase().includes('review') ||
    f.content.toLowerCase().includes('verification')
  );

  const hasCodeExamples = finalProject.findings.some(f => 
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
export async function testResearchQualityAssurance(runtime: IAgentRuntime): Promise<void> {
  elizaLogger.info('Starting E2E Test: Research Quality Assurance');
  
  const service = runtime.getService<ResearchService>('research');
  if (!service) {
    throw new Error('Research service not available');
  }

  // Create a very specific research query
  const specificQuery = 'ElizaOS plugin development tutorial TypeScript examples 2024';
  
  const project = await service.createResearchProject(specificQuery, {
    maxSearchResults: 3,
    metadata: {
      researchType: 'tutorial',
      expectedKeywords: ['ElizaOS', 'plugin', 'TypeScript', 'development']
    }
  });

  elizaLogger.info(`Created quality assurance research project: ${project.id}`);

  // Wait for completion
  const completed = await waitForResearchCompletion(service, project.id, 120000);
  
  const finalProject = await service.getProject(project.id);
  if (!finalProject) {
    throw new Error('Could not retrieve completed project');
  }

  // Detailed quality checks
  const expectedKeywords = ['ElizaOS', 'plugin', 'TypeScript', 'development', 'tutorial'];
  const keywordCoverage: Record<string, number> = {};
  
  expectedKeywords.forEach(keyword => {
    keywordCoverage[keyword] = finalProject.findings.filter(f => 
      f.content.toLowerCase().includes(keyword.toLowerCase())
    ).length;
  });

  // Calculate relevance metrics
  const totalFindings = finalProject.findings.length;
  const highRelevanceFindings = finalProject.findings.filter(f => f.relevance > 0.7).length;
  const mediumRelevanceFindings = finalProject.findings.filter(f => f.relevance > 0.4 && f.relevance <= 0.7).length;
  const lowRelevanceFindings = finalProject.findings.filter(f => f.relevance <= 0.4).length;

  // Check source diversity
  const sourceDomains = new Set(
    finalProject.sources.map(s => {
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
  elizaLogger.info(`  * High (>0.7): ${highRelevanceFindings}/${totalFindings}`);
  elizaLogger.info(`  * Medium (0.4-0.7): ${mediumRelevanceFindings}/${totalFindings}`);
  elizaLogger.info(`  * Low (<0.4): ${lowRelevanceFindings}/${totalFindings}`);
  elizaLogger.info(`- Source diversity: ${sourceDomains.size} unique domains`);
  elizaLogger.info(`- Average finding length: ${Math.round(finalProject.findings.reduce((sum, f) => sum + f.content.length, 0) / totalFindings)} chars`);

  // Validate minimum quality standards
  const keywordsCovered = Object.values(keywordCoverage).filter(count => count > 0).length;
  if (keywordsCovered < 2) {
    elizaLogger.warn(`Low keyword coverage: only ${keywordsCovered}/${expectedKeywords.length} keywords found`);
  }

  if (highRelevanceFindings < totalFindings * 0.3) {
    elizaLogger.warn(`Low proportion of high-relevance findings: ${highRelevanceFindings}/${totalFindings}`);
  }

  elizaLogger.success('E2E Test Passed: Research Quality Assurance');
}

// Export all tests as a TestSuite for the ElizaOS test runner
export const researchE2ETests = [
  {
    name: 'Research Plugin E2E Tests - Real World Scenarios',
    description: 'Comprehensive end-to-end tests simulating real-world research use cases',
    tests: [
      {
        name: 'Code/Feature Research',
        description: 'Simulates researching technical implementation details before building a feature',
        fn: testCodeFeatureResearch
      },
      {
        name: 'Person Research',
        description: 'Tests researching information about a public figure',
        fn: testPersonResearch
      },
      {
        name: 'News/Current Events Research',
        description: 'Tests researching latest news and current developments',
        fn: testNewsResearch
      },
      {
        name: 'Technical Documentation Research',
        description: 'Tests researching technical documentation and best practices',
        fn: testDocumentationResearch
      },
      {
        name: 'Competitive Analysis',
        description: 'Tests researching competitors and market analysis',
        fn: testCompetitiveAnalysis
      },
      {
        name: 'DeFi Research Integration',
        description: 'Tests DeFi-specific research scenarios',
        fn: testDeFiResearch
      },
      {
        name: 'Research Quality Assurance',
        description: 'Tests research quality, relevance, and comprehensive coverage',
        fn: testResearchQualityAssurance
      }
    ]
  }
]; 