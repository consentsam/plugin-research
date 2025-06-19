import { IAgentRuntime, UUID } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import { ResearchService } from '../service';
import { 
  ResearchStatus, 
  ResearchPhase, 
  ResearchDomain,
  TaskType,
  ResearchDepth 
} from '../types';

// Simplified DeepResearch Bench test queries
const DEEPRESEARCH_BENCH_QUERIES = [
  {
    domain: ResearchDomain.PHYSICS,
    query: "quantum error correction surface codes",
    expectedDepth: ResearchDepth.PHD_LEVEL,
    expectedTaskType: TaskType.ANALYTICAL
  },
  {
    domain: ResearchDomain.COMPUTER_SCIENCE,
    query: "machine learning drug discovery comparison",
    expectedDepth: ResearchDepth.DEEP,
    expectedTaskType: TaskType.COMPARATIVE
  }
];

export class DeepResearchBenchSimplifiedTestSuite {
  name = 'deepresearch-bench-simplified-e2e';
  description = 'Simplified E2E tests for DeepResearch Bench without runtime.useModel dependencies';

  tests = [
    {
      name: 'Should create and track research projects',
      fn: async (runtime: IAgentRuntime) => {
        const service = runtime.getService('research') as ResearchService;
        
        if (!service) {
          throw new Error('Research service not available');
        }
        
        console.log(`\n🔬 Testing Research Project Creation`);
        
        // Test 1: Create a research project with explicit metadata
        const query = DEEPRESEARCH_BENCH_QUERIES[0];
        const project = await service.createResearchProject(query.query, {
          domain: query.domain,
          researchDepth: query.expectedDepth,
          maxSearchResults: 5,
          evaluationEnabled: false, // Skip evaluation to avoid useModel calls
          // Disable features that require useModel
          maxDepth: 1,
          timeout: 30000
        });
        
        console.log(`✅ Created project: ${project.id}`);
        console.log(`📊 Query: ${project.query}`);
        console.log(`📊 Status: ${project.status}`);
        
        // Verify project creation
        if (!project.id) {
          throw new Error('Project ID not generated');
        }
        
        if (project.status !== ResearchStatus.PENDING && project.status !== ResearchStatus.ACTIVE) {
          throw new Error(`Unexpected project status: ${project.status}`);
        }
        
        // Test 2: Retrieve project
        const retrieved = await service.getProject(project.id);
        if (!retrieved) {
          throw new Error('Could not retrieve project');
        }
        
        console.log(`✅ Retrieved project successfully`);
        
        // Test 3: Get active projects
        const activeProjects = await service.getActiveProjects();
        console.log(`📊 Active projects: ${activeProjects.length}`);
        
        // Test 4: Create multiple projects
        const project2 = await service.createResearchProject(
          DEEPRESEARCH_BENCH_QUERIES[1].query,
          {
            domain: DEEPRESEARCH_BENCH_QUERIES[1].domain,
            researchDepth: DEEPRESEARCH_BENCH_QUERIES[1].expectedDepth,
            maxSearchResults: 3,
            evaluationEnabled: false
          }
        );
        
        console.log(`✅ Created second project: ${project2.id}`);
        
        // Test 5: Get all projects
        const allProjects = await service.getAllProjects();
        if (allProjects.length < 2) {
          throw new Error(`Expected at least 2 projects, got ${allProjects.length}`);
        }
        
        console.log(`✅ Total projects: ${allProjects.length}`);
        
        // Test 6: Pause and resume
        if (project.status === ResearchStatus.ACTIVE) {
          await service.pauseResearch(project.id);
          const paused = await service.getProject(project.id);
          if (paused?.status !== ResearchStatus.PAUSED) {
            throw new Error('Failed to pause research');
          }
          console.log(`✅ Paused research successfully`);
          
          await service.resumeResearch(project.id);
          const resumed = await service.getProject(project.id);
          if (resumed?.status !== ResearchStatus.ACTIVE) {
            throw new Error('Failed to resume research');
          }
          console.log(`✅ Resumed research successfully`);
        }
        
        console.log(`\n✨ Research service basic operations test passed!`);
      }
    },
    
    {
      name: 'Should handle research metadata and configuration',
      fn: async (runtime: IAgentRuntime) => {
        const service = runtime.getService('research') as ResearchService;
        
        if (!service) {
          throw new Error('Research service not available');
        }
        
        console.log(`\n🔬 Testing Research Metadata Handling`);
        
        // Test different research configurations
        const configs = [
          {
            query: "compare React and Vue.js performance",
            domain: ResearchDomain.COMPUTER_SCIENCE,
            depth: ResearchDepth.MODERATE,
            expectedTaskType: TaskType.COMPARATIVE
          },
          {
            query: "analyze climate change impact on agriculture",
            domain: ResearchDomain.ENVIRONMENTAL_SCIENCE,
            depth: ResearchDepth.DEEP,
            expectedTaskType: TaskType.ANALYTICAL
          },
          {
            query: "predict cryptocurrency market trends 2025",
            domain: ResearchDomain.FINANCE,
            depth: ResearchDepth.SURFACE,
            expectedTaskType: TaskType.PREDICTIVE
          }
        ];
        
        for (const config of configs) {
          const project = await service.createResearchProject(config.query, {
            domain: config.domain,
            researchDepth: config.depth,
            maxSearchResults: 2,
            evaluationEnabled: false
          });
          
          console.log(`\n📋 Project: ${config.query.substring(0, 50)}...`);
          console.log(`  - Domain: ${project.metadata.domain || 'auto-detected'}`);
          console.log(`  - Depth: ${project.metadata.depth}`);
          console.log(`  - Language: ${project.metadata.language}`);
          
          // Verify metadata
          if (project.metadata.domain && project.metadata.domain !== config.domain) {
            console.warn(`  ⚠️  Domain mismatch: expected ${config.domain}, got ${project.metadata.domain}`);
          }
          
          if (project.metadata.depth !== config.depth) {
            throw new Error(`Depth mismatch: expected ${config.depth}, got ${project.metadata.depth}`);
          }
        }
        
        console.log(`\n✨ Metadata handling test passed!`);
      }
    },
    
    {
      name: 'Should export research in different formats',
      fn: async (runtime: IAgentRuntime) => {
        const service = runtime.getService('research') as ResearchService;
        
        if (!service) {
          throw new Error('Research service not available');
        }
        
        console.log(`\n🔬 Testing Research Export Functionality`);
        
        // Create a simple project
        const project = await service.createResearchProject(
          "test export functionality",
          {
            domain: ResearchDomain.GENERAL,
            researchDepth: ResearchDepth.SURFACE,
            maxSearchResults: 1,
            evaluationEnabled: false
          }
        );
        
        // Manually set project to completed state for testing
        const projectInternal = (service as any).projects.get(project.id);
        if (projectInternal) {
          projectInternal.status = ResearchStatus.COMPLETED;
          projectInternal.report = {
            title: "Test Export Report",
            summary: "This is a test report for export functionality",
            sections: [
              {
                heading: "Introduction",
                content: "Test content for export",
                subsections: []
              }
            ],
            citations: [],
            bibliography: [],
            methodology: "Test methodology",
            limitations: [],
            futureWork: [],
            keywords: ["test", "export"],
            generatedAt: Date.now(),
            wordCount: 100,
            readingTime: 1,
            confidence: 0.8,
            completeness: 0.9
          };
          projectInternal.findings = [
            {
              id: uuidv4(),
              content: "Test finding",
              source: {
                id: uuidv4(),
                url: "https://example.com",
                title: "Test Source",
                snippet: "Test snippet",
                relevance: 0.8,
                credibility: 0.9,
                publicationDate: new Date().toISOString(),
                type: 'web' as const,
                metadata: {}
              },
              relevance: 0.8,
              confidence: 0.9,
              category: "test",
              timestamp: Date.now()
            }
          ];
        }
        
        // Test different export formats
        const formats = ['json', 'markdown', 'deepresearch'] as const;
        
        for (const format of formats) {
          try {
            const exported = await service.exportProject(project.id, format);
            console.log(`✅ Exported in ${format} format - length: ${exported.length} chars`);
            
            // Verify export content
            if (format === 'json') {
              const parsed = JSON.parse(exported);
              if (!parsed.id || !parsed.query) {
                throw new Error('Invalid JSON export structure');
              }
            } else if (format === 'markdown') {
              if (!exported.includes('#') || !exported.includes('Test Export Report')) {
                throw new Error('Invalid Markdown export');
              }
            } else if (format === 'deepresearch') {
              const parsed = JSON.parse(exported);
              if (!parsed.id || !parsed.article) {
                throw new Error('Invalid DeepResearch format');
              }
            }
          } catch (error) {
            console.error(`❌ Failed to export in ${format} format:`, error);
            throw error;
          }
        }
        
        console.log(`\n✨ Export functionality test passed!`);
      }
    }
  ];
}

export default new DeepResearchBenchSimplifiedTestSuite();