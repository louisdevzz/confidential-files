#!/usr/bin/env node
/**
 * generate-seed-avatars.mjs
 * Generate avatar images cho các nhân vật seed data bằng Gemini AI
 * 
 * Usage:
 *   cd backend && node ../scripts/generate-seed-avatars.mjs
 * 
 * Hoặc từ root:
 *   bun run generate:avatars
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp-image-generation';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.error('❌ Missing GEMINI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Seed characters cần generate
const SEED_CHARACTERS = [
  {
    name: 'Thám tử Sherlock',
    rarity: 'SSR',
    description: 'Huyền thoại thám tử học đường với kính lúp và mũ deerstalker',
    subject: 'all',
    prompt: `Create a FULL BODY chibi anime character in kawaii style.
CHARACTER: "Thám tử Sherlock" - Legendary school detective
STYLE: Big head (1/2 body height), chibi proportions, stubby arms and legs
OUTFIT: Tan detective hat (deerstalker), brown trench coat, holding large magnifying glass
FEATURES: Brown hair, BIG sparkling expressive eyes, cheerful confident smile
LEGENDARY EFFECT: Golden glowing aura, premium accessories, majestic standing pose
BACKGROUND: Simple gradient with sparkles
High quality cel-shaded anime art, clean lines, vibrant colors, square format, plenty of space around character.`
  },
  {
    name: 'Cô giáo Toán',
    rarity: 'SR',
    description: 'Nữ hoàng phương trình, luôn mang theo thước kẻ và sách',
    subject: 'math',
    prompt: `Create a FULL BODY chibi anime character in kawaii style.
CHARACTER: "Cô giáo Toán" - Math queen teacher
STYLE: Big head (1/2 body height), chibi proportions, stubby limbs
OUTFIT: Professional teacher attire with cardigan, long black hair, glasses, holding ruler and math book
FEATURES: Kind gentle expression, BIG sparkling eyes, warm smile
ELEGANT EFFECT: Silver accents, refined details, confident charming pose
BACKGROUND: Simple gradient with geometric patterns
High quality cel-shaded anime art, clean lines, vibrant colors, square format, plenty of space around character.`
  },
  {
    name: 'Anh chàng Vật Lý',
    rarity: 'SR',
    description: 'Master của các định luật Newton, thích thí nghiệm',
    subject: 'physics',
    prompt: `Create a FULL BODY chibi anime character in kawaii style.
CHARACTER: "Anh chàng Vật Lý" - Physics master scientist
STYLE: Big head (1/2 body height), chibi proportions, stubby limbs
OUTFIT: White lab coat, safety goggles on head, messy brown hair, holding flask with colorful bubbling liquid
FEATURES: Excited curious expression, BIG sparkling eyes, energetic pose
ELEGANT EFFECT: Silver accents, atom/lightning symbols floating around, dynamic pose
BACKGROUND: Simple gradient with electric effects
High quality cel-shaded anime art, clean lines, vibrant colors, square format, plenty of space around character.`
  },
  {
    name: 'Học sinh siêng năng',
    rarity: 'R',
    description: 'Luôn làm bài tập đúng hạn, đeo kính cận và cặp sách',
    subject: null,
    prompt: `Create a FULL BODY chibi anime character in kawaii style.
CHARACTER: "Học sinh siêng năng" - Diligent student
STYLE: Big head (1/2 body height), chibi proportions, stubby limbs
OUTFIT: School uniform with backpack, neat black hair, round glasses, holding books and pencil
FEATURES: Serious studious expression, BIG determined eyes, focused look
CUTE EFFECT: Friendly appearance, nice details, cheerful standard pose
BACKGROUND: Simple gradient or transparent
High quality cel-shaded anime art, clean lines, vibrant colors, square format, plenty of space around character.`
  },
  {
    name: 'Thí nghiệm hóa học',
    rarity: 'R',
    description: 'Thích pha trộn mọi thứ trong phòng lab, đội tóc xanh',
    subject: 'chemistry',
    prompt: `Create a FULL BODY chibi anime character in kawaii style.
CHARACTER: "Thí nghiệm hóa học" - Chemistry experiment girl
STYLE: Big head (1/2 body height), chibi proportions, stubby limbs
OUTFIT: Lab coat with colorful chemical stains, blue hair in cute buns, holding beakers with bubbling liquids
FEATURES: Playful mischievous expression, BIG sparkly eyes, cheeky smile
CUTE EFFECT: Bubbles floating around, nice details, cheerful pose
BACKGROUND: Simple gradient with bubble effects
High quality cel-shaded anime art, clean lines, vibrant colors, square format, plenty of space around character.`
  },
  {
    name: 'Cây nấm dễ thương',
    rarity: 'N',
    description: 'Ngướ bạn đồng hành nhỏ bé đáng yêu, nấm độc hại nhưng cute',
    subject: null,
    prompt: `Create a FULL BODY chibi anime mascot character in kawaii style.
CHARACTER: "Cây nấm dễ thương" - Cute mushroom mascot companion
STYLE: Big head, chibi proportions, tiny stubby arms and legs
OUTFIT: Red mushroom cap with white spots, round cute body, tiny hands and feet
FEATURES: Big sparkly happy eyes, wide cheerful smile, adorable huggable appearance
SIMPLE EFFECT: Minimal details but maximum cuteness, friendly waving pose
BACKGROUND: Simple gradient or transparent
High quality cel-shaded anime art, clean lines, vibrant colors, square format, plenty of space around character.`
  },
  {
    name: 'Batman Học Đường',
    rarity: 'SSR',
    description: 'Bí ẩn và mạnh mẽ, bảo vệ bạn bè trong trường',
    subject: null,
    prompt: `Create a FULL BODY chibi anime character in kawaii style.
CHARACTER: "Batman Học Đường" - School Batman guardian
STYLE: Big head (1/2 body height), chibi proportions, stubby limbs
OUTFIT: Batman cowl and cape over school uniform, black spiky hair, utility belt accessories
FEATURES: Mysterious confident expression, BIG glowing white eyes, cool smirk
LEGENDARY EFFECT: Dark bat symbol glowing with golden light, powerful heroic pose, dramatic shadows
BACKGROUND: Simple dark gradient with bat symbols
High quality cel-shaded anime art, clean lines, vibrant colors, square format, plenty of space around character.`
  },
  {
    name: 'Học sinh đeo kính',
    rarity: 'R',
    description: 'Thông minh và chăm chỉ, luôn ngồi góc lớp',
    subject: null,
    prompt: `Create a FULL BODY chibi anime character in kawaii style.
CHARACTER: "Học sinh đeo kính" - Smart quiet student
STYLE: Big head (1/2 body height), chibi proportions, stubby limbs
OUTFIT: Neat school uniform, black hair with rectangular glasses, holding open book
FEATURES: Quiet intelligent expression, BIG thoughtful eyes, gentle smile
CUTE EFFECT: Clean studious look, nice details, calm reading pose
BACKGROUND: Simple gradient or transparent
High quality cel-shaded anime art, clean lines, vibrant colors, square format, plenty of space around character.`
  }
];

async function generateImage(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          responseModalities: ['Text', 'Image']
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    // Extract image from response
    const imagePart = data.candidates?.[0]?.content?.parts?.find(
      part => part.inlineData
    );

    if (!imagePart?.inlineData?.data) {
      throw new Error('No image generated');
    }

    return {
      buffer: Buffer.from(imagePart.inlineData.data, 'base64'),
      mimeType: imagePart.inlineData.mimeType || 'image/png'
    };
  } catch (error) {
    console.error('Generate error:', error);
    throw error;
  }
}

async function uploadToStorage(fileName, buffer, mimeType) {
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, buffer, {
      contentType: mimeType,
      cacheControl: '3600'
    });

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  return publicUrl;
}

async function updateCharacter(name, avatarUrl) {
  const { error } = await supabase
    .from('characters')
    .update({ avatar_url: avatarUrl })
    .eq('name', name);

  if (error) {
    throw new Error(`Update failed: ${error.message}`);
  }
}

async function main() {
  console.log('🎨 Generating avatars with Gemini AI...\n');
  console.log(`Model: ${GEMINI_MODEL}\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < SEED_CHARACTERS.length; i++) {
    const char = SEED_CHARACTERS[i];
    console.log(`[${i + 1}/${SEED_CHARACTERS.length}] ${char.name} (${char.rarity})...`);
    
    try {
      // Generate image
      const { buffer, mimeType } = await generateImage(char.prompt);
      console.log('  ✅ Image generated');

      // Upload to storage
      const fileName = `character-${Date.now()}-${i}.png`;
      const publicUrl = await uploadToStorage(fileName, buffer, mimeType);
      console.log('  ✅ Uploaded to storage');

      // Update database
      await updateCharacter(char.name, publicUrl);
      console.log('  ✅ Database updated');
      console.log(`  📸 URL: ${publicUrl}\n`);

      success++;
      
      // Wait 2s between requests to avoid rate limiting
      if (i < SEED_CHARACTERS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Success: ${success}   ❌ Failed: ${failed}`);
  console.log('='.repeat(50));

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
