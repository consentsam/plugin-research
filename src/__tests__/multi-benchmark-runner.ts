#!/usr/bin/env bun
/**
 * Multi-Benchmark Test Runner for ElizaOS Research Plugin
 * Tests multiple research scenarios and validates scoring quality
 */

// Removed real-runtime import - using simplified approach
import { ResearchService } from '../service';
import { ResearchDomain, ResearchDepth } from '../types';
import { elizaLogger, ModelType, IAgentRuntime } from '@elizaos/core';
import { DeepResearchBenchmark } from '../benchmark/deepresearch-benchmark';
import { SearchResultProcessor } from '../processing/result-processor';

interface BenchmarkScenario {
  name: string;
  query: string;
  domain: ResearchDomain;
  expectedSources: number;
  expectedWords: number;
  expectedRaceScore: number;
  expectedFactScore: number;
  timeoutMs: number;
}

const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  {
    name: "Computer Science - Federated Learning",
    query: "Analyze the security and privacy implications of federated learning in healthcare applications. Compare different privacy-preserving techniques including differential privacy, homomorphic encryption, and secure multi-party computation.",
    domain: ResearchDomain.COMPUTER_SCIENCE,
    expectedSources: 15,
    expectedWords: 3000,
    expectedRaceScore: 0.65,
    expectedFactScore: 0.7,
    timeoutMs: 600000, // 10 minutes
  },
  {
    name: "Physics - Quantum Computing",
    query: "What are the latest breakthroughs in quantum computing hardware and their implications for cryptography and computational complexity?",
    domain: ResearchDomain.PHYSICS,
    expectedSources: 12,
    expectedWords: 2500,
    expectedRaceScore: 0.6,
    expectedFactScore: 0.65,
    timeoutMs: 450000, // 7.5 minutes
  },
  {
    name: "Medicine - mRNA Vaccines",
    query: "Analyze the effectiveness of mRNA vaccine technology for infectious diseases beyond COVID-19, including safety profiles and future applications.",
    domain: ResearchDomain.MEDICINE,
    expectedSources: 15,
    expectedWords: 3000,
    expectedRaceScore: 0.65,
    expectedFactScore: 0.75,
    timeoutMs: 600000, // 10 minutes
  },
  {
    name: "General - Renewable Energy",
    query: "Compare the environmental and economic impacts of different renewable energy storage technologies for grid-scale deployment.",
    domain: ResearchDomain.GENERAL,
    expectedSources: 10,
    expectedWords: 2000,
    expectedRaceScore: 0.55,
    expectedFactScore: 0.6,
    timeoutMs: 450000, // 7.5 minutes
  },
  {
    name: "Economics - Digital Currency",
    query: "Evaluate the economic impact of central bank digital currencies (CBDCs) on monetary policy and financial stability.",
    domain: ResearchDomain.ECONOMICS,
    expectedSources: 12,
    expectedWords: 2500,
    expectedRaceScore: 0.6,
    expectedFactScore: 0.65,
    timeoutMs: 450000, // 7.5 minutes
  }
];

interface BenchmarkResult {
  scenario: BenchmarkScenario;
  success: boolean;
  actualSources: number;
  actualWords: number;
  raceScore?: number;
  factScore?: number;
  duration: number;
  error?: string;
  projectId?: string;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

class MultiBenchmarkRunner {
  private researchService: ResearchService;
  private deepBenchmark: DeepResearchBenchmark;
  private resultProcessor: SearchResultProcessor;

  constructor(private runtime: any) {
    this.researchService = new ResearchService(runtime);
    this.deepBenchmark = new DeepResearchBenchmark();
    this.resultProcessor = new SearchResultProcessor({
      qualityThreshold: 0.4,
      deduplicationThreshold: 0.8,
      maxResults: 50,
      diversityWeight: 0.3,
    });
  }

  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    
    console.log(`🧪 Running ${BENCHMARK_SCENARIOS.length} benchmark scenarios\n`);
    
