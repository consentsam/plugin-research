import {
  Action,
  ActionExample,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
  ModelType,
  elizaLogger,
} from '@elizaos/core';
import { ResearchService } from '../service';
import {
  DEFI_SCENARIOS,
  DeFiScenarioType,
  executeDeFiScenario,
  generateScenarioReport,
  generateComprehensiveDeFiReport,
  setupDeFiMonitoring,
} from '../scenarios/defi-scenarios';

/**
 * Action to start a specialized DeFi security research project
 */
export const defiSecurityResearchAction: Action = {
  name: 'defi_security_research',
  description: 'Conduct deep security analysis of DeFi protocols, vulnerabilities, and audit reports',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    return !!researchService;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) {
    try {
      // Extract protocol or topic from message
      const extractionPrompt = `Extract the DeFi protocol or security topic from the user's message.
      
User message: "${message.content.text}"

Respond with a JSON object:
{
  "protocol": "specific protocol name if mentioned (e.g., Aave, Compound)",
  "topic": "security focus area (e.g., reentrancy, flash loans, oracle manipulation)",
  "timeframe": "time period if mentioned (e.g., 2024, last month)"
}`;

      const extraction = await runtime.useModel(ModelType.TEXT_LARGE, {
        messages: [{ role: 'user', content: extractionPrompt }],
      });

      let params;
      try {
        const responseContent = typeof extraction === 'string' 
          ? extraction 
          : (extraction as any).response || (extraction as any).content || '';
        params = JSON.parse(responseContent);
      } catch (e) {
        params = {
          protocol: '',
          topic: 'general security',
          timeframe: '2024'
        };
      }

      // Build custom query
      const query = `${params.protocol} ${params.topic} vulnerabilities security audit ${params.timeframe}`.trim();
      
      // Execute security scenario
      const project = await executeDeFiScenario(
        runtime,
        DEFI_SCENARIOS.SMART_CONTRACT_SECURITY,
        query
      );

      const response = {
        text: `I've started a comprehensive DeFi security analysis focusing on ${params.protocol || 'DeFi protocols'} ${params.topic}.

Project ID: ${project.id}
Scope: Security vulnerabilities, audit reports, and exploit analysis
Sources: Searching security databases, audit firms, and vulnerability reports

I'll analyze:
- Known vulnerabilities and exploits
- Security audit findings
- Best practice violations
- Potential attack vectors
- Mitigation strategies

The analysis will include code examples and specific recommendations.`,
        metadata: { project, scenario: DEFI_SCENARIOS.SMART_CONTRACT_SECURITY },
      };

      if (callback) await callback(response);
      return response;

    } catch (error) {
      elizaLogger.error('DeFi security research failed:', error);
      throw error;
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Research security vulnerabilities in Aave v3',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll conduct a comprehensive security analysis of Aave v3.",
          action: 'defi_security_research',
        },
      },
    ],
    [
      {
        name: '{{user}}',
        content: {
          text: 'Analyze flash loan attack vectors in DeFi lending protocols',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll research flash loan attack vectors across DeFi lending protocols.",
          action: 'defi_security_research',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Action to analyze yield farming opportunities
 */
export const yieldFarmingAnalysisAction: Action = {
  name: 'analyze_yield_farming',
  description: 'Analyze and compare yield farming opportunities across different chains and protocols',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    return !!researchService;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) {
    try {
      // Extract chains and preferences
      const extractionPrompt = `Extract yield farming preferences from the user's message.
      
User message: "${message.content.text}"

Respond with a JSON object:
{
  "chains": ["chain names mentioned, e.g., arbitrum, optimism"] or ["all"],
  "riskTolerance": "low", "medium", or "high",
  "minimumAPY": number or null,
  "stablecoinOnly": boolean
}`;

      const extraction = await runtime.useModel(ModelType.TEXT_LARGE, {
        messages: [{ role: 'user', content: extractionPrompt }],
      });

      let params;
      try {
        const responseContent = typeof extraction === 'string' 
          ? extraction 
          : (extraction as any).response || (extraction as any).content || '';
        params = JSON.parse(responseContent);
      } catch (e) {
        params = {
          chains: ['all'],
          riskTolerance: 'medium',
          minimumAPY: null,
          stablecoinOnly: false
        };
      }

      // Build query based on preferences
      const chainString = params.chains.join(' ');
      const query = `yield farming APY ${chainString} ${params.stablecoinOnly ? 'stablecoin' : ''} ${params.riskTolerance} risk`.trim();
      
      // Execute yield farming scenario
      const project = await executeDeFiScenario(
        runtime,
        DEFI_SCENARIOS.YIELD_FARMING_OPTIMIZATION,
        query
      );

      const response = {
        text: `I'm analyzing yield farming opportunities based on your criteria:

Chains: ${params.chains.join(', ')}
Risk Tolerance: ${params.riskTolerance}
${params.minimumAPY ? `Minimum APY: ${params.minimumAPY}%` : ''}
${params.stablecoinOnly ? 'Stablecoin pairs only' : 'All token pairs'}

I'll evaluate:
- Current APY rates across protocols
- Risk assessments (smart contract, impermanent loss)
- Gas costs and efficiency
- Historical performance
- Optimal entry/exit strategies

Project ID: ${project.id}`,
        metadata: { project, scenario: DEFI_SCENARIOS.YIELD_FARMING_OPTIMIZATION, params },
      };

      if (callback) await callback(response);
      return response;

    } catch (error) {
      elizaLogger.error('Yield farming analysis failed:', error);
      throw error;
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Find the best yield farming opportunities on Arbitrum and Optimism',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll analyze yield farming opportunities on Arbitrum and Optimism.",
          action: 'analyze_yield_farming',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Action to research MEV strategies and protection
 */
export const mevResearchAction: Action = {
  name: 'research_mev',
  description: 'Research MEV (Maximum Extractable Value) strategies, protection mechanisms, and impact',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    return !!researchService;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) {
    try {
      const project = await executeDeFiScenario(
        runtime,
        DEFI_SCENARIOS.MEV_RESEARCH
      );

      const response = {
        text: `I've started researching MEV (Maximum Extractable Value) strategies and protection mechanisms.

Project ID: ${project.id}

Research Focus:
- MEV attack types (sandwich, frontrunning, backrunning)
- Protection mechanisms (private mempools, commit-reveal)
- Economic impact analysis
- Implementation examples
- User protection strategies

I'll provide code examples for both attack vectors and protection mechanisms.`,
        metadata: { project, scenario: DEFI_SCENARIOS.MEV_RESEARCH },
      };

      if (callback) await callback(response);
      return response;

    } catch (error) {
      elizaLogger.error('MEV research failed:', error);
      throw error;
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Research MEV protection strategies for DEX trading',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll research MEV protection strategies and their implementations.",
          action: 'research_mev',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Action to analyze gas optimization techniques
 */
export const gasOptimizationAction: Action = {
  name: 'analyze_gas_optimization',
  description: 'Research and analyze Solidity gas optimization techniques with examples',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    return !!researchService;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) {
    try {
      // Extract specific optimization area if mentioned
      const topic = message.content.text?.toLowerCase() || '';
      let customQuery = '';
      
      if (topic.includes('storage')) {
        customQuery = 'Solidity storage packing optimization slot efficiency';
      } else if (topic.includes('loop') || topic.includes('array')) {
        customQuery = 'Solidity loop array optimization gas efficient iteration';
      } else if (topic.includes('assembly') || topic.includes('yul')) {
        customQuery = 'Solidity inline assembly Yul optimization techniques';
      }

      const project = await executeDeFiScenario(
        runtime,
        DEFI_SCENARIOS.GAS_OPTIMIZATION,
        customQuery
      );

      const response = {
        text: `I'm researching advanced Solidity gas optimization techniques.

Project ID: ${project.id}

Analysis includes:
- Storage optimization (packing, slots)
- Computation efficiency (loops, operations)
- Memory vs calldata usage
- Assembly/Yul optimizations
- Before/after comparisons with gas savings

I'll provide specific code examples showing optimization patterns and their gas impact.`,
        metadata: { project, scenario: DEFI_SCENARIOS.GAS_OPTIMIZATION },
      };

      if (callback) await callback(response);
      return response;

    } catch (error) {
      elizaLogger.error('Gas optimization research failed:', error);
      throw error;
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Show me Solidity gas optimization techniques',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll research advanced gas optimization techniques for Solidity.",
          action: 'analyze_gas_optimization',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Action to analyze cross-chain bridge security
 */
export const bridgeSecurityAction: Action = {
  name: 'analyze_bridge_security',
  description: 'Analyze cross-chain bridge architectures, security models, and vulnerabilities',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    return !!researchService;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) {
    try {
      // Check if specific bridge is mentioned
      const text = message.content.text?.toLowerCase() || '';
      let bridge = '';
      
      if (text.includes('layerzero')) bridge = 'LayerZero';
      else if (text.includes('wormhole')) bridge = 'Wormhole';
      else if (text.includes('axelar')) bridge = 'Axelar';
      else if (text.includes('chainlink')) bridge = 'Chainlink CCIP';
      
      const customQuery = bridge 
        ? `${bridge} cross-chain bridge security architecture vulnerabilities`
        : undefined;

      const project = await executeDeFiScenario(
        runtime,
        DEFI_SCENARIOS.CROSS_CHAIN_BRIDGES,
        customQuery
      );

      const response = {
        text: `I'm analyzing cross-chain bridge security${bridge ? ` focusing on ${bridge}` : ''}.

Project ID: ${project.id}

Research covers:
- Architecture and security models
- Validator/oracle mechanisms
- Historical vulnerabilities and exploits
- Best practices for secure implementations
- Comparison of major bridge protocols

I'll provide detailed security assessments and recommendations.`,
        metadata: { project, scenario: DEFI_SCENARIOS.CROSS_CHAIN_BRIDGES, bridge },
      };

      if (callback) await callback(response);
      return response;

    } catch (error) {
      elizaLogger.error('Bridge security analysis failed:', error);
      throw error;
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Analyze LayerZero bridge security architecture',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll analyze LayerZero's cross-chain bridge security architecture.",
          action: 'analyze_bridge_security',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Action to run comprehensive DeFi analysis
 */
export const comprehensiveDeFiAnalysisAction: Action = {
  name: 'comprehensive_defi_analysis',
  description: 'Run a comprehensive analysis across multiple DeFi research areas',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    return !!researchService;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) {
    try {
      // Determine which scenarios to include based on message
      const text = message.content.text?.toLowerCase() || '';
      const scenarios: DeFiScenarioType[] = [];
      
      // Always include security
      scenarios.push(DEFI_SCENARIOS.SMART_CONTRACT_SECURITY);
      
      // Add others based on keywords
      if (text.includes('yield') || text.includes('farm') || text.includes('apy')) {
        scenarios.push(DEFI_SCENARIOS.YIELD_FARMING_OPTIMIZATION);
      }
      if (text.includes('mev') || text.includes('frontrun') || text.includes('sandwich')) {
        scenarios.push(DEFI_SCENARIOS.MEV_RESEARCH);
      }
      if (text.includes('gas') || text.includes('optimiz')) {
        scenarios.push(DEFI_SCENARIOS.GAS_OPTIMIZATION);
      }
      if (text.includes('bridge') || text.includes('cross-chain') || text.includes('crosschain')) {
        scenarios.push(DEFI_SCENARIOS.CROSS_CHAIN_BRIDGES);
      }
      
      // If only security was added, add a few more key areas
      if (scenarios.length === 1) {
        scenarios.push(
          DEFI_SCENARIOS.YIELD_FARMING_OPTIMIZATION,
          DEFI_SCENARIOS.MEV_RESEARCH,
          DEFI_SCENARIOS.GAS_OPTIMIZATION
        );
      }

      const response = {
        text: `I'm conducting a comprehensive DeFi analysis across ${scenarios.length} key areas:

${scenarios.map((s, i) => `${i + 1}. ${s.replace(/_/g, ' ').toLowerCase()}`).join('\n')}

This comprehensive analysis will:
- Identify security vulnerabilities and best practices
- Compare yield opportunities and risks
- Analyze MEV impact and protection strategies
- Provide gas optimization techniques
- Generate actionable recommendations

I'll compile all findings into a comprehensive report with code examples and specific recommendations for each area.`,
        metadata: { 
          scenarios,
          reportType: 'comprehensive',
          async generateReport() {
            return generateComprehensiveDeFiReport(runtime, scenarios);
          }
        },
      };

      if (callback) await callback(response);
      
      // Start generating the comprehensive report asynchronously
      generateComprehensiveDeFiReport(runtime, scenarios).then(report => {
        if (callback) {
          callback({
            text: `Comprehensive DeFi Analysis Report completed!\n\n${report.substring(0, 1000)}...`,
            metadata: { fullReport: report }
          });
        }
      });

      return response;

    } catch (error) {
      elizaLogger.error('Comprehensive DeFi analysis failed:', error);
      throw error;
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Do a comprehensive DeFi analysis covering security, yield, and MEV',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll conduct a comprehensive DeFi analysis across multiple areas.",
          action: 'comprehensive_defi_analysis',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Action to set up DeFi monitoring
 */
export const setupDeFiMonitoringAction: Action = {
  name: 'setup_defi_monitoring',
  description: 'Set up real-time monitoring for DeFi security incidents and opportunities',

  async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
    const researchService = runtime.getService<ResearchService>('research');
    return !!researchService;
  },

  async handler(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ) {
    try {
      // Extract monitoring preferences
      const extractionPrompt = `Extract monitoring preferences from the user's message.
      
User message: "${message.content.text}"

Respond with a JSON object:
{
  "focusAreas": ["security", "yield", "mev"] based on what's mentioned,
  "interval": "realtime", "hourly", or "daily",
  "alertThreshold": "high", "medium", or "all"
}`;

      const extraction = await runtime.useModel(ModelType.TEXT_LARGE, {
        messages: [{ role: 'user', content: extractionPrompt }],
      });

      let params;
      try {
        const responseContent = typeof extraction === 'string' 
          ? extraction 
          : (extraction as any).response || (extraction as any).content || '';
        params = JSON.parse(responseContent);
      } catch (e) {
        params = {
          focusAreas: ['security'],
          interval: 'hourly',
          alertThreshold: 'high'
        };
      }

      // Map focus areas to scenarios
      const scenarios: DeFiScenarioType[] = [];
      if (params.focusAreas.includes('security')) {
        scenarios.push(DEFI_SCENARIOS.SMART_CONTRACT_SECURITY);
      }
      if (params.focusAreas.includes('yield')) {
        scenarios.push(DEFI_SCENARIOS.YIELD_FARMING_OPTIMIZATION);
      }
      if (params.focusAreas.includes('mev')) {
        scenarios.push(DEFI_SCENARIOS.MEV_RESEARCH);
      }

      // Set up monitoring
      const intervalMs = params.interval === 'realtime' ? 5 * 60 * 1000 : // 5 minutes
                        params.interval === 'hourly' ? 60 * 60 * 1000 : // 1 hour
                        24 * 60 * 60 * 1000; // daily

      const alertThreshold = params.alertThreshold === 'all' ? 0.5 :
                            params.alertThreshold === 'medium' ? 0.7 :
                            0.9; // high

      const timer = await setupDeFiMonitoring(runtime, {
        scenarios,
        interval: intervalMs,
        alertThreshold,
        onAlert: (project, finding) => {
          if (callback) {
            callback({
              text: `🚨 DeFi Alert: High-relevance finding detected!\n\nTopic: ${project.query}\nRelevance: ${finding.relevance}\n\nFinding: ${finding.content.substring(0, 500)}...`,
              metadata: { project, finding, alertType: 'defi_monitoring' }
            });
          }
        }
      });

      const response = {
        text: `DeFi monitoring has been set up successfully!

Monitoring: ${params.focusAreas.join(', ')}
Frequency: ${params.interval}
Alert Level: ${params.alertThreshold} priority only

I'll monitor for:
${scenarios.map(s => `- ${s.replace(/_/g, ' ')}`).join('\n')}

You'll receive alerts when high-relevance findings are detected.`,
        metadata: { 
          timer,
          scenarios,
          interval: intervalMs,
          alertThreshold
        },
      };

      if (callback) await callback(response);
      return response;

    } catch (error) {
      elizaLogger.error('DeFi monitoring setup failed:', error);
      throw error;
    }
  },

  examples: [
    [
      {
        name: '{{user}}',
        content: {
          text: 'Set up monitoring for DeFi security incidents',
        },
      },
      {
        name: '{{assistant}}',
        content: {
          text: "I'll set up real-time monitoring for DeFi security incidents.",
          action: 'setup_defi_monitoring',
        },
      },
    ],
  ] as ActionExample[][],
};

/**
 * Export all DeFi-specific actions
 */
export const defiActions = [
  defiSecurityResearchAction,
  yieldFarmingAnalysisAction,
  mevResearchAction,
  gasOptimizationAction,
  bridgeSecurityAction,
  comprehensiveDeFiAnalysisAction,
  setupDeFiMonitoringAction,
]; 