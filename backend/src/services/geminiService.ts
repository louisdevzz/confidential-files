import { ChatMessage, ChatResponse, ChatRequestOptions } from '../types/index.js';
import { createLogger, withErrorMeta } from '../lib/logger.js';

const logger = createLogger('gemini-service');

export class GeminiService {
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY!;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.defaultModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }

    logger.info('Gemini service initialized', {
      model: this.defaultModel,
      baseUrl: this.baseUrl,
    });
  }

  private convertMessages(messages: ChatMessage[]): { role: string; parts: { text: string }[] }[] {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  }

  private supportsThinkingConfig(model: string): boolean {
    const normalized = model.toLowerCase();
    return normalized.includes('pro');
  }

  private buildGenerationConfig(options: ChatRequestOptions, model: string): Record<string, unknown> {
    const baseConfig: Record<string, unknown> = {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 4096,
    };

    if (options.responseMimeType) {
      baseConfig.responseMimeType = options.responseMimeType;
    }

    if (options.responseSchema) {
      baseConfig.responseSchema = options.responseSchema;
    }

    if (options.thinking?.enabled && Number.isFinite(options.thinking.budget_tokens)) {
      const budget = Math.max(1, Math.floor(options.thinking.budget_tokens));

      if (this.supportsThinkingConfig(model)) {
        baseConfig.thinkingConfig = {
          thinkingBudget: budget,
        };
      } else {
        logger.warn('Thinking config skipped for model', {
          model,
          requestedThinkingBudget: budget,
        });
      }
    }

    return baseConfig;
  }

  async chat(options: ChatRequestOptions): Promise<ChatResponse> {
    const url = `${this.baseUrl}/models/${options.model || this.defaultModel}:generateContent?key=${this.apiKey}`;
    const startedAt = Date.now();
    const model = options.model || this.defaultModel;

    logger.debug('Gemini chat request started', {
      model,
      messageCount: options.messages.length,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 4096,
      responseMimeType: options.responseMimeType ?? 'text/plain',
      hasResponseSchema: Boolean(options.responseSchema),
      thinkingBudget:
        options.thinking?.enabled && Number.isFinite(options.thinking.budget_tokens)
          ? Math.max(1, Math.floor(options.thinking.budget_tokens))
          : null,
    });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: options.abortSignal,
        body: JSON.stringify({
          contents: this.convertMessages(options.messages),
          generationConfig: this.buildGenerationConfig(options, model),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Gemini API returned non-OK response', {
          model,
          status: response.status,
          durationMs: Date.now() - startedAt,
          errorPreview: error.slice(0, 400),
        });
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        candidates: Array<{
          finishReason?: string;
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const candidate = data.candidates[0];
      const parts = candidate?.content?.parts ?? [];
      const content = parts
        .map((part) => part.text ?? '')
        .join('')
        .trim();

      if (candidate?.finishReason === 'MAX_TOKENS') {
        logger.warn('Gemini chat output hit max tokens', {
          model,
          durationMs: Date.now() - startedAt,
          contentLength: content.length,
        });
      }

      logger.debug('Gemini chat request completed', {
        model,
        durationMs: Date.now() - startedAt,
        candidateCount: data.candidates.length,
        finishReason: candidate?.finishReason ?? null,
        partsCount: parts.length,
        contentLength: content.length,
      });

      return {
        content,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('Gemini chat request aborted', {
          model,
          durationMs: Date.now() - startedAt,
        });
        throw error;
      }

      logger.error(
        'Gemini chat request failed',
        withErrorMeta(error, {
          model,
          durationMs: Date.now() - startedAt,
        })
      );
      throw error;
    }
  }

  async *chatStream(options: ChatRequestOptions): AsyncGenerator<string> {
    const url = `${this.baseUrl}/models/${options.model || this.defaultModel}:streamGenerateContent?key=${this.apiKey}`;
    const startedAt = Date.now();
    const model = options.model || this.defaultModel;

    logger.debug('Gemini stream request started', {
      model,
      messageCount: options.messages.length,
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 4096,
      responseMimeType: options.responseMimeType ?? 'text/plain',
      hasResponseSchema: Boolean(options.responseSchema),
      thinkingBudget:
        options.thinking?.enabled && Number.isFinite(options.thinking.budget_tokens)
          ? Math.max(1, Math.floor(options.thinking.budget_tokens))
          : null,
    });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: options.abortSignal,
        body: JSON.stringify({
          contents: this.convertMessages(options.messages),
          generationConfig: this.buildGenerationConfig(options, model),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Gemini stream API returned non-OK response', {
          model,
          status: response.status,
          durationMs: Date.now() - startedAt,
          errorPreview: error.slice(0, 400),
        });
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line);
              const parts = chunk.candidates?.[0]?.content?.parts ?? [];
              const text = parts
                .map((part: { text?: string }) => part.text ?? '')
                .join('');
              if (text) {
                yield text;
              }
            } catch {
              logger.debug('Gemini stream chunk parse skipped (likely incomplete)');
            }
          }
        }
      }

      logger.debug('Gemini stream request completed', {
        model,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('Gemini stream request aborted', {
          model,
          durationMs: Date.now() - startedAt,
        });
        throw error;
      }

      logger.error(
        'Gemini stream request failed',
        withErrorMeta(error, {
          model,
          durationMs: Date.now() - startedAt,
        })
      );
      throw error;
    }
  }
}
