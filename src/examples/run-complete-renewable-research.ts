#!/usr/bin/env bun
/**
 * Complete renewable energy research with real LLM support
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { ResearchService } from '../service';
import { elizaLogger, IAgentRuntime, ModelType, Character, asUUID } from '@elizaos/core';
import { ResearchConfig, ResearchStatus } from '../types';
import fs from 'fs/promises';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Create a runtime with real LLM support
const createRealLLMRuntime = (): IAgentRuntime => {
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  let openai: OpenAI | null = null;
  let anthropic: Anthropic | null = null;
  
  if (openaiKey) {
    openai = new OpenAI({ apiKey: openaiKey });
  }
  if (anthropicKey) {
    anthropic = new Anthropic({ apiKey: anthropicKey });
  }

  const testCharacter: Character = {
    name: 'RenewableEnergyExpert',
    bio: ['Expert researcher in renewable energy, energy storage, and environmental sustainability'],
    system: 'You are an expert research assistant specializing in renewable energy, environmental science, and grid-scale energy storage technologies. You provide detailed, accurate, and well-cited analysis.',
    messageExamples: [],
    postExamples: [],
    topics: ['renewable energy', 'energy storage', 'environmental impact', 'grid technology', 'sustainability'],
    adjectives: ['analytical', 'thorough', 'technical', 'precise'],
    knowledge: [],
    plugins: ['research'],
  };

  return {
    agentId: asUUID('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
    character: testCharacter,
    getSetting: (key: string) => {
      const value = process.env[key];
      if (key.includes('API_KEY') && value) {
        elizaLogger.debug(`[Runtime] Found ${key}`);
      }
      return value || null;
    },
    getService: () => null,
    providers: [],
    actions: [],
    evaluators: [],
    plugins: [],
    services: new Map(),
    
    // Real LLM implementation
    useModel: async (modelType: string, params: any) => {
      const messages = params?.messages || [];
      const lastMessage = messages[messages.length - 1];
      
      if (!lastMessage) {
        return { content: 'No message provided' };
      }
      
      elizaLogger.debug(`[LLM] Processing request with ${modelType}`);
      
      try {
        // Prefer Claude for research tasks
        if (anthropic) {
          const response = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 4096,
            messages: messages.map((msg: any) => ({
              role: msg.role === 'system' ? 'user' : msg.role,
              content: msg.role === 'system' ? `<system>${msg.content}</system>` : msg.content
            })),
          });
          
          return { content: response.content[0].type === 'text' ? response.content[0].text : '' };
        } 
        // Fall back to OpenAI
        else if (openai) {
          const response = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: messages,
            max_tokens: 4096,
          });
          
          return { content: response.choices[0].message.content || '' };
        }
        // Last resort: return a simple response
        else {
          elizaLogger.warn('[LLM] No LLM API available, using fallback');
          return { content: 'Analysis complete.' };
        }
      } catch (error) {
        elizaLogger.error('[LLM] Error:', error);
        return { content: `LLM Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
      }
    },
    
    // Memory managers
    messageManager: {
      createMemory: async () => asUUID('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    descriptionManager: {
      createMemory: async () => asUUID('cccccccc-cccc-cccc-cccc-cccccccccccc'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    documentsManager: {
      createMemory: async () => asUUID('dddddddd-dddd-dddd-dddd-dddddddddddd'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    knowledgeManager: {
      createMemory: async () => asUUID('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    loreManager: {
      createMemory: async () => asUUID('ffffffff-ffff-ffff-ffff-ffffffffffff'),
      getMemories: async () => [],
      getMemoriesByRoomIds: async () => [],
      getCachedEmbeddings: async () => [],
      searchMemoriesByEmbedding: async () => [],
    },
    
    stop: async () => {},
  } as any as IAgentRuntime;
};

async function runCompleteResearch() {
  elizaLogger.info('=== Running Complete Renewable Energy Research ===');
  
  const runtime = createRealLLMRuntime();
  const service = new ResearchService(runtime);
  
  const query = "Compare the environmental and economic impacts of different renewable energy storage technologies for grid-scale deployment";
  
  elizaLogger.info(`📋 Research Query: "${query}"`);
  
  try {
    // Create research project with comprehensive configuration
    const config: Partial<ResearchConfig> = {
      searchProviders: ['web', 'academic'],
      maxSearchResults: 10,
      maxDepth: 3,
      enableImages: false,
      evaluationEnabled: false,
      timeout: 120000, // 2 minute timeout
      enableCitations: true,
      language: 'en',
      cacheEnabled: true,
      parallelSearches: 3,
      retryAttempts: 2,
      qualityThreshold: 0.7,
    };
    
    const project = await service.createResearchProject(query, config);
    
    elizaLogger.info(`✅ Project created: ${project.id}`);
    elizaLogger.info(`📊 Status: ${project.status}, Phase: ${project.phase}`);
    
    // Monitor progress
    let lastSourceCount = 0;
    let lastFindingCount = 0;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const current = await service.getProject(project.id);
      if (!current) break;
      
      // Log progress every 5 seconds or when counts change
      if (attempts % 5 === 0 || 
          current.sources.length !== lastSourceCount || 
          current.findings.length !== lastFindingCount) {
        
        elizaLogger.info(`⏳ Progress: ${current.phase} | Sources: ${current.sources.length} | Findings: ${current.findings.length}`);
        
        // Log new sources
        if (current.sources.length > lastSourceCount) {
          const newSources = current.sources.slice(lastSourceCount);
          newSources.forEach(s => {
            elizaLogger.info(`  📄 New source: ${s.title.substring(0, 80)}...`);
          });
          lastSourceCount = current.sources.length;
        }
        
        // Log new findings
        if (current.findings.length > lastFindingCount) {
          const newFindings = current.findings.slice(lastFindingCount);
          elizaLogger.info(`  💡 ${newFindings.length} new findings extracted`);
          lastFindingCount = current.findings.length;
        }
      }
      
      // Check if completed
      if (current.status === ResearchStatus.COMPLETED) {
        elizaLogger.info(`\n✅ Research COMPLETED!`);
        
        if (current.report) {
          // Export and save the report
          const markdown = await service.exportProject(project.id, 'markdown');
          const reportPath = path.join(__dirname, '../../renewable-energy-research-report.md');
          await fs.writeFile(reportPath, markdown);
          
          elizaLogger.info(`📄 Report saved to: ${reportPath}`);
          
          // Analyze report content
          const contentAnalysis = {
            hasEnergy: markdown.toLowerCase().includes('energy'),
            hasStorage: markdown.toLowerCase().includes('storage'),
            hasBattery: markdown.toLowerCase().includes('battery') || markdown.toLowerCase().includes('batteries'),
            hasRenewable: markdown.toLowerCase().includes('renewable'),
            hasEnvironmental: markdown.toLowerCase().includes('environmental'),
            hasEconomic: markdown.toLowerCase().includes('economic'),
            hasGrid: markdown.toLowerCase().includes('grid'),
            wordCount: markdown.split(/\s+/).length,
            sourceCount: current.sources.length,
            findingCount: current.findings.length,
          };
          
          elizaLogger.info('\n📊 Report Analysis:');
          elizaLogger.info(`  - Word count: ${contentAnalysis.wordCount}`);
          elizaLogger.info(`  - Sources: ${contentAnalysis.sourceCount}`);
          elizaLogger.info(`  - Findings: ${contentAnalysis.findingCount}`);
          elizaLogger.info(`  - Contains key terms:`);
          elizaLogger.info(`    • Energy: ${contentAnalysis.hasEnergy ? '✅' : '❌'}`);
          elizaLogger.info(`    • Storage: ${contentAnalysis.hasStorage ? '✅' : '❌'}`);
          elizaLogger.info(`    • Battery: ${contentAnalysis.hasBattery ? '✅' : '❌'}`);
          elizaLogger.info(`    • Renewable: ${contentAnalysis.hasRenewable ? '✅' : '❌'}`);
          elizaLogger.info(`    • Environmental: ${contentAnalysis.hasEnvironmental ? '✅' : '❌'}`);
          elizaLogger.info(`    • Economic: ${contentAnalysis.hasEconomic ? '✅' : '❌'}`);
          elizaLogger.info(`    • Grid: ${contentAnalysis.hasGrid ? '✅' : '❌'}`);
          
          // Show preview
          elizaLogger.info('\n📖 Report Preview:');
          elizaLogger.info('─'.repeat(80));
          elizaLogger.info(markdown.substring(0, 1500) + '...');
          elizaLogger.info('─'.repeat(80));
          
          // Final verdict
          const relevantTermsCount = Object.values(contentAnalysis).filter(v => v === true).length;
          if (relevantTermsCount >= 5) {
            elizaLogger.info('\n🎉 SUCCESS: Report contains highly relevant renewable energy storage content!');
          } else if (relevantTermsCount >= 3) {
            elizaLogger.info('\n⚠️  PARTIAL: Report contains some relevant content but may be incomplete');
          } else {
            elizaLogger.error('\n❌ FAIL: Report does NOT contain relevant renewable energy content');
          }
        } else {
          elizaLogger.warn('⚠️  Research completed but no report generated');
        }
        
        break;
      } else if (current.status === ResearchStatus.FAILED) {
        elizaLogger.error(`❌ Research FAILED: ${current.error}`);
        break;
      }
      
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      elizaLogger.warn('⏱️  Research timed out after 2 minutes');
    }
    
    // Export project data
    const exportData = await service.exportProject(project.id, 'json');
    const exportPath = path.join(__dirname, '../../renewable-energy-research-export.json');
    await fs.writeFile(exportPath, exportData);
    elizaLogger.info(`💾 Full project data exported to: ${exportPath}`);
    
    await service.stop();
    
  } catch (error) {
    elizaLogger.error('❌ Research failed with error:', error);
  }
  
  elizaLogger.info('\n=== Research Complete ===');
}

// Run the research
runCompleteResearch().catch(console.error); 