// supabase/functions/generate-case/index.ts
// Tầng 1 — Sinh vụ án qua Kimi K2 (server-side proxy — tránh CORS & ẩn API key)
// answerKeywords (tu_khoa_thang_cuoc) được lưu vào DB, KHÔNG trả về client.
// Kimi API tương thích OpenAI — gọi trực tiếp bằng fetch (không cần SDK, không có CORS server-side).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

const SUBJECT_LABELS: Record<string, string> = {
  math: "Toán Học",
  physics: "Vật Lý",
  chemistry: "Hóa Học",
  biology: "Sinh Học",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "lớp 6–8, kiến thức cơ bản",
  medium: "lớp 9–10, kiến thức trung bình",
  hard: "lớp 11–12, kiến thức nâng cao",
};

interface FullGeneratedCase {
  boi_canh: string;
  ten_hung_thu: string;
  loi_khai: string;
  kien_thuc_an: string;
  tu_khoa_thang_cuoc: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const { subject, difficulty, roomCode } = (await req.json()) as {
      subject: string;
      difficulty: string;
      roomCode: string;
    };

    if (!subject || !difficulty || !roomCode) {
      return new Response(
        JSON.stringify({ error: "subject, difficulty và roomCode là bắt buộc" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("KIMI_API_KEY");
    if (!apiKey) throw new Error("KIMI_API_KEY chưa được cấu hình trong Supabase secrets");

    const model = Deno.env.get("KIMI_MODEL") ?? "kimi-k2";
    const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
    const difficultyLabel = DIFFICULTY_LABELS[difficulty] ?? difficulty;

    const prompt =
      `Hãy đóng vai nhà văn trinh thám. Đối tượng là học sinh cấp 2–3 Việt Nam.\n\n` +
      `Tạo MỘT vụ án mạng hoặc trộm cắp hấp dẫn, phù hợp lứa tuổi.\n` +
      `Bằng chứng ngoại phạm của hung thủ PHẢI chứa một điểm vô lý dựa trên kiến thức môn ${subjectLabel} (${difficultyLabel}).\n\n` +
      `Trả về CHỈ một đối tượng JSON hợp lệ (không có markdown, không có text ngoài JSON) với cấu trúc:\n` +
      `{\n` +
      `  "boi_canh": "3–5 câu mô tả hiện trường vụ án sinh động và hấp dẫn",\n` +
      `  "ten_hung_thu": "Họ tên đầy đủ + nghề nghiệp của hung thủ",\n` +
      `  "loi_khai": "Lời khai ngoại phạm của hung thủ, trong đó ẩn một sai lầm kiến thức ${subjectLabel}",\n` +
      `  "kien_thuc_an": "Giải thích khoa học ĐÚNG cho lỗi sai đó — đây là đáp án, không hiện cho học sinh",\n` +
      `  "tu_khoa_thang_cuoc": ["từ khóa 1", "từ khóa 2", "từ khóa 3"]\n` +
      `}\n\n` +
      `Yêu cầu tu_khoa_thang_cuoc: 2–3 cụm từ / thuật ngữ khoa học mà học sinh BẮT BUỘC phải đề cập chính xác để chứng minh họ hiểu đúng kiến thức và phá được lời khai giả.`;

    const kimiRes = await fetch("https://api.kimi.com/coding/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "User-Agent": "KimiCLI/0.77",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.6, // kimi-k2.5 only allows 0.6
        max_tokens: 8000,
        // Enable thinking for kimi-k2.5 and other reasoning models
        thinking: { enabled: true, budget_tokens: 5000 },
        // NOTE: response_format omitted — not supported by all kimi models
      }),
    });

    if (!kimiRes.ok) {
      const errText = await kimiRes.text();
      throw new Error(`Kimi API ${kimiRes.status}: ${errText.slice(0, 300)}`);
    }

    // Log full response for debugging
    const kimiData = await kimiRes.json() as {
      choices: Array<{
        message: { content: string; reasoning_content?: string };
      }>;
    };
    console.log("Kimi raw response:", JSON.stringify(kimiData).slice(0, 1000));

    const msg = kimiData.choices[0]?.message;
    // Kimi thinking models (kimi-k2.5) may return JSON in reasoning_content; content may be empty
    const raw = (msg?.content || msg?.reasoning_content || "").trim();

    if (!raw) {
      throw new Error(
        `Kimi trả về nội dung rỗng. Full response: ${JSON.stringify(kimiData).slice(0, 500)}`
      );
    }

    // Robust JSON extraction:
    // 1) Try direct parse
    // 2) Strip markdown code fences (```json ... ``` or ``` ... ```)
    // 3) Fallback: extract first {...} block
    let fullCase: FullGeneratedCase | null = null;
    const attempts: string[] = [
      raw,
      raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
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
      throw new Error(`AI không trả về JSON hợp lệ. Raw response: ${raw.slice(0, 300)}`);
    }

    if (
      !fullCase.boi_canh ||
      !fullCase.ten_hung_thu ||
      !fullCase.loi_khai ||
      !fullCase.kien_thuc_an ||
      !Array.isArray(fullCase.tu_khoa_thang_cuoc) ||
      fullCase.tu_khoa_thang_cuoc.length === 0
    ) {
      throw new Error(`Dữ liệu AI thiếu trường bắt buộc: ${JSON.stringify(Object.keys(fullCase))}`);
    }

    // Lưu FULL case (kể cả tu_khoa_thang_cuoc) vào DB bằng service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: dbError } = await supabase
      .from("rooms")
      .update({ case_data: fullCase })
      .eq("code", roomCode);

    if (dbError) throw new Error(`Lỗi lưu DB: ${dbError.message}`);

    // Trả về SAFE case — KHÔNG bao gồm tu_khoa_thang_cuoc
    const { tu_khoa_thang_cuoc: _omit, ...safeCase } = fullCase;

    return new Response(JSON.stringify(safeCase), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
