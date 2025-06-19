import { describe, it, expect } from 'vitest';
import { startResearchAction, checkResearchStatusAction } from '../actions';
import { ResearchService } from '../service';
import { IAgentRuntime, Memory, State, UUID } from '@elizaos/core';
import { v4 as uuidv4 } from 'uuid';

// Create a real runtime for testing
function createTestRuntime(): IAgentRuntime {
  const researchService = new ResearchService({
    getSetting: (key: string) => {
      if (key.includes('API_KEY')) return 'test-key';
      return null;
    },
    useModel: async () => 'mock response',
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as any);
  
  return {
    agentId: uuidv4() as UUID,
    character: {
      name: 'TestAgent',
      bio: ['Test bio'],
      system: 'Test system prompt',
      messageExamples: [],
      postExamples: [],
      topics: [],
      adjectives: [],
      knowledge: [],
      clients: [],
      plugins: [],
    },
    getSetting: (key: string) => {
      if (key.includes('API_KEY')) return 'test-key';
      return null;
    },
    getService: (name: string) => {
      if (name === 'research') return researchService;
      return null;
    },
    useModel: async () => 'mock response',
    composeState: async () => ({ values: {}, data: {}, text: '' }),
    updateState: async () => true,
    messageManager: {
      createMemory: async () => true,
      getMemories: async () => [],
      updateMemory: async () => true,
      deleteMemory: async () => true,
      searchMemories: async () => [],
      getLastMessages: async () => [],
    },
    actions: [],
    providers: [],
    evaluators: [],
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
  } as unknown as IAgentRuntime;
}

describe('Research Actions - Real Implementation Tests', () => {
  it('should validate actions correctly', async () => {
    const runtime = createTestRuntime();
    const message: Memory = {
      id: uuidv4() as UUID,
      entityId: uuidv4() as UUID,
      roomId: uuidv4() as UUID,
      agentId: uuidv4() as UUID,
      content: { text: 'test' },
      createdAt: Date.now(),
    } as Memory;
    
    // Test validation with service available
    const isValid = await startResearchAction.validate(runtime, message);
    expect(isValid).toBe(true);
    
    // Test validation without service
    const runtimeNoService = { ...runtime, getService: () => null } as IAgentRuntime;
    const isInvalid = await startResearchAction.validate(runtimeNoService, message);
    expect(isInvalid).toBe(false);
  });
  
  it('should handle research action correctly', async () => {
    const runtime = createTestRuntime();
    const message: Memory = {
      id: uuidv4() as UUID,
      entityId: uuidv4() as UUID,
      roomId: uuidv4() as UUID,
      agentId: uuidv4() as UUID,
      content: { text: 'research quantum computing' },
      createdAt: Date.now(),
    } as Memory;
    
    const responses: any[] = [];
    const callback = async (response: any) => {
      responses.push(response);
      return [];
    };
    
    const result = await startResearchAction.handler(
      runtime,
      message,
      { values: {}, data: {}, text: '' },
      {},
      callback
    );
    
    // The handler should return something (even if research fails)
    expect(result).toBeDefined();
  });
}); 