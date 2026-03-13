import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { GeminiImageService } from '../services/geminiImageService.js';

const router = Router();
const imageService = new GeminiImageService();

// Tỷ lệ rớt nhân vật
const DROP_RATES: Record<string, number> = {
  'SSR': 0.03,  // 3%
  'SR': 0.15,   // 15%
  'R': 0.35,    // 35%
  'N': 0.47     // 47%
};

// Chi phí quay
const GACHA_COST = 1; // 1 vé

// GET /api/gacha/characters - Lấy danh sách nhân vật
router.get('/characters', async (req, res) => {
  try {
    const { data: characters, error } = await supabase
      .from('characters')
      .select('*')
      .order('rarity', { ascending: false });

    if (error) throw error;

    res.json(characters);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// GET /api/gacha/my-collection - Lấy bộ sưu tập của user
router.get('/my-collection', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('Fetching collection for user:', userId);

    // Check if table exists first
    const { error: tableCheckError } = await supabase
      .from('user_characters')
      .select('id')
      .limit(1);
    
    if (tableCheckError && tableCheckError.code === 'PGRST205') {
      console.error('Table user_characters does not exist');
      return res.status(500).json({ 
        error: 'Database schema not initialized. Please run: bun run db:push',
        details: tableCheckError.message 
      });
    }

    const { data: collection, error } = await supabase
      .from('user_characters')
      .select(`
        *,
        character:characters(*)
      `)
      .eq('user_id', userId)
      .order('obtained_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log('Collection fetched:', collection?.length || 0, 'items');
    res.json(collection || []);
  } catch (error) {
    console.error('Error in my-collection:', error);
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    res.status(500).json({ error: message });
  }
});

// GET /api/gacha/tickets - Lấy số vé của user
router.get('/tickets', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Kiểm tra có phải admin không
    const { data: { user } } = await supabase.auth.admin.getUserById(userId as string);
    const isAdmin = user?.email === ADMIN_EMAIL;

    if (isAdmin) {
      return res.json({ tickets: 999999, isAdmin: true });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('gacha_tickets')
      .eq('id', userId)
      .single();

    if (error) throw error;

    res.json({ tickets: profile?.gacha_tickets || 0, isAdmin: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// Admin email - có quyền quay unlimited
const ADMIN_EMAIL = 'louisdevzz04@gmail.com';

// POST /api/gacha/roll - Quay gacha
router.post('/roll', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Lấy thông tin user để kiểm tra có phải admin không
    const { data: userProfile, error: userError } = await supabase
      .from('profiles')
      .select('gacha_tickets, username')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // Kiểm tra có phải admin không (dựa vào email trong metadata)
    const { data: { user } } = await supabase.auth.admin.getUserById(userId as string);
    const isAdmin = user?.email === ADMIN_EMAIL;

    // Nếu không phải admin, kiểm tra vé
    if (!isAdmin) {
      if ((userProfile?.gacha_tickets || 0) < GACHA_COST) {
        return res.status(400).json({ 
          error: 'Không đủ vé Gacha',
          tickets: userProfile?.gacha_tickets || 0,
          cost: GACHA_COST
        });
      }

      // Trừ vé cho user thường
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ gacha_tickets: (userProfile?.gacha_tickets || 0) - GACHA_COST })
        .eq('id', userId);

      if (updateError) throw updateError;
    }

    // Xác định độ hiếm
    const rarity = rollRarity();

    // Quay nhân vật theo độ hiếm
    let character = await rollCharacter(rarity);

    if (!character) {
      return res.status(500).json({ error: 'Không thể quay nhân vật' });
    }

    // Nếu nhân vật chưa có avatar hoặc avatar là placeholder, generate bằng AI
    if (!character.avatar_url || character.avatar_url.includes('placehold') || character.is_generated === false) {
      try {
        console.log(`🎨 Generating AI avatar for ${character.name}...`);
        const { url: newAvatarUrl } = await imageService.generateCharacterImage(
          character.name,
          character.description,
          rarity,
          character.subject || undefined
        );
        
        // Update avatar trong database
        const { error: updateAvatarError } = await supabase
          .from('characters')
          .update({ 
            avatar_url: newAvatarUrl,
            is_generated: true
          })
          .eq('id', character.id);
        
        if (updateAvatarError) {
          console.error('Error updating avatar:', updateAvatarError);
        } else {
          character.avatar_url = newAvatarUrl;
          character.is_generated = true;
          console.log(`✅ Avatar generated for ${character.name}`);
        }
      } catch (genError) {
        console.error('Error generating avatar:', genError);
        // Continue với avatar cũ nếu generate lỗi
      }
    }

    // Thêm vào bộ sưu tập user
    const { error: collectionError } = await supabase
      .from('user_characters')
      .upsert({
        user_id: userId,
        character_id: character.id,
        obtained_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,character_id',
        ignoreDuplicates: true
      });

    if (collectionError) {
      console.error('Collection error:', collectionError);
    }

    // Lưu lịch sử
    await supabase
      .from('gacha_history')
      .insert({
        user_id: userId,
        character_id: character.id,
        rarity: rarity,
        cost: isAdmin ? 0 : GACHA_COST
      });

    res.json({
      success: true,
      character,
      rarity,
      ticketsLeft: isAdmin ? 999999 : (userProfile?.gacha_tickets || 0) - GACHA_COST,
      isAdmin
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Roll error:', error);
    res.status(500).json({ error: message });
  }
});

// POST /api/gacha/generate - Generate nhân vật mới bằng AI
router.post('/generate', async (req, res) => {
  try {
    const { characterType, rarity, subject } = req.body;

    if (!characterType || !rarity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate image và info
    const { url, name, description } = await imageService.generateCharacterImage(
      characterType,
      rarity,
      subject
    );

    // Lưu vào database
    const { data: character, error } = await supabase
      .from('characters')
      .insert({
        name,
        rarity,
        description,
        avatar_url: url,
        subject: subject || null,
        is_generated: true
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      character
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Generate error:', error);
    res.status(500).json({ error: message });
  }
});

// POST /api/gacha/equip - Trang bị nhân vật
router.post('/equip', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    const { characterId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Bỏ trang bị tất cả nhân vật khác
    await supabase
      .from('user_characters')
      .update({ is_equipped: false })
      .eq('user_id', userId);

    // Trang bị nhân vật mới
    const { error } = await supabase
      .from('user_characters')
      .update({ is_equipped: true })
      .eq('user_id', userId)
      .eq('character_id', characterId);

    if (error) throw error;

    // Update profile avatar
    const { data: character } = await supabase
      .from('characters')
      .select('avatar_url')
      .eq('id', characterId)
      .single();

    if (character) {
      await supabase
        .from('profiles')
        .update({ avatar_url: character.avatar_url })
        .eq('id', userId);
    }

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// GET /api/gacha/history - Lịch sử quay
router.get('/history', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data: history, error } = await supabase
      .from('gacha_history')
      .select(`
        *,
        character:characters(name, avatar_url, rarity)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json(history);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});

// Helper functions
function rollRarity(): string {
  const roll = Math.random();
  let cumulative = 0;
  
  const rarities = ['SSR', 'SR', 'R', 'N'];
  for (const rarity of rarities) {
    cumulative += DROP_RATES[rarity];
    if (roll <= cumulative) {
      return rarity;
    }
  }
  
  return 'N';
}

async function rollCharacter(rarity: string) {
  // Lấy nhân vật ngẫu nhiên theo độ hiếm
  console.log(`🔍 Looking for characters with rarity: ${rarity}`);
  
  const { data: characters, error } = await supabase
    .from('characters')
    .select('*')
    .eq('rarity', rarity);

  if (error) {
    console.error('❌ Error fetching characters:', error);
    return null;
  }

  if (!characters || characters.length === 0) {
    console.error(`❌ No characters found for rarity: ${rarity}`);
    console.error('💡 HINT: Run "bun run db:push" to insert seed characters');
    return null;
  }

  console.log(`✅ Found ${characters.length} characters for ${rarity}`);

  // Chọn ngẫu nhiên
  const randomIndex = Math.floor(Math.random() * characters.length);
  return characters[randomIndex];
}

export default router;
