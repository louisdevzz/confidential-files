import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { GeminiService } from '../services/geminiService.js';
import { BraveSearchService } from '../services/braveSearchService.js';
import type { FullGeneratedCase, GenerateCaseRequest } from '../types/index.js';

const router = Router();
const geminiService = new GeminiService();
const braveSearch = new BraveSearchService();

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

router.post('/generate', async (req, res) => {
  try {
    const { subject, difficulty, roomCode } = req.body as GenerateCaseRequest;

    if (!difficulty || !roomCode) {
      return res.status(400).json({ error: 'difficulty và roomCode là bắt buộc' });
    }

    // Validate subject — fallback to random if not provided
    const validSubject = (VALID_SUBJECTS as readonly string[]).includes(subject)
      ? subject
      : VALID_SUBJECTS[Math.floor(Math.random() * VALID_SUBJECTS.length)];
    const subjectLabel = SUBJECT_LABELS[validSubject];
    const difficultyLabel = DIFFICULTY_LABELS[difficulty] ?? difficulty;

    // Search for real knowledge context to make scenarios more realistic
    const knowledgeContext = await braveSearch.getKnowledgeContext(validSubject, subjectLabel, difficultyLabel);

    const subjectExamples: Record<string, string> = {
      math: 'Ví dụ lỗi sai: nhầm công thức diện tích, tính sai tỉ lệ phần trăm, nhầm đơn vị đo, sai phép tính xác suất...',
      physics: 'Ví dụ lỗi sai: nhầm hướng lực, sai công thức vận tốc/gia tốc, hiểu sai nguyên lý áp suất, nhầm về truyền nhiệt...',
      chemistry: 'Ví dụ lỗi sai: nhầm phản ứng hóa học, sai về tính chất axit-bazơ, nhầm trạng thái chất, hiểu sai về nồng độ dung dịch...',
      biology: 'Ví dụ lỗi sai: nhầm về quang hợp/hô hấp, sai về hệ tuần hoàn, hiểu sai di truyền, nhầm về hệ sinh thái...',
    };

    const prompt =
      `Bạn là "thám tử học đường", tạo tình huống bí ẩn trong trường học liên quan đến môn ${subjectLabel}.\n\n` +
      `MÔN HỌC: ${subjectLabel} (${difficultyLabel})\n` +
      `${subjectExamples[validSubject] ?? ''}\n\n` +
      `NGUYÊN TẮC TẠO TÌNH HUỐNG:\n` +
      `- Bối cảnh NGẮN GỌN (3-4 câu), đi thẳng vào vấn đề\n` +
      `- Tình huống PHẢI liên quan tự nhiên đến kiến thức ${subjectLabel} (ví dụ: thí nghiệm hỏng, tính toán sai, hiện tượng bất thường mà cần kiến thức ${subjectLabel} để giải thích)\n` +
      `- KHÔNG gượng ép nhét kiến thức vào — tình huống phải xảy ra tự nhiên trong đời sống học sinh\n` +
      `- Quan sát bằng mắt thường, logic thường ngày. KHÔNG dùng thiết bị khoa học phức tạp\n\n` +
      `NGHI PHẠM:\n` +
      `- Là bạn học BÌNH THƯỜNG với nét riêng đời thường (đeo tai nghe, tóc nhuộm, hay vẽ bậy...)\n` +
      `- KHÔNG dùng kiểu "học bá", "lớp trưởng", "giỏi môn X". Chỉ là người bình thường.\n` +
      `- Nghi phạm đưa lập luận tự tin, nghe hợp lý, NHƯNG chứa MỘT lỗi sai kiến thức ${subjectLabel}\n` +
      `- Lỗi sai phải cụ thể, dựa trên hiểu lầm thực tế mà học sinh thường mắc phải\n` +
      (knowledgeContext ? `\n${knowledgeContext}\n` : '\n') +
      `Trả về JSON:\n` +
      `{\n` +
      `  "boi_canh": "3-4 câu ngắn gọn. Kể chuyện gì xảy ra, tại sao nghi ngờ. Ngôi thứ nhất, tự nhiên.",\n` +
      `  "ten_hung_thu": "Tên + nét riêng đời thường (vd: 'Minh - hay đeo kính gọng đen, ngồi bàn cuối')",\n` +
      `  "loi_khai": "Lời biện minh tự tin, chứa lỗi sai kiến thức ${subjectLabel} cụ thể. Giọng tự nhiên.",\n` +
      `  "kien_thuc_an": "Chỉ ra lỗi sai cụ thể + giải thích đúng bằng kiến thức ${subjectLabel}.",\n` +
      `  "tu_khoa_thang_cuoc": ["từ khóa 1", "từ khóa 2"]\n` +
      `}\n\n` +
      `QUAN TRỌNG: Tình huống phải HỢP LÝ và liên quan tự nhiên đến ${subjectLabel}. Lỗi sai phải là loại học sinh thường nhầm trong thực tế.`;

    const geminiResponse = await geminiService.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 8000,
    });

    const raw = geminiResponse.content;

    if (!raw) {
      throw new Error('Kimi trả về nội dung rỗng');
    }

    // Parse JSON
    let fullCase: FullGeneratedCase | null = null;
    const attempts: string[] = [
      raw,
      raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
    ];
    const braceMatch = raw.match(/\{[\s\S]*\}/);
    if (braceMatch) attempts.push(braceMatch[0]);

    for (const candidate of attempts) {
      try {
        fullCase = JSON.parse(candidate) as FullGeneratedCase;
        break;
      } catch {
        // try next
      }
    }

    if (!fullCase) {
      throw new Error(`AI không trả về JSON hợp lệ`);
    }

    if (
      !fullCase.boi_canh ||
      !fullCase.ten_hung_thu ||
      !fullCase.loi_khai ||
      !fullCase.kien_thuc_an ||
      !Array.isArray(fullCase.tu_khoa_thang_cuoc) ||
      fullCase.tu_khoa_thang_cuoc.length === 0
    ) {
      throw new Error('Dữ liệu AI thiếu trường bắt buộc');
    }

    // Save to DB
    const { error: dbError } = await supabase
      .from('rooms')
      .update({ case_data: fullCase })
      .eq('code', roomCode);

    if (dbError) throw new Error(`Lỗi lưu DB: ${dbError.message}`);

    // Return safe case (without tu_khoa_thang_cuoc)
    const { tu_khoa_thang_cuoc: _omit, ...safeCase } = fullCase;

    res.json(safeCase);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Generate case error:', error);
    res.status(500).json({ error: message });
  }
});

export default router;
