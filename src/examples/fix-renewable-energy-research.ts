#!/usr/bin/env bun
/**
 * Script to diagnose and fix renewable energy research issues
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { ResearchService } from '../service';
import { elizaLogger, IAgentRuntime, Character, asUUID } from '@elizaos/core';
import { TavilySearchProvider } from '../integrations/search-providers/tavily';
import fs from 'fs/promises';

async function testTavilyDirectly() {
  elizaLogger.info('=== Testing Tavily Search Directly ===');
  
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    elizaLogger.error('TAVILY_API_KEY not found in environment');
    return;
  }
  
  try {
    const tavily = new TavilySearchProvider({ apiKey });
    const query = "renewable energy storage technologies environmental economic impacts grid scale";
    
    elizaLogger.info(`Searching Tavily for: "${query}"`);
    const results = await tavily.search(query, 5);
    
    elizaLogger.info(`Found ${results.length} results:`);
    results.forEach((result, i) => {
      elizaLogger.info(`${i + 1}. ${result.title}`);
      elizaLogger.info(`   URL: ${result.url}`);
      elizaLogger.info(`   Score: ${result.score}`);
      elizaLogger.info(`   Snippet: ${result.snippet?.substring(0, 100)}...`);
    });
    
    // Check if results are relevant
    const relevantResults = results.filter(r => 
      r.title.toLowerCase().includes('energy') ||
      r.title.toLowerCase().includes('storage') ||
      r.snippet?.toLowerCase().includes('battery') ||
      r.snippet?.toLowerCase().includes('renewable')
    );
    
    elizaLogger.info(`\n${relevantResults.length} out of ${results.length} results appear relevant`);
    
  } catch (error) {
    elizaLogger.error('Tavily search failed:', error);
  }
}

async function testWithMinimalRuntime() {
  elizaLogger.info('\n=== Testing with Minimal Runtime ===');
  
  const runtime: IAgentRuntime = {
    agentId: asUUID('11111111-1111-1111-1111-111111111111'),
    character: {
      name: 'ResearchBot',
      bio: ['Research assistant'],
      system: 'You are a research assistant.',
      messageExamples: [],
      postExamples: [],
      topics: [],
      adjectives: [],
      knowledge: [],
      plugins: [],
    },
    getSetting: (key: string) => process.env[key] || null,
    getService: () => null,
    providers: [],
    actions: [],
    evaluators: [],
    plugins: [],
    services: new Map(),
    messageManager: {
      createMemory: async () => asUUID('22222222-2222-2222-2222-222222222222'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    // Add all other required managers
    descriptionManager: {
      createMemory: async () => asUUID('33333333-3333-3333-3333-333333333333'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    documentsManager: {
      createMemory: async () => asUUID('44444444-4444-4444-4444-444444444444'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    knowledgeManager: {
      createMemory: async () => asUUID('55555555-5555-5555-5555-555555555555'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    loreManager: {
      createMemory: async () => asUUID('66666666-6666-6666-6666-666666666666'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    // Add useModel for text generation
    useModel: async (modelType: string, params: any) => {
      elizaLogger.debug(`Mock model called: ${modelType}`);
      // Return simple responses for different types of requests
      return { content: 'Analysis complete.' };
    },
    stop: async () => {},
  } as any;
  
  const service = new ResearchService(runtime);
  
  try {
    const query = "Compare renewable energy storage technologies environmental economic impacts";
    elizaLogger.info(`Creating research project: "${query}"`);
    
    const project = await service.createResearchProject(query, {
      searchProviders: ['web'],
      maxSearchResults: 5,
      maxDepth: 1,
      enableImages: false,
      evaluationEnabled: false,
      timeout: 60000,
    });
    
    elizaLogger.info(`Project created: ${project.id}`);
    
    // Wait for completion
    let attempts = 0;
    while (attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const current = await service.getProject(project.id);
      if (!current) break;
      
      if (attempts % 5 === 0) {
        elizaLogger.info(`Status: ${current.status}, Phase: ${current.phase}, Sources: ${current.sources.length}`);
        
        // Log first few sources
        if (current.sources.length > 0) {
          elizaLogger.info('First few sources:');
          current.sources.slice(0, 3).forEach((s, i) => {
            elizaLogger.info(`  ${i + 1}. ${s.title} (${s.url})`);
          });
        }
      }
      
      if (current.status === 'completed' || current.status === 'failed') {
        if (current.status === 'completed' && current.report) {
          const markdown = await service.exportProject(project.id, 'markdown');
          const reportPath = path.join(__dirname, '../../fixed-renewable-energy-report.md');
          await fs.writeFile(reportPath, markdown);
          elizaLogger.info(`✅ Report saved to: ${reportPath}`);
          
          // Show preview
          elizaLogger.info('\nReport Preview:');
          elizaLogger.info(markdown.substring(0, 1000) + '...');
          
          // Check content
          const hasRelevantContent = 
            markdown.toLowerCase().includes('energy') &&
            markdown.toLowerCase().includes('storage') &&
            (markdown.toLowerCase().includes('battery') || 
             markdown.toLowerCase().includes('renewable') ||
             markdown.toLowerCase().includes('environmental'));
          
          if (hasRelevantContent) {
            elizaLogger.info('\n✅ SUCCESS: Report contains relevant renewable energy content!');
          } else {
            elizaLogger.error('\n❌ FAIL: Report does NOT contain relevant content');
            elizaLogger.info('\nFirst 2000 chars of report:');
            elizaLogger.info(markdown.substring(0, 2000));
          }
        } else {
          elizaLogger.error(`Research failed: ${current.error}`);
        }
        break;
      }
      
      attempts++;
    }
    
    await service.stop();
    
  } catch (error) {
    elizaLogger.error('Test failed:', error);
  }
}

async function main() {
  // First test Tavily directly
  await testTavilyDirectly();
  
  // Then test with minimal runtime
  await testWithMinimalRuntime();
}

main().catch(console.error); 