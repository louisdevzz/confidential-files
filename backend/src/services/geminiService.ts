import { ChatMessage, ChatResponse, ChatRequestOptions } from '../types/index.js';

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
  }

  private convertMessages(messages: ChatMessage[]): { role: string; parts: { text: string }[] }[] {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
  }

  async chat(options: ChatRequestOptions): Promise<ChatResponse> {
    const url = `${this.baseUrl}/models/${options.model || this.defaultModel}:generateContent?key=${this.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: this.convertMessages(options.messages),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 4096,
          ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      candidates: Array<{
        content: {
          parts: Array<{ text: string }>;
        };
      }>;
    };

    const candidate = data.candidates[0];
    const content = candidate?.content?.parts?.[0]?.text || '';
    
    return {
      content,
    };
  }

  async *chatStream(options: ChatRequestOptions): AsyncGenerator<string> {
    const url = `${this.baseUrl}/models/${options.model || this.defaultModel}:streamGenerateContent?key=${this.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: this.convertMessages(options.messages),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 4096,
          ...(options.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
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
            const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield text;
            }
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  }
}
