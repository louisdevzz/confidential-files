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

    // Subject-specific scenario seeds — realistic incidents that naturally involve knowledge
    const scenarioSeeds: Record<string, string> = {
      math: [
        'Ví dụ tình huống tốt: tiền quỹ lớp bị thiếu sau khi ai đó tính toán sai, kết quả xổ số mini bị nghi gian lận vì xác suất bất thường, bản vẽ trang trí lớp bị sai tỉ lệ khiến không vừa tường...',
        'Ví dụ lỗi sai tự nhiên: nhầm diện tích hình tròn vs chu vi, tính sai tỉ lệ %, nhầm xác suất độc lập vs phụ thuộc, sai đơn vị quy đổi...',
      ].join('\n'),
      physics: [
        'Ví dụ tình huống tốt: cửa kính lớp bị vỡ và nghi phạm khai sai về hướng/lực va chạm, đồ vật rơi từ tầng trên nhưng vị trí rơi không khớp lời khai, tai nạn ở phòng thí nghiệm mà nghi phạm giải thích sai về điện/nhiệt...',
        'Ví dụ lỗi sai tự nhiên: nhầm quán tính, sai về phản xạ ánh sáng/bóng đổ, hiểu sai về trọng lực/rơi tự do, nhầm về dẫn nhiệt...',
      ].join('\n'),
      chemistry: [
        'Ví dụ tình huống tốt: vết ố bí ẩn trên áo trắng mà nghi phạm giải thích sai về phản ứng, mùi lạ trong phòng lab mà lời giải thích không đúng hóa chất, đồ ăn/nước uống bị biến đổi màu sắc bất thường...',
        'Ví dụ lỗi sai tự nhiên: nhầm tính chất axit-bazơ, sai về phản ứng oxi hóa, hiểu sai về nồng độ/pha loãng, nhầm trạng thái chất...',
      ].join('\n'),
      biology: [
        'Ví dụ tình huống tốt: cây cảnh trong lớp bị chết và nghi phạm khai sai về nguyên nhân, thức ăn bị hỏng nhanh bất thường mà lời giải thích sai về vi khuẩn, vật nuôi góc thiên nhiên bị ốm và nghi phạm hiểu sai về triệu chứng...',
        'Ví dụ lỗi sai tự nhiên: nhầm quang hợp/hô hấp, sai về di truyền trội lặn, hiểu sai chuỗi thức ăn, nhầm về hệ miễn dịch...',
      ].join('\n'),
    };

    const prompt =
      `Bạn là biên kịch truyện trinh thám học đường kiểu Thám Tử Conan, nhưng phù hợp với học sinh cấp 2-3.\n\n` +
      `MÔN HỌC: ${subjectLabel} (${difficultyLabel})\n\n` +
      `PHONG CÁCH "CONAN HỌC ĐƯỜNG":\n` +
      `Tạo một VỤ VIỆC xảy ra tự nhiên trong trường học — giống như một tập Conan thu nhỏ:\n` +
      `- Có SỰ VIỆC cụ thể xảy ra (đồ bị mất/hỏng, tai nạn nhỏ, hiện tượng bất thường, ai đó bị oan...)\n` +
      `- Có NGHI PHẠM với động cơ hợp lý (che giấu lỗi, đổ thừa người khác, giấu bằng chứng...)\n` +
      `- Có MANH MỐI mà thám tử phát hiện được qua quan sát\n` +
      `- Nghi phạm đưa ra NGOẠI PHẠM/LỜI GIẢI THÍCH nghe có lý — nhưng chứa lỗi sai kiến thức ${subjectLabel}\n` +
      `- KHÔNG có bạo lực, giết người, máu me. Chỉ là những sự việc đời thường ở trường học.\n\n` +
      `${scenarioSeeds[validSubject] ?? ''}\n\n` +
      `NGHI PHẠM:\n` +
      `- Là bạn học bình thường, có tính cách và ngoại hình đời thường\n` +
      `- KHÔNG miêu tả kiểu "học bá", "lớp trưởng", "giỏi môn X"\n` +
      `- Có ĐỘNG CƠ rõ ràng (sợ bị phạt, muốn đổ lỗi, che giấu sai lầm...)\n\n` +
      `LỜI KHAI:\n` +
      `- Nghi phạm giải thích/biện minh một cách tự tin, dùng kiến thức ${subjectLabel} để chứng minh mình vô tội\n` +
      `- NHƯNG trong lập luận đó có MỘT lỗi sai kiến thức ${subjectLabel} (${difficultyLabel})\n` +
      `- Lỗi sai phải là loại mà học sinh THỰC SỰ hay nhầm, không phải lỗi ngớ ngẩn\n` +
      `- Khi bị chỉ ra lỗi sai, lời khai sụp đổ → chứng minh nghi phạm nói dối\n` +
      (knowledgeContext ? `\n${knowledgeContext}\n` : '\n') +
      `Trả về JSON (CHỈ JSON, không có text khác):\n` +
      `{\n` +
      `  "boi_canh": "3-4 câu. Kể SỰ VIỆC gì xảy ra, phát hiện manh mối gì, và tại sao nghi ngờ người này. Viết ngôi thứ nhất, tự nhiên như đang kể cho bạn nghe.",\n` +
      `  "ten_hung_thu": "Tên + 1 nét ngoại hình đời thường (vd: 'Khánh - hay đội mũ lưỡi trai ngược', 'Linh - luôn đeo vòng tay gỗ')",\n` +
      `  "loi_khai": "Lời biện minh/ngoại phạm của nghi phạm. Dùng kiến thức ${subjectLabel} để tự bào chữa, nhưng chứa lỗi sai cụ thể. Giọng tự tin, tự nhiên.",\n` +
      `  "kien_thuc_an": "Chỉ ra lỗi sai CỤ THỂ trong lời khai + kiến thức ${subjectLabel} đúng là gì. Ngắn gọn, rõ ràng.",\n` +
      `  "tu_khoa_thang_cuoc": ["từ khóa chính xác 1", "từ khóa 2", "từ khóa 3"]\n` +
      `}\n\n` +
      `LƯU Ý QUAN TRỌNG:\n` +
      `- Tình huống phải TỰ NHIÊN như có thể xảy ra ngoài đời thật ở trường học\n` +
      `- KHÔNG gượng ép, KHÔNG vô lý, KHÔNG tạo tình huống chỉ để nhét kiến thức vào\n` +
      `- Kiến thức ${subjectLabel} phải ĐÚNG vai TRÒ: là công cụ để vạch trần lời nói dối, không phải mục đích chính của câu chuyện`;

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
