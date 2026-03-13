# 🔍 Hồ Sơ Mật: AI Ngoại Phạm

> **Trinh Thám Học Đường Co-op — Đánh Bại AI Bằng Kiến Thức Thật**

"Hồ Sơ Mật: AI Ngoại Phạm" là một tựa game trinh thám học đường **nhiều người chơi (Co-op)** chạy trên nền tảng Web. Game ứng dụng AI (LLM) làm **Game Master tự động tạo ra hàng ngàn vụ án vô tận** dựa trên kiến thức các môn Toán, Lý, Hóa, Sinh. Học sinh sẽ lập tổ đội, cùng nhau tham gia vào một phòng chat để "Hỏi cung" kẻ tình nghi (do AI nhập vai). Để chiến thắng, học sinh phải dùng kiến thức học thuật thật sự để **bẻ gãy lập luận dối trá của AI**, ép nó nhận tội, từ đó cày điểm quay Gacha đua Top.

Đây không chỉ là một mini-game mà hoàn toàn có thể trở thành một module **"Gamification" (Game hóa) cực kỳ đột phá** cho các nền tảng học tập thích ứng (Adaptive Learning), giúp học sinh tự nguyện ôn bài mà không hề gượng ép.

---

## 🎮 Vòng Lặp Gameplay Cốt Lõi (Gameplay Loop)

### 1. Sinh Án (Tự động)
Học sinh tạo phòng (Lobby). Hệ thống gọi **API Tầng 1** tự động đẻ ra một vụ án ngẫu nhiên:
- Bối cảnh câu chuyện
- Tên hung thủ & lý lịch
- Lời khai giả chứa **lỗi sai kiến thức** (Toán / Lý / Hóa / Sinh)
- Từ khóa đáp án (ẩn, dùng để chấm điểm)

### 2. Thảo Luận & Thẩm Vấn (Co-op)
Một nhóm **3–5 học sinh** cùng vào phòng. Đọc hồ sơ vụ án và bắt đầu chat trực tiếp với AI (**Tầng 2**):
- AI nhập vai hung thủ — **cực kỳ ngoan cố**, trả lời trịch thượng và tung hỏa mù
- Cả nhóm phải bàn bạc để tìm ra điểm vô lý
- *Ví dụ: "Nhôm không phản ứng với H₂SO₄ đặc nguội" — AI đang nói dối!*

### 3. Cú Chốt Hạ (Combat bằng Kiến thức)
Một học sinh tìm ra chân lý, gõ lời giải thích chứa **"Từ khóa cốt lõi"** vào khung chat:
- AI nhận diện được → lập tức thay đổi thái độ sang hoảng sợ
- AI nhận tội và nhả mã `[GAME_OVER]`

### 4. Vinh Danh MVP & Gacha
Game kết thúc. Hệ thống trao thưởng:
- Người tung đòn "Chốt hạ" → **MVP** → nhận nhiều vé Gacha nhất
- Cả phòng dùng vé để quay:
  - 🃏 Thẻ nhân vật Truyện tranh (**SSR**, **SR**)
  - 🖼️ Khung Avatar flex trên Bảng Xếp Hạng
  - 🎭 Đạo cụ dùng để "chơi dơ" bạn bè ở ván sau

---

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Lobby   │  │  Chat    │  │  Gacha / Leaderboard│  │
│  │  Room    │  │  Room    │  │  Board           │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
└─────────────────────────────┬───────────────────────┘
                              │ WebSocket / REST
┌─────────────────────────────▼───────────────────────┐
│                    BACKEND / BFF                     │
│  ┌────────────────┐   ┌────────────────────────────┐ │
│  │  Tầng 1 (GM)   │   │  Tầng 2 (Suspect AI)       │ │
│  │  Sinh Án       │   │  Hỏi Cung + Chốt Hạ        │ │
│  │  LLM Prompt    │   │  LLM Roleplay Persona       │ │
│  └────────────────┘   └────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Hai Tầng AI

| Tầng | Vai Trò | Prompt Strategy |
|------|---------|-----------------|
| **Tầng 1 — Game Master** | Sinh vụ án, dựng lời khai sai, đặt từ khóa đáp án | Zero-shot generation với schema JSON |
| **Tầng 2 — Suspect AI** | Nhập vai hung thủ, phủ nhận, tung hỏa mù, nhận tội khi bị vạch trần | System prompt persona + keyword detection |

---

## 📚 Môn Học Tích Hợp

| Môn | Ví Dụ Lỗi Sai AI Có Thể Dùng |
|-----|-------------------------------|
| **Hóa học** | Nhôm thụ động với H₂SO₄ đặc nguội / HNO₃ đặc nguội |
| **Vật lý** | Sai định luật bảo toàn năng lượng / động lượng |
| **Toán học** | Sai công thức lượng giác, giới hạn, tích phân |
| **Sinh học** | Sai cơ chế di truyền DNA, quá trình quang hợp |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **UI Components** | shadcn/ui, Radix UI, Tailwind CSS |
| **Animation** | Framer Motion |
| **Routing** | React Router DOM |
| **Real-time** | WebSocket (Co-op chat) |
| **AI / LLM** | LLM API (OpenAI / Gemini / Claude) |
| **Testing** | Vitest, Playwright |
| **Package Manager** | Bun |

---

## 🚀 Chạy Dự Án

```sh
# Clone repo
git clone <YOUR_GIT_URL>
cd confidential-files

# Cài đặt dependencies (dùng Bun)
bun install

# Khởi động dev server
bun run dev

# Chạy unit tests
bun run test

# Chạy E2E tests
bunx playwright test

# Build production
bun run build
```

### Biến Môi Trường

Tạo file `.env.local` ở root:

```env
VITE_LLM_API_KEY=your_api_key_here
VITE_LLM_API_URL=https://api.openai.com/v1
VITE_WS_URL=ws://localhost:3001
```

---

## 📁 Cấu Trúc Thư Mục

```
src/
├── pages/
│   ├── Index.tsx          # Landing page + Hero section
│   ├── CreateRoom.tsx     # Tạo phòng chơi
│   ├── JoinRoom.tsx       # Tham gia phòng bằng mã
│   ├── Lobby.tsx          # Phòng chờ Co-op
│   └── NotFound.tsx       # 404
├── components/
│   ├── NavLink.tsx        # Navigation
│   └── ui/                # shadcn/ui components
├── hooks/                 # Custom React hooks
├── lib/
│   └── utils.ts           # Utilities (cn, etc.)
└── test/                  # Unit & integration tests
```

---

## 🎯 Tầm Nhìn Sản Phẩm

> Module "Gamification" đột phá cho các nền tảng **Adaptive Learning**

- **Học sinh tự nguyện ôn bài** — không cần ép buộc, vì game đủ hấp dẫn
- **Kiến thức được kiểm tra thực tế** — AI không thể bị qua mặt bằng từ ngữ mơ hồ
- **Co-op thúc đẩy teamwork** — nhóm phải thảo luận, phân tích cùng nhau
- **Gacha & Leaderboard** — tạo vòng lặp động lực dài hạn (retention)
- **Vô hạn nội dung** — AI Game Master sinh án mới mỗi ván, không bao giờ lặp lại

---

## 📄 License

Private — All rights reserved.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
