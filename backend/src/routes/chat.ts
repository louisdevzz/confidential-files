import { Router, type Router as ExpressRouter } from 'express';
import { supabase } from '../lib/supabase.js';
import { GeminiService } from '../services/geminiService.js';
import { createLogger, withErrorMeta } from '../lib/logger.js';
import type { ChatMessage, FullGeneratedCase, ChatRequest } from '../types/index.js';

const router: ExpressRouter = Router();
const geminiService = new GeminiService();
const logger = createLogger('chat-route');

const ROOM_CASE_CACHE_TTL_MS = 5 * 60 * 1000;
const CHAT_HISTORY_LIMIT = 10;

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
};

const parseFloatInRange = (value: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const CHAT_TEMPERATURE = parseFloatInRange(process.env.CHAT_TEMPERATURE, 0.6, 0, 2);
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL?.trim() || undefined;

const roomCaseCache = new Map<string, { value: FullGeneratedCase; expiresAt: number }>();

const sanitize = (text: string): string =>
  text.replace(/[<>`{}[\]\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 320);

const getCachedCaseData = (roomCode: string): FullGeneratedCase | null => {
  const key = roomCode.toUpperCase();
  const now = Date.now();
  const hit = roomCaseCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    roomCaseCache.delete(key);
    return null;
  }
  return hit.value;
};

const setCachedCaseData = (roomCode: string, caseData: FullGeneratedCase): void => {
  roomCaseCache.set(roomCode.toUpperCase(), {
    value: caseData,
    expiresAt: Date.now() + ROOM_CASE_CACHE_TTL_MS,
  });
};

const fetchRoomCaseData = async (roomCode: string): Promise<FullGeneratedCase> => {
  const cached = getCachedCaseData(roomCode);
  if (cached) return cached;

  const { data: room, error: dbError } = await supabase
    .from('rooms')
    .select('case_data')
    .eq('code', roomCode.toUpperCase())
    .single();

  if (dbError || !room?.case_data) {
    throw new Error('Không tìm thấy vụ án cho phòng này.');
  }

  const caseData = room.case_data as FullGeneratedCase;
  setCachedCaseData(roomCode, caseData);
  return caseData;
};

const buildSystemPrompt = (c: FullGeneratedCase): string =>
  `Bạn là ${c.ten_hung_thu}, học sinh bị nghi ngờ trong một sự cố ở lớp.\n` +
  `Bối cảnh: ${c.boi_canh}\n` +
  `Lời khai gốc: "${c.loi_khai}"\n\n` +
  `Trả lời như học sinh thật đang cãi lại:\n` +
  `- 1-2 câu ngắn, tối đa 35-45 từ\n` +
  `- Tự nhiên, hơi phòng thủ, không văn vẻ\n` +
  `- Không nhận tội, không lộ đáp án\n` +
  `- Nếu người chơi chưa đúng, chỉ chối hoặc vặn lại ngắn gọn\n` +
  `- Nếu người chơi đúng hẳn và chạm các ý: ${c.tu_khoa_thang_cuoc.join(', ')}, thì thừa nhận ngắn gọn và thêm [GAME_OVER]`;

const toGeminiMessages = (messages: ChatRequest['messages'], systemPrompt: string): ChatMessage[] => {
  const safeMessages = messages
    .slice(-CHAT_HISTORY_LIMIT)
    .map((message) => ({
      role: message.role,
      content: sanitize(message.content),
    }))
    .filter((message) => message.content.length > 0);

  return [
    {
      role: 'user',
      content: `[SYSTEM PROMPT - BẮT BUỘC TUÂN THỦ]: ${systemPrompt}\n\n[HỎI]: Đã đến lúc đối chất.`,
    },
    { role: 'assistant', content: 'Ừ, cậu hỏi đi.' },
    ...safeMessages,
  ];
};

router.post('/', async (req, res) => {
  try {
    const { roomCode, messages } = req.body as ChatRequest;

    if (!roomCode || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'roomCode và messages là bắt buộc' });
    }

    const caseData = await fetchRoomCaseData(roomCode);

    if (!Array.isArray(caseData.tu_khoa_thang_cuoc) || caseData.tu_khoa_thang_cuoc.length === 0) {
      throw new Error('Dữ liệu vụ án không hợp lệ (thiếu từ khoá đáp án).');
    }

    const systemPrompt = buildSystemPrompt(caseData);
    const geminiMessages = toGeminiMessages(messages, systemPrompt);

    const geminiResponse = await geminiService.chat({
      model: CHAT_MODEL,
      messages: geminiMessages,
      temperature: CHAT_TEMPERATURE,
    });

    res.json({ response: geminiResponse.content });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Chat request failed', withErrorMeta(error, { path: '/api/chat' }));
    res.status(500).json({ error: message });
  }
});

export default router;
