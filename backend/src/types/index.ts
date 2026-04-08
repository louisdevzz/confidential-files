export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  reasoningContent?: string;
}

export interface ChatRequestOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseMimeType?: 'application/json' | 'text/plain';
  abortSignal?: AbortSignal;
  thinking?: {
    enabled: boolean;
    budget_tokens: number;
  };
}

export interface FullGeneratedCase {
  boi_canh: string;
  ten_hung_thu: string;
  loi_khai: string;
  kien_thuc_an: string;
  tu_khoa_thang_cuoc: string[];
}

export interface SafeGeneratedCase {
  boi_canh: string;
  ten_hung_thu: string;
  loi_khai: string;
  kien_thuc_an: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerateCaseRequest {
  subject: string;
  difficulty: string;
  roomCode: string;
}

export interface ChatRequest {
  roomCode: string;
  messages: ChatTurn[];
}
