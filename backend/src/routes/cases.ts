import { Router, type Router as ExpressRouter } from 'express';
import { readFile } from 'node:fs/promises';
import { supabase } from '../lib/supabase.js';
import { GeminiService } from '../services/geminiService.js';
import { BraveSearchService } from '../services/braveSearchService.js';
import { caseMemoryStore } from '../services/caseMemoryStore.js';
import type { ChatResponse, FullGeneratedCase, GenerateCaseRequest } from '../types/index.js';

const router: ExpressRouter = Router();
const geminiService = new GeminiService();

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
        .replace(/^[#>*\-\d\.\s]+/, '')
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

const normalizeCaseCandidate = (value: unknown): FullGeneratedCase | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  const boiCanh = typeof candidate.boi_canh === 'string' ? candidate.boi_canh.trim() : '';
  const tenHungThu = typeof candidate.ten_hung_thu === 'string' ? candidate.ten_hung_thu.trim() : '';
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

const countSentences = (value: string): number =>
  value
    .split(/[.!?。！？]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0).length;

const hasEnoughTimeMarkers = (value: string): boolean => {
  const matches =
    value.match(
      /(\d{1,2}[:h]\d{1,2}|sáng|trưa|chiều|tối|ra chơi|trước giờ học|sau giờ học|tiết\s*\d|trực nhật|tan học)/gi
    ) ?? [];
  return matches.length >= 2;
};

const hasUnsafeTheme = (value: string): boolean => {
  return /(giết|thi thể|máu me|bom|khủng bố|ma túy|chém|đâm)/i.test(value);
};

const isGenericNarrative = (value: string): boolean => {
  const genericPatterns = [
    /xảy ra một sự cố nhỏ/i,
    /gây tranh cãi/i,
    /mọi thứ vẫn bình thường/i,
    /xuất hiện dấu vết bất thường/i,
    /có một điểm mâu thuẫn rõ ràng/i,
    /một bạn học trong lớp/i,
    /mình không làm gì sai cả/i,
    /nếu có sai thì chắc là do nhầm lẫn/i,
  ];

  return genericPatterns.some((pattern) => pattern.test(value));
};

const isCaseTooGeneric = (candidate: FullGeneratedCase): boolean => {
  const combined = [
    candidate.boi_canh,
    candidate.ten_hung_thu,
    candidate.loi_khai,
    candidate.kien_thuc_an,
  ].join(' ');

  return (
    isGenericNarrative(candidate.boi_canh) ||
    isGenericNarrative(candidate.loi_khai) ||
    candidate.ten_hung_thu.trim().toLowerCase() === 'một bạn học trong lớp' ||
    combined.length < 280
  );
};

const evaluateCaseQuality = (candidate: FullGeneratedCase): { score: number; reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];

  if (candidate.boi_canh.trim().length >= 180 && candidate.boi_canh.trim().length <= 900) {
    score += 15;
  } else {
    reasons.push('Bối cảnh quá ngắn/dài, thiếu cảm giác chuyện thật trong trường học.');
  }

  if (hasEnoughTimeMarkers(candidate.boi_canh)) {
    score += 15;
  } else {
    reasons.push('Bối cảnh chưa có đủ mốc thời gian rõ ràng để suy luận.');
  }

  if (/(lớp|bàn giáo viên|ngăn bàn|tủ lớp|phòng thí nghiệm|giờ ra chơi|trực nhật|tan học)/i.test(candidate.boi_canh)) {
    score += 10;
  } else {
    reasons.push('Thiếu không gian cụ thể của trường học Việt Nam.');
  }

  if (/(quỹ lớp|USB|thước|máy tính cầm tay|bình nước|quạt|đèn|vết mực|hóa đơn|chai nước|cây lớp|khăn giấy|cốc thủy tinh)/i.test(candidate.boi_canh)) {
    score += 10;
  } else {
    reasons.push('Thiếu vật chứng hoặc đồ vật cụ thể để suy luận.');
  }

  const testimonySentenceCount = countSentences(candidate.loi_khai);
  if (testimonySentenceCount >= 4 && testimonySentenceCount <= 6) {
    score += 10;
  } else {
    reasons.push('Lời khai cần 4-6 câu tự nhiên và mạch lạc hơn.');
  }

  if (/mâu thuẫn|không thể|vì vậy|do đó|suy ra/i.test(candidate.kien_thuc_an)) {
    score += 10;
  } else {
    reasons.push('Phần kiến thức ẩn chưa thể hiện rõ chuỗi suy luận dẫn đến mâu thuẫn.');
  }

  if (/(hóa đơn|vết|dấu|thời gian|kích thước|nhiệt|lực|nồng độ|quang hợp|xác suất|tỉ lệ|diện tích|chu vi)/i.test(candidate.kien_thuc_an)) {
    score += 10;
  } else {
    reasons.push('Thiếu liên kết trực tiếp giữa vật chứng/quan sát và kết luận.');
  }

  const uniqueKeywords = new Set(candidate.tu_khoa_thang_cuoc.map((keyword) => keyword.trim()).filter(Boolean));
  if (uniqueKeywords.size >= 3 && uniqueKeywords.size <= 5) {
    score += 10;
  } else {
    reasons.push('Từ khóa thắng cuộc cần 3-5 từ, ngắn gọn và không trùng lặp.');
  }

  const combinedNarrative = `${candidate.boi_canh} ${candidate.loi_khai}`;
  if (!hasUnsafeTheme(combinedNarrative)) {
    score += 10;
  } else {
    reasons.push('Nội dung đang quá bạo lực, chưa phù hợp bối cảnh học sinh.');
  }

  if (!isCaseTooGeneric(candidate)) {
    score += 10;
  } else {
    reasons.push('Case đang quá chung chung, giống template fallback hơn là tình huống thật.');
  }

  return { score, reasons };
};

const buildEmergencyCase = (subject: string, subjectLabel: string, difficultyLabel: string): FullGeneratedCase => {
  const bySubject: Record<string, FullGeneratedCase> = {
    math: {
      boi_canh:
        `Sáng nay trước tiết ${subjectLabel}, lớp em góp tiền quỹ để in tài liệu ôn tập. Bạn lớp phó học tập để tiền trong phong bì ở ngăn bàn giáo viên lúc 7h15, khi đó cả nhóm trực nhật đều nhìn thấy. Đến khoảng 7h40, trước khi cô vào lớp, bạn ấy mở phong bì ra thì thấy thiếu đúng 200.000 đồng. Minh nói lúc đó chỉ lên bàn giáo viên để mượn máy tính cầm tay kiểm tra lại phép chia tiền, nhưng trên tờ giấy nháp cạnh phong bì lại có phép tính chia sai số tiền còn lại theo đầu người.`,
      ten_hung_thu: 'Minh, lớp phó học tập',
      loi_khai:
        `Mình chỉ cầm phong bì lên để xem tổng tiền đã đủ chưa thôi. Nếu thiếu 200.000 đồng thì chắc mọi người cộng nhầm từ đầu, vì chia tiền kiểu đó rất dễ lệch. Với lại lúc mình nhìn, số tiền còn lại vẫn chia hết cho 8 bạn nên không thể bảo là mình lấy. Theo mình, chỉ cần tổng sau cùng vẫn chia đều thì chứng tỏ không mất khoản nào cả. Mọi người đang nghi oan vì thấy mình đứng gần bàn giáo viên thôi.`,
      kien_thuc_an:
        `Lỗi sai nằm ở câu “chỉ cần tổng sau cùng vẫn chia đều thì chứng tỏ không mất khoản nào cả”. Một số tiền vẫn chia hết cho 8 không có nghĩa là nó chưa bị rút bớt, vì có rất nhiều giá trị khác nhau cùng chia hết cho 8. Tờ giấy nháp bên cạnh phong bì ghi phép chia theo số tiền còn lại sau khi đã bị bớt đi 200.000 đồng, chứng tỏ người viết đã nhìn thấy số tiền sau khi thiếu. Vì Minh là người thừa nhận đã cầm phong bì và còn để lại phép tính liên quan trực tiếp đến số tiền còn lại, lời khai của bạn ấy tự mâu thuẫn.`,
      tu_khoa_thang_cuoc: ['chia hết không suy ra đủ tiền', 'giấy nháp', '200000 đồng', 'mâu thuẫn phép chia'],
    },
    physics: {
      boi_canh:
        `Chiều nay sau giờ ra chơi, lớp em phát hiện quạt treo tường cuối lớp không quay nữa. Trước đó lúc 14h05 quạt vẫn chạy bình thường vì nhóm trực nhật còn đứng dưới quạt để lau bảng. Đến 14h20, khi cả lớp ổn định chỗ ngồi, cô bật lại công tắc thì quạt chỉ rung nhẹ rồi dừng. Nam nói mình chỉ ném khăn lau bảng lên quạt để gỡ một mẩu giấy bị mắc, nhưng chiếc khăn lại rơi ở vị trí lệch hẳn sang bên phải so với hướng Nam mô tả.`,
      ten_hung_thu: 'Nam, cao và hay nghịch quạt',
      loi_khai:
        `Mình chỉ quăng nhẹ khăn lên thôi nên không thể làm quạt hỏng được. Quạt đang quay thì nếu khăn chạm vào cũng chỉ bật ra chứ không tạo lực đáng kể. Hơn nữa mình đứng ngay dưới quạt, nếu khăn văng ra thì đương nhiên phải rơi thẳng xuống chỗ mình. Cả lớp cứ nghĩ do mình nghịch, nhưng có thể quạt đã yếu sẵn từ trước rồi. Mình không đụng gì mạnh cả.`,
      kien_thuc_an:
        `Lỗi sai nằm ở câu “khăn văng ra thì đương nhiên phải rơi thẳng xuống chỗ mình”. Khi quạt đang quay, vật bị hất ra vẫn mang vận tốc theo phương tiếp tuyến nên không rơi thẳng đứng ngay dưới tâm quạt. Chiếc khăn rơi lệch sang bên phải phù hợp với việc bị cánh quạt hất mạnh khi quạt đang quay, nghĩa là Nam đã ném khăn lúc quạt còn chạy chứ không phải chỉ “gỡ nhẹ”. Nếu chỉ chạm rất nhẹ như Nam nói, khó có chuyện quạt rung rồi hỏng ngay sau đó.`,
      tu_khoa_thang_cuoc: ['vận tốc tiếp tuyến', 'khăn rơi lệch', 'quạt đang quay', 'lời khai sai lực'],
    },
    chemistry: {
      boi_canh:
        `Trong giờ thực hành ${subjectLabel}, nhóm em dùng giấy quỳ để kiểm tra vài dung dịch mẫu. Khoảng 9h10, chai dung dịch số 2 vẫn được đặt nguyên trên khay giáo viên. Nhưng đến 9h25, trên áo trắng của Lan xuất hiện một vệt hồng nhạt kéo dài ở tay áo, còn nhãn chai số 2 bị đổi vị trí sang bàn cạnh cửa sổ. Lan nói mình không hề chạm vào chai đó, chỉ đi ngang qua lúc các bạn đang thu dọn, nhưng trong thùng rác gần chỗ bạn lại có một mẩu giấy quỳ chuyển đỏ.`,
      ten_hung_thu: 'Lan, bạn rất sợ bị trừ điểm thực hành',
      loi_khai:
        `Mình không đụng vào chai dung dịch số 2 đâu. Nếu chất đó bắn vào áo thì phải làm bạc màu hoặc vàng đi chứ không thể để lại vệt hồng như thế được. Với lại giấy quỳ đỏ thì gặp axit mới đổi màu, nên mẩu giấy trong thùng rác cũng không nói lên gì cả. Có khi ai đó làm đổ rồi mình vô tình đi ngang qua thôi. Mình không có lý do gì để giấu chuyện này.`,
      kien_thuc_an:
        `Lỗi sai nằm ở câu “giấy quỳ đỏ thì gặp axit mới đổi màu”. Thực tế, quỳ tím gặp axit chuyển đỏ, còn quỳ đỏ không dùng để kết luận như Lan nói. Mẩu giấy quỳ trong thùng rác cho thấy đã có người thử dung dịch rồi phát hiện tính axit. Vệt hồng nhạt trên áo cùng vị trí chai bị di chuyển cho thấy Lan đã cầm chai, thử bằng quỳ rồi làm bắn ra tay áo, sau đó đổi chỗ chai để tránh bị chú ý.`,
      tu_khoa_thang_cuoc: ['quỳ tím hóa đỏ', 'vệt hồng tay áo', 'đổi vị trí chai', 'axit'],
    },
    biology: {
      boi_canh:
        `Lớp em có một chậu cây đậu đặt cạnh cửa sổ để theo dõi trong dự án ${subjectLabel}. Sáng qua lúc trực nhật, cây vẫn xanh bình thường và đất còn hơi ẩm. Đến đầu giờ chiều nay, lá cây cụp xuống rõ rệt, một mặt chậu bị xoay hẳn vào trong lớp thay vì hướng ra nắng như mọi khi. Huy nói mình chỉ mang chậu vào trong vài phút để lau bệ cửa sổ rồi đặt lại, nhưng dưới đáy chậu lại có vệt nước đọng mới và đất trên mặt bị nén rất chặt.`,
      ten_hung_thu: 'Huy, tổ trưởng trực nhật',
      loi_khai:
        `Mình chỉ bê chậu vào một lúc rồi đặt lại thôi nên cây không thể héo nhanh như vậy được. Cây sống chủ yếu nhờ hô hấp, nên chuyện quay mặt chậu vào trong hay ra ngoài cũng không ảnh hưởng nhiều trong vài tiếng. Với lại đất càng nén chặt thì cây càng đứng vững, không liên quan gì đến việc lá cụp xuống cả. Có thể cây tự yếu sẵn từ mấy hôm trước. Mọi người đang để ý quá mức thôi.`,
      kien_thuc_an:
        `Lỗi sai nằm ở câu “cây sống chủ yếu nhờ hô hấp, nên quay mặt chậu vào trong hay ra ngoài cũng không ảnh hưởng nhiều”. Cây cần ánh sáng để quang hợp; việc xoay mặt chậu lệch hướng sáng làm thay đổi điều kiện sống của cây. Ngoài ra đất bị nén chặt và có vệt nước đọng cho thấy chậu đã bị tưới hoặc đặt lại vội vàng, ảnh hưởng đến rễ và khả năng trao đổi khí. Những dấu vết này mâu thuẫn với lời khai “chỉ bê vào một lúc rồi đặt lại”.`,
      tu_khoa_thang_cuoc: ['quang hợp cần ánh sáng', 'xoay chậu', 'đất nén chặt', 'vệt nước đáy chậu'],
    },
  };

  return bySubject[subject] ?? bySubject.physics;
};

router.post('/generate', async (req, res) => {
  const { subject, difficulty, roomCode } = req.body as GenerateCaseRequest;

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
    const learningHint = await caseMemoryStore.getLearningHint(validSubject);

    const detectiveStyleReference = await withTimeout(getDetectiveStyleReference(), 800, '');

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
      `Bạn là biên kịch vụ án học đường theo tinh thần suy luận kiểu Sherlock/Conan: quan sát đời thường -> lộ mâu thuẫn -> bóc lỗi lập luận.\n\n` +
      `MÔN: ${subjectLabel} (${difficultyLabel})\n` +
      `MỤC TIÊU: tạo một vụ việc rất đời thường, tự nhiên như chuyện thật trong trường học Việt Nam.\n\n` +
      (learningHint || '') +
      `NGUYÊN TẮC CỐT LÕI (BẮT BUỘC):\n` +
      `- Mỗi manh mối phải trả lời được ít nhất 1 câu hỏi: AI làm? LÚC NÀO? BẰNG CÁCH NÀO?\n` +
      `- Không được có "chi tiết trang trí". Nếu nêu chi tiết thì chi tiết đó phải được dùng để suy luận.\n` +
      `- Chuỗi nhân quả phải rõ: Sự kiện -> Dấu vết -> Suy luận -> Mâu thuẫn trong lời khai.\n\n` +
      `KHUNG VỤ ÁN BẮT BUỘC:\n` +
      `1) Sự việc cụ thể xảy ra trước giờ học/trong giờ ra chơi/sau buổi trực nhật.\n` +
      `2) Có 1-2 manh mối quan sát được bằng mắt/thói quen/logic thời gian và CÓ QUAN HỆ TRỰC TIẾP với nghi phạm.\n` +
      `3) Nghi phạm có động cơ con người rất thật (sợ bị phạt, sợ mất uy tín, muốn đổ lỗi...).\n` +
      `4) Lời khai nghe hợp lý nhưng có đúng 1 lỗi kiến thức ${subjectLabel}.\n` +
      `5) Khi sửa đúng kiến thức, lời khai tự sập.\n\n` +
      `ANTI-PATTERN (TUYỆT ĐỐI TRÁNH):\n` +
      `- Không dùng câu đố/đề bài đặt làm mật khẩu theo kiểu gượng ép.\n` +
      `- Không tạo bối cảnh phi thực tế, không "drama" quá đà, không thuật ngữ hàn lâm dày đặc.\n` +
      `- Không giải thích kiến thức như sách giáo khoa; giữ văn nói tự nhiên của học sinh.\n\n` +
      `RÀNG BUỘC VỀ VẬT CHỨNG (RẤT QUAN TRỌNG):\n` +
      `- Nếu có hóa đơn: phải nêu rõ hóa đơn chứng minh hành động gì và mâu thuẫn với câu nào trong lời khai.\n` +
      `- Nếu có vật mới/vật thay thế: phải nêu vì sao kích thước/chủng loại/thời điểm mua tạo thành mâu thuẫn logic.\n` +
      `- Không được để vật chứng xuất hiện mà không ảnh hưởng kết luận.\n\n` +
      `MẪU TÌNH HUỐNG NÊN ƯU TIÊN (chọn 1):\n` +
      `- Mất đồ lớp học (quỹ, chìa khóa, USB thuyết trình, đạo cụ văn nghệ).\n` +
      `- Hỏng thiết bị nhỏ (quạt, đèn, bình nước nóng, cân trong phòng lab).\n` +
      `- Dấu vết bất thường (vết bẩn, mùi, vị trí đồ vật, thời gian không khớp).\n\n` +
      (detectiveStyleReference
        ? `THAM KHẢO PHONG CÁCH (tóm tắt từ nguồn nội bộ):\n${detectiveStyleReference}\n` +
          `- Chỉ học tinh thần: nhịp suy luận, căng thẳng thời gian, động cơ con người, cú bẻ từ chi tiết nhỏ.\n` +
          `- Tuyệt đối không chép lại cốt truyện, tên nhân vật, tình tiết đặc thù từ nguồn tham khảo.\n\n`
        : '') +
      `${scenarioSeeds[validSubject] ?? ''}\n\n` +
      `TRẢ VỀ CHÍNH XÁC JSON (không markdown, không text ngoài JSON):\n` +
      `{\n` +
      `  "boi_canh": "4-5 câu, ngôi tôi, phải có: 1 đồ vật cụ thể, 2 mốc thời gian cụ thể, 1 hành động đáng ngờ của nghi phạm, 1 lý do nghi ngờ rõ ràng",\n` +
      `  "ten_hung_thu": "Tên riêng học sinh + 1 nét nhận diện đời thường, ví dụ: Minh, lớp phó học tập",\n` +
      `  "loi_khai": "4-6 câu nói tự nhiên như học sinh, KHÔNG được chung chung kiểu 'Mình không làm gì sai cả', phải viện dẫn 1 lập luận kiến thức sai",\n` +
      `  "kien_thuc_an": "Chỉ rõ câu sai nào trong lời khai, kiến thức đúng là gì, vật chứng nào bác bỏ lời khai",\n` +
      `  "tu_khoa_thang_cuoc": ["3-5 từ khóa ngắn, bám sát mấu chốt suy luận"]\n` +
      `}\n\n` +
      `CẤM dùng các câu sáo rỗng như: "xảy ra một sự cố nhỏ", "mọi thứ vẫn bình thường", "xuất hiện dấu vết bất thường", "có một điểm mâu thuẫn rõ ràng".`;

    const geminiResponse = await withTimeout<ChatResponse | null>(
      geminiService.chat({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.35,
        maxTokens: 1200,
        responseMimeType: 'application/json',
      }),
      9000,
      null
    );

    const raw = geminiResponse?.content ?? '';
    const attemptPayloads: string[] = [raw];

    let fullCase: FullGeneratedCase | null = tryParseCaseJson(raw);

    if (!fullCase) {
      const rescuePrompt =
        `Chuyển nội dung dưới đây thành JSON HỢP LỆ theo đúng schema, không thêm giải thích, không markdown.\n` +
        `Schema bắt buộc: {\n` +
        `  \"boi_canh\": string,\n` +
        `  \"ten_hung_thu\": string,\n` +
        `  \"loi_khai\": string,\n` +
        `  \"kien_thuc_an\": string,\n` +
        `  \"tu_khoa_thang_cuoc\": string[]\n` +
        `}\n\n` +
        `NỘI DUNG GỐC:\n${raw}`;

      const rescue = await withTimeout<ChatResponse | null>(
        geminiService.chat({
          messages: [{ role: 'user', content: rescuePrompt }],
          temperature: 0.7,
          maxTokens: 15000,
          responseMimeType: 'application/json',
        }),
        10000,
        null
      );

      const rescueContent = rescue?.content ?? '';
      attemptPayloads.push(rescueContent);
      fullCase = tryParseCaseJson(rescueContent);
    }

    if (!fullCase) {
      const emergencyPrompt =
        `Hãy tạo MỚI một object JSON hợp lệ theo schema dưới đây cho vụ án học đường môn ${subjectLabel} (${difficultyLabel}).\n` +
        `Không markdown, không giải thích.\n` +
        `Schema: { boi_canh: string, ten_hung_thu: string, loi_khai: string, kien_thuc_an: string, tu_khoa_thang_cuoc: string[] }\n\n` +
        `Các đầu ra lỗi trước đó (để tránh lặp format lỗi):\n${attemptPayloads.filter(Boolean).slice(0, 2).join('\n---\n')}`;

      const emergency = await withTimeout<ChatResponse | null>(
        geminiService.chat({
          messages: [{ role: 'user', content: emergencyPrompt }],
          temperature: 0.25,
          maxTokens: 900,
          responseMimeType: 'application/json',
        }),
        2500,
        null
      );

      fullCase = tryParseCaseJson(emergency?.content ?? '');
    }

    if (!fullCase || isCaseTooGeneric(fullCase)) {
      fullCase = buildEmergencyCase(validSubject, subjectLabel, difficultyLabel);
    }

    let quality = evaluateCaseQuality(fullCase);

    await caseMemoryStore.saveGeneration({
      roomCode,
      subject: validSubject,
      difficulty,
      quality,
      caseData: fullCase,
    });
    console.info('case_generation_quality', {
      roomCode,
      subject: validSubject,
      score: quality.score,
      reasons: quality.reasons,
    });

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

    const fallbackSubject = (VALID_SUBJECTS as readonly string[]).includes(subject)
      ? subject
      : 'physics';
    const fallbackSubjectLabel = SUBJECT_LABELS[fallbackSubject];
    const fallbackDifficultyLabel = DIFFICULTY_LABELS[difficulty] ?? difficulty ?? 'trung bình';
    const emergencyCase = buildEmergencyCase(fallbackSubject, fallbackSubjectLabel, fallbackDifficultyLabel);
    const emergencyQuality = evaluateCaseQuality(emergencyCase);

    try {
      if (roomCode) {
        await supabase.from('rooms').update({ case_data: emergencyCase }).eq('code', roomCode);
      }

      await caseMemoryStore.saveGeneration({
        roomCode: roomCode ?? 'unknown',
        subject: fallbackSubject,
        difficulty: difficulty ?? 'unknown',
        quality: emergencyQuality,
        caseData: emergencyCase,
      });

      const { tu_khoa_thang_cuoc: _omit, ...safeEmergencyCase } = emergencyCase;
      return res.status(200).json(safeEmergencyCase);
    } catch (fallbackError) {
      console.error('Emergency case fallback failed:', fallbackError);
      res.status(500).json({ error: message });
    }
  }
});

export default router;
