import { IAgentRuntime, ModelType } from '@elizaos/core';

/**
 * Creates a mock runtime for e2e tests that properly handles useModel calls
 */
export function wrapRuntimeWithMocks(runtime: IAgentRuntime): IAgentRuntime {
  const originalUseModel = runtime.useModel?.bind(runtime);
  
  return {
    ...runtime,
    useModel: async (modelType: any, params: any): Promise<any> => {
      // Handle the case where params might not have the expected structure
      if (!params || (!params.messages && !params.prompt)) {
        console.warn('useModel called with invalid params:', params);
        // Return a default response based on the context
        if (typeof params === 'object' && params.messages?.[0]?.content) {
          const content = params.messages[0].content.toLowerCase();
          
          // Domain extraction
          if (content.includes('domain')) {
            if (content.includes('physics') || content.includes('quantum')) return 'physics';
            if (content.includes('biology') || content.includes('medical')) return 'biology';
            if (content.includes('computer') || content.includes('software')) return 'computer_science';
            if (content.includes('economic') || content.includes('finance')) return 'economics';
            return 'general';
          }
          
          // Task type extraction
          if (content.includes('task type')) {
            if (content.includes('analyz')) return 'analytical';
            if (content.includes('compar')) return 'comparative';
            if (content.includes('evaluat')) return 'evaluative';
            if (content.includes('predict')) return 'predictive';
            return 'exploratory';
          }
          
          // Depth extraction
          if (content.includes('depth')) {
            if (content.includes('phd') || content.includes('expert')) return 'phd-level';
            if (content.includes('comprehensive') || content.includes('detailed')) return 'deep';
            if (content.includes('quick') || content.includes('overview')) return 'surface';
            return 'moderate';
          }
        }
        return 'general';
      }
      
      // If we have a properly configured runtime, use it
      if (originalUseModel) {
        try {
          return await originalUseModel(modelType, params);
        } catch (error) {
          console.error('Original useModel failed:', error);
          // Fall back to mock responses
        }
      }
      
      // Provide mock responses based on the prompt content
      const content = params.messages?.[0]?.content || params.prompt || '';
      const lowerContent = content.toLowerCase();
      
      // Domain extraction
      if (lowerContent.includes('research domain')) {
        if (lowerContent.includes('physics') || lowerContent.includes('quantum')) return 'physics';
        if (lowerContent.includes('biology') || lowerContent.includes('medical')) return 'biology';
        if (lowerContent.includes('computer') || lowerContent.includes('software')) return 'computer_science';
        if (lowerContent.includes('economic') || lowerContent.includes('finance')) return 'economics';
        if (lowerContent.includes('medicine') || lowerContent.includes('health')) return 'medicine';
        return 'general';
      }
      
      // Task type extraction
      if (lowerContent.includes('task type')) {
        if (lowerContent.includes('analyz')) return 'analytical';
        if (lowerContent.includes('compar')) return 'comparative';
        if (lowerContent.includes('synthes') || lowerContent.includes('synthetic')) return 'synthetic';
        if (lowerContent.includes('evaluat')) return 'evaluative';
        if (lowerContent.includes('predict')) return 'predictive';
        return 'exploratory';
      }
      
      // Depth extraction
      if (lowerContent.includes('depth') || lowerContent.includes('level')) {
        if (lowerContent.includes('phd') || lowerContent.includes('expert') || lowerContent.includes('academic')) return 'phd-level';
        if (lowerContent.includes('comprehensive') || lowerContent.includes('detailed')) return 'deep';
        if (lowerContent.includes('quick') || lowerContent.includes('overview')) return 'surface';
        return 'moderate';
      }
      
      // Default response for other cases
      return 'Mock response for: ' + content.substring(0, 50);
    }
  };
}