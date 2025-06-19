#!/usr/bin/env bun
/**
 * Example script showing how to save research outputs to files
 * Run with: bun run src/examples/save-research-output.ts
 */

import { ResearchService } from '../service';
import { IAgentRuntime } from '@elizaos/core';
import fs from 'fs/promises';
import path from 'path';

// Create a mock runtime for demonstration
const mockRuntime = {
  getSetting: (key: string) => {
    const settings: Record<string, string> = {
      TAVILY_API_KEY: process.env.TAVILY_API_KEY || '',
      EXA_API_KEY: process.env.EXA_API_KEY || '',
      SERPAPI_API_KEY: process.env.SERPAPI_API_KEY || '',
      FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY || '',
    };
    return settings[key];
  },
  useModel: async () => 'mock response',
  logger: {
    info: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  },
  getService: () => null,
} as unknown as IAgentRuntime;

async function saveResearchOutputs() {
  console.log('🔬 ElizaOS Research Plugin - Output Example\n');
  
  // Create research service
  const service = new ResearchService(mockRuntime);
  
  // Start a research project
  console.log('1️⃣ Starting research project...');
  const project = await service.createResearchProject(
    'What are the latest breakthroughs in quantum computing in 2024?'
  );
  
  console.log(`   Project ID: ${project.id}`);
  console.log(`   Status: ${project.status}`);
  
  // Wait for research to complete (in real usage, this would take longer)
  console.log('\n2️⃣ Waiting for research to complete...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Get the updated project
  const completedProject = await service.getProject(project.id);
  
  if (!completedProject) {
    console.error('❌ Project not found');
    return;
  }
  
  // Create output directory
  const outputDir = path.join(process.cwd(), 'research-outputs', project.id);
  await fs.mkdir(outputDir, { recursive: true });
  console.log(`\n3️⃣ Created output directory: ${outputDir}`);
  
  // Save different formats
  console.log('\n4️⃣ Saving research outputs...\n');
  
  try {
    // 1. Save as JSON (complete project data)
    const jsonPath = path.join(outputDir, 'research-complete.json');
    const jsonData = await service.exportProject(project.id, 'json');
    await fs.writeFile(jsonPath, jsonData, 'utf-8');
    console.log(`   ✅ JSON saved to: ${jsonPath}`);
    
    // 2. Save as Markdown (human-readable report)
    const mdPath = path.join(outputDir, 'research-report.md');
    const mdData = await service.exportProject(project.id, 'markdown');
    await fs.writeFile(mdPath, mdData, 'utf-8');
    console.log(`   ✅ Markdown saved to: ${mdPath}`);
    
    // 3. Save as DeepResearch Bench format
    const benchPath = path.join(outputDir, 'deepresearch-bench.json');
    const benchData = await service.exportProject(project.id, 'deepresearch');
    await fs.writeFile(benchPath, benchData, 'utf-8');
    console.log(`   ✅ DeepResearch format saved to: ${benchPath}`);
    
    // 4. Save metadata separately
    const metaPath = path.join(outputDir, 'metadata.json');
    const metadata = {
      projectId: project.id,
      query: project.query,
      status: completedProject.status,
      createdAt: new Date(project.createdAt).toISOString(),
      completedAt: completedProject.completedAt ? new Date(completedProject.completedAt).toISOString() : null,
      domain: completedProject.metadata.domain,
      taskType: completedProject.metadata.taskType,
      sourceCount: completedProject.sources.length,
      findingCount: completedProject.findings.length,
      evaluationScore: completedProject.evaluationResults?.overallScore || 'Not evaluated',
    };
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`   ✅ Metadata saved to: ${metaPath}`);
    
    // 5. Create a summary file
    const summaryPath = path.join(outputDir, 'summary.txt');
    const summary = `Research Summary
================
Query: ${project.query}
Status: ${completedProject.status}
Domain: ${completedProject.metadata.domain}
Sources Found: ${completedProject.sources.length}
Key Findings: ${completedProject.findings.length}

Top Findings:
${completedProject.findings
  .sort((a, b) => b.relevance - a.relevance)
  .slice(0, 5)
  .map((f, i) => `${i + 1}. ${f.content.substring(0, 150)}...`)
  .join('\n')}
`;
    await fs.writeFile(summaryPath, summary, 'utf-8');
    console.log(`   ✅ Summary saved to: ${summaryPath}`);
    
  } catch (error) {
    console.error('❌ Error saving outputs:', error);
  }
  
  console.log('\n5️⃣ All outputs saved successfully!');
  console.log(`\n📁 View your research outputs in: ${outputDir}`);
}

// Run the example
saveResearchOutputs().catch(console.error); 