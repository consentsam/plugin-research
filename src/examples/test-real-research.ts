import { IAgentRuntime, elizaLogger } from '@elizaos/core';
import { ResearchService } from '../service';

export async function testRealResearch(runtime: IAgentRuntime) {
  elizaLogger.info('🔬 Testing Real Research Functionality');
  
  const service = runtime.getService<ResearchService>('research');
  if (!service) {
    elizaLogger.error('Research service not available');
    return;
  }
  
  // Test 1: Simple research query
  elizaLogger.info('\n📚 Test 1: Simple Research Query');
  const project1 = await service.createResearchProject(
    'Latest developments in quantum computing 2024',
    { maxSearchResults: 3 }
  );
  
  elizaLogger.info(`Created project: ${project1.id}`);
  elizaLogger.info(`Query: ${project1.query}`);
  elizaLogger.info(`Status: ${project1.status}`);
  
  // Wait a bit and check progress
  let checkCount = 0;
  const checkInterval = setInterval(async () => {
    checkCount++;
    const current = await service.getProject(project1.id);
    if (!current) return;
    
    elizaLogger.info(`Progress: Phase=${current.phase}, Sources=${current.sources.length}, Findings=${current.findings.length}`);
    
    // Sample a finding if available
    if (current.findings.length > 0 && checkCount === 1) {
      const sample = current.findings[0];
      elizaLogger.info(`Sample finding: "${sample.content.substring(0, 200)}..."`);
      elizaLogger.info(`From source: ${sample.source.title} (${sample.source.url})`);
    }
    
    // Check if completed or timeout
    if (current.status === 'completed' || current.status === 'failed' || checkCount > 30) {
      clearInterval(checkInterval);
      
      if (current.status === 'completed') {
        elizaLogger.success(`✅ Research completed successfully!`);
        elizaLogger.info(`Final results: ${current.sources.length} sources, ${current.findings.length} findings`);
        
        if (current.report) {
          elizaLogger.info(`Report generated with ${current.report.sections.length} sections`);
        }
      } else if (current.status === 'failed') {
        elizaLogger.error(`❌ Research failed: ${current.error}`);
      } else {
        elizaLogger.warn(`⏱️  Research timed out after ${checkCount * 5} seconds`);
      }
    }
  }, 5000); // Check every 5 seconds
}

// Test runner
export async function runRealResearchTests(runtime: IAgentRuntime) {
  try {
    await testRealResearch(runtime);
  } catch (error) {
    elizaLogger.error('Test failed:', error);
  }
} 