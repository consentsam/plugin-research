#!/usr/bin/env bun
/**
 * Run real research with file logging enabled
 * This will save outputs to research_logs/ directory
 */

import { ResearchService } from '../service';
import { IAgentRuntime } from '@elizaos/core';
import { config } from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

// Load environment variables
config();

// Enable file logging
process.env.FILE_LOGGING = 'true';

// Create runtime with real API keys - NO HARD-CODED FALLBACKS
const runtime = {
  getSetting: (key: string) => {
    if (key === 'FILE_LOGGING') return 'true';
    const value = process.env[key];
    if (!value) {
      console.warn(`⚠️  Environment variable ${key} not found`);
    }
    return value || null;
  },
  useModel: async (type: any, params: any) => {
    // This example file should be updated to use real API calls
    throw new Error('This example file needs to be updated to use real LLM APIs. Use the real-runtime.ts implementation instead.');
  },
  logger: {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: () => {}, // Suppress debug logs for cleaner output
  },
  getService: () => null,
} as unknown as IAgentRuntime;

async function runRealResearch() {
  console.log('🔬 ElizaOS Research Plugin - Real Research Demo\n');
  console.log('📁 File logging enabled - outputs will be saved to research_logs/\n');

  // Create research service
  const service = new ResearchService(runtime);

  // Research queries to test
  const queries = [
    'What are the latest breakthroughs in AI and machine learning in 2024?',
    'Compare the environmental policies of Nordic countries',
    'Analyze the impact of remote work on productivity post-pandemic'
  ];

  console.log(`Running ${queries.length} research projects...\n`);

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Research ${i + 1}/${queries.length}: ${query}`);
    console.log('='.repeat(80) + '\n');

    try {
      // Start research
      console.log('🚀 Starting research...');
      const project = await service.createResearchProject(query);
      console.log(`📋 Project ID: ${project.id}`);
      console.log(`🏷️  Domain: ${project.metadata.domain}`);
      console.log(`📊 Task Type: ${project.metadata.taskType}`);

      // Wait for research to complete
      console.log('\n⏳ Research in progress...');
      
      // Check status periodically
      let completed = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      
      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const currentProject = await service.getProject(project.id);
        
        if (currentProject) {
          process.stdout.write(`\r📍 Status: ${currentProject.status} | Phase: ${currentProject.phase || 'N/A'}`);
          
          if (currentProject.status === 'completed' || currentProject.status === 'failed') {
            completed = true;
            console.log('\n');
          }
        }
        attempts++;
      }

      // Get final project state
      const finalProject = await service.getProject(project.id);
      
      if (finalProject) {
        console.log(`\n✅ Research Status: ${finalProject.status}`);
        console.log(`📑 Sources Found: ${finalProject.sources.length}`);
        console.log(`💡 Key Findings: ${finalProject.findings.length}`);
        
        if (finalProject.report) {
          console.log(`📝 Report Generated: ${finalProject.report.wordCount} words`);
          console.log(`⏱️  Reading Time: ${finalProject.report.readingTime} minutes`);
        }
        
        // The report should already be saved by the service
        console.log('\n📁 Files saved to research_logs/ directory');
      }

    } catch (error) {
      console.error(`\n❌ Error with research: ${error}`);
    }

    // Small delay between research projects
    if (i < queries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Show saved files
  console.log('\n' + '='.repeat(80));
  console.log('📂 Research Outputs Saved:\n');
  
  try {
    const logsDir = path.join(process.cwd(), 'research_logs');
    const files = await fs.readdir(logsDir);
    const mdFiles = files.filter(f => f.endsWith('.md')).sort();
    
    if (mdFiles.length > 0) {
      console.log('Markdown Reports:');
      mdFiles.forEach(file => {
        console.log(`  📄 ${file}`);
      });
      
      console.log('\n💡 To view a report, run:');
      console.log(`   cat research_logs/${mdFiles[0]}`);
      
      console.log('\n💡 To view all reports:');
      console.log('   ls -la research_logs/');
    } else {
      console.log('No reports found in research_logs/');
    }
  } catch (error) {
    console.log('research_logs/ directory not found yet');
  }
}

// Run the research
runRealResearch().catch(console.error); 