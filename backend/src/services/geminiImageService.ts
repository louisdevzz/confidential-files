import { supabase } from '../lib/supabase.js';

interface GeneratedImage {
  imageData: Buffer;
  mimeType: string;
}

export class GeminiImageService {
  private apiKey: string;
  private baseUrl: string;
  private bucketName: string;

  private modelName: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY!;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.bucketName = 'avatars';
    this.modelName = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp-image-generation';

    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }
  }

  async generateCharacterImage(
    characterName: string,
    characterDescription: string,
    rarity: string,
    subject?: string
  ): Promise<{ url: string; name: string; description: string }> {
    // Tạo prompt dựa trên tên và mô tả nhân vật
    const prompt = this.buildPrompt(characterName, characterDescription, rarity, subject);
    
    console.log('🎨 Generating image with prompt:', prompt);
    console.log('🔧 Using model:', this.modelName);

    try {
      const url = `${this.baseUrl}/models/${this.modelName}:generateContent?key=${this.apiKey}`;
      
      console.log('📡 Calling Gemini API...');
      
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

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Gemini API error:', errorText);
        
        // Nếu model mới lỗi, thử fallback về model cũ
        if (this.modelName !== 'gemini-2.0-flash-exp-image-generation') {
          console.log('🔄 Falling back to gemini-2.0-flash-exp-image-generation...');
          const fallbackUrl = `${this.baseUrl}/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${this.apiKey}`;
          
          const fallbackResponse = await fetch(fallbackUrl, {
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

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json() as any;
            const imagePart = fallbackData?.candidates?.[0]?.content?.parts?.find(
              (part: any) => part?.inlineData
            );

            if (imagePart?.inlineData?.data) {
              console.log('✅ Fallback successful!');
              const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
              const mimeType = imagePart.inlineData.mimeType || 'image/png';
              
              const fileName = `character-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
              const publicUrl = await this.uploadToStorage(fileName, imageBuffer, mimeType);

              return {
                url: publicUrl,
                name: characterName,
                description: characterDescription
              };
            }
          }
        }
        
        throw new Error(`Failed to generate image: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;
      
      // Extract image from response
      const imagePart = data?.candidates?.[0]?.content?.parts?.find(
        (part: any) => part?.inlineData
      );

      if (!imagePart?.inlineData?.data) {
        console.error('❌ No image data in response:', JSON.stringify(data, null, 2));
        throw new Error('No image generated in response');
      }

      console.log('✅ Image generated successfully!');

      // Decode base64 image
      const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
      const mimeType = imagePart.inlineData.mimeType || 'image/png';
      
      console.log('📤 Uploading to Supabase Storage...');
      
      // Upload to Supabase Storage
      const fileName = `character-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
      const publicUrl = await this.uploadToStorage(fileName, imageBuffer, mimeType);

      console.log('✅ Uploaded to:', publicUrl);

      // Return with the original name and description
      return {
        url: publicUrl,
        name: characterName,
        description: characterDescription
      };
    } catch (error) {
      console.error('❌ Error generating image:', error);
      throw error;
    }
  }

  private buildPrompt(characterName: string, characterDescription: string, rarity: string, subject?: string): string {
    const basePrompt = `Create a FULL BODY chibi anime character in kawaii style.

CHARACTER TO DRAW: "${characterName}"
DESCRIPTION: "${characterDescription}"

STYLE REQUIREMENTS (MANDATORY):
- FULL BODY chibi character (not just head/shoulders)
- Chibi proportions: big head (1/2 of body height), small body, stubby arms and legs
- Kawaii anime style with BIG expressive sparkling eyes
- Clean, smooth line art with cel-shading
- Bright, vibrant colors
- Cute pose (standing, waving, or cheerful gesture)
- Character's outfit and appearance MUST match the name and description provided
- Simple gradient or transparent background (no complex scenery)
- High contrast and polished finish`;

    const rarityStyles: Record<string, string> = {
      'SSR': 'LEGENDARY: Golden glowing aura, luxurious detailed outfit, crown or premium accessories, sparkling effects, majestic pose',
      'SR': 'ELEGANT: Silver accents, refined outfit details, confident charming pose, subtle glow effects',
      'R': 'CUTE: Friendly smile, nice outfit, cheerful standard pose, clean presentation',
      'N': 'SIMPLE: Minimal outfit details, adorable basic pose, clean and sweet'
    };

    const subjectThemes: Record<string, string> = {
      'math': 'holding calculator/ruler, wearing glasses, geometric patterns on outfit',
      'physics': 'with lightning/atom symbols floating around, lab coat accessory, energetic pose',
      'chemistry': 'holding cute flask/test tube, safety goggles on head, bubbles floating',
      'biology': 'with small plants/flowers or DNA helix accessory, nature-themed outfit colors',
      'detective': 'tiny magnifying glass accessory, detective cap, trench coat, curious expression'
    };

    let prompt = `${basePrompt}

RARITY EFFECT: ${rarityStyles[rarity] || rarityStyles['N']}.`;
    
    if (subject && subjectThemes[subject]) {
      prompt += `
THEME ELEMENTS: ${subjectThemes[subject]}.`;
    }

    prompt += `

CRITICAL: Must be FULL BODY chibi anime character. Big head, small body, cute kawaii aesthetic. Game avatar quality. Square composition, centered, plenty of white/transparent space around the character.`;

    return prompt;
  }

  private async generateCharacterInfo(
    baseType: string,
    rarity: string,
    subject?: string
  ): Promise<{ name: string; description: string }> {
    const url = `${this.baseUrl}/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`;
    
    const prompt = `Generate a creative name and short description (max 100 characters) for a ${rarity} rarity game character.
Type: ${baseType}
Subject: ${subject || 'general'}

Return in JSON format:
{
  "name": "character name",
  "description": "short description"
}

Make it fun and suitable for a school detective game with anime style.`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 200
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate character info');
      }

      const data = await response.json() as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Try to parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          name: parsed.name || this.getDefaultName(baseType, rarity),
          description: parsed.description || this.getDefaultDescription(baseType)
        };
      }
    } catch (error) {
      console.error('Error generating character info:', error);
    }

    return {
      name: this.getDefaultName(baseType, rarity),
      description: this.getDefaultDescription(baseType)
    };
  }

  private getDefaultName(baseType: string, rarity: string): string {
    const names: Record<string, string[]> = {
      'SSR': ['Huyền Thoại', 'Tuyệt Phẩm', 'Huyền Bí'],
      'SR': ['Tinh Anh', 'Xuất Sắc', 'Ưu Tú'],
      'R': ['Thông Thường', 'Cơ Bản', 'Đơn Giản'],
      'N': ['Nhân Vật', 'Bạn Học', 'Học Sinh']
    };
    
    const typeNames: Record<string, string> = {
      'detective': 'Thám Tử',
      'student': 'Học Sinh',
      'teacher': 'Giáo Viên',
      'scientist': 'Nhà Khoa Học',
      'mascot': 'Mascot'
    };

    const rarityNames = names[rarity] || names['N'];
    const typeName = typeNames[baseType] || 'Nhân Vật';
    const randomName = rarityNames[Math.floor(Math.random() * rarityNames.length)];
    
    return `${typeName} ${randomName}`;
  }

  private getDefaultDescription(baseType: string): string {
    const descriptions: Record<string, string> = {
      'detective': 'Thám tử học đường với khả năng quan sát tuyệt vờ',
      'student': 'Học sinh chăm chỉ và thông minh',
      'teacher': 'Giáo viên tận tâm và kiến thức uyên thâm',
      'scientist': 'Nhà khoa học trẻ đầy nhiệt huyết',
      'mascot': 'Ngườ bạn đồng hành đáng yêu'
    };
    return descriptions[baseType] || 'Một nhân vật đặc biệt';
  }

  private async uploadToStorage(
    fileName: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    // Ensure bucket exists
    await this.ensureBucketExists();

    const { error: uploadError } = await supabase.storage
      .from(this.bucketName)
      .upload(fileName, buffer, {
        contentType: mimeType,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(fileName);

    return publicUrl;
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === this.bucketName);
      
      if (!bucketExists) {
        const { error } = await supabase.storage.createBucket(this.bucketName, {
          public: true,
          fileSizeLimit: 5242880, // 5MB
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
        });
        
        if (error) {
          console.error('Error creating bucket:', error);
        }
      }
    } catch (error) {
      console.error('Error checking bucket:', error);
    }
  }
}
