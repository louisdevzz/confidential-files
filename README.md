# 🔍 Hồ Sơ Mật: AI Ngoại Phạm

> **Trinh Thám Học Đường Co-op — Đánh Bại AI Bằng Kiến Thức Thật**

"Hồ Sơ Mật: AI Ngoại Phạm" là một tựa game trinh thám học đường **nhiều ngườ chơi (Co-op)** chạy trên nền tảng Web. Game ứng dụng AI (LLM) làm **Game Master tự động tạo ra hàng ngàn vụ án vô tận** dựa trên kiến thức các môn Toán, Lý, Hóa, Sinh. Học sinh sẽ lập tổ đội, cùng nhau tham gia vào một phòng chat để "Hỏi cung" kẻ tình nghi (do AI nhập vai). Để chiến thắng, học sinh phải dùng kiến thức học thuật thật sự để **bẻ gãy lập luận dối trá của AI**, ép nó nhận tội, từ đó cày điểm quay Gacha đua Top.

Đây không chỉ là một mini-game mà hoàn toàn có thể trở thành một module **"Gamification" (Game hóa) cực kỳ đột phá** cho các nền tảng học tập thích ứng (Adaptive Learning), giúp học sinh tự nguyện ôn bài mà không hề gượng ép.

---

## 🎮 Vòng Lặp Gameplay Cốt Lõi (Gameplay Loop)

### 1. Sinh Án (Tự động)
Học sinh tạo phòng (Lobby). Hệ thống gọi **API Tầng 1** tự động đẻ ra một vụ án ngẫu nhiên:
- Bối cảnh câu chuyện học đường (lớp học, thư viện, phòng lab, căn tin...)
- Tên hung thủ & đặc điểm nhận dạng
- Lờ khai giả chứa **lỗi sai kiến thức** (Toán / Lý / Hóa / Sinh)
- Từ khóa đáp án (ẩn, dùng để chấm điểm)

### 2. Thảo Luận & Thẩm Vấn (Co-op)
Một nhóm **3–5 học sinh** cùng vào phòng. Đọc hồ sơ vụ án và bắt đầu chat trực tiếp với AI (**Tầng 2**):
- AI nhập vai hung thủ — **cực kỳ ngoan cố**, trả lờ trịch thượng và tung hỏa mù
- Cả nhóm phải bàn bạc để tìm ra điểm vô lý
- *Ví dụ: "Nhôm không phản ứng với H₂SO₄ đặc nguội" — AI đang nói dối!*

### 3. Cú Chốt Hạ (Combat bằng Kiến thức)
Một học sinh tìm ra chân lý, gõ lờ giải thích chứa **"Từ khóa cốt lõi"** vào khung chat:
- AI nhận diện được → lập tức thay đổi thái độ sang hoảng sợ
- AI nhận tội và nhả mã `[GAME_OVER]`

### 4. Vinh Danh MVP & Gacha
Game kết thúc. Hệ thống trao thưởng:
- Ngườ tung đòn "Chốt hạ" → **MVP** → nhận nhiều vé Gacha nhất
- Cả phòng dùng vé để quay:
  - 🃏 **Nhân vật Chibi Anime** (SSR 3%, SR 15%, R 35%, N 47%)
  - 🖼️ **Avatar độc quyền** để flex trên Bảng Xếp Hạng
  - 🎨 **AI tự động vẽ** — Mỗi nhân vật là một bức tranh chibi anime kawaii duy nhất

---

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Home    │  │  Create  │  │  Lobby   │  │  Gacha       │  │
│  │  Page    │  │  Room    │  │  (Co-op) │  │  (Quay thẻ)  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Join    │  │  Room    │  │  Profile │  │  Ranking     │  │
│  │  Room    │  │  List    │  │  (Equip) │  │  (Leaderboard)│  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘  │
└─────────────────────────────────┬───────────────────────────┘
                                  │ REST API / WebSocket
┌─────────────────────────────────▼───────────────────────────┐
│                    BACKEND (Express + Node.js)               │
│  ┌────────────────────┐   ┌────────────────────────────────┐│
│  │  Tầng 1 (GM)       │   │  Tầng 2 (Suspect AI)           ││
│  │  /api/cases        │   │  /api/chat                     ││
│  │  Sinh Án + Lờ Khai │   │  Hỏi Cung + Keyword Detection  ││
│  └────────────────────┘   └────────────────────────────────┘│
│  ┌────────────────────┐   ┌────────────────────────────────┐│
│  │  Gacha System      │   │  AI Image Generation           ││
│  │  /api/gacha        │   │  Gemini 3 Pro Image            ││
│  │  Roll + Collection │   │  Full-body Chibi Anime         ││
│  └────────────────────┘   └────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   Supabase         │
                    │  - PostgreSQL      │
                    │  - Realtime        │
                    │  - Storage         │
                    └────────────────────┘
