#!/usr/bin/env bun
/**
 * Test script specifically for renewable energy storage research
 */

// Load environment variables
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { ResearchService } from '../service';
import { elizaLogger, IAgentRuntime, ModelType, Character, UUID, asUUID } from '@elizaos/core';
import { ResearchConfig, ResearchStatus } from '../types';
import fs from 'fs/promises';

// Create a more complete runtime with real model support
const createRealRuntime = (): IAgentRuntime => {
  const testCharacter: Character = {
    name: 'EnergyResearcher',
    bio: ['An expert researcher focused on renewable energy and sustainability'],
    system: 'You are an expert research assistant specializing in renewable energy, environmental science, and grid-scale energy storage technologies.',
    messageExamples: [],
    postExamples: [],
    topics: ['renewable energy', 'energy storage', 'environmental impact', 'grid technology'],
    adjectives: ['analytical', 'thorough', 'technical'],
    knowledge: [],
    plugins: ['research'],
  };

  return {
    agentId: asUUID('12345678-1234-1234-1234-123456789012'),
    character: testCharacter,
    getSetting: (key: string) => {
      const value = process.env[key];
      if (key.includes('API_KEY') && value) {
        elizaLogger.debug(`[Runtime] Found ${key}`);
      }
      return value || null;
    },
    getService: (name: string) => null,
    providers: [],
    actions: [],
    evaluators: [],
    plugins: [],
    services: new Map(),
    
    // Simplified model that returns reasonable responses
    useModel: async (modelType: string, params: any) => {
      const messages = params?.messages || [];
      const lastMessage = messages[messages.length - 1]?.content || '';
      
      elizaLogger.debug(`[Model ${modelType}] Processing:`, lastMessage.substring(0, 100) + '...');
      
      // Handle different types of model requests
      if (lastMessage.includes('Analyze this research query')) {
        return {
          content: JSON.stringify({
            domain: 'ENGINEERING',
            taskType: 'comparative',
            temporalFocus: 'current',
            geographicScope: ['global'],
            requiredExpertise: ['energy storage', 'environmental science', 'economics'],
            expectedSourceTypes: ['academic', 'technical', 'government']
          })
        };
      } else if (lastMessage.includes('Generate sub-queries')) {
        return {
          content: `PURPOSE: Compare different storage technologies
QUERY: lithium-ion batteries environmental impact grid scale
TYPE: comparative
PRIORITY: high
---
PURPOSE: Economic analysis of storage technologies
QUERY: grid scale energy storage cost comparison economics
TYPE: statistical
PRIORITY: high
---
PURPOSE: Environmental lifecycle assessment
QUERY: renewable energy storage lifecycle assessment environmental impact
TYPE: analytical
PRIORITY: medium`
        };
      } else if (lastMessage.includes('Extract key findings')) {
        return {
          content: JSON.stringify([{
            content: "Based on the analysis, lithium-ion batteries currently dominate grid-scale storage with 90% market share, but face environmental challenges in mining and disposal.",
            relevance: 0.95,
            confidence: 0.9,
            category: "fact"
          }])
        };
      } else if (lastMessage.includes('research findings')) {
        return {
          content: "The research reveals that while lithium-ion batteries currently dominate grid-scale energy storage, alternative technologies like flow batteries and compressed air storage show promise for specific applications with potentially lower environmental impacts."
        };
      }
      
      // Default response
      return { content: "Analysis complete. Findings integrated into research report." };
    },
    
    // Memory managers
    messageManager: {
      createMemory: async () => asUUID('12345678-1234-1234-1234-123456789013'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    descriptionManager: {
      createMemory: async () => asUUID('12345678-1234-1234-1234-123456789014'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    documentsManager: {
      createMemory: async () => asUUID('12345678-1234-1234-1234-123456789015'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    knowledgeManager: {
      createMemory: async () => asUUID('12345678-1234-1234-1234-123456789016'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    loreManager: {
      createMemory: async () => asUUID('12345678-1234-1234-1234-123456789017'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    
    stop: async () => {},
  } as any as IAgentRuntime;
};

async function testRenewableEnergyResearch() {
  elizaLogger.info('=== Testing Renewable Energy Storage Research ===');
  
  const runtime = createRealRuntime();
  const service = new ResearchService(runtime);
  
  const query = "Compare the environmental and economic impacts of different renewable energy storage technologies for grid-scale deployment";
  
  elizaLogger.info(`Research Query: "${query}"`);
  
  try {
    // Create research project with specific configuration
    const config: Partial<ResearchConfig> = {
      searchProviders: ['web', 'academic'],
      maxSearchResults: 10,
      maxDepth: 3,
      enableImages: false,
      evaluationEnabled: false,
    };
    
    const project = await service.createResearchProject(query, config);
    
    elizaLogger.info('✅ Project created successfully:', {
      id: project.id,
      status: project.status,
    });
    
    // Wait for research to complete (max 30 seconds)
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const currentProject = await service.getProject(project.id);
      if (!currentProject) break;
      
      elizaLogger.info(`Progress: ${currentProject.phase} - Sources: ${currentProject.sources.length}, Findings: ${currentProject.findings.length}`);
      
      if (currentProject.status === ResearchStatus.COMPLETED || 
          currentProject.status === ResearchStatus.FAILED) {
        elizaLogger.info(`Research ${currentProject.status}`);
        
        // Save the report if completed
        if (currentProject.report) {
          // Export as markdown
          const markdownReport = await service.exportProject(project.id, 'markdown');
          const reportPath = path.join(__dirname, '../../test-renewable-energy-report.md');
          await fs.writeFile(reportPath, markdownReport);
          elizaLogger.info(`✅ Report saved to: ${reportPath}`);
          
          // Show first 500 chars of the report
          elizaLogger.info('\n📄 Report Preview:\n' + markdownReport.substring(0, 500) + '...\n');
          
          // Check if report contains renewable energy content
          const hasRelevantContent = markdownReport.toLowerCase().includes('energy') ||
                                    markdownReport.toLowerCase().includes('storage') ||
                                    markdownReport.toLowerCase().includes('battery');
          
          if (hasRelevantContent) {
            elizaLogger.info('✅ Report contains relevant renewable energy content!');
          } else {
            elizaLogger.error('❌ Report does NOT contain relevant renewable energy content!');
          }
        }
        
        break;
      }
      
      attempts++;
    }
    
    // Export the project data for analysis
    const exportData = await service.exportProject(project.id, 'json');
    const exportPath = path.join(__dirname, '../../test-renewable-energy-export.json');
    await fs.writeFile(exportPath, exportData);
    elizaLogger.info(`✅ Project data exported to: ${exportPath}`);
    
    await service.stop();
    
  } catch (error) {
    elizaLogger.error('❌ Test failed:', error);
  }
  
  elizaLogger.info('=== Test Complete ===');
}

// Run the test
testRenewableEnergyResearch().catch(console.error); 