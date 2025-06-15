# DeFi Research Implementation Guide

## Overview

This guide demonstrates how to implement and use the Deep Research plugin's DeFi-specific scenarios and actions. The plugin provides specialized research capabilities for DeFi security, yield farming, MEV, gas optimization, cross-chain bridges, and more.

## Quick Start

### 1. Basic DeFi Security Research

```typescript
import { IAgentRuntime } from '@elizaos/core';
import { executeDeFiScenario, DEFI_SCENARIOS } from '@elizaos/plugin-research/scenarios/defi-scenarios';

async function securityResearch(runtime: IAgentRuntime) {
  // Start a security research project
  const project = await executeDeFiScenario(
    runtime,
    DEFI_SCENARIOS.SMART_CONTRACT_SECURITY,
    'Aave v3 reentrancy vulnerabilities 2024'
  );
  
  console.log(`Research started: ${project.id}`);
  
  // Monitor progress
  const service = runtime.getService('research');
  const status = await service.getProject(project.id);
  console.log(`Current phase: ${status.phase}`);
}
```

### 2. Yield Farming Analysis

```typescript
async function yieldAnalysis(runtime: IAgentRuntime) {
  const project = await executeDeFiScenario(
    runtime,
    DEFI_SCENARIOS.YIELD_FARMING_OPTIMIZATION,
    'Arbitrum Optimism stablecoin yield farming low risk'
  );
  
  // Wait for completion
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // Get the report
  const report = generateScenarioReport(
    DEFI_SCENARIOS.YIELD_FARMING_OPTIMIZATION,
    project
  );
  
  console.log(report);
}
```

## Available DeFi Actions

### 1. defi_security_research

Conducts deep security analysis of DeFi protocols.

```typescript
// Example usage in chat
User: "Research security vulnerabilities in Aave v3"
Assistant: "I'll conduct a comprehensive security analysis of Aave v3."
// Triggers defi_security_research action
```

### 2. analyze_yield_farming

Analyzes yield farming opportunities across chains.

```typescript
// Example usage
User: "Find the best yield farming opportunities on Arbitrum and Optimism"
Assistant: "I'll analyze yield farming opportunities on Arbitrum and Optimism."
// Triggers analyze_yield_farming action
```

### 3. research_mev

Researches MEV strategies and protection mechanisms.

```typescript
// Example usage
User: "Research MEV protection strategies for DEX trading"
Assistant: "I'll research MEV protection strategies and their implementations."
// Triggers research_mev action
```

### 4. analyze_gas_optimization

Provides Solidity gas optimization techniques.

```typescript
// Example usage
User: "Show me Solidity gas optimization techniques"
Assistant: "I'll research advanced gas optimization techniques for Solidity."
// Triggers analyze_gas_optimization action
```

### 5. analyze_bridge_security

Analyzes cross-chain bridge security.

```typescript
// Example usage
User: "Analyze LayerZero bridge security architecture"
Assistant: "I'll analyze LayerZero's cross-chain bridge security architecture."
// Triggers analyze_bridge_security action
```

### 6. comprehensive_defi_analysis

Runs analysis across multiple DeFi areas.

```typescript
// Example usage
User: "Do a comprehensive DeFi analysis covering security, yield, and MEV"
Assistant: "I'll conduct a comprehensive DeFi analysis across multiple areas."
// Triggers comprehensive_defi_analysis action
```

### 7. setup_defi_monitoring

Sets up real-time monitoring for DeFi events.

```typescript
// Example usage
User: "Set up monitoring for DeFi security incidents"
Assistant: "I'll set up real-time monitoring for DeFi security incidents."
// Triggers setup_defi_monitoring action
```

## Advanced Implementation Examples

### Custom Security Analysis with Report Generation