```

### Hai Tầng AI

| Tầng | Vai Trò | API Endpoint | Prompt Strategy |
|------|---------|--------------|-----------------|
| **Tầng 1 — Game Master** | Sinh vụ án, dựng lờ khai sai, đặt từ khóa đáp án | `POST /api/cases/generate` | Zero-shot generation với schema JSON |
| **Tầng 2 — Suspect AI** | Nhập vai hung thủ, phủ nhận, tung hỏa mù, nhận tội khi bị vạch trần | `POST /api/chat` | System prompt persona + keyword detection |

### Gacha System

| Tính năng | Mô tả |
|-----------|-------|
| **Roll Gacha** | Quay nhân vật ngẫu nhiên với tỷ lệ rớt: SSR (3%), SR (15%), R (35%), N (47%) |
| **AI Image Generation** | Tự động tạo ảnh chibi anime bằng **Gemini AI** — mỗi nhân vật là duy nhất |
| **Collection** | Xem và quản lý bộ sưu tập nhân vật đã sở hữu |
| **Equip Avatar** | Đổi avatar profile bằng nhân vật trong bộ sưu tập |
| **Admin Mode** | Email `louisdevzz04@gmail.com` có vé Gacha vô hạn (∞) |

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
| **State Management** | TanStack Query (React Query) |
| **UI Components** | shadcn/ui, Radix UI, Tailwind CSS |
| **Animation** | Framer Motion |
| **Routing** | React Router DOM |
| **Authentication** | Supabase Auth |
| **Backend** | Express.js, Node.js |
| **Database** | Supabase (PostgreSQL) |
| **Realtime** | Supabase Realtime |
| **Storage** | Supabase Storage (avatars bucket) |
| **AI / LLM** | Gemini API (Google) |
| **Testing** | Vitest, Playwright |
| **Package Manager** | Bun |

---

## 🚀 Chạy Dự Án

### Prerequisites
- Node.js 18+ 
- Bun 1.0+
- Supabase account
- Gemini API key

### Setup

```sh
# Clone repo
git clone <YOUR_GIT_URL>
cd confidential-files

# Cài đặt dependencies (Frontend)
bun install

# Cài đặt dependencies (Backend)
cd backend && bun install
```

### Environment Variables

Tạo file `.env` ở root:

```env
# Frontend
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BACKEND_API_URL=http://localhost:3001/api
```

Tạo file `backend/.env`:

```env
# Backend
PORT=3001
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key
FRONTEND_URL=http://localhost:5173
```

### Database Setup

```sh
# Push schema lên Supabase
bun run db:push
```

### Run Development

```sh
# Terminal 1: Backend
cd backend && bun run dev

# Terminal 2: Frontend
bun run dev
```

### Testing

```sh
# Unit tests
bun run test

# E2E tests
bunx playwright test
```

### Build Production

```sh
# Build frontend
bun run build

