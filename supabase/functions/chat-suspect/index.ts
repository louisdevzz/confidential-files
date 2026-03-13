// supabase/functions/chat-suspect/index.ts
// Tầng 2 — Chat với hung thủ AI (server-side proxy — tránh CORS & ẩn từ khóa đáp án)
// tu_khoa_thang_cuoc được đọc từ DB server-side, KHÔNG nhận từ client.
// Kimi API tương thích OpenAI — gọi trực tiếp bằng fetch (không cần SDK, không có CORS server-side).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey",
};

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface FullGeneratedCase {
  boi_canh: string;
  ten_hung_thu: string;
  loi_khai: string;
  kien_thuc_an: string;
  tu_khoa_thang_cuoc: string[];
}

/** Sanitize user input — chống prompt injection */
const sanitize = (text: string) =>
  text.replace(/[<>`{}[\]\\]/g, "").slice(0, 500);

const buildSystemPrompt = (c: FullGeneratedCase): string =>
  `Ngươi là ${c.ten_hung_thu} trong vụ án sau:\n${c.boi_canh}\n\n` +
  `Lời khai ngoại phạm của ngươi: "${c.loi_khai}"\n\n` +
  `LUẬT CHƠI (tuyệt đối tuân thủ):\n` +
  `- Tỏ ra kiêu ngạo, tự tin, gian xảo và bảo vệ lời khai bằng mọi giá.\n` +
  `- TUYỆT ĐỐI KHÔNG nhận tội cho đến khi thám tử giải thích đúng bản chất khoa học và đề cập đến: ${c.tu_khoa_thang_cuoc.join(", ")}.\n` +
  `- Trả lời ngắn 2–4 câu, đúng nhân vật, tiếng Việt tự nhiên, có cảm xúc.\n` +
  `- Khi thám tử giải thích đúng bản chất khoa học (phải đề cập từ khóa then chốt), ngươi hoảng hốt, thừa nhận tội lỗi và kết thúc tin nhắn bằng đúng cụm [GAME_OVER].\n` +
  `- Không bao giờ tiết lộ từ khóa, không gợi ý đáp án.`;

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
    const { roomCode, messages } = (await req.json()) as {
      roomCode: string;
      messages: ChatTurn[];
    };

    if (!roomCode || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "roomCode và messages là bắt buộc" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Đọc full case (kể cả tu_khoa_thang_cuoc) từ DB server-side
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: room, error: dbError } = await supabase
      .from("rooms")
      .select("case_data")
      .eq("code", roomCode)
      .single();

    if (dbError || !room?.case_data) {
      throw new Error("Không tìm thấy vụ án cho phòng này.");
    }

    const caseData = room.case_data as FullGeneratedCase;

    if (!Array.isArray(caseData.tu_khoa_thang_cuoc) || caseData.tu_khoa_thang_cuoc.length === 0) {
      throw new Error("Dữ liệu vụ án không hợp lệ (thiếu từ khoá đáp án).");
    }

    const apiKey = Deno.env.get("KIMI_API_KEY");
    if (!apiKey) throw new Error("KIMI_API_KEY chưa được cấu hình trong Supabase secrets");

    const model = Deno.env.get("KIMI_MODEL") ?? "kimi-k2";
    const systemPrompt = buildSystemPrompt(caseData);

    const safeMessages = messages.map((m) => ({
      role: m.role,
      content: sanitize(m.content),
    }));

    const kimiRes = await fetch("https://api.kimi.com/coding/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "User-Agent": "KimiCLI/0.77",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...safeMessages],
        temperature: 0.6, // kimi-k2.5 only allows 0.6
        max_tokens: 4000,
        // Enable thinking for kimi-k2.5 and other reasoning models
        thinking: { enabled: true, budget_tokens: 2000 },
      }),
    });

    if (!kimiRes.ok) {
      const errText = await kimiRes.text();
      throw new Error(`Kimi API ${kimiRes.status}: ${errText.slice(0, 300)}`);
    }

    const kimiData = await kimiRes.json() as { choices: Array<{ message: { content: string } }> };
    const response = kimiData.choices[0]?.message?.content?.trim() ?? "";

    return new Response(JSON.stringify({ response }), {
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
