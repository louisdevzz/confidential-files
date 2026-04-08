import { Router, type Router as ExpressRouter } from 'express';
import { supabase } from '../lib/supabase.js';
import { GeminiService } from '../services/geminiService.js';
import { createLogger, withErrorMeta } from '../lib/logger.js';
import type { ChatResponse, ChatRequestOptions, FullGeneratedCase, GenerateCaseRequest } from '../types/index.js';

const router: ExpressRouter = Router();
const geminiService = new GeminiService();
const logger = createLogger('cases-route');

const VALID_SUBJECTS = ['math', 'physics', 'chemistry', 'biology'] as const;

const SUBJECT_LABELS: Record<string, string> = {
  math: 'Toán Học',
  physics: 'Vật Lý',
  chemistry: 'Hóa Học',
  biology: 'Sinh Học',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'lớp 6–8, kiến thức cơ bản',
  medium: 'lớp 9–10, kiến thức trung bình',
  hard: 'lớp 11–12, kiến thức nâng cao',
};

const CASE_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'OBJECT',
  required: ['boi_canh', 'ten_hung_thu', 'loi_khai', 'kien_thuc_an', 'tu_khoa_thang_cuoc'],
  properties: {
    boi_canh: { type: 'STRING' },
    ten_hung_thu: { type: 'STRING' },
    loi_khai: { type: 'STRING' },
    kien_thuc_an: { type: 'STRING' },
    tu_khoa_thang_cuoc: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      minItems: 3,
      maxItems: 5,
    },
  },
};

const parseTimeoutMs = (value: string | undefined, defaultMs: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultMs;
  return Math.max(1000, Math.floor(parsed));
};

const parsePositiveInt = (value: string | undefined, defaultValue: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return defaultValue;
  return Math.floor(parsed);
};

const CASE_GENERATION_TIMEOUT_MS = parseTimeoutMs(process.env.CASE_GENERATION_TIMEOUT_MS, 35000);
const CASE_THINKING_BUDGET = parsePositiveInt(process.env.CASE_THINKING_BUDGET, 256);

const previewText = (value: string, max = 320): string => {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
};

const callGeminiChatWithTimeout = async (params: {
  prompt: string;
  temperature: number;
  maxTokens: number;
  responseMimeType: 'application/json' | 'text/plain';
  responseSchema?: ChatRequestOptions['responseSchema'];
  thinking?: ChatRequestOptions['thinking'];
  timeoutMs: number;
  phase: 'primary';
  roomCode: string;
  subject: string;
}): Promise<ChatResponse | null> => {
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), params.timeoutMs);

  try {
    return await geminiService.chat({
      messages: [{ role: 'user', content: params.prompt }],
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      responseMimeType: params.responseMimeType,
      responseSchema: params.responseSchema,
      thinking: params.thinking,
      abortSignal: abortController.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logger.warn('Gemini request timed out', {
        roomCode: params.roomCode,
        subject: params.subject,
        phase: params.phase,
        timeoutMs: params.timeoutMs,
      });
      return null;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const extractBalancedJsonObjects = (input: string): string[] => {
  const results: string[] = [];
  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      if (depth === 0) startIndex = index;
      depth += 1;
      continue;
    }

    if (char === '}') {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        results.push(input.slice(startIndex, index + 1));
        startIndex = -1;
      }
    }
  }

  return results;
};

const SUSPECT_ROLE_SUFFIX_PATTERN =
  /\b(lớp\s*phó|lớp\s*trưởng|tổ\s*trưởng|tổ\s*phó|bí\s*thư|thủ\s*quỹ|trực\s*nhật|nhóm\s*trưởng|phụ\s*trách)\b.*$/i;

const normalizeSuspectName = (value: string): string => {
  const withoutParentheses = value.replace(/\([^)]*\)/g, ' ').trim();
  const leftOfComma = withoutParentheses.split(',')[0]?.trim() ?? '';
  const withoutRoleSuffix = leftOfComma.replace(SUSPECT_ROLE_SUFFIX_PATTERN, '').trim();
  return withoutRoleSuffix.replace(/\s{2,}/g, ' ');
};

const normalizeCaseCandidate = (value: unknown): FullGeneratedCase | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  const boiCanh = typeof candidate.boi_canh === 'string' ? candidate.boi_canh.trim() : '';
  const tenHungThuRaw = typeof candidate.ten_hung_thu === 'string' ? candidate.ten_hung_thu.trim() : '';
  const tenHungThu = normalizeSuspectName(tenHungThuRaw);
  const loiKhai = typeof candidate.loi_khai === 'string' ? candidate.loi_khai.trim() : '';
  const kienThucAn = typeof candidate.kien_thuc_an === 'string' ? candidate.kien_thuc_an.trim() : '';
  const keywords = Array.isArray(candidate.tu_khoa_thang_cuoc)
    ? candidate.tu_khoa_thang_cuoc
        .filter((keyword): keyword is string => typeof keyword === 'string')
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    : [];

  if (!boiCanh || !tenHungThu || !loiKhai || !kienThucAn || keywords.length === 0) {
    return null;
  }

  return {
    boi_canh: boiCanh,
    ten_hung_thu: tenHungThu,
    loi_khai: loiKhai,
    kien_thuc_an: kienThucAn,
    tu_khoa_thang_cuoc: [...new Set(keywords)].slice(0, 5),
  };
};

