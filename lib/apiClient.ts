import { getModelProvider } from '../constants';
import type { ApiModel, ModelProvider } from '../constants';

export type GeneratePromptRequest = {
  model: ApiModel;
  contents: any;
  config: any;
  apiKey?: string;
  isXmlQuality?: boolean;
};

export class ApiRequestError extends Error {
  status?: number;
  responseText?: string;

  constructor(message: string, status?: number, responseText?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.responseText = responseText;
  }
}

export class EmptyResponseError extends Error {
  constructor(providerLabel: string) {
    super(`${providerLabel} response did not yield valid text.`);
    this.name = 'EmptyResponseError';
  }
}

export const ENDPOINTS: Record<ModelProvider, string> = {
  google: 'local://offline-engine',
  groq: 'local://offline-engine',
  mistral: 'local://offline-engine',
  github: 'local://offline-engine',
  openrouter: 'local://offline-engine',
};

export const CHECK_MODELS: Record<ModelProvider, string> = {
  google: 'gemini-2.5-flash',
  groq: 'qwen/qwen3.6-27b',
  mistral: 'mistral-small-latest',
  github: 'gpt-4o-mini',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
};

// Rich vocabulary sets for local creative prompt synthesis
const COMPOSITIONS = [
  'dynamic 3/4 perspective angle',
  'side profile view with clean silhouette',
  'centered symmetrical emblem framing',
  'dynamic low-angle heroic action pose',
  'high-angle diagonal isometric view',
  'close-up detailed focal composition',
  'full-body energetic stance',
  'minimalist aerial flatlay arrangement',
  'curved circular badge containment',
  'fluid motion trail composition',
];

const LIGHTING_AND_COLORWAYS = [
  'vibrant dual-tone colorway',
  'pastel muted earthy tones',
  'high-contrast monochromatic palette',
  'warm sunset gradient accentuation',
  'cool cyber neon dual-accent shading',
  'clean solid 2-tone vector shapes',
  'retro vintage duo-color scheme',
  'crisp monochromatic vector ink',
];

const EXPRESSIONS_AND_MOODS = [
  'cheerful joyful expression and energetic demeanor',
  'focused confident expression with purposeful movement',
  'peaceful serene posture with harmonious aesthetic',
  'playful inquisitive mood with whimsical elements',
  'bold majestic presence with striking contours',
  'curious adventurous spirit with charming character design',
];

const SCENARIOS = [
  'interacting with modern creative tools and gadgets',
  'immersed in vibrant natural outdoor scenery',
  'in a stylized futuristic tech-driven workspace',
  'celebrating a triumphant creative breakthrough',
  'exploring magical surreal environmental surroundings',
  'carrying minimalist accessories with charming details',
];

/**
 * Pure client-side instantaneous prompt generation engine (Zero-API)
 */
export const generateModelContent = async (request: GeneratePromptRequest): Promise<string> => {
  // Simulate tiny 20ms async tick for UI smooth feedback
  await new Promise(resolve => setTimeout(resolve, 20));

  let concept = 'subject';
  let numPrompts = 10;
  let artStyle = 'Flat illustration';
  let isWhiteBg = true;

  try {
    const rawContent = typeof request.contents === 'string' ? request.contents : JSON.stringify(request.contents);
    
    // Extract concept from prompt builder content
    const conceptMatch = rawContent.match(/Concept:\s*([^\n,]+)/i) || rawContent.match(/concept["']?\s*:\s*["']?([^"',\n]+)/i);
    if (conceptMatch && conceptMatch[1]) {
      concept = conceptMatch[1].trim();
    } else {
      const firstLine = rawContent.split('\n')[0].replace(/[^\w\s-]/g, '').trim();
      if (firstLine.length > 0 && firstLine.length < 50) {
        concept = firstLine;
      }
    }

    // Extract numPrompts
    const numMatch = rawContent.match(/Generate exactly (\d+) prompts/i) || rawContent.match(/(\d+)\s*unique\s*prompts/i);
    if (numMatch && numMatch[1]) {
      numPrompts = Math.max(1, parseInt(numMatch[1], 10));
    }

    // Extract art style
    if (rawContent.includes('Monoline geometric vector')) artStyle = 'Monoline geometric vector';
    else if (rawContent.includes('Geometric silhouette')) artStyle = 'Geometric silhouette';
    else if (rawContent.includes('Negative space cutout')) artStyle = 'Negative space cutout';
    else artStyle = 'Flat illustration';

    if (rawContent.includes('isolated on solid white background') || rawContent.includes('white background')) {
      isWhiteBg = true;
    }
  } catch (e) {
    // fallback defaults
  }

  const generatedPrompts: string[] = [];

  for (let i = 0; i < numPrompts; i++) {
    const comp = COMPOSITIONS[i % COMPOSITIONS.length];
    const colorway = LIGHTING_AND_COLORWAYS[(i * 3) % LIGHTING_AND_COLORWAYS.length];
    const mood = EXPRESSIONS_AND_MOODS[(i * 2) % EXPRESSIONS_AND_MOODS.length];
    const scenario = SCENARIOS[(i * 5) % SCENARIOS.length];

    let promptText = '';

    if (artStyle === 'Monoline geometric vector') {
      promptText = `Monoline geometric vector art of ${concept}, ${comp}, ${scenario}, single uniform line weight, clean continuous black outlines, geometric arcs and polygonal facets, zero fills, minimalist line art, ${mood}${isWhiteBg ? ', isolated on pure white background' : ''}`;
    } else if (artStyle === 'Geometric silhouette') {
      promptText = `Bold geometric silhouette vector of ${concept}, ${comp}, ${scenario}, planar facet cuts, aerodynamic contours, high contrast 2-tone black and white only, strictly lineless, modern emblem style, ${mood}${isWhiteBg ? ', isolated on clean white background' : ''}`;
    } else if (artStyle === 'Negative space cutout') {
      promptText = `Negative space cutout vector emblem of ${concept}, ${comp}, ${scenario}, clever high-contrast carved negative space cuts, balanced black and white solid shapes, minimalist badge framing, ${mood}${isWhiteBg ? ', isolated on pure white background' : ''}`;
    } else {
      // Flat illustration
      promptText = `Flat design illustration of ${concept}, ${comp}, ${scenario}, ${mood}, chunky rounded anatomy, geometric minimalist silhouette, ${colorway}, smooth curved contours, modern aesthetic, professional vector graphic${isWhiteBg ? ', isolated on solid white background' : ''}`;
    }

    generatedPrompts.push(promptText);
  }

  return JSON.stringify(generatedPrompts);
};

export const stripCodeFence = (text: string): string => {
  let s = (text || '').trim();
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (s.startsWith('```')) {
    const nl = s.indexOf('\n');
    s = nl !== -1 ? s.substring(nl + 1) : s.substring(3);
  }
  if (s.endsWith('```')) {
    s = s.substring(0, s.length - 3);
  }
  return s.trim();
};

/**
 * Standalone Zero-API verification (Always 100% active and valid offline)
 */
export async function checkApiKeyOnline(provider: ModelProvider, _key: string): Promise<{
  success: boolean;
  status: 'active' | 'rate_limited' | 'invalid' | 'error';
  reason: 'valid' | 'limited' | 'invalid';
  message: string;
  latency: number;
}> {
  return {
    success: true,
    status: 'active',
    reason: 'valid',
    message: 'Active (Offline Standalone Engine Ready)',
    latency: 0,
  };
}

export const isTransientEmptyResponseError = (_error: unknown): boolean => false;
export const shouldRotateApiKeyOnError = (_error: unknown): boolean => false;
