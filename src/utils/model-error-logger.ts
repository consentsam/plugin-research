import { elizaLogger, IAgentRuntime, ModelType } from '@elizaos/core';
import fs from 'fs/promises';
import path from 'path';

interface ModelCallLog {
    timestamp: string;
    callId: string;
    modelType: string; // Store as string since ModelType is an enum/object
    inputData: any;
    error?: any;
    stackTrace?: string;
    context: string;
    success: boolean;
}

export class ModelErrorLogger {
    private static instance: ModelErrorLogger;
    private logsDir: string;
    private currentLogFile: string;
    private logs: ModelCallLog[] = [];

    private constructor() {
        this.logsDir = path.join(process.cwd(), 'research_logs', 'model_errors');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.currentLogFile = path.join(this.logsDir, `model-errors-${timestamp}.json`);
        this.initialize();
    }

    static getInstance(): ModelErrorLogger {
        if (!ModelErrorLogger.instance) {
            ModelErrorLogger.instance = new ModelErrorLogger();
        }
        return ModelErrorLogger.instance;
    }

    private async initialize() {
        try {
            await fs.mkdir(this.logsDir, { recursive: true });
            elizaLogger.info(`[ModelErrorLogger] Initialized with log file: ${this.currentLogFile}`);
        } catch (error) {
            elizaLogger.error('[ModelErrorLogger] Failed to initialize:', error);
        }
    }

    async logModelCall(
        runtime: IAgentRuntime,
        modelType: string | typeof ModelType[keyof typeof ModelType],
        inputData: any,
        context: string,
        error?: any
    ): Promise<string> {
        const callId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const log: ModelCallLog = {
            timestamp: new Date().toISOString(),
            callId,
            modelType: String(modelType),
            inputData: this.sanitizeInput(inputData),
            error: error ? {
                message: error.message,
                name: error.name,
                code: error.code,
                details: error
            } : undefined,
            stackTrace: error?.stack,
            context,
            success: !error
        };

        this.logs.push(log);

        // Log to console with more detail
        if (error) {
            elizaLogger.error(`[ModelErrorLogger] Model call failed in ${context}:`, {
                callId,
                modelType: log.modelType,
                errorMessage: error.message,
                inputType: typeof inputData,
                inputKeys: inputData ? Object.keys(inputData) : 'null',
                hasPrompt: inputData?.prompt !== undefined,
                hasMessages: inputData?.messages !== undefined,
                promptPreview: inputData?.prompt ? inputData.prompt.substring(0, 100) + '...' : 'N/A',
                messagesCount: Array.isArray(inputData?.messages) ? inputData.messages.length : 'N/A'
            });

            // Additional detailed logging for AI_InvalidPromptError
            if (error.message?.includes('Invalid prompt')) {
                elizaLogger.error(`[ModelErrorLogger] DETAILED INVALID PROMPT ERROR:`, {
                    fullInput: JSON.stringify(inputData, null, 2),
                    expectedFormat: 'OpenAI wrapper expects { prompt: string } format',
                    actualFormat: this.detectInputFormat(inputData),
                    context
                });
            }
        }

        // Save logs periodically
        if (this.logs.length % 10 === 0) {
            await this.saveLogs();
        }

        return callId;
    }

    private sanitizeInput(input: any): any {
        if (!input) return input;

        // Create a deep copy to avoid modifying the original
        const sanitized = JSON.parse(JSON.stringify(input));

        // Truncate long strings
        const truncateString = (str: string, maxLength: number = 1000) => {
            if (str.length > maxLength) {
                return str.substring(0, maxLength) + `... (truncated ${str.length - maxLength} chars)`;
            }
            return str;
        };

        const sanitizeObject = (obj: any): any => {
            if (typeof obj === 'string') {
                return truncateString(obj);
            }
            if (Array.isArray(obj)) {
                return obj.map(item => sanitizeObject(item));
            }
            if (obj && typeof obj === 'object') {
                const result: any = {};
                for (const [key, value] of Object.entries(obj)) {
                    result[key] = sanitizeObject(value);
                }
                return result;
            }
            return obj;
        };

        return sanitizeObject(sanitized);
    }

    private detectInputFormat(input: any): string {
        if (!input) return 'null/undefined input';
        if (input.prompt !== undefined) return 'prompt format (correct for OpenAI)';
        if (input.messages !== undefined) return 'messages format (incorrect for OpenAI TEXT generation)';
        if (typeof input === 'string') return 'plain string';
        return 'unknown format';
    }