const tryParseCaseJson = (raw: string): FullGeneratedCase | null => {
  const candidates: string[] = [];
  const trimmed = raw.trim();

  candidates.push(trimmed);
  candidates.push(trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));

  const fenceMatches = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const match of fenceMatches) {
    if (match[1]) candidates.push(match[1].trim());
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  candidates.push(...extractBalancedJsonObjects(trimmed));

  for (const candidate of candidates) {
    try {
      const parsed = normalizeCaseCandidate(JSON.parse(candidate));
      if (parsed) return parsed;
    } catch {
      // try next candidate
    }
  }

  return null;
};

router.post('/generate', async (req, res) => {
  const { subject, difficulty, roomCode } = req.body as GenerateCaseRequest;
  const startedAt = Date.now();

  try {
    if (!difficulty || !roomCode) {
      return res.status(400).json({ error: 'difficulty và roomCode là bắt buộc' });
    }

    // Validate subject — fallback to random if not provided
    const validSubject = (VALID_SUBJECTS as readonly string[]).includes(subject)
      ? subject
      : VALID_SUBJECTS[Math.floor(Math.random() * VALID_SUBJECTS.length)];
    const subjectLabel = SUBJECT_LABELS[validSubject];
    const difficultyLabel = DIFFICULTY_LABELS[difficulty] ?? difficulty;

    logger.info('Case generation started', {
      roomCode,
      subject: validSubject,
      difficulty,
      difficultyLabel,
      generationTimeoutMs: CASE_GENERATION_TIMEOUT_MS,
    });

    const prompt =
      `Tạo 1 sự cố học đường đời thường, an toàn, phù hợp học sinh Việt Nam.\n` +
      `Môn trọng tâm: ${subjectLabel} (${difficultyLabel}). Mâu thuẫn chính phải thuộc môn này.\n\n` +
      `Yêu cầu nội dung:\n` +
      `- Có 1 nghi phạm là học sinh, có lý do ở gần hiện trường\n` +
      `- Có 1 nhân chứng thấy hành động cụ thể\n` +
      `- Có 2 mốc thời gian rõ ràng\n` +
      `- Có 1 đồ vật cụ thể liên quan trực tiếp đến mâu thuẫn\n` +
      `- Lời khai phải phủ nhận và chứa đúng 1 lỗi kiến thức ${subjectLabel}\n\n` +
      `Cấm: bạo lực nặng, chết người, bối cảnh hình sự, drama phi thực tế.\n\n` +
      `Trả về DUY NHẤT JSON hợp lệ với các key: boi_canh, ten_hung_thu, loi_khai, kien_thuc_an, tu_khoa_thang_cuoc.\n` +
      `Độ dài gợi ý: boi_canh 4-5 câu, loi_khai 4-5 câu, tu_khoa_thang_cuoc gồm 3-5 từ khóa ngắn.\n` +
      `Không markdown. Không giải thích ngoài JSON.`;
    
    logger.debug('Case generation prompt prepared', {
      roomCode,
      subject: validSubject,
      promptLength: prompt.length,
    });

    const geminiResponse = await callGeminiChatWithTimeout({
      prompt,
      temperature: 0.45,
      maxTokens: 1200,
      responseMimeType: 'application/json',
      responseSchema: CASE_RESPONSE_SCHEMA,
      thinking: { enabled: true, budget_tokens: CASE_THINKING_BUDGET },
      timeoutMs: CASE_GENERATION_TIMEOUT_MS,
      phase: 'primary',
      roomCode,
      subject: validSubject,
    });

    if (!geminiResponse) {
      throw new Error('AI generate timeout, vui lòng thử lại.');
    }

    const raw = geminiResponse.content ?? '';
    logger.info('Primary case response received', {
      roomCode,
      subject: validSubject,
      contentLength: raw.length,
    });

    const fullCase = tryParseCaseJson(raw);

    if (!fullCase) {
      logger.error('Primary parse failed', {
        roomCode,
        subject: validSubject,
        rawPreview: previewText(raw),
      });
      throw new Error('AI trả JSON không hợp lệ ở lần generate đầu tiên.');
    }

    logger.info('case_generation_result', {
      roomCode,
      subject: validSubject,
    });

    // Save to DB
    const { error: dbError } = await supabase
      .from('rooms')
      .update({ case_data: fullCase })
      .eq('code', roomCode);

    if (dbError) throw new Error(`Lỗi lưu DB: ${dbError.message}`);

    logger.info('Case generation completed', {
      roomCode,
      subject: validSubject,
      durationMs: Date.now() - startedAt,
      boiCanhLength: fullCase.boi_canh.length,
      loiKhaiLength: fullCase.loi_khai.length,
      keywordsCount: fullCase.tu_khoa_thang_cuoc.length,
    });

    // Return safe case (without tu_khoa_thang_cuoc)
    const { tu_khoa_thang_cuoc: _omit, ...safeCase } = fullCase;

    res.json(safeCase);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      'Generate case failed',
      withErrorMeta(error, {
        roomCode,
        subject,
        difficulty,
        durationMs: Date.now() - startedAt,
      })
    );
    res.status(502).json({ error: message });
  }
});

export default router;
