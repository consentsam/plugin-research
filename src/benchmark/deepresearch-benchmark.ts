import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { elizaLogger } from '@elizaos/core';
import { ResearchProject, DeepResearchBenchResult } from '../types';

const execAsync = promisify(exec);

export interface BenchmarkConfig {
  pythonPath?: string;
  benchmarkPath?: string;
  outputDir?: string;
  maxRetries?: number;
}

export interface BenchmarkResult {
  comprehensiveness: number;
  insight: number;
  instructionFollowing: number;
  readability: number;
  overallScore: number;
  timestamp: string;
  modelName: string;
}

export interface BenchmarkSetupResult {
  success: boolean;
  pythonVersion?: string;
  benchmarkPath?: string;
  error?: string;
}

export class DeepResearchBenchmark {
  private pythonPath: string;
  private benchmarkPath: string;
  private outputDir: string;
  private maxRetries: number;

  constructor(config: BenchmarkConfig = {}) {
    this.pythonPath = config.pythonPath || 'python3';
    this.benchmarkPath = config.benchmarkPath || path.join(process.cwd(), 'deep_research_bench');
    this.outputDir = config.outputDir || path.join(this.benchmarkPath, 'results');
    this.maxRetries = config.maxRetries || 3;
  }

  /**
   * Check if the benchmark environment is properly set up
   */
  async checkSetup(): Promise<BenchmarkSetupResult> {
    try {
      // Check Python availability
      const { stdout: pythonVersion } = await execAsync(`${this.pythonPath} --version`);
      elizaLogger.info(`Python version: ${pythonVersion.trim()}`);

      // Check if benchmark directory exists
      try {
        await fs.access(this.benchmarkPath);
      } catch {
        return {
          success: false,
          error: `Benchmark directory not found: ${this.benchmarkPath}`
        };
      }

      // Check if main script exists
      const mainScript = path.join(this.benchmarkPath, 'deepresearch_bench_race.py');
      try {
        await fs.access(mainScript);
      } catch {
        return {
          success: false,
          error: `Main benchmark script not found: ${mainScript}`
        };
      }

      // Check if requirements are installed
      try {
        await execAsync(`cd "${this.benchmarkPath}" && ${this.pythonPath} -c "import tqdm, openai, requests"`);
      } catch (error) {
        return {
          success: false,
          error: `Python dependencies not installed. Run: cd ${this.benchmarkPath} && pip install -r requirements.txt`
        };
      }

      return {
        success: true,
        pythonVersion: pythonVersion.trim(),
        benchmarkPath: this.benchmarkPath
      };
    } catch (error) {
      return {
        success: false,
        error: `Setup check failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Install benchmark dependencies
   */
  async setupBenchmark(): Promise<boolean> {
    try {
      elizaLogger.info('Installing DeepResearch benchmark dependencies...');
      
      const { stdout, stderr } = await execAsync(
        `cd "${this.benchmarkPath}" && pip install -r requirements.txt`,
        { timeout: 180000 } // 3 minutes
      );

      if (stderr && stderr.includes('ERROR')) {
        elizaLogger.error('Pip install errors:', stderr);
        return false;
      }

      elizaLogger.info('Dependencies installed successfully');
      return true;
    } catch (error) {
      elizaLogger.error('Failed to install dependencies:', error);
      return false;
    }
  }

  /**
   * Convert a ResearchProject to DeepResearch benchmark format
   */
  private convertProjectToBenchmarkFormat(project: ResearchProject): DeepResearchBenchResult {
    if (!project.report) {
      throw new Error('Project must have a report to be benchmarked');
    }

    // Create the article content from report sections
    const article = project.report.sections
      .map(section => `${section.heading}\n\n${section.content}`)
      .join('\n\n');

    return {
      id: project.id,
      prompt: project.query,
      article,
      metadata: {
        domain: project.metadata.domain,
        taskType: project.metadata.taskType,
        generatedAt: new Date().toISOString(),
        modelVersion: 'elizaos-research-1.0',
        evaluationScores: project.report.evaluationMetrics ? {
          race: project.report.evaluationMetrics.raceScore,
          fact: project.report.evaluationMetrics.factScore,
        } : {
          race: {
            overall: 0,
            comprehensiveness: 0,
            depth: 0,
            instructionFollowing: 0,
            readability: 0,
            breakdown: [],
          },
          fact: {
            citationAccuracy: 0,
            effectiveCitations: 0,
            totalCitations: 0,
            verifiedCitations: 0,
            disputedCitations: 0,
            citationCoverage: 0,
            sourceCredibility: 0,
            breakdown: [],
          },
        },
      },
    };
  }

  /**
   * Save a research project in the format expected by the benchmark
   */
  private async saveProjectForBenchmark(project: ResearchProject, modelName: string): Promise<string> {
    const benchmarkData = this.convertProjectToBenchmarkFormat(project);
    
    // Create model directory
    const modelDir = path.join(this.benchmarkPath, 'data', 'test_data', 'raw_data');
    await fs.mkdir(modelDir, { recursive: true });

    // Save as JSONL file (one line per project)
    const outputFile = path.join(modelDir, `${modelName}.jsonl`);
    const jsonLine = JSON.stringify(benchmarkData) + '\n';
    
    await fs.writeFile(outputFile, jsonLine, 'utf-8');
    elizaLogger.info(`Saved project to benchmark format: ${outputFile}`);
    
    return outputFile;
  }

  /**
   * Run the RACE evaluation for a single project
   */
  async evaluateProject(
    project: ResearchProject, 
    modelName: string = 'elizaos-research-agent'
  ): Promise<BenchmarkResult> {
    // Check setup first
    const setupResult = await this.checkSetup();
    if (!setupResult.success) {
      throw new Error(`Benchmark setup failed: ${setupResult.error}`);
    }

    try {
      // Save project in benchmark format
      await this.saveProjectForBenchmark(project, modelName);

      // Run the benchmark
      elizaLogger.info(`Running DeepResearch benchmark for model: ${modelName}`);
      
      const command = `cd "${this.benchmarkPath}" && ${this.pythonPath} deepresearch_bench_race.py ${modelName} --limit 1 --only_en`;
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 300000, // 5 minutes
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      if (stderr && stderr.includes('ERROR')) {
        elizaLogger.error('Benchmark execution errors:', stderr);
      }

      elizaLogger.info('Benchmark completed, parsing results...');

      // Parse results
      const resultFile = path.join(this.outputDir, 'race_result.txt');
      const results = await this.parseResults(resultFile);

      elizaLogger.info('Benchmark results:', results);
      return results;

    } catch (error) {
      elizaLogger.error('Benchmark evaluation failed:', error);
      throw error;
    }
  }

  /**
   * Parse benchmark results from the output file
   */
  private async parseResults(resultFile: string): Promise<BenchmarkResult> {
    try {
      const content = await fs.readFile(resultFile, 'utf-8');
      const lines = content.split('\n');
      
      const results: any = {
        timestamp: new Date().toISOString(),
        modelName: 'elizaos-research-agent'
      };

      for (const line of lines) {
        const [key, value] = line.split(':').map(s => s.trim());
        if (key && value) {
          const numValue = parseFloat(value);
          if (!isNaN(numValue)) {
            switch (key.toLowerCase()) {
              case 'comprehensiveness':
                results.comprehensiveness = numValue;
                break;
              case 'insight':
                results.insight = numValue;
                break;
              case 'instruction following':
                results.instructionFollowing = numValue;
                break;
              case 'readability':
                results.readability = numValue;
                break;
              case 'overall score':
                results.overallScore = numValue;
                break;
            }
          }
        }
      }

      // Validate that we got all required scores
      const requiredFields = ['comprehensiveness', 'insight', 'instructionFollowing', 'readability', 'overallScore'];
      for (const field of requiredFields) {
        if (results[field] === undefined) {
          throw new Error(`Missing required field in benchmark results: ${field}`);
        }
      }

      return results as BenchmarkResult;

    } catch (error) {
      elizaLogger.error('Failed to parse benchmark results:', error);
      throw new Error(`Failed to parse benchmark results: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Run benchmark on multiple projects
   */
  async evaluateProjects(
    projects: ResearchProject[], 
    modelName: string = 'elizaos-research-agent'
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      elizaLogger.info(`Evaluating project ${i + 1}/${projects.length}: ${project.query.substring(0, 50)}...`);
      
      try {
        const result = await this.evaluateProject(project, `${modelName}-${i}`);
        results.push(result);
      } catch (error) {
        elizaLogger.error(`Failed to evaluate project ${i + 1}:`, error);
        // Continue with other projects
      }
    }

    return results;
  }

  /**
   * Get benchmark statistics for a model
   */
  async getBenchmarkStats(modelName: string): Promise<{
    averageScore: number;
    totalEvaluations: number;
    scoreBreakdown: {
      comprehensiveness: number;
      insight: number;
      instructionFollowing: number;
      readability: number;
    };
  }> {
    try {
      const rawResultsFile = path.join(this.outputDir, 'raw_results.jsonl');
      const content = await fs.readFile(rawResultsFile, 'utf-8');
      const lines = content.trim().split('\n');
      
      const scores = lines
        .map(line => JSON.parse(line))
        .filter(result => !result.error); // Filter out failed evaluations

      if (scores.length === 0) {
        throw new Error('No successful evaluations found');
      }

      const avgScores = {
        comprehensiveness: scores.reduce((sum, s) => sum + (s.comprehensiveness || 0), 0) / scores.length,
        insight: scores.reduce((sum, s) => sum + (s.insight || 0), 0) / scores.length,
        instructionFollowing: scores.reduce((sum, s) => sum + (s.instruction_following || 0), 0) / scores.length,
        readability: scores.reduce((sum, s) => sum + (s.readability || 0), 0) / scores.length,
      };

      const averageScore = scores.reduce((sum, s) => sum + (s.overall_score || 0), 0) / scores.length;

      return {
        averageScore,
        totalEvaluations: scores.length,
        scoreBreakdown: avgScores
      };

    } catch (error) {
      elizaLogger.error('Failed to get benchmark stats:', error);
      throw error;
    }
  }
}

// Default instance
export const deepResearchBenchmark = new DeepResearchBenchmark();