```typescript
import { 
  executeDeFiScenario, 
  DEFI_SCENARIOS,
  generateScenarioReport 
} from '@elizaos/plugin-research/scenarios/defi-scenarios';

async function customSecurityAnalysis(runtime: IAgentRuntime) {
  // Execute security research with custom query
  const project = await executeDeFiScenario(
    runtime,
    DEFI_SCENARIOS.SMART_CONTRACT_SECURITY,
    'Flash loan reentrancy attacks Compound Finance 2024'
  );
  
  // Wait for research to complete
  let completed = false;
  while (!completed) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const status = await runtime.getService('research').getProject(project.id);
    completed = status.status === 'completed';
  }
  
  // Generate specialized security report
  const report = generateScenarioReport(
    DEFI_SCENARIOS.SMART_CONTRACT_SECURITY,
    project
  );
  
  // Extract critical findings
  const criticalFindings = project.findings
    .filter(f => f.relevance > 0.8)
    .map(f => ({
      content: f.content,
      source: f.sourceId,
      relevance: f.relevance
    }));
  
  return {
    report,
    criticalFindings,
    vulnerabilitiesFound: criticalFindings.length
  };
}
```

### Batch DeFi Research

```typescript
import { executeDeFiScenarioBatch } from '@elizaos/plugin-research/scenarios/defi-scenarios';

async function batchDeFiResearch(runtime: IAgentRuntime) {
  // Run multiple scenarios in batch
  const scenarios = [
    DEFI_SCENARIOS.SMART_CONTRACT_SECURITY,
    DEFI_SCENARIOS.YIELD_FARMING_OPTIMIZATION,
    DEFI_SCENARIOS.MEV_RESEARCH,
    DEFI_SCENARIOS.GAS_OPTIMIZATION
  ];
  
  const results = await executeDeFiScenarioBatch(runtime, scenarios);
  
  // Process results
  for (const [scenario, project] of results) {
    console.log(`Scenario: ${scenario}`);
    console.log(`Findings: ${project.findings.length}`);
    console.log(`Sources: ${project.sources.length}`);
  }
  
  return results;
}
```

### Real-Time DeFi Monitoring

```typescript
import { setupDeFiMonitoring } from '@elizaos/plugin-research/scenarios/defi-scenarios';

async function monitorDeFiSecurity(runtime: IAgentRuntime) {
  const monitoring = await setupDeFiMonitoring(runtime, {
    scenarios: [
      DEFI_SCENARIOS.SMART_CONTRACT_SECURITY,
      DEFI_SCENARIOS.MEV_RESEARCH
    ],
    interval: 5 * 60 * 1000, // 5 minutes
    alertThreshold: 0.8, // High relevance only
    onAlert: (project, finding) => {
      console.log('🚨 DEFI ALERT:', {
        topic: project.query,
        relevance: finding.relevance,
        finding: finding.content.substring(0, 200)
      });
      
      // Send alert to Discord/Telegram/etc
      notifySecurityTeam({
        severity: 'high',
        protocol: extractProtocolFromQuery(project.query),
        finding: finding
      });
    }
  });
  
  // Stop monitoring after 24 hours
  setTimeout(() => {
    clearInterval(monitoring);
    console.log('Monitoring stopped');
  }, 24 * 60 * 60 * 1000);
}
```

### Comprehensive Report Generation

```typescript
import { generateComprehensiveDeFiReport } from '@elizaos/plugin-research/scenarios/defi-scenarios';

async function generateFullReport(runtime: IAgentRuntime) {
  const scenarios = [
    DEFI_SCENARIOS.SMART_CONTRACT_SECURITY,
    DEFI_SCENARIOS.YIELD_FARMING_OPTIMIZATION,
    DEFI_SCENARIOS.MEV_RESEARCH,
    DEFI_SCENARIOS.GAS_OPTIMIZATION,
    DEFI_SCENARIOS.CROSS_CHAIN_BRIDGES
  ];
  
  const report = await generateComprehensiveDeFiReport(runtime, scenarios);
  
  // Save report to file
  const fs = require('fs');
  fs.writeFileSync(
    `defi-report-${new Date().toISOString()}.md`,
    report
  );
  
  // Extract key metrics
  const metrics = extractMetricsFromReport(report);
  console.log('Report Metrics:', metrics);
  
  return report;
}
```

