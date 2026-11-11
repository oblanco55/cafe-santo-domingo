/**
 * Adaptador de Replicate para la campaña de Café Santo Domingo.
 * Soporta Face Swap / InstantID en Replicate.
 */

import type { FalAvatarOptions, FalAvatarResult } from './fal';

export class ReplicateAIProvider {
  private apiToken: string;

  constructor(apiToken?: string) {
    this.apiToken = apiToken ?? process.env.REPLICATE_API_TOKEN ?? '';
  }

  isConfigured(): boolean {
    return Boolean(this.apiToken && this.apiToken.trim().length > 0);
  }

  async generateAvatar(opts: FalAvatarOptions): Promise<FalAvatarResult> {
    if (!this.isConfigured()) {
      throw new Error('REPLICATE_API_TOKEN no está configurada.');
    }

    // Predicción en Replicate (lucataco/instantid o cdingram/face-swap)
    const prompt = `A cinematic Dominican coffee ambassador holding a cup of ${opts.favoriteProduct || 'Café Santo Domingo'}, warm golden sunlight, smiling, 8k portrait`;

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'ef68c344d5c9076f8a425ec88a03ca22a7f058097d64ab0a22a3628e469d7bba', // InstantID
        input: {
          image: opts.selfieUrlOrBase64,
          prompt,
          negative_prompt: 'ugly, deformed, disfigured, blur, bad anatomy',
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Error en Replicate (${response.status}): ${err}`);
    }

    const prediction = await response.json();
    let result = prediction;

    // Polling de Replicate hasta que esté terminado (máx 30s)
    const startTime = Date.now();
    while (result.status !== 'succeeded' && result.status !== 'failed' && result.status !== 'canceled') {
      if (Date.now() - startTime > 35000) {
        throw new Error('Timeout esperando la respuesta de Replicate');
      }
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: { Authorization: `Token ${this.apiToken}` },
      });
      if (pollRes.ok) {
        result = await pollRes.json();
      }
    }

    if (result.status !== 'succeeded') {
      throw new Error(`Replicate terminó con estado ${result.status}: ${result.error ?? ''}`);
    }

    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
    const caption = `☕ ¡Orgulloso embajador de ${opts.favoriteProduct || 'Café Santo Domingo'}! El sabor que nos une. #CafeSantoDomingo #OrgulloDominicano`;

    return {
      imageUrl: imageUrl || '',
      caption,
      model: 'replicate/instantid',
    };
  }
}
