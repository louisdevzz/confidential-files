# Backend API - Hồ Sơ Mật

Backend Express + TypeScript thay thế Supabase Edge Functions.

## Kiến Trúc

```
Frontend (React) → Backend API (Express) → Supabase (PostgreSQL + Auth)
                           ↓
                    Gemini API (LLM)
```

## Cài Đặt

```bash
# Cài dependencies
cd backend
bun install

# Copy env file
cp .env.example .env

# Điền các biến môi trường:
# - SUPABASE_SERVICE_ROLE_KEY: Lấy từ Supabase Dashboard > Project Settings > API > service_role key
# - GEMINI_API_KEY: API key của bạn (lấy từ Google AI Studio)
```

## Chạy Development

```bash
# Từ root project
bun run backend:dev

# Hoặc từ backend folder
cd backend
bun run dev
```

Server sẽ chạy tại `http://localhost:3001`

## Build & Production

```bash
# Build
bun run backend:build

# Start production
bun run backend:start
```

## API Endpoints

### Health Check
```
GET /health
```

### Generate Case (Tầng 1)
```
POST /api/cases/generate
Body: { subject: string, difficulty: string, roomCode: string }
Response: SafeGeneratedCase (không chứa tu_khoa_thang_cuoc)
```

### Chat with Suspect (Tầng 2)
```
POST /api/chat
Body: { roomCode: string, messages: ChatTurn[] }
Response: { response: string }
```

## Migration từ Edge Functions

| Edge Function | Express Route |
|---------------|---------------|
| `generate-case` | `POST /api/cases/generate` |
| `chat-suspect` | `POST /api/chat` |

## Lưu Ý Security

- `tu_khoa_thang_cuoc` (answer keywords) chỉ tồn tại server-side trong DB
- Backend sử dụng `SUPABASE_SERVICE_ROLE_KEY` để bypass RLS
- Frontend KHÔNG BAO GIỜ nhận được answer keywords
