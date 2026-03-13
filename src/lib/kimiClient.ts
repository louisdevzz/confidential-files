/**
 * Backend API Client
 *
 * Tầng 1 — generateCase():   Gọi backend API để sinh vụ án.
 * Tầng 2 — chatWithSuspect(): Gọi backend API để nhập vai hung thủ.
 *
 * Tất cả calls đến Kimi API đều qua backend Express server để:
 *  • Tránh lỗi CORS khi gọi trực tiếp từ browser
 *  • Ẩn KIMI_API_KEY khỏi JS bundle
 *  • Đảm bảo tu_khoa_thang_cuoc (answer keywords) không bao giờ về client
 */

import type { Subject, Difficulty, SafeGeneratedCase } from "@/lib/database.types";

const API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || "http://localhost:3001/api";

// Helper để gọi API
const apiCall = async <T>(endpoint: string, body: unknown): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
};

// ─── Tầng 1: Sinh vụ án ───────────────────────────────────────────────────────

/**
 * Gọi backend API để sinh vụ án và lưu vào DB.
 * Nhận lại SafeGeneratedCase — KHÔNG chứa tu_khoa_thang_cuoc.
 *
 * @param subject  - Môn học
 * @param difficulty - Độ khó
 * @param roomCode - Mã phòng để backend lưu case vào đúng row
 */
export const generateCase = async (
  subject: Subject,
  difficulty: Difficulty,
  roomCode: string
): Promise<SafeGeneratedCase> => {
  return apiCall<SafeGeneratedCase>("/cases/generate", {
    subject,
    difficulty,
    roomCode,
  });
};

// ─── Tầng 2: Chat với hung thủ ────────────────────────────────────────────────

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Gọi backend API để lấy phản hồi của hung thủ.
 * Backend đọc tu_khoa_thang_cuoc từ DB — client không cần truyền caseData.
 *
 * @param messages - Lịch sử cuộc hội thoại (được sanitize phía server)
 * @param roomCode - Mã phòng để backend lấy đúng case từ DB
 * @returns Phản hồi của hung thủ. Nếu chứa [GAME_OVER] → hung thủ đã nhận tội.
 */
export const chatWithSuspect = async (
  messages: ChatTurn[],
  roomCode: string
): Promise<string> => {
  const data = await apiCall<{ response: string }>("/chat", {
    roomCode,
    messages,
  });

  if (!data?.response) {
    throw new Error("Backend không trả về phản hồi.");
  }

  return data.response;
};
