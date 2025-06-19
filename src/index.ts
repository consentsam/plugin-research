import { Plugin } from '@elizaos/core';
import { ResearchService } from './service';
import { researchProviders } from './providers';
import { researchActions } from './actions';
import deepResearchBenchSimplifiedTests from './__tests__/deepresearch-bench-simplified.e2e.test';

export * from './types';
export * from './service';
export * from './actions';
export * from './providers';
export * from './integrations';
export * from './strategies/research-strategies';
export * from './evaluation/research-evaluator';

export const researchPlugin: Plugin = {
  name: 'research',
  description: 'PhD-level deep research across 22 domains with RACE/FACT evaluation',
  
  services: [ResearchService],
  actions: researchActions,
  providers: researchProviders,
  
  tests: [
    deepResearchBenchSimplifiedTests
  ],
};

export default researchPlugin;
