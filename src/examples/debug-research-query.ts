#!/usr/bin/env bun
/**
 * Debug script to test research query handling
 */

import { ResearchService } from '../service';
import { elizaLogger, IAgentRuntime } from '@elizaos/core';
import { ResearchConfig, ResearchStatus } from '../types';
import { Character } from '@elizaos/core';

// Create a minimal runtime for testing
const createTestRuntime = (): IAgentRuntime => {
  const testCharacter: Character = {
    name: 'TestResearcher',
    bio: ['A test researcher for debugging'],
    system: 'You are a research assistant focused on technical topics.',
    messageExamples: [],
    postExamples: [],
    topics: ['technology', 'science', 'research'],
    adjectives: ['analytical', 'thorough'],
    knowledge: [],
    plugins: ['research'],
  };

  return {
    agentId: 'test-agent-id',
    character: testCharacter,
    getSetting: (key: string) => {
      // Return actual environment variables
      const value = process.env[key];
      elizaLogger.debug(`[Runtime] getSetting(${key}) = ${value ? '<REDACTED>' : 'null'}`);
      return value || null;
    },
    getService: (name: string) => {
      return null;
    },
    providers: [],
    actions: [],
    evaluators: [],
    plugins: [],
    services: new Map(),
    messageManager: {
      createMemory: async () => true,
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    descriptionManager: {
      createMemory: async () => true,
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    documentsManager: {
      createMemory: async () => true,
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    knowledgeManager: {
      createMemory: async () => true,
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    loreManager: {
      createMemory: async () => true,
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    useModel: async (modelType: any, params: any) => {
      // Log model calls to see what's happening
      elizaLogger.info('[Debug] Model called with:', {
        modelType,
        query: params?.messages?.[params.messages.length - 1]?.content
      });
      
      // Return a simple response to avoid errors
      return 'Based on the search results, here is a concise answer to your query.';
    },
    stop: async () => {},
  } as any as IAgentRuntime;
};

async function debugResearch() {
  elizaLogger.info('=== Starting Research Debug ===');
  
  const runtime = createTestRuntime();
  const service = new ResearchService(runtime);
  
  const testQuery = "Compare the environmental and economic impacts of different renewable energy storage technologies for grid-scale deployment";
  
  elizaLogger.info(`Original Query: "${testQuery}"`);
  
  try {
    // Create a research project
    const project = await service.createResearchProject(testQuery, {
      searchProviders: ['web'],
      maxSearchResults: 5,
      evaluationEnabled: false,
    });
    
    elizaLogger.info('Project created:', {
      id: project.id,
      query: project.query,
      status: project.status,
      metadata: {
        domain: project.metadata.domain,
        taskType: project.metadata.taskType,
        queryPlan: {
          mainQuery: project.metadata.queryPlan.mainQuery,
          subQueries: project.metadata.queryPlan.subQueries.map(sq => ({
            query: sq.query,
            purpose: sq.purpose,
          })),
        },
      },
    });
    
    // Wait a bit for the research to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check the project status
    const updatedProject = await service.getProject(project.id);
    
    if (updatedProject) {
      elizaLogger.info('Project after 2 seconds:', {
        status: updatedProject.status,
        phase: updatedProject.phase,
        sources: updatedProject.sources.length,
        findings: updatedProject.findings.length,
      });
      
      // Log the first few sources if any
      if (updatedProject.sources.length > 0) {
        elizaLogger.info('First few sources found:', 
          updatedProject.sources.slice(0, 3).map(s => ({
            title: s.title,
            url: s.url,
          }))
        );
      }
    }
    
    // Stop the service
    await service.stop();
    
  } catch (error) {
    elizaLogger.error('Debug failed:', error);
  }
  
  elizaLogger.info('=== Debug Complete ===');
}

// Run the debug
debugResearch().catch(console.error); 