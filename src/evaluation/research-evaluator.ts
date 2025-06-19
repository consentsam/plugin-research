import { IAgentRuntime, elizaLogger, ModelType } from '@elizaos/core';
import {
  ResearchProject,
  ResearchReport,
  Citation,
  FactualClaim,
  RACEScore,
  FACTScore,
  EvaluationCriteria,
  EvaluationMetrics,
  VerificationStatus,
} from '../types';

/**
 * RACE (Reference-based Adaptive Criteria-driven Evaluation) implementation
 */
export class RACEEvaluator {
  constructor(private runtime: IAgentRuntime) {}

  async evaluate(
    report: ResearchReport,
    criteria: EvaluationCriteria,
    referenceReport?: ResearchReport
  ): Promise<RACEScore> {
    const scores = {
      comprehensiveness: await this.evaluateDimension(
        report,
        criteria.comprehensiveness,
        'comprehensiveness',
        referenceReport
      ),
      depth: await this.evaluateDimension(report, criteria.depth, 'depth', referenceReport),
      instructionFollowing: await this.evaluateDimension(
        report,
        criteria.instructionFollowing,
        'instructionFollowing',
        referenceReport
      ),
      readability: await this.evaluateDimension(
        report,
        criteria.readability,
        'readability',
        referenceReport
      ),
    };

    // Calculate weighted overall score
    const overall =
      scores.comprehensiveness * criteria.comprehensiveness.weight +
      scores.depth * criteria.depth.weight +
      scores.instructionFollowing * criteria.instructionFollowing.weight +
      scores.readability * criteria.readability.weight;

    return {
      overall,
      comprehensiveness: scores.comprehensiveness,
      depth: scores.depth,
      instructionFollowing: scores.instructionFollowing,
      readability: scores.readability,
      breakdown: [],
    };
  }

  private async evaluateDimension(
    report: ResearchReport,
    criteriaDefinition: any,
    dimension: string,
    referenceReport?: ResearchReport
  ): Promise<number> {
    const reportContent = this.extractReportContent(report);
    const referenceContent = referenceReport ? this.extractReportContent(referenceReport) : '';

    const prompt = `Evaluate this research report on the ${dimension} dimension.

Evaluation Criteria:
${criteriaDefinition.description}

Rubric Items to Check:
${criteriaDefinition.rubric.map((item: string, i: number) => `${i + 1}. ${item}`).join('\n')}

Report to Evaluate:
${reportContent}

${referenceContent ? `Reference Report for Comparison:\n${referenceContent}` : ''}

Provide a score from 0-100 based on how well the report meets the criteria.
Consider each rubric item and provide reasoning for your score.

Respond with JSON:
{
  "score": number (0-100),
  "reasoning": "explanation of score",
  "rubricScores": {
    "item1": score,
    "item2": score,
    ...
  }
}`;

    const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [{ role: 'user', content: prompt }],
    });

    try {
      const content = typeof response === 'string' ? response : (response as any).content || '';
      const result = JSON.parse(content);
      return result.score / 100; // Normalize to 0-1
    } catch (e) {
      elizaLogger.error(`Failed to evaluate ${dimension}:`, e);
      return 0.5; // Default middle score
    }
  }

  private extractReportContent(report: ResearchReport): string {
    let content = `Title: ${report.title}\n\nSummary: ${report.summary}\n\n`;

    for (const section of report.sections) {
      content += `## ${section.heading}\n${section.content}\n\n`;
      if (section.subsections) {
        for (const subsection of section.subsections) {
          content += `### ${subsection.heading}\n${subsection.content}\n\n`;
        }
      }
    }

    return content.substring(0, 10000); // Limit length for LLM context
  }
}

/**
 * FACT (Framework for Factual Abundance and Citation Trustworthiness) implementation
 */
export class FACTEvaluator {
  constructor(private runtime: IAgentRuntime) {}

  async evaluate(project: ResearchProject): Promise<FACTScore> {
    const allClaims = await this.extractFactualClaims(project);
    const verificationResults = await this.verifyClaims(allClaims);

    const totalCitations = project.report?.citations.length || 0;
    const verifiedCitations = verificationResults.filter((r) => r.verified).length;
    const citationAccuracy = totalCitations > 0 ? verifiedCitations / totalCitations : 0;

    // Deduplicate claims
    const uniqueClaims = this.deduplicateClaims(verificationResults);
    const effectiveCitations = uniqueClaims.filter((c) => c.verified).length;

    return {
      citationAccuracy,
      effectiveCitations,
      totalCitations,
      verifiedCitations,
      disputedCitations: 0,
      citationCoverage: totalCitations > 0 ? effectiveCitations / totalCitations : 0,
      sourceCredibility: 0.8, // Default credibility score
      breakdown: [],
    };
  }

  private async extractFactualClaims(project: ResearchProject): Promise<FactualClaim[]> {
    const claims: FactualClaim[] = [];

    if (!project.report) return claims;

    // Extract claims from report sections
    for (const section of project.report.sections) {
      const sectionClaims = await this.extractClaimsFromText(section.content, section.citations);
      claims.push(...sectionClaims);
    }

    // Also extract from findings
    for (const finding of project.findings) {
      if (finding.factualClaims) {
        claims.push(...finding.factualClaims);
      }
    }

    return claims;
  }