    async saveLogs(): Promise<void> {
        try {
            await fs.writeFile(
                this.currentLogFile,
                JSON.stringify(this.logs, null, 2),
                'utf-8'
            );
            elizaLogger.debug(`[ModelErrorLogger] Saved ${this.logs.length} logs to ${this.currentLogFile}`);
        } catch (error) {
            elizaLogger.error('[ModelErrorLogger] Failed to save logs:', error);
        }
    }

    async generateErrorReport(): Promise<string> {
        const errorLogs = this.logs.filter(log => !log.success);
        const report = {
            summary: {
                totalCalls: this.logs.length,
                failedCalls: errorLogs.length,
                successRate: ((this.logs.length - errorLogs.length) / this.logs.length * 100).toFixed(2) + '%'
            },
            errorsByContext: this.groupByContext(errorLogs),
            errorsByType: this.groupByErrorType(errorLogs),
            commonPatterns: this.identifyPatterns(errorLogs),
            recommendations: this.generateRecommendations(errorLogs)
        };

        const reportPath = path.join(this.logsDir, `error-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
        
        return reportPath;
    }

    private groupByContext(logs: ModelCallLog[]): Record<string, number> {
        return logs.reduce((acc, log) => {
            acc[log.context] = (acc[log.context] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }

    private groupByErrorType(logs: ModelCallLog[]): Record<string, number> {
        return logs.reduce((acc, log) => {
            const errorType = log.error?.name || 'Unknown';
            acc[errorType] = (acc[errorType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }

    private identifyPatterns(logs: ModelCallLog[]): string[] {
        const patterns: string[] = [];
        
        const invalidPromptErrors = logs.filter(log => 
            log.error?.message?.includes('Invalid prompt')
        );

        if (invalidPromptErrors.length > 0) {
            patterns.push(`${invalidPromptErrors.length} calls failed due to invalid prompt format`);
            
            const withMessages = invalidPromptErrors.filter(log => 
                log.inputData?.messages !== undefined
            );
            if (withMessages.length > 0) {
                patterns.push(`${withMessages.length} calls used 'messages' format instead of 'prompt'`);
            }
        }

        return patterns;
    }

    private generateRecommendations(logs: ModelCallLog[]): string[] {
        const recommendations: string[] = [];

        const invalidPromptErrors = logs.filter(log => 
            log.error?.message?.includes('Invalid prompt')
        );

        if (invalidPromptErrors.length > 0) {
            recommendations.push(
                'Convert all model calls to use { prompt: string } format instead of { messages: array }'
            );
            
            const contexts = [...new Set(invalidPromptErrors.map(log => log.context))];
            recommendations.push(
                `Fix model calls in these contexts: ${contexts.join(', ')}`
            );
        }

        return recommendations;
    }
}

/**
 * Wrapper function to safely call model with error logging
 */
export async function safeModelCall(
    runtime: IAgentRuntime,
    modelType: string | typeof ModelType[keyof typeof ModelType],
    inputData: any,
    context: string
): Promise<any> {
    const logger = ModelErrorLogger.getInstance();
    
    try {
        // Log the call attempt
        elizaLogger.debug(`[safeModelCall] Attempting model call in ${context}`, {
            modelType: String(modelType),
            inputFormat: inputData?.prompt ? 'prompt' : inputData?.messages ? 'messages' : 'other'
        });

        // Ensure correct format for OpenAI
        const formattedInput = formatForOpenAI(inputData);
        
        const result = await runtime.useModel(modelType, formattedInput);
        
        await logger.logModelCall(runtime, modelType, formattedInput, context);
        
        return result;
    } catch (error) {
        await logger.logModelCall(runtime, modelType, inputData, context, error);
        throw error;
    }
}

/**
 * Convert various input formats to OpenAI's expected format
 */
export function formatForOpenAI(input: any): any {
    // If already in correct format, return as is
    if (input?.prompt !== undefined) {
        return input;
    }

    // Convert messages format to prompt format
    if (input?.messages !== undefined) {
        elizaLogger.debug('[formatForOpenAI] Converting messages format to prompt format');
        
        let prompt = '';
        if (Array.isArray(input.messages)) {
            prompt = input.messages
                .map((msg: any) => `${msg.role}: ${msg.content}`)
                .join('\n\n');
        } else if (typeof input.messages === 'string') {
            prompt = input.messages;
        }

        return {
            ...input,
            prompt,
            messages: undefined // Remove messages field
        };
    }

    // If it's a plain string, wrap it
    if (typeof input === 'string') {
        return { prompt: input };
    }

    // For any other format, try to extract a prompt
    if (input?.content) {
        return { prompt: input.content };
    }

    if (input?.text) {
        return { prompt: input.text };
    }

    // If we can't determine the format, return as is and let it fail with a clear error
    elizaLogger.warn('[formatForOpenAI] Unable to determine input format:', input);
    return input;
} 