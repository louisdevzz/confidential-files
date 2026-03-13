import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { GeminiService } from '../services/geminiService.js';
import type { FullGeneratedCase, GenerateCaseRequest } from '../types/index.js';

const router = Router();
const geminiService = new GeminiService();

const SUBJECTS = ['math', 'physics', 'chemistry', 'biology'] as const;

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

function getRandomSubject(): string {
  const randomIndex = Math.floor(Math.random() * SUBJECTS.length);
  return SUBJECTS[randomIndex];
}

router.post('/generate', async (req, res) => {
  try {
    const { difficulty, roomCode } = req.body as GenerateCaseRequest;

    if (!difficulty || !roomCode) {
      return res.status(400).json({ error: 'difficulty và roomCode là bắt buộc' });
    }

    // Tự động random chọn môn học
    const subject = getRandomSubject();
    const subjectLabel = SUBJECT_LABELS[subject];
    const difficultyLabel = DIFFICULTY_LABELS[difficulty] ?? difficulty;

    const prompt =
      `Bạn là một "thám tử học đường" cấp 3, sử dụng phương pháp quan sát và suy luận của Sherlock Holmes nhưng trong bối cảnh trường học bình dị.\n\n` +
      `Nhiệm vụ: Hãy TỰ SÁNG TẠO ra MỘT tình huống bí ẩn xảy ra trong trường học (lớp học, thư viện, phòng lab, căn tin...). Tình huống phải thực tế, gần gũi với đờ sống học sinh.\n\n` +
      `PHONG CÁCH VIẾT (Quan trọng nhất):\n` +
      `1. Tự nhiên như kể chuyện: Viết như đang tâm sự với bạn cùng lớp, dùng ngôi thứ nhất ("Tôi").\n` +
      `2. Quan sát tỉ mỉ nhưng đơn giản: Chú ý những chi tiết nhỏ bình thường - vết bẩn trên quần áo, giấy tờ để lung tung, mùi lạ trong không khí... Không dùng thiết bị khoa học phức tạp.\n` +
      `3. Suy luận logic từ thực tế: Từ những dấu hiệu bình dị, suy ra điều bất thường. Ví dụ: "Chiếc ghế bị xô lệch chứng tỏ ai đó vừa đứng dậy vội vàng", "Vết mực còn ướt trên tay nghĩa là vừa viết xong".\n` +
      `4. Tình huống độc đáo: Không dùng mô-típ cũ (mất bánh kem, heo đất). Hãy nghĩ tình huống mới: bài kiểm tra bị làm rơi, đồ dùng học tập biến mất kỳ lạ, thí nghiệm có kết quả bất thường...\n` +
      `5. Tuyệt đối KHÔNG dùng: tia laser, hồng ngoại, thiết bị điện tử phức tạp, từ ngữ khoa học máy móc. Chỉ dùng quan sát bằng mắt thường và suy luận logic.\n\n` +
      `LỜI KHAI CỦA NGHI PHẠM:\n` +
      `- Nghi phạm là bạn học thông minh, tự tin, đưa ra lập luận nghe có vẻ logic.\n` +
      `- NHƯNG trong lập luận đó có chứa một lỗi sai về kiến thức ${subjectLabel} (${difficultyLabel}).\n` +
      `- Lỗi sai này không quá hiển nhiên, cần hiểu biết ${subjectLabel} mới phát hiện được.\n\n` +
      `Trả về JSON:\n` +
      `{\n` +
      `  "boi_canh": "4-6 câu kể lại tình huống. Tự nhiên, có chi tiết quan sát thực tế, dẫn đến việc phát hiện nghi phạm. Không dùng từ khoa học khô khan.",\n` +
      `  "ten_hung_thu": "Tên bạn học và đặc điểm nhận dạng (vd: Minh - lớp trưởng hay ngồi góc lớp, Hương - bạn giỏi Hóa)",\n` +
      `  "loi_khai": "Lờ biện minh tự tin của nghi phạm. Nghe logic nhưng chứa lỗi kiến thức ${subjectLabel}. Giọng điệu tự nhiên như học sinh nói chuyện.",\n` +
      `  "kien_thuc_an": "Giải thích đúng bằng kiến thức ${subjectLabel}, chỉ ra lỗi sai trong lờ khai một cách rõ ràng.",\n` +
      `  "tu_khoa_thang_cuoc": ["từ khóa 1", "từ khóa 2"]\n` +
      `}\n\n` +
      `QUAN TRỌNG: Viết như học sinh kể chuyện cho bạn nghe. Tự nhiên, logic, không gượng ép, không dùng thiết bị khoa học phức tạp!`;

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