  private async extractClaimsFromText(
    text: string,
    citations: Citation[]
  ): Promise<FactualClaim[]> {
    const prompt = `Extract factual claims and their citations from this text.

Text:
${text}

Available Citations:
${citations.map((c, i) => `[${i + 1}] ${c.source.url}`).join('\n')}

For each factual claim in the text:
1. Extract the exact statement
2. Identify which citation supports it (by number)
3. Note the supporting evidence

Respond with JSON array:
[
  {
    "statement": "exact factual claim",
    "citationIndex": number,
    "supportingEvidence": "relevant quote or context"
  }
]`;

    const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [{ role: 'user', content: prompt }],
    });

    try {
      const content = typeof response === 'string' ? response : (response as any).content || '';
      const extracted = JSON.parse(content);

      return extracted.map((item: any) => ({
        statement: item.statement,
        supportingEvidence: item.supportingEvidence,
        sourceUrls: citations[item.citationIndex - 1]
          ? [citations[item.citationIndex - 1].source.url]
          : [],
        verificationStatus: 'unverified' as VerificationStatus,
        confidenceScore: 0.8,
        relatedClaims: [],
      }));
    } catch (e) {
      return [];
    }
  }

  private async verifyClaims(
    claims: FactualClaim[]
  ): Promise<Array<FactualClaim & { verified: boolean }>> {
    const results = [];

    for (const claim of claims) {
      const verified = await this.verifySingleClaim(claim);
      results.push({ ...claim, verified });
    }

    return results;
  }

  private async verifySingleClaim(claim: FactualClaim): Promise<boolean> {
    // In a real implementation, this would:
    // 1. Fetch the source URL content
    // 2. Check if the content supports the claim
    // For now, we'll use a simplified verification

    if (!claim.sourceUrls || claim.sourceUrls.length === 0 || !claim.statement) return false;

    const prompt = `Does this evidence support the claim?

Claim: ${claim.statement}
Evidence: ${claim.supportingEvidence}
Source URL: ${claim.sourceUrls[0]}

Answer with just "yes" or "no".`;

    const response = await this.runtime.useModel(ModelType.TEXT_LARGE, {
      messages: [{ role: 'user', content: prompt }],
    });

    const answer = typeof response === 'string' ? response : (response as any).content || '';
    return answer.toLowerCase().includes('yes');
  }

  private deduplicateClaims(
    claims: Array<FactualClaim & { verified: boolean }>
  ): Array<FactualClaim & { verified: boolean }> {
    const seen = new Set<string>();
    const unique = [];

    for (const claim of claims) {
      const key = `${claim.statement}|${claim.sourceUrls?.join(',')}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(claim);
      }
    }

    return unique;
  }
}

/**
 * Combined evaluator for complete research assessment
 */
export class ResearchEvaluator {
  private raceEvaluator: RACEEvaluator;
  private factEvaluator: FACTEvaluator;

  constructor(runtime: IAgentRuntime) {
    this.raceEvaluator = new RACEEvaluator(runtime);
    this.factEvaluator = new FACTEvaluator(runtime);
  }

  async evaluateProject(
    project: ResearchProject,
    criteria: EvaluationCriteria,
    referenceReport?: ResearchReport
  ): Promise<EvaluationMetrics> {
    if (!project.report) {
      throw new Error('Project must have a completed report for evaluation');
    }

    const [raceScore, factScore] = await Promise.all([
      this.raceEvaluator.evaluate(project.report, criteria, referenceReport),
      this.factEvaluator.evaluate(project),
    ]);

    return {
      raceScore,
      factScore,
      timestamp: Date.now(),
      evaluatorVersion: '1.0',
    };
  }

  formatEvaluationReport(metrics: EvaluationMetrics): string {
    const race = metrics.raceScore!;
    const fact = metrics.factScore!;

    return `# Research Evaluation Report

## RACE Scores
- **Overall**: ${(race.overall * 100).toFixed(1)}%
- **Comprehensiveness**: ${(race.comprehensiveness * 100).toFixed(1)}%
- **Depth**: ${(race.depth * 100).toFixed(1)}%
- **Instruction Following**: ${(race.instructionFollowing * 100).toFixed(1)}%
- **Readability**: ${(race.readability * 100).toFixed(1)}%

## FACT Scores
- **Citation Accuracy**: ${(fact.citationAccuracy * 100).toFixed(1)}%
- **Effective Citations**: ${fact.effectiveCitations}
- **Total Citations**: ${fact.totalCitations}
- **Verified Citations**: ${fact.verifiedCitations}

## Overall Assessment
${this.generateAssessment(race, fact)}`;
  }

  private generateAssessment(race: RACEScore, fact: FACTScore): string {
    const overallQuality = race.overall;
    const citationQuality = fact.citationAccuracy;

    if (overallQuality >= 0.8 && citationQuality >= 0.8) {
      return 'Excellent research quality with strong factual grounding.';
    } else if (overallQuality >= 0.6 && citationQuality >= 0.6) {
      return 'Good research quality with adequate citation support.';
    } else if (overallQuality >= 0.4 || citationQuality >= 0.4) {
      return 'Moderate research quality. Consider improving depth and citation accuracy.';
    } else {
      return 'Research needs significant improvement in both content quality and factual support.';
    }
  }
}
