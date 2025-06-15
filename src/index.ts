import { Plugin } from '@elizaos/core';
import { ResearchService } from './service';
import { allResearchActions } from './actions';
import { researchProviders } from './providers';
import { researchE2ETests } from './tests/research-e2e.test';
import { realWorldE2ETests } from './tests/real-world-e2e.test';

export * from './types';
export { ResearchService } from './service';
export { researchActions } from './actions';
export { researchProviders } from './providers';

export const researchPlugin: Plugin = {
  name: 'research',
  description: 'Deep research plugin for multi-phase internet research with AI analysis',
  actions: allResearchActions,
  providers: researchProviders,
  services: [ResearchService],
  tests: [...researchE2ETests, ...realWorldE2ETests], // Both are already arrays of TestSuites
};

export default researchPlugin;
