import { Router, type Router as ExpressRouter } from 'express';
import { supabase } from '../lib/supabase.js';
import { GeminiService } from '../services/geminiService.js';
import type { ChatMessage, FullGeneratedCase, ChatRequest } from '../types/index.js';

const router: ExpressRouter = Router();
const geminiService = new GeminiService();

const ROOM_CASE_CACHE_TTL_MS = 5 * 60 * 1000;
const CHAT_HISTORY_LIMIT = 14;

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
  `Bạn là ${c.ten_hung_thu} - một học sinh tài giỏi, tự tin và có chút kiêu ngạo (theo phong cách thám tử học đường).\n\n` +
  `Vụ án: ${c.boi_canh}\n\n` +
  `Lờ biện minh của bạn: "${c.loi_khai}"\n\n` +
  `TÍNH CÁCH CỦA BẠN:\n` +
  `- Tự tin, bình tĩnh, ăn nói lưu loát và logic\n` +
  `- Tỏ ra ngườ hiểu biết, thích thể hiện kiến thức\n` +
  `- Bảo vệ quan điểm của mình một cách sắc sảo nhưng vẫn lịch sự\n` +
  `- Khi bị ép, vẫn giữ thái độ ung dung nhưng bắt đầu lúng túng\n\n` +
  `LUẬT CHƠI (tuyệt đối tuân thủ):\n` +
  `- TUYỆT ĐỐI KHÔNG nhận tội cho đến khi thám tử giải thích đúng bản chất khoa học và đề cập đến: ${c.tu_khoa_thang_cuoc.join(', ')}.\n` +
  `- Trả lờ ngắn gọn (2-4 câu), súc tích, có chiều sâu.\n` +
  `- Giọng điệu: Tự tin, thông minh, hơi kiêu một chút nhưng không kiêu ngạo quá mức.\n` +
  `- Khi thám tử giải thích đúng (phải đề cập từ khóa then chốt), bạn tỏ ra ngạc nhiên, thừa nhận thông minh và kết thúc bằng [GAME_OVER].\n` +
  `- Không bao giờ tiết lộ từ khóa, không gợi ý đáp án, không tự mình sửa lỗi sai trong lờ khai.`;

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
    { role: 'assistant', content: 'Tôi đang chờ đây. Có điều gì muốn hỏi sao?' },
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
      messages: geminiMessages,
      temperature: 0.35,
      maxTokens: 420,
    });

    res.json({ response: geminiResponse.content });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Chat error:', error);
    res.status(500).json({ error: message });
  }
});

export default router;