# Build backend
cd backend && bun run build
```

---

## 📁 Cấu Trúc Thư Mục

```
├── src/                          # Frontend source
│   ├── pages/                    # React pages
│   │   ├── Index.tsx             # Landing page
│   │   ├── CreateRoom.tsx        # Tạo phòng
│   │   ├── JoinRoom.tsx          # Tham gia phòng
│   │   ├── Lobby.tsx             # Phòng chờ Co-op
│   │   ├── Game.tsx              # Màn chơi chat với AI
│   │   ├── Gacha.tsx             # Quay Gacha
│   │   ├── Profile.tsx           # Hồ sơ + Bộ sưu tập
│   │   ├── Ranking.tsx           # Bảng xếp hạng
│   │   └── RoomList.tsx          # Danh sách phòng
│   ├── components/               # Components
│   │   ├── Header.tsx            # Navigation header
│   │   └── ui/                   # shadcn/ui components
│   ├── hooks/                    # Custom React hooks
│   │   └── useAuth.tsx           # Auth context
│   ├── services/                 # API services
│   │   └── gachaService.ts       # Gacha API client
│   ├── lib/                      # Utilities
│   │   ├── supabase.ts           # Supabase client
│   │   └── utils.ts              # Helper functions
│   └── test/                     # Unit tests
│
├── backend/                      # Backend API
│   ├── src/
│   │   ├── routes/               # API routes
│   │   │   ├── cases.ts          # Tầng 1: Sinh án
│   │   │   ├── chat.ts           # Tầng 2: Chat AI
│   │   │   └── gacha.ts          # Gacha system
│   │   ├── services/             # Business logic
│   │   │   ├── geminiService.ts  # LLM chat
│   │   ├── lib/
│   │   │   └── supabase.ts       # Supabase admin client
│   │   └── server.ts             # Express server
│   └── package.json
│
├── supabase/                     # Database
│   ├── schema.sql                # Main schema
│   └── gacha-schema.sql          # Gacha tables
│
├── scripts/                      # Utility scripts
│   └── push-schema.mjs           # DB migration
│
└── package.json
```

---

## 🎯 Tính Năng Chính

### 1. Hệ Thống Phòng Co-op
- Tạo phòng với mã 6 chữ số
- Mờ bạn bè vào bằng mã phòng
- Realtime sync qua Supabase Realtime
- Chủ phòng có quyền điều khiển (bắt đầu game, kick member)

### 2. AI Game Master (Tầng 1)
- Tự động sinh vụ án dựa trên môn học (Toán/Lý/Hóa/Sinh)
- 3 cấp độ: Dễ (lớp 6-8), Trung bình (lớp 9-10), Khó (lớp 11-12)
- Lờ khai chứa lỗi sai kiến thức thật
- Đáp án ẩn với từ khóa cốt lõi

### 3. AI Suspect (Tầng 2)
- Nhập vai hung thủ với tính cách ngoan cố
- Phản ứng thông minh với câu hỏi
- Chỉ nhận tội khi phát hiện đúng từ khóa
- Giọng điệu học sinh, tự nhiên

### 4. Gacha System
- **AI Image Generation**: Mỗi nhân vật là ảnh chibi anime duy nhất
- **Rarity Tiers**: SSR (3%), SR (15%), R (35%), N (47%)
- **Collection**: Xem toàn bộ nhân vật đã sở hữu
- **Equip System**: Đổi avatar profile
- **Admin Mode**: Unlimited tickets cho email admin

### 5. Authentication
- Đăng nhập/Đăng ký qua Supabase Auth
- Profile với username, avatar
- Bảo mật JWT token

---

## 🎨 Tầm Nhìn Sản Phẩm

> Module "Gamification" đột phá cho các nền tảng **Adaptive Learning**

- **Học sinh tự nguyện ôn bài** — không cần ép buộc, vì game đủ hấp dẫn
- **Kiến thức được kiểm tra thực tế** — AI không thể bị qua mặt bằng từ ngữ mơ hồ
- **Co-op thúc đẩy teamwork** — nhóm phải thảo luận, phân tích cùng nhau
- **Gacha & Leaderboard** — tạo vòng lặp động lực dài hạn (retention)
- **Vô hạn nội dung** — AI Game Master sinh án mới mỗi ván, không bao giờ lặp lại
- **NFT-ready** — Mỗi nhân vật Gacha là unique AI-generated artwork

---

## 📝 API Documentation

### Cases API
```
POST /api/cases/generate
Body: { difficulty: "easy" | "medium" | "hard", roomCode: string }
Response: { boi_canh, ten_hung_thu, loi_khai, kien_thuc_an }
```

### Chat API
```
POST /api/chat
Body: { roomCode: string, messages: Array<{role, content}> }
Response: { response: string }
```

### Gacha API
```
GET  /api/gacha/characters          # Danh sách tất cả nhân vật
GET  /api/gacha/my-collection       # Bộ sưu tập của user (auth)
GET  /api/gacha/tickets             # Số vé còn lại (auth)
POST /api/gacha/roll                # Quay Gacha (auth)
POST /api/gacha/generate            # Generate nhân vật mới (auth)
POST /api/gacha/equip               # Trang bị nhân vật (auth)
GET  /api/gacha/history             # Lịch sử quay (auth)
```

---

## 🤝 Contributing

1. Fork repository
2. Tạo branch mới: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Mở Pull Request

---

## 📄 License

Private — All rights reserved.

---

## 🙏 Acknowledgments

- **Gemini AI** (Google) — LLM & Image Generation
- **Supabase** — Database & Authentication
- **shadcn/ui** — UI Components
- **Framer Motion** — Animations

---

<p align="center">
  <strong>🔍 Hồ Sơ Mật: AI Ngoại Phạm</strong><br>
  <em>Học mà chơi, chơi mà học!</em>
</p>
