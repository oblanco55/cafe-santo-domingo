/**
 * Adaptador de Fal.ai para la campaña de Café Santo Domingo.
 * Soporta generación de Avatar fotorealista / 3D con reemplazo facial (PuLID / Face Swap)
 * y generación de video animado con Kling / Luma vía Fal.ai.
 */

export interface FalAvatarOptions {
  selfieUrlOrBase64: string;
  templateStyle: 'barista' | 'colonial' | 'plantacion';
  format: 'avatar' | 'video';
  favoriteProduct?: string;
  userName?: string;
}

export interface FalAvatarResult {
  imageUrl: string;
  videoUrl?: string;
  caption: string;
  model: string;
}

const TEMPLATE_PROMPTS: Record<string, { prompt: string; background: string }> = {
  barista: {
    prompt:
      'Professional coffee barista in a modern artisanal coffee shop, wearing an apron with Café Santo Domingo embroidery, holding a steaming red cup of Café Santo Domingo, warm cinematic studio lighting, photorealistic 8k, ultra-detailed smiling portrait',
    background: 'modern artisanal coffee shop',
  },
  colonial: {
    prompt:
      'Elegant coffee enthusiast smiling warmly in the historic Zona Colonial of Santo Domingo at golden hour, holding a classic porcelain cup of Café Santo Domingo, cobblestone streets and colonial architecture in the background, warm Caribbean golden sunlight, cinematic 8k',
    background: 'Zona Colonial of Santo Domingo at golden hour',
  },
  plantacion: {
    prompt:
      'Proud coffee ambassador standing amidst lush green coffee plantations in Jarabacoa Dominican Republic, holding a red cup of Café Santo Domingo, morning mist over mountain slopes, vibrant coffee cherries on branches, photorealistic 8k',
    background: 'Jarabacoa coffee plantation',
  },
};

export class FalAIProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.FAL_KEY ?? '';
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateAvatar(opts: FalAvatarOptions): Promise<FalAvatarResult> {
    if (!this.isConfigured()) {
      throw new Error('FAL_KEY no está configurada.');
    }

    const template = TEMPLATE_PROMPTS[opts.templateStyle] ?? TEMPLATE_PROMPTS.colonial;
    const prompt = `${template.prompt}, featuring the person's exact face from reference, enjoying ${opts.favoriteProduct || 'Café Santo Domingo'}`;

    // Fal.ai PulID / Face-to-Many request
    const response = await fetch('https://fal.run/fal-ai/flux-pulid', {
      method: 'POST',
      headers: {
        Authorization: `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        reference_images: [
          {
            image_url: opts.selfieUrlOrBase64,
          },
        ],
        num_inference_steps: 28,
        guidance_scale: 4.5,
        image_size: 'portrait_16_9',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error en Fal.ai (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const imageUrl = data?.images?.[0]?.url || data?.image?.url;

    if (!imageUrl) {
      throw new Error('Fal.ai no devolvió ninguna imagen válida.');
    }

    let videoUrl: string | undefined;

    // Si solicitó video, enviamos la imagen a Kling / Luma en Fal.ai
    if (opts.format === 'video') {
      try {
        const vidResponse = await fetch('https://fal.run/fal-ai/kling-video/v1/standard/image-to-video', {
          method: 'POST',
          headers: {
            Authorization: `Key ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: 'The person gently sips coffee from the cup, smiles warmly at the camera with steam rising from the cup, subtle natural movement',
            image_url: imageUrl,
            duration: '5',
          }),
        });
        if (vidResponse.ok) {
          const vidData = await vidResponse.json();
          videoUrl = vidData?.video?.url;
        }
      } catch {
        // Fallback a solo imagen si la llamada a video falla
      }
    }

    const caption = `☕ ¡Orgulloso embajador de ${opts.favoriteProduct || 'Café Santo Domingo'}! El sabor que nos une en cada momento. #CafeSantoDomingo #OrgulloDominicano #ElSaborQueNosUne`;

    return {
      imageUrl,
      videoUrl,
      caption,
      model: opts.format === 'video' ? 'fal-ai/flux-pulid+kling' : 'fal-ai/flux-pulid',
    };
  }
}
