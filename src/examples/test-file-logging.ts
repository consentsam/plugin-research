#!/usr/bin/env bun
/**
 * Test file logging functionality with a simple research example
 */

import { ResearchService } from '../service';
import { IAgentRuntime } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

// Enable file logging
process.env.FILE_LOGGING = 'true';

// Create a simple runtime
const runtime = {
  getSetting: (key: string) => {
    if (key === 'FILE_LOGGING') return 'true';
    if (key === 'TAVILY_API_KEY') return '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';
    return null;
  },
  useModel: async () => 'Mock response',
  logger: {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: () => {},
  },
  getService: () => null,
} as unknown as IAgentRuntime;

async function testFileLogging() {
  console.log('🧪 Testing File Logging Functionality\n');

  // Create research service
  const service = new ResearchService(runtime);

  // Create sources first
  const source1 = {
    id: uuidv4(),
    url: 'https://example.com/ai-research',
    title: 'Latest AI Research 2024',
    content: 'This is a test source about AI advancements...',
    accessedAt: Date.now(),
    type: 'web' as const,
    reliability: 0.9,
    metadata: {
      author: ['Test Author'],
      publishDate: '2024-01-15',
      domain: 'example.com',
      language: 'en',
    },
  };

  const source2 = {
    id: uuidv4(),
    url: 'https://example.org/machine-learning',
    title: 'Machine Learning Breakthroughs',
    content: 'Recent breakthroughs in machine learning include...',
    accessedAt: Date.now(),
    type: 'web' as const,
    reliability: 0.85,
    metadata: {
      author: ['ML Expert'],
      publishDate: '2024-02-20',
      domain: 'example.org',
      language: 'en',
    },
  };

  // Create a mock research project
  const projectId = uuidv4();
  const mockProject = {
    id: projectId,
    query: 'Test research about AI advancements',
    status: 'completed' as const,
    phase: 'reporting' as const,
    createdAt: Date.now(),
    completedAt: Date.now() + 5000,
    sources: [source1, source2],
    findings: [
      {
        id: uuidv4(),
        content: 'Large language models have shown significant improvements in reasoning capabilities.',
        source: source1,
        relevance: 0.95,
        confidence: 0.9,
        category: 'llm',
        timestamp: Date.now(),
        citations: [],
        factualClaims: [
          {
            id: uuidv4(),
            statement: 'LLMs show improved reasoning',
            supportingEvidence: ['Research shows LLMs can solve complex problems'],
            sourceUrls: ['https://example.com/ai-research'],
            verificationStatus: 'verified' as const,
            confidenceScore: 0.9,
            relatedClaims: [],
          },
        ],
        relatedFindings: [],
        verificationStatus: 'verified' as const,
        extractionMethod: 'manual',
      },
      {
        id: uuidv4(),
        content: 'Multimodal AI systems can now process text, images, and audio simultaneously.',
        source: source2,
        relevance: 0.9,
        confidence: 0.85,
        category: 'multimodal',
        timestamp: Date.now(),
        citations: [],
        factualClaims: [
          {
            id: uuidv4(),
            statement: 'Multimodal AI processes multiple data types',
            supportingEvidence: ['Systems can handle text, images, and audio'],
            sourceUrls: ['https://example.org/machine-learning'],
            verificationStatus: 'verified' as const,
            confidenceScore: 0.85,
            relatedClaims: [],
          },
        ],
        relatedFindings: [],
        verificationStatus: 'verified' as const,
        extractionMethod: 'manual',
      },
    ],
    metadata: {
      domain: 'computer_science',
      taskType: 'analytical',
      depth: 'comprehensive',
      synthesis: 'The year 2024 has witnessed remarkable advances in artificial intelligence, particularly in large language models and multimodal systems. LLMs have demonstrated enhanced reasoning capabilities, while multimodal systems have achieved unprecedented integration across different data types.',
      categoryAnalysis: {
        llm: 'Large language models have evolved to show emergent reasoning abilities, with improvements in mathematical problem-solving and logical deduction.',
        multimodal: 'Multimodal AI represents a significant leap forward, enabling systems to understand and generate content across multiple modalities seamlessly.',
      },
    },
    report: null,
  };

  // Store the project
  (service as any).projects.set(projectId, mockProject);

  // Generate report (this will trigger file saving)
  console.log('📝 Generating report...');
  await (service as any).generateReport(mockProject);

  console.log('✅ Report generation complete\n');

  // Check if files were created
  const logsDir = path.join(process.cwd(), 'research_logs');
  
  try {
    const files = await fs.readdir(logsDir);
    console.log('📁 Files created in research_logs/:');
    
    const mdFiles = files.filter(f => f.endsWith('.md'));
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    if (mdFiles.length > 0) {
      console.log('\nMarkdown files:');
      mdFiles.forEach(file => console.log(`  📄 ${file}`));
    }
    
    if (jsonFiles.length > 0) {
      console.log('\nJSON files:');
      jsonFiles.forEach(file => console.log(`  📊 ${file}`));
    }

    // Read and display the first markdown file
    if (mdFiles.length > 0) {
      console.log('\n📖 Preview of the first report:\n');
      console.log('─'.repeat(80));
      
      const content = await fs.readFile(path.join(logsDir, mdFiles[0]), 'utf-8');
      // Show first 50 lines
      const lines = content.split('\n');
      const preview = lines.slice(0, 50).join('\n');
      console.log(preview);
      
      if (lines.length > 50) {
        console.log(`\n... (${lines.length - 50} more lines)`);
      }
      console.log('─'.repeat(80));
      
      console.log(`\n💡 To view the full report, run:`);
      console.log(`   cat research_logs/${mdFiles[0]}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking files:', error);
  }
}

// Run the test
testFileLogging().catch(console.error); 