    for (let i = 0; i < BENCHMARK_SCENARIOS.length; i++) {
      const scenario = BENCHMARK_SCENARIOS[i];
      console.log(`\n📋 Scenario ${i + 1}/${BENCHMARK_SCENARIOS.length}: ${scenario.name}`);
      console.log(`🔍 Query: ${scenario.query.substring(0, 100)}...`);
      console.log(`📊 Expected: ${scenario.expectedSources} sources, ${scenario.expectedWords} words`);
      console.log(`🎯 Target RACE: ${scenario.expectedRaceScore}, FACT: ${scenario.expectedFactScore}`);
      
      const result = await this.runSingleBenchmark(scenario);
      results.push(result);
      
      this.printBenchmarkResult(result);
      
      // Brief pause between tests
      if (i < BENCHMARK_SCENARIOS.length - 1) {
        console.log('\n⏳ Waiting 30 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
    
    return results;
  }

  private async runSingleBenchmark(scenario: BenchmarkScenario): Promise<BenchmarkResult> {
    const startTime = Date.now();
    
    try {
      // Create research project
      const project = await this.researchService.createResearchProject(scenario.query, {
        domain: scenario.domain,
        researchDepth: ResearchDepth.DEEP,
        maxSearchResults: 30,
        timeout: scenario.timeoutMs,
        enableCitations: true,
        evaluationEnabled: true,
      });

      console.log(`✅ Project created: ${project.id}`);

      // Wait for completion with timeout
      const completedProject = await this.waitForCompletion(project.id, scenario.timeoutMs);
      
      const duration = Date.now() - startTime;
      
      if (!completedProject) {
        return {
          scenario,
          success: false,
          actualSources: 0,
          actualWords: 0,
          duration,
          error: 'Timeout waiting for completion',
          quality: 'poor',
        };
      }

      // Analyze results
      const actualSources = completedProject.sources.length;
      const actualWords = this.countWords(completedProject.report?.content || '');
      
      // Get evaluation scores if available
      let raceScore: number | undefined;
      let factScore: number | undefined;
      
      if (completedProject.metadata?.evaluationMetrics) {
        raceScore = completedProject.metadata.evaluationMetrics.raceScore?.overall;
        factScore = completedProject.metadata.evaluationMetrics.factScore?.citationAccuracy;
      }

      const quality = this.assessQuality(scenario, actualSources, actualWords, raceScore, factScore);

      return {
        scenario,
        success: true,
        actualSources,
        actualWords,
        raceScore,
        factScore,
        duration,
        projectId: project.id,
        quality,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        scenario,
        success: false,
        actualSources: 0,
        actualWords: 0,
        duration,
        error: error instanceof Error ? error.message : String(error),
        quality: 'poor',
      };
    }
  }

  private async waitForCompletion(projectId: string, timeoutMs: number): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 10000; // Check every 10 seconds
    
    while (Date.now() - startTime < timeoutMs) {
      const project = await this.researchService.getProject(projectId);
      
      if (!project) {
        throw new Error('Project not found');
      }
      
      console.log(`📍 Phase: ${project.phase} → Status: ${project.status}`);
      console.log(`  Sources: ${project.sources.length}, Findings: ${project.findings.length}`);
      
      if (project.status === 'completed') {
        console.log('✅ Research completed successfully');
        return project;
      }
      
      if (project.status === 'failed') {
        throw new Error(`Research failed: ${project.error}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    return null; // Timeout
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private assessQuality(
    scenario: BenchmarkScenario,
    actualSources: number,
    actualWords: number,
    raceScore?: number,
    factScore?: number
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    let qualityPoints = 0;
    
    // Source count assessment
    if (actualSources >= scenario.expectedSources) {
      qualityPoints += 2;
    } else if (actualSources >= scenario.expectedSources * 0.7) {
      qualityPoints += 1;
    }
    
    // Word count assessment
    if (actualWords >= scenario.expectedWords) {
      qualityPoints += 2;
    } else if (actualWords >= scenario.expectedWords * 0.7) {
      qualityPoints += 1;
    }
    
    // RACE score assessment
    if (raceScore !== undefined) {
      if (raceScore >= scenario.expectedRaceScore) {
        qualityPoints += 2;
      } else if (raceScore >= scenario.expectedRaceScore * 0.8) {
        qualityPoints += 1;
      }
    }
    
    // FACT score assessment
    if (factScore !== undefined) {
      if (factScore >= scenario.expectedFactScore) {
        qualityPoints += 2;
      } else if (factScore >= scenario.expectedFactScore * 0.8) {
        qualityPoints += 1;
      }
    }
    
    // Assess overall quality
    const maxPoints = 8;
    const qualityRatio = qualityPoints / maxPoints;
    
    if (qualityRatio >= 0.8) return 'excellent';
    if (qualityRatio >= 0.6) return 'good';
    if (qualityRatio >= 0.4) return 'fair';
    return 'poor';
  }

  private printBenchmarkResult(result: BenchmarkResult): void {
    const { scenario, success, actualSources, actualWords, raceScore, factScore, duration, quality, error } = result;
    
    console.log(`\n📊 Results for "${scenario.name}":`);
    
    if (success) {
      console.log(`✅ SUCCESS (${(duration / 1000).toFixed(1)}s)`);
      console.log(`📚 Sources: ${actualSources} (expected: ${scenario.expectedSources})`);
      console.log(`📝 Words: ${actualWords} (expected: ${scenario.expectedWords})`);
      
      if (raceScore !== undefined) {
        const raceStatus = raceScore >= scenario.expectedRaceScore ? '✅' : '⚠️';
        console.log(`${raceStatus} RACE Score: ${(raceScore * 100).toFixed(1)}% (target: ${(scenario.expectedRaceScore * 100).toFixed(1)}%)`);
      }
      
      if (factScore !== undefined) {
        const factStatus = factScore >= scenario.expectedFactScore ? '✅' : '⚠️';
        console.log(`${factStatus} FACT Score: ${(factScore * 100).toFixed(1)}% (target: ${(scenario.expectedFactScore * 100).toFixed(1)}%)`);
      }
      
      const qualityEmoji = {
        excellent: '🏆',
        good: '👍',
        fair: '👌',
        poor: '👎'
      }[quality];
      
      console.log(`${qualityEmoji} Overall Quality: ${quality.toUpperCase()}`);
      
    } else {
      console.log(`❌ FAILED (${(duration / 1000).toFixed(1)}s)`);
      console.log(`💥 Error: ${error}`);
    }
  }

  printSummaryReport(results: BenchmarkResult[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('🏆 MULTI-BENCHMARK SUMMARY REPORT');
    console.log('='.repeat(80));
    
    const successful = results.filter(r => r.success);
    const successRate = (successful.length / results.length) * 100;
    
    console.log(`📊 Success Rate: ${successful.length}/${results.length} (${successRate.toFixed(1)}%)`);
    
    if (successful.length > 0) {
      const avgSources = successful.reduce((sum, r) => sum + r.actualSources, 0) / successful.length;
      const avgWords = successful.reduce((sum, r) => sum + r.actualWords, 0) / successful.length;
      const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
      
      console.log(`📚 Average Sources: ${avgSources.toFixed(1)}`);
      console.log(`📝 Average Words: ${avgWords.toFixed(0)}`);
      console.log(`⏱️  Average Duration: ${(avgDuration / 1000).toFixed(1)}s`);
      
      const raceScores = successful.filter(r => r.raceScore !== undefined).map(r => r.raceScore!);
      const factScores = successful.filter(r => r.factScore !== undefined).map(r => r.factScore!);
      
      if (raceScores.length > 0) {
        const avgRace = raceScores.reduce((sum, s) => sum + s, 0) / raceScores.length;
        console.log(`🎯 Average RACE Score: ${(avgRace * 100).toFixed(1)}%`);
      }
      
      if (factScores.length > 0) {
        const avgFact = factScores.reduce((sum, s) => sum + s, 0) / factScores.length;
        console.log(`🔍 Average FACT Score: ${(avgFact * 100).toFixed(1)}%`);
      }
    }
    
    // Quality distribution
    const qualityCounts = results.reduce((counts, r) => {
      counts[r.quality] = (counts[r.quality] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
    
    console.log('\n📈 Quality Distribution:');
    console.log(`🏆 Excellent: ${qualityCounts.excellent || 0}`);
    console.log(`👍 Good: ${qualityCounts.good || 0}`);
    console.log(`👌 Fair: ${qualityCounts.fair || 0}`);
    console.log(`👎 Poor: ${qualityCounts.poor || 0}`);
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (successRate < 80) {
      console.log('⚠️  Consider increasing timeout limits for complex queries');
    }
    if (successful.some(r => r.actualSources < r.scenario.expectedSources * 0.8)) {
      console.log('⚠️  Some scenarios have insufficient source coverage - consider expanding search providers');
    }
    if (successful.some(r => r.raceScore && r.raceScore < 0.6)) {
      console.log('⚠️  RACE scores need improvement - focus on comprehensiveness and depth');
    }
    if (successful.some(r => r.factScore && r.factScore < 0.6)) {
      console.log('⚠️  FACT scores need improvement - enhance citation accuracy and verification');
    }
    
    console.log('\n✅ Multi-benchmark testing complete!');
  }
}

async function main() {
  console.log('🧪 ElizaOS Research Plugin - Multi-Benchmark Test Suite\n');
  
  try {
    // Create minimal runtime mock for testing
    const runtime = {
      useModel: async (modelType: string, params: any) => {
        if (modelType === ModelType.TEXT_EMBEDDING) {
          // Return fake embedding
          return new Array(1536).fill(0).map(() => Math.random());
        }
        // Return fake text response
        return "This is a test response from the model";
      },
      getSetting: (key: string) => process.env[key] || null,
    } as any as IAgentRuntime;
    console.log('✅ Test runtime initialized with API integrations');
    
    // Run benchmark suite
    const runner = new MultiBenchmarkRunner(runtime);
    const results = await runner.runAllBenchmarks();
    
    // Print summary
    runner.printSummaryReport(results);
    
    // Exit with appropriate code
    const successRate = results.filter(r => r.success).length / results.length;
    process.exit(successRate >= 0.8 ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Multi-benchmark test failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);