## Integration with ElizaOS Agents

### Agent Configuration

```typescript
// agent-config.ts
import { researchPlugin } from '@elizaos/plugin-research';

export default {
  name: 'DeFi Research Agent',
  plugins: [researchPlugin],
  settings: {
    voice: {
      model: 'en_US-male-medium'
    }
  },
  bio: [
    'Expert in DeFi security analysis and research',
    'Specializes in smart contract vulnerabilities',
    'Provides yield farming optimization strategies',
    'Analyzes MEV and cross-chain bridge security'
  ],
  modelProvider: 'openai',
  model: 'gpt-4-turbo-preview'
};
```

### Custom Agent Actions

```typescript
// custom-defi-agent.ts
import { Agent } from '@elizaos/core';
import { researchPlugin } from '@elizaos/plugin-research';

class DeFiResearchAgent extends Agent {
  async onMessage(message: Message) {
    // Custom logic for DeFi-specific messages
    if (message.content.includes('vulnerability') || 
        message.content.includes('exploit')) {
      // Automatically trigger security research
      await this.runtime.processAction(
        'defi_security_research',
        message
      );
    }
    
    // Continue with normal processing
    return super.onMessage(message);
  }
  
  async generateDailyReport() {
    // Generate daily DeFi security report
    const scenarios = [
      DEFI_SCENARIOS.SMART_CONTRACT_SECURITY,
      DEFI_SCENARIOS.MEV_RESEARCH
    ];
    
    const report = await generateComprehensiveDeFiReport(
      this.runtime,
      scenarios
    );
    
    // Post to Discord/Telegram
    await this.postToChannel(report);
  }
}
```

## Best Practices

### 1. Query Optimization

```typescript
// Good: Specific and targeted
const query = "Aave v3 flash loan reentrancy vulnerabilities 2024";

// Less effective: Too broad
const query = "DeFi vulnerabilities";
```

### 2. Error Handling

```typescript
try {
  const project = await executeDeFiScenario(
    runtime,
    DEFI_SCENARIOS.SMART_CONTRACT_SECURITY,
    query
  );
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, 60000));
    return retry();
  }
  throw error;
}
```

### 3. Resource Management

```typescript
// Use batching for multiple scenarios
const results = await executeDeFiScenarioBatch(runtime, scenarios);

// Add delays between requests
for (const scenario of scenarios) {
  await executeDeFiScenario(runtime, scenario);
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

### 4. Result Caching

```typescript
const cache = new Map();

async function getCachedOrResearch(scenario, query) {
  const cacheKey = `${scenario}-${query}`;
  
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < 3600000) { // 1 hour
      return cached.data;
    }
  }
  
  const result = await executeDeFiScenario(runtime, scenario, query);
  cache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  });
  
  return result;
}
```

## Troubleshooting

### Common Issues

1. **Rate Limiting**
   - Add delays between requests
   - Use batch operations
   - Implement exponential backoff

2. **Memory Usage**
   - Process large reports in chunks
   - Clear completed projects periodically
   - Use streaming for real-time monitoring

3. **Timeout Issues**
   - Increase timeout for complex scenarios
   - Break down large queries
   - Use phase-based progress tracking

### Debug Mode

```typescript
// Enable debug logging
process.env.DEBUG = 'eliza:plugin-research:*';

// Track research progress
const service = runtime.getService('research');
service.on('phaseChange', (project, phase) => {
  console.log(`Project ${project.id} entered phase: ${phase}`);
});
```

## API Reference

See the [API documentation](./api-integration.md) for detailed method signatures and parameters.

## Examples Repository

For more examples, visit: https://github.com/elizaos/plugin-research-examples 