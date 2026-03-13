# AGENTS.md — Hướng Dẫn Cho AI Coding Agents

Tài liệu này dành cho các AI coding agents (Cursor, Copilot, Codex, v.v.) làm việc với codebase **"Hồ Sơ Mật: AI Ngoại Phạm"**.

---

## Tổng Quan Dự Án

Game trinh thám học đường **Co-op** chạy trên Web. Học sinh (3–5 người) cùng "hỏi cung" một AI nhập vai hung thủ, sử dụng kiến thức Toán / Lý / Hóa / Sinh để bẻ gãy lời khai giả và ép AI nhận tội.

---

## Package Manager

**LUÔN dùng `bun`**, không dùng `npm` hay `yarn`:

```sh
bun install            # cài dependencies
bun add <package>      # thêm package
bun run dev            # dev server
bun run test           # chạy tests
bunx playwright test   # E2E tests
```

---

## Quy Ước Code

### Cấm Tuyệt Đối
- `any` type — dùng `unknown` hoặc type cụ thể
- Mutate state trực tiếp — dùng immutable patterns
- Custom CSS ngoài `App.css` / `index.css` — dùng Tailwind
- Sửa file trong `src/components/ui/` — đây là shadcn/ui generated
- `Math.random()` cho security-sensitive IDs

### Bắt Buộc
- `interface` cho component props
- `type` cho union/utility types
- Arrow function components
- `cn()` từ `src/lib/utils.ts` cho conditional classes
- Framer Motion cho mọi animation

---

## Kiến Trúc Quan Trọng

### Hai Tầng AI

```
Tầng 1 (Game Master)
  Input:  { subject, difficulty }
  Output: GeneratedCase (JSON)
  Nhiệm vụ: Sinh vụ án + lời khai sai + answerKeywords

Tầng 2 (Suspect AI)
  Input:  System prompt persona + chat history
  Output: Streamed text response
  Nhiệm vụ: Nhập vai hung thủ, detect keyword, kết thúc với [GAME_OVER]
```

### Schema Tầng 1 (KHÔNG thay đổi)

```ts
interface GeneratedCase {
  caseId: string;
  title: string;
  setting: string;
  suspectName: string;
  falseStatement: string;
  subject: "math" | "physics" | "chemistry" | "biology";
  answerKeywords: string[];   // SERVER-SIDE ONLY — không gửi về client
  difficulty: 1 | 2 | 3;
}
```

---

## Luồng Điều Hướng

```
/ (Index)
├── /create-room → CreateRoom → /lobby/:code
└── /join-room   → JoinRoom  → /lobby/:code
                                    └── /chat/:code  [TODO]
```

---

## Security Rules — Agent Phải Tuân Thủ

1. **`answerKeywords` KHÔNG BAO GIỜ xuất hiện trong response về client**
2. Room code phải dùng `crypto.getRandomValues()` hoặc server-side CSPRNG
3. Sanitize user input trước khi đưa vào LLM prompt
4. Rate limit: 10 messages/phút/user trong phòng chat
5. Không log chat content của user

---

## Những Tính Năng Chưa Implement

Khi được yêu cầu implement các phần dưới, hỏi rõ spec trước khi code:

| Feature | Ghi Chú |
|---------|---------|
| Chat Room (`/chat/:code`) | WebSocket, Tầng 2 integration |
| WebSocket Server | Real-time Co-op |
| Tầng 1 API | Sinh án tự động |
| Tầng 2 Chat | Suspect persona + keyword detection |
| Gacha System | Phần thưởng sau game |
| Leaderboard | Bảng xếp hạng toàn server |
| MVP Detection | Chấm điểm người chốt hạ |
| Authentication | Đăng nhập học sinh |

---

## Testing Requirements

- Unit tests: `src/test/` dùng Vitest
- E2E tests: Playwright
- Coverage mục tiêu: **80%+** business logic
- Chạy `bun run test` sau mỗi thay đổi logic quan trọng

---

## File Size Limits

- Tối đa **400 dòng/file** — nếu vượt, tách thành components nhỏ hơn
- Không tạo file mới nếu có thể edit file hiện có
