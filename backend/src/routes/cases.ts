import { Router, type Router as ExpressRouter } from 'express';
import { readFile } from 'node:fs/promises';
import { supabase } from '../lib/supabase.js';
import { GeminiService } from '../services/geminiService.js';
import { createLogger, withErrorMeta } from '../lib/logger.js';
import type { ChatResponse, FullGeneratedCase, GenerateCaseRequest } from '../types/index.js';

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

let detectiveStyleReferencePromise: Promise<string> | null = null;

const parseTimeoutMs = (value: string | undefined, defaultMs: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultMs;
  return Math.max(1000, Math.floor(parsed));
};

const CASE_GENERATION_TIMEOUT_MS = parseTimeoutMs(process.env.CASE_GENERATION_TIMEOUT_MS, 35000);
const CASE_RESCUE_TIMEOUT_MS = parseTimeoutMs(process.env.CASE_RESCUE_TIMEOUT_MS, 20000);

const sanitizeReferenceText = (input: string): string => {
  const cleanedLines = input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('!['))
    .filter((line) => !/^https?:\/\//i.test(line))
    .map((line) =>
      line
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/^[#>*\-\d.\s]+/, '')
        .replace(/[*_`~]/g, '')
        .trim()
    )
    .filter((line) => line.length >= 24);

  const deduped: string[] = [];
  for (const line of cleanedLines) {
    if (!deduped.includes(line)) deduped.push(line);
    if (deduped.length >= 18) break;
  }

  const merged = deduped.join(' ');
  return merged.length > 1800 ? `${merged.slice(0, 1800)}...` : merged;
};

const getDetectiveStyleReference = async (): Promise<string> => {
  if (!detectiveStyleReferencePromise) {
    detectiveStyleReferencePromise = readFile(new URL('../../vu-an-hay.md', import.meta.url), 'utf-8')
      .then((content) => sanitizeReferenceText(content))
      .catch(() => '');
  }

  return detectiveStyleReferencePromise;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
  let timer: NodeJS.Timeout | null = null;

  try {
    return await Promise.race<T>([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const previewText = (value: string, max = 320): string => {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
};

const callGeminiChatWithTimeout = async (params: {
  prompt: string;
  temperature: number;
  maxTokens: number;
  responseMimeType: 'application/json' | 'text/plain';
  timeoutMs: number;
  phase: 'primary' | 'rescue';
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
      rescueTimeoutMs: CASE_RESCUE_TIMEOUT_MS,
    });

    const detectiveStyleReference = await withTimeout(getDetectiveStyleReference(), 800, '');

    const prompt =
  `Bạn tạo 1 vụ án học đường dạng suy luận đơn giản, đời thường, logic rõ ràng.\n\n` +

  `MÔN: ${subjectLabel} (${difficultyLabel})\n\n` +

  `YÊU CẦU:\n` +
  `- Tình huống thật trong lớp học (mất đồ / hỏng đồ / dấu vết lạ)\n` +
  `- Có 1-2 manh mối quan sát được\n` +
  `- Có 1 nhân chứng thấy hành động đáng ngờ\n` +
  `- Nghi phạm có động cơ hợp lý (sợ bị phạt, che giấu lỗi...)\n` +
  `- Lời khai nghe hợp lý nhưng chứa đúng 1 lỗi kiến thức ${subjectLabel}\n` +
  `- Khi áp dụng kiến thức đúng → lời khai bị mâu thuẫn\n\n` +

  `TRÁNH:\n` +
  `- Không drama, không phi thực tế\n` +
  `- Không giải thích kiểu sách giáo khoa\n` +
  `- Không kết luận thủ phạm trong bối cảnh\n\n` +

  `TRẢ VỀ JSON DUY NHẤT:\n` +
  `{\n` +
  `  "boi_canh": "5-8 câu, mỗi câu phải có chi tiết cụ thể (thời gian, hành động, đồ vật). Phải có: 1 đồ vật, 2 mốc thời gian, 1 nhân chứng thấy hành động rõ ràng",\n` +
  `  "ten_hung_thu": "tên riêng học sinh (1-2 từ)",\n` +
  `  "loi_khai": "5-8 câu, mỗi câu có hành động hoặc giải thích cụ thể. Phải có chống chế tự nhiên và chứa đúng 1 lỗi kiến thức",\n` +
  `  "kien_thuc_an": "giải thích rõ: câu nào sai, kiến thức đúng là gì, và chi tiết nào bác lại lời khai",\n` +
  `  "tu_khoa_thang_cuoc": ["3-5 từ khóa cụ thể"]\n` +
  `}\n\n` +
  `Viết chi tiết, không viết câu chung chung. Chỉ trả JSON.`

    logger.debug('Case generation prompt prepared', {
      roomCode,
      subject: validSubject,
      promptLength: prompt.length,
      hasDetectiveReference: detectiveStyleReference.length > 0,
      detectiveReferenceLength: detectiveStyleReference.length,
    });

    const geminiResponse = await callGeminiChatWithTimeout({
      prompt,
      temperature: 0.35,
      maxTokens: 1200,
      responseMimeType: 'application/json',
      timeoutMs: CASE_GENERATION_TIMEOUT_MS,
      phase: 'primary',
      roomCode,
      subject: validSubject,
    });

    const raw = geminiResponse?.content ?? '';
    logger.info('Primary case response received', {
      roomCode,
      subject: validSubject,
      contentLength: raw.length,
    });

    let fullCase: FullGeneratedCase | null = tryParseCaseJson(raw);
    let source: 'direct' | 'rescued' = 'direct';

    if (!fullCase) {
      logger.warn('Primary parse failed, trying rescue parse', {
        roomCode,
        subject: validSubject,
        rawPreview: previewText(raw),
      });

      const rescuePrompt =
      raw.trim().length === 0
        ? `Tạo nhanh 1 JSON hợp lệ theo schema sau. Nội dung ngắn gọn, hợp lý:\n` +
          `{\n` +
          `  "boi_canh": string,\n` +
          `  "ten_hung_thu": string,\n` +
          `  "loi_khai": string,\n` +
          `  "kien_thuc_an": string,\n` +
          `  "tu_khoa_thang_cuoc": string[]\n` +
          `}\n` +
          `Yêu cầu: không rỗng, ten_hung_thu là tên riêng, keywords 3-5.\n` +
          `Chỉ trả JSON.`

        : `Chuẩn hóa nội dung sau thành JSON hợp lệ theo schema.\n` +
          `Nếu thiếu thì tự điền.\n\n` +
          `Schema:\n` +
          `{\n` +
          `  "boi_canh": string,\n` +
          `  "ten_hung_thu": string,\n` +
          `  "loi_khai": string,\n` +
          `  "kien_thuc_an": string,\n` +
          `  "tu_khoa_thang_cuoc": string[]\n` +
          `}\n\n` +
          `Nội dung:\n${raw}\n\n` +
          `Chỉ trả JSON.`;

      const rescue = await callGeminiChatWithTimeout({
        prompt: rescuePrompt,
        temperature: raw.trim().length === 0 ? 0.5 : 0.65,
        maxTokens: 1400,
        responseMimeType: 'application/json',
        timeoutMs: CASE_RESCUE_TIMEOUT_MS,
        phase: 'rescue',
        roomCode,
        subject: validSubject,
      });

      const rescueContent = rescue?.content ?? '';
      logger.info('Rescue response received', {
        roomCode,
        subject: validSubject,
        contentLength: rescueContent.length,
      });

      fullCase = tryParseCaseJson(rescueContent);
      if (fullCase) source = 'rescued';

      if (!fullCase) {
        logger.error('Rescue parse failed', {
          roomCode,
          subject: validSubject,
          rawPreview: previewText(raw),
          rescuePreview: previewText(rescueContent),
        });
      }
    }

    if (!fullCase) {
      throw new Error('AI trả nội dung rỗng hoặc JSON không hợp lệ sau bước rescue.');
    }

    logger.info('case_generation_result', {
      roomCode,
      subject: validSubject,
      source,
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
      source,
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
