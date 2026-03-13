-- ============================================================
-- GACHA SYSTEM - Bảng cho hệ thống quay thẻ nhân vật
-- ============================================================

-- 1. Bảng characters - Lưu các nhân vật có thể quay
CREATE TABLE IF NOT EXISTS characters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  rarity VARCHAR(10) NOT NULL CHECK (rarity IN ('SSR', 'SR', 'R', 'N')),
  description TEXT,
  avatar_url TEXT NOT NULL,
  subject VARCHAR(50), -- Môn học liên quan (math, physics, etc.)
  is_generated BOOLEAN DEFAULT false, -- true nếu được AI generate
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index cho rarity để query nhanh
CREATE INDEX IF NOT EXISTS idx_characters_rarity ON characters(rarity);

-- 2. Bảng user_characters - Lưu nhân vật user đã quay được
CREATE TABLE IF NOT EXISTS user_characters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  character_id uuid REFERENCES characters(id) ON DELETE CASCADE NOT NULL,
  obtained_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_equipped BOOLEAN DEFAULT false, -- Nhân vật đang được trang bị
  UNIQUE(user_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_user_characters_user_id ON user_characters(user_id);

-- 3. Bảng gacha_history - Lịch sử quay gacha
CREATE TABLE IF NOT EXISTS gacha_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  character_id uuid REFERENCES characters(id) ON DELETE CASCADE NOT NULL,
  rarity VARCHAR(10) NOT NULL,
  cost INT NOT NULL DEFAULT 1, -- Số vé đã dùng
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gacha_history_user_id ON gacha_history(user_id);

-- 4. Thêm cột tickets vào profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gacha_tickets INT NOT NULL DEFAULT 5;

-- 5. Enable RLS
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_history ENABLE ROW LEVEL SECURITY;

-- Policies
-- Characters: Ai cũng đọc được
DROP POLICY IF EXISTS "characters_select" ON characters;
CREATE POLICY "characters_select" ON characters FOR SELECT USING (true);

-- User characters: User chỉ đọc được của mình
DROP POLICY IF EXISTS "user_characters_select" ON user_characters;
DROP POLICY IF EXISTS "user_characters_insert" ON user_characters;
DROP POLICY IF EXISTS "user_characters_update" ON user_characters;
CREATE POLICY "user_characters_select" ON user_characters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_characters_insert" ON user_characters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_characters_update" ON user_characters FOR UPDATE USING (auth.uid() = user_id);

-- Gacha history: User chỉ đọc được của mình
DROP POLICY IF EXISTS "gacha_history_select" ON gacha_history;
DROP POLICY IF EXISTS "gacha_history_insert" ON gacha_history;
CREATE POLICY "gacha_history_select" ON gacha_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gacha_history_insert" ON gacha_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Realtime cho user_characters
ALTER PUBLICATION supabase_realtime ADD TABLE user_characters;

-- 7. Seed data - Thêm một số nhân vật mặc định với avatar chibi anime
-- Sử dụng Dicebear API để tạo avatar chibi miễn phí
INSERT INTO characters (name, rarity, description, avatar_url, subject, is_generated) VALUES
('Thám tử Sherlock', 'SSR', 'Huyền thoại thám tử học đường với kính lúp và mũ deerstalker', 'https://api.dicebear.com/7.x/notionists/png?seed=sherlock&backgroundColor=ffdfbf', 'all', false),
('Cô giáo Toán', 'SR', 'Nữ hoàng phương trình, luôn mang theo thước kẻ', 'https://api.dicebear.com/7.x/notionists/png?seed=math-teacher&backgroundColor=c0aede', 'math', false),
('Anh chàng Vật Lý', 'SR', 'Master của các định luật Newton, thích thí nghiệm', 'https://api.dicebear.com/7.x/notionists/png?seed=physics-boy&backgroundColor=b6e3f4', 'physics', false),
('Học sinh siêng năng', 'R', 'Luôn làm bài tập đúng hạn, đeo kính cận', 'https://api.dicebear.com/7.x/notionists/png?seed=hardworking&backgroundColor=d1d4f9', null, false),
('Thí nghiệm hóa học', 'R', 'Thích pha trộn mọi thứ trong phòng lab', 'https://api.dicebear.com/7.x/notionists/png?seed=chemistry&backgroundColor=ffd5dc', 'chemistry', false),
('Cây nấm dễ thương', 'N', 'Ngướ bạn đồng hành nhỏ bé đáng yêu', 'https://api.dicebear.com/7.x/notionists/png?seed=mushroom&backgroundColor=ffdfbf', null, false),
('Batman Học Đường', 'SSR', 'Bí ẩn và mạnh mẽ, bảo vệ bạn bè', 'https://api.dicebear.com/7.x/notionists/png?seed=batman-school&backgroundColor=1a1a1a', null, false),
('Học sinh đeo kính', 'R', 'Thông minh và chăm chỉ', 'https://api.dicebear.com/7.x/notionists/png?seed=glasses-boy&backgroundColor=c0aede', null, false)
ON CONFLICT DO NOTHING;
