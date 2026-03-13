# CLAUDE.md — Hướng Dẫn Cho AI Assistant

Tài liệu này cung cấp ngữ cảnh và quy tắc cho Claude (hoặc bất kỳ AI assistant nào) khi làm việc với codebase **"Hồ Sơ Mật: AI Ngoại Phạm"**.

---

## Dự Án Là Gì?

Game trinh thám học đường Co-op chạy trên Web. Học sinh nhóm lại (3–5 người), đọc hồ sơ vụ án do AI sinh ra, rồi "hỏi cung" một AI nhập vai hung thủ. Để thắng, học sinh phải dùng kiến thức thật (Toán / Lý / Hóa / Sinh) để vạch trần lỗi sai trong lời khai của AI.

**Hai tầng AI cốt lõi:**
- **Tầng 1 (Game Master)**: Sinh vụ án ngẫu nhiên, tạo lời khai có lỗi sai kiến thức, nhúng từ khóa đáp án ẩn
- **Tầng 2 (Suspect AI)**: Nhập vai hung thủ trong phòng chat, phủ nhận → nhận tội khi bị vạch từ khóa

---

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui + Radix UI + Tailwind CSS
- **Animation**: Framer Motion
- **Routing**: React Router DOM v6
- **Package Manager**: Bun (dùng `bun` thay vì `npm`)
- **Testing**: Vitest (unit), Playwright (E2E)

---

## Lệnh Thường Dùng

```sh
bun run dev          # Dev server (http://localhost:5173)
bun run build        # Production build
bun run test         # Vitest unit tests
bun run lint         # ESLint
bunx playwright test # E2E tests
```

---

## Cấu Trúc Pages

| File | Mô Tả |
|------|-------|
| `src/pages/Index.tsx` | Landing page, hero section, CTA |
| `src/pages/CreateRoom.tsx` | Tạo phòng — sinh mã room và gọi API Tầng 1 |
| `src/pages/JoinRoom.tsx` | Tham gia phòng bằng mã code |
| `src/pages/Lobby.tsx` | Phòng chờ Co-op, hiển thị danh sách player |
| `src/pages/NotFound.tsx` | 404 fallback |

**Luồng điều hướng:**
```
Index → CreateRoom → Lobby/:code → [Chat Room - chưa implement]
Index → JoinRoom   → Lobby/:code → [Chat Room - chưa implement]
```

---

## Quy Tắc Code

### TypeScript
- Luôn dùng `interface` cho props của component
- Dùng `type` cho union types và utility types
- Không dùng `any` — dùng `unknown` nếu cần
- Tất cả props phải có type annotation

### React
- Function components với arrow functions
- Custom hooks đặt trong `src/hooks/`, tên bắt đầu bằng `use`
- Không mutate state trực tiếp — luôn dùng immutable patterns
- Sử dụng Framer Motion cho tất cả animation (không dùng CSS animation thuần)

### Styling
- **Chỉ dùng Tailwind CSS** — không viết CSS tùy chỉnh (trừ `App.css`, `index.css`)
- Dùng `cn()` từ `src/lib/utils.ts` để merge conditional classes
- shadcn/ui components nằm trong `src/components/ui/` — không sửa trực tiếp, extend bằng wrapper

### File Organization
- Tối đa 400 dòng/file — refactor thành component nhỏ hơn nếu vượt
- Mỗi page tự chứa sub-components trong cùng file (nếu nhỏ) hoặc tách ra `src/components/`

---

## Quy Tắc AI Integration

### Tầng 1 — Game Master Prompt
Khi implement API call sinh án:
- Output phải là JSON có schema cố định (dễ parse, an toàn)
- Luôn validate JSON response trước khi dùng — không tin tưởng LLM output trực tiếp
- Timeout tối đa 15s, có fallback case mặc định nếu API lỗi

```ts
interface GeneratedCase {
  caseId: string;
  title: string;
  setting: string;
  suspectName: string;
  falseStatement: string;     // Lời khai có lỗi sai
  subject: "math" | "physics" | "chemistry" | "biology";
  answerKeywords: string[];   // Từ khóa để chấm điểm (KHÔNG gửi về client)
  difficulty: 1 | 2 | 3;
}
```

### Tầng 2 — Suspect AI Chat
- System prompt persona phải chứa: tên, tính cách ngoan cố, lời khai giả, và trigger nhận tội
- **BẮT BUỘC**: Keyword matching phải server-side — không bao giờ gửi `answerKeywords` về browser
- Stream response để cải thiện UX (không đợi full response)

---

## Bảo Mật (Security)

- `answerKeywords` chỉ tồn tại server-side — **KHÔNG BAO GIỜ** đưa vào response về client
- Validate và sanitize tất cả user input trước khi đưa vào LLM prompt (chống prompt injection)
- Mã phòng (room code) dùng CSPRNG, không dùng `Math.random()`
- Rate limiting: tối đa 10 messages/phút/user trong phòng chat
- Không log nội dung chat của người dùng

---

## Testing

- **Unit tests** (`src/test/`): Vitest — test utils, hooks, logic xử lý
- **E2E tests**: Playwright — test luồng chính: tạo phòng → vào lobby → chat
- Mục tiêu coverage: **80%+** cho business logic
- Chạy tests trước mỗi commit lớn

---

## Những Thứ Chưa Implement (TODO)

- [ ] Chat Room page (phòng hỏi cung thực sự)
- [ ] WebSocket server cho real-time Co-op
- [ ] Tầng 1 API integration (sinh án)
- [ ] Tầng 2 AI chat integration (suspect persona)
- [ ] Hệ thống Gacha
- [ ] Leaderboard / Bảng xếp hạng
- [ ] MVP detection & scoring
- [ ] Authentication (đăng nhập học sinh)

---

## Không Làm

- Không sửa files trong `src/components/ui/` trực tiếp (đây là shadcn/ui generated)
- Không dùng `npm` hay `yarn` — dự án dùng **Bun**
- Không hardcode API keys trong source code — dùng `.env.local`
- Không viết CSS classes mà Tailwind đã có sẵn
- Không tạo file mới nếu có thể edit file hiện có
