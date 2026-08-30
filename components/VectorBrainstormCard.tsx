import React from 'react';
import { UseSettingsReturn } from '../hooks/useSettings';
import { AI_MODELS, VECTOR_ART_STYLES, DEFAULT_VECTOR_ART_STYLE, getModelProvider } from '../constants';
import { generateModelContent } from '../lib/apiClient';
import { readStoredProviderApiKeys } from '../hooks/useGemini';
import Spinner from './Spinner';

import { VECTOR_LAYOUT_PRESETS, LayoutMiniPreview } from '../lib/layoutPresets';

export { VECTOR_ART_STYLES };
export { VECTOR_LAYOUT_PRESETS };


interface VectorBrainstormCardProps {
  settings: UseSettingsReturn;
  isLoading: boolean;
  disabled: boolean;
  onGenerate: () => void;
}

export const VectorBrainstormCard: React.FC<VectorBrainstormCardProps> = ({
  settings,
  isLoading,
  disabled,
  onGenerate,
}) => {
  const [isRolling, setIsRolling] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const artStyle = settings.vectorArtStyle || (VECTOR_ART_STYLES[0] || '');
  const preset = settings.vectorPreset || 'Single Image';
  const pose = settings.vectorPose || '';
  const attributes = settings.vectorAttributes || '';
  const whiteBg = settings.vectorWhiteBg ?? true;

  const addImageFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        settings.addVectorReferenceImage?.(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) addImageFromFile(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDropImage = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files) {
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) addImageFromFile(file);
      });
    }
  };

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : [];
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length > 0) {
      e.preventDefault();
      imageItems.forEach(item => {
        const file = item.getAsFile();
        if (file) addImageFromFile(file);
      });
    }
  };

  const handleRandomIdea = async () => {
    if (disabled || isLoading || isRolling) return;
    setIsRolling(true);

    const currentStyle = (artStyle || '').toLowerCase();

    let styleInstruction = '';
    if (currentStyle.includes('jersey') || currentStyle.includes('jersy')) {
      const JERSEY_DOMAINS = [
        'soccer jersey', 'futsal jersey', 'basketball jersey', 'cycling jersey',
        'volleyball jersey', 'motocross jersey', 'esports jersey', 'rugby jersey',
        'American football jersey', 'handball jersey', 'athletics track jersey',
        'ice hockey jersey', 'polo shirt jersey', 'badminton jersey', 'swimming jersey',
        'boxing jersey', 'martial arts jersey', 'racing overalls', 'ski racing suit', 'tennis jersey',
      ];
      const picked = JERSEY_DOMAINS[Math.floor(Math.random() * JERSEY_DOMAINS.length)];
      styleInstruction = `Generate 1 specific athletic jersey or sports kit type in English. Maximum 2 words. Output ONLY the jersey type name itself. Example outputs: "soccer jersey", "cycling kit", "esports jersey". Focus on: "${picked}".`;

    } else if (currentStyle.includes('livery') || currentStyle.includes('wrap')) {
      const LIVERY_DOMAINS = [
        'sports coupe', 'racing sedan', 'rally hatchback', 'drift car',
        'supercar', 'cargo van', 'trophy truck', 'GT racer',
        'muscle car', 'electric hypercar', 'formula car', 'motorbike fairing',
        'dragster', 'touring car', 'Le Mans prototype', 'buggy racer',
        'safari rally truck', 'speedboat hull', 'racing kart', 'motorcycle sidecar',
      ];
      const picked = LIVERY_DOMAINS[Math.floor(Math.random() * LIVERY_DOMAINS.length)];
      styleInstruction = `Generate 1 specific vehicle type for a racing livery or car wrap design in English. Maximum 2 words. Output ONLY the vehicle type. Example outputs: "drift car", "cargo van", "GT racer". Focus on: "${picked}".`;

    } else if (currentStyle.includes('pictogram') || currentStyle.includes('logo') || currentStyle.includes('abstract')) {
      const LOGO_DOMAINS = [
        'wolf emblem', 'eagle crest', 'lion mark', 'phoenix seal', 'dragon glyph',
        'falcon icon', 'bear badge', 'shark emblem', 'ox crest', 'panther mark',
        'coffee glyph', 'burger icon', 'sushi mark', 'ramen bowl', 'pizza slice',
        'runner icon', 'cyclist mark', 'swimmer glyph', 'archer crest', 'boxer seal',
        'lotus seal', 'oak leaf', 'mountain crest', 'wave glyph', 'compass mark',
        'architect crest', 'lab flask', 'barista seal', 'chef mark', 'astronaut glyph',
      ];
      const picked = LOGO_DOMAINS[Math.floor(Math.random() * LOGO_DOMAINS.length)];
      styleInstruction = `Generate 1 specific logo mark or pictogram subject in English. Maximum 2 words. Output ONLY the subject name. Example outputs: "wolf emblem", "coffee glyph", "archer crest". Focus on: "${picked}".`;

    } else if (currentStyle.includes('pattern') || currentStyle.includes('seamless')) {
      const PATTERN_DOMAINS = [
        'tropical leaves', 'geometric hexagon', 'Scandinavian folk', 'Japanese koi',
        'Art Deco fan', 'retro 70s', 'floral watercolor', 'botanical fern',
        'animal leopard', 'ocean wave', 'mountain terrain', 'galaxy star',
        'bread pastry', 'coffee bean', 'fruit citrus', 'sushi roll',
        'bicycle vintage', 'camping outdoors', 'boho mandala', 'ikat textile',
        'Memphis 80s', 'Bauhaus grid', 'batik kawung', 'Aboriginal dot',
        'Easter egg', 'Christmas holly', 'Halloween pumpkin', 'lunar festival',
        'baby nursery', 'school stationery', 'medical healthcare', 'sport ball',
      ];
      const picked = PATTERN_DOMAINS[Math.floor(Math.random() * PATTERN_DOMAINS.length)];
      styleInstruction = `Generate 1 specific seamless pattern or surface print theme in English. Maximum 2 words. Output ONLY the theme name. Example outputs: "tropical leaves", "koi fish", "Art Deco". Focus on: "${picked}".`;

    } else if (currentStyle.includes('object')) {
      const OBJECT_DOMAINS = [
        // Kitchen & Food
        'espresso machine', 'cast iron skillet', 'chef knife', 'stand mixer', 'wok pan',
        'french press', 'sushi set', 'pizza oven', 'matcha whisk', 'curry pot',
        // Tools & Workshop
        'power drill', 'angle grinder', 'impact wrench', 'circular saw', 'laser level',
        'soldering iron', 'oscilloscope', 'bench vise', 'torque wrench', 'pipe cutter',
        // Vehicles & Mobility
        'electric scooter', 'cargo bicycle', 'delivery drone', 'jet ski', 'vintage vespa',
        'forklift truck', 'hot rod', 'yacht', 'submarine', 'ultralight aircraft',
        // Technology & Electronics
        'vintage camera', 'reel projector', 'vinyl turntable', 'tube amplifier', 'ham radio',
        'oscilloscope', 'arcade joystick', 'CRT monitor', 'cassette walkman', 'film camera',
        // Outdoor & Sports Gear
        'mountaineering axe', 'surfboard', 'compound bow', 'fishing rod', 'ski poles',
        'tennis racket', 'baseball glove', 'soccer cleat', 'boxing glove', 'fencing mask',
        // Science & Lab
        'microscope', 'lab centrifuge', 'chemistry flask', 'telescope', 'spectrometer',
        // Fashion & Accessories
        'leather sneaker', 'aviator watch', 'biker helmet', 'vintage suitcase', 'diamond ring',
      ];
      const picked = OBJECT_DOMAINS[Math.floor(Math.random() * OBJECT_DOMAINS.length)];
      styleInstruction = `Generate 1 specific inanimate physical object for flat illustration in English. Maximum 2 words. Output ONLY the object name. Example outputs: "espresso machine", "power drill", "vintage camera". Focus on: "${picked}". STRICT: Zero humans, zero characters, zero faces.`;

    } else if (currentStyle.includes('geometric silhouette') || currentStyle.includes('negative space')) {
      const SILHOUETTE_DOMAINS = [
        'arctic wolf', 'charging bull', 'soaring eagle', 'roaring lion', 'leaping panther',
        'stag deer', 'grizzly bear', 'great white shark', 'humpback whale', 'octopus',
        'rearing horse', 'howling wolf', 'cobra snake', 'ram skull', 'bison',
        'winged griffin', 'roaring dragon', 'soaring phoenix', 'kraken tentacle', 'chimera',
        'warrior archer', 'samurai blade', 'gladiator helm', 'viking shield', 'ninja star',
        'mountain peak', 'lighthouse cliff', 'ancient temple', 'space rocket', 'anchor cross',
      ];
      const picked = SILHOUETTE_DOMAINS[Math.floor(Math.random() * SILHOUETTE_DOMAINS.length)];
      styleInstruction = `Generate 1 specific silhouette subject in English. Maximum 2 words. Output ONLY the subject name. Example outputs: "arctic wolf", "soaring eagle", "samurai blade". Focus on: "${picked}".`;

    } else {
      // General / Flat Illustration / Mascot / Monoline
      const GENERAL_DOMAINS = [
        // Food & Drink
        'ramen bowl', 'bubble tea', 'sushi set', 'tacos street', 'croissant bakery',
        'smoothie bowl', 'pizza slice', 'boba milk', 'dim sum', 'avocado toast',
        // Animals
        'red panda', 'axolotl', 'capybara', 'arctic fox', 'giant panda',
        'sea otter', 'quokka', 'snow leopard', 'meerkat', 'sloth bear',
        // Vehicles
        'vintage vespa', 'retro campervan', 'electric bicycle', 'steam locomotive', 'wooden sailboat',
        // Sports & Fitness
        'rock climber', 'surfer wave', 'skateboard trick', 'yoga pose', 'trail runner',
        // Tech & Gaming
        'retro gaming', 'robot friend', 'space explorer', 'VR headset', 'hologram lab',
        // Nature & Seasons
        'cherry blossom', 'autumn forest', 'coral reef', 'northern lights', 'desert cactus',
        // Lifestyle & Career
        'urban barista', 'street photographer', 'home gardener', 'city cyclist', 'dj booth',
        // Fantasy & Culture
        'samurai warrior', 'ninja cat', 'pirate ship', 'viking village', 'dragon knight',
        'witchy potion', 'ancient Egypt', 'Aztec temple', 'medieval castle', 'space wizard',
        // Health & Science
        'emergency doctor', 'lab scientist', 'bone anatomy', 'mental wellness', 'dental care',
        // Business
        'startup pitch', 'remote work', 'data analyst', 'fintech app', 'e-commerce delivery',
      ];
      const picked = GENERAL_DOMAINS[Math.floor(Math.random() * GENERAL_DOMAINS.length)];
      styleInstruction = `Generate 1 specific microstock illustration concept in English. Maximum 2 words. Output ONLY the subject/theme name itself — no extra words, no explanation. Example outputs: "ramen bowl", "red panda", "vintage vespa", "cherry blossom". Focus on: "${picked}".`;
    }

    try {
      const storedKeys = readStoredProviderApiKeys();
      const provider = getModelProvider(settings.selectedModel);
      let activeKey = storedKeys[provider]?.[0];

      // Fallback to any available provider key if current model has no key
      if (!activeKey) {
        for (const p of ['google', 'github', 'groq', 'mistral', 'openrouter', 'openai'] as const) {
          if (storedKeys[p]?.[0]) {
            activeKey = storedKeys[p][0];
            break;
          }
        }
      }

      if (!activeKey) {
        alert('Silakan pasang API Key terlebih dahulu di menu API Key untuk menggunakan Acak Ide AI.');
        setIsRolling(false);
        return;
      }

      const rawContent = await generateModelContent({
        model: settings.selectedModel,
        apiKey: activeKey,
        contents: `${styleInstruction} ABSOLUTE RULE: Output ONLY the subject phrase. MAXIMUM 2 WORDS. No explanation, no punctuation, no extra text, no JSON. Just the 2-word phrase itself. Examples of perfect output: "ramen bowl", "arctic fox", "power drill", "jazz band". BAD outputs (FORBIDDEN): "Here is a theme: ramen bowl", "The concept is: arctic fox".`,
        config: {
          temperature: 1.1,
          maxOutputTokens: 20,
        },
      });

      let extracted = (rawContent || '').trim();

      // 1. If wrapped in markdown code blocks, strip them
      extracted = extracted.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1').trim();

      // 2. Try JSON parse if it looks like JSON
      if ((extracted.startsWith('{') && extracted.endsWith('}')) || (extracted.startsWith('[') && extracted.endsWith(']'))) {
        try {
          const parsed = JSON.parse(extracted);
          if (typeof parsed === 'string') {
            extracted = parsed;
          } else if (Array.isArray(parsed) && parsed.length > 0) {
            extracted = typeof parsed[0] === 'string' ? parsed[0] : String(Object.values(parsed[0])[0] || '');
          } else if (typeof parsed === 'object' && parsed !== null) {
            const values = Object.values(parsed);
            if (values.length > 0) {
              extracted = String(values[0] || '');
            }
          }
        } catch {
          // If JSON parse fails, regex extract value inside quotes after colon
          const match = extracted.match(/:\s*["']([^"']+)["']/);
          if (match && match[1]) {
            extracted = match[1];
          }
        }
      }

      // 3. Clean any remaining artifacts, JSON keys, curly braces, and quotes
      const cleaned = extracted
        .replace(/^[{\[\s]*["']?[a-zA-Z0-9_\-]+["']?\s*:\s*["']?/, '')
        .replace(/["']?[}\]\s]*$/, '')
        .replace(/^["'`\s.\-]+|["'`\s.\-]+$/g, '')
        .replace(/^(theme|concept|idea|here is|here's|prompt|output|result)[\s:]+/i, '')
        .replace(/\b(ai[- ]powered|ai[- ]generated|ai assistant|\bai\b|artificial intelligence|vector|illustration|microstock)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/[\r\n].*/s, '')
        .trim();

      // 4. ENFORCE max 2 words — truncate if LLM was verbose
      const words = cleaned.split(/\s+/).filter(Boolean);
      const finalResult = words.slice(0, 2).join(' ');

      if (finalResult && finalResult.length >= 2 && finalResult.length <= 40) {
        settings.setConceptsInput(finalResult);
      }
    } catch (err: any) {
      console.error('Error generating AI idea via API:', err);
      alert(`Gagal mengambil ide dari API: ${err?.message || 'Koneksi error atau API key bermasalah'}`);
    } finally {
      setIsRolling(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disabled && !isLoading) {
      onGenerate();
    }
  };

  return (
    <div
      onPaste={handlePasteImage}
      className="vector-brainstorm-card w-full rounded-2xl bg-[#141416] border border-white/[0.08] p-5 sm:p-6 shadow-2xl text-white flex flex-col gap-4 focus:outline-none"
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex items-center justify-between text-xs font-bold tracking-wider text-gray-300 uppercase">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-indigo-400">psychology</span>
          <span>Idea Brainstorming</span>
        </div>
      </div>

      {/* Main Idea Input with Dice Button */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="vector-main-idea" className="text-xs font-medium text-gray-400">
            Ide Utama (AI akan mengembangkan ini)
          </label>
          <button
            type="button"
            onClick={handleRandomIdea}
            disabled={disabled || isLoading}
            className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer disabled:opacity-50"
            title="Randomize Microstock Idea"
          >
            <span className={`material-symbols-outlined text-sm ${isRolling ? 'animate-spin' : ''}`}>
              casino
            </span>
            <span>Acak Ide (Dice)</span>
          </button>
        </div>
        <div className="relative">
          <textarea
            id="vector-main-idea"
            value={settings.conceptsInput}
            onChange={(e) => settings.setConceptsInput(e.target.value)}
            placeholder="e.g. construction worker, smart robot, cute animal"
            rows={2}
            disabled={disabled || isLoading}
            className="w-full bg-[#202024] border border-white/[0.08] hover:border-white/20 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 pr-11 text-sm text-white placeholder-gray-500 focus:outline-none transition-all resize-none"
          />
          <button
            type="button"
            onClick={handleRandomIdea}
            disabled={disabled || isLoading}
            className="absolute right-2.5 bottom-2.5 p-1.5 rounded-lg bg-white/[0.06] hover:bg-indigo-500/20 text-gray-400 hover:text-indigo-300 border border-white/[0.08] hover:border-indigo-500/30 transition-all cursor-pointer disabled:opacity-50 group"
            title="Randomize Microstock Idea"
            aria-label="Acak Ide"
          >
            <span className={`material-symbols-outlined text-base group-hover:rotate-180 transition-transform duration-300 ${isRolling ? 'animate-spin' : ''}`}>
              casino
            </span>
          </button>
        </div>
      </div>

      {/* Gambar Referensi (Multiple) & Instruksi Tambahan (2 Column) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Kolom Kiri: Tempel / Unggah Banyak Gambar Referensi */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-indigo-400">image</span>
              <span>Referensi Gambar ({(settings.vectorReferenceImages || []).length})</span>
            </label>
            {(settings.vectorReferenceImages || []).length > 0 && (
              <button
                type="button"
                onClick={() => settings.clearVectorReferenceImages?.()}
                className="text-[10px] text-red-400 hover:text-red-300 font-semibold cursor-pointer"
              >
                Hapus Semua
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled || isLoading}
          />

          {(settings.vectorReferenceImages || []).length > 0 ? (
            <div className="w-full min-h-[88px] bg-[#202024] border border-indigo-500/30 rounded-xl p-2 flex flex-wrap gap-1.5">
              {(settings.vectorReferenceImages || []).map((img, idx) => (
                <div key={idx} className="relative group w-16 h-16 shrink-0">
                  <img
                    src={img}
                    alt={`Ref ${idx + 1}`}
                    className="w-full h-full object-cover rounded-lg border border-white/10 bg-black/40"
                  />
                  <button
                    type="button"
                    onClick={() => settings.removeVectorReferenceImage?.(idx)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >✕</button>
                </div>
              ))}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 shrink-0 border border-dashed border-white/20 hover:border-indigo-500/50 rounded-lg flex items-center justify-center cursor-pointer transition-all"
                title="Tambah Gambar"
              >
                <span className="material-symbols-outlined text-gray-500 hover:text-indigo-400 text-lg">add</span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleDropImage}
              className="w-full h-[88px] bg-[#202024] border border-dashed border-white/15 hover:border-indigo-500/60 hover:bg-[#26262b] rounded-xl p-2.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
              title="Klik, Drag, atau Ctrl+V untuk tempel gambar"
            >
              <span className="material-symbols-outlined text-gray-400 group-hover:text-indigo-400 text-xl transition-colors mb-1">
                add_photo_alternate
              </span>
              <p className="text-xs text-gray-300 group-hover:text-white font-medium">
                Tempel (<span className="text-indigo-400 font-semibold">Ctrl+V</span>) / Klik Unggah
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Bisa kirim banyak gambar sekaligus
              </p>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Instruksi Teks Tambahan */}
        <div>
          <label htmlFor="vector-instruction" className="text-xs font-medium text-gray-400 block mb-1.5 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-indigo-400">edit_note</span>
            <span>Instruksi Tambahan (Opsional)</span>
          </label>
          <textarea
            id="vector-instruction"
            value={settings.vectorInstruction || ''}
            onChange={(e) => settings.setVectorInstruction?.(e.target.value)}
            placeholder="e.g. fokus ke motif zigzag-nya, ubah jadi jersey basket, palet merah hitam..."
            rows={3}
            disabled={disabled || isLoading}
            className="w-full h-[88px] bg-[#202024] border border-white/[0.08] hover:border-white/20 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-all resize-none"
          />
        </div>
      </div>

      {/* Art Style, Preset, Jumlah (3 Column Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Art Style */}
        <div>
          <label htmlFor="vector-art-style" className="flex items-center gap-1.5 text-xs font-bold text-gray-300 uppercase mb-1.5">
            <span className="material-symbols-outlined text-sm text-indigo-400">palette</span>
            <span>Art Style</span>
          </label>
          <div className="relative">
            <select
              id="vector-art-style"
              value={artStyle}
              onChange={(e) => settings.setVectorArtStyle?.(e.target.value)}
              disabled={disabled || isLoading || VECTOR_ART_STYLES.length === 0}
              className="w-full appearance-none bg-[#202024] border border-white/[0.08] hover:border-white/20 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 pr-8 text-sm text-white focus:outline-none transition-all cursor-pointer truncate disabled:opacity-60"
            >
              {VECTOR_ART_STYLES.length === 0 ? (
                <option value="" className="bg-[#18181b] text-gray-400">
                  (Belum ada Art Style)
                </option>
              ) : (
                VECTOR_ART_STYLES.map((style) => (
                  <option key={style} value={style} className="bg-[#18181b] text-white">
                    {style}
                  </option>
                ))
              )}
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-base">
              expand_more
            </span>
          </div>
        </div>

        {/* Preset */}
        <div>
          <label htmlFor="vector-preset" className="flex items-center gap-1.5 text-xs font-bold text-gray-300 uppercase mb-1.5">
            <span className="material-symbols-outlined text-sm text-indigo-400">dashboard_customize</span>
            <span>Preset Layout</span>
          </label>
          <div className="relative">
            <select
              id="vector-preset"
              value={preset}
              onChange={(e) => settings.setVectorPreset?.(e.target.value)}
              disabled={disabled || isLoading}
              className="w-full appearance-none bg-[#202024] border border-white/[0.08] hover:border-white/20 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 pr-8 text-sm text-white focus:outline-none transition-all cursor-pointer truncate"
            >
              {VECTOR_LAYOUT_PRESETS.map((p) => (
                <option key={p.id} value={p.name} className="bg-[#18181b] text-white">
                  {p.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-base">
              expand_more
            </span>
          </div>
        </div>

        {/* Jumlah */}
        <div>
          <label htmlFor="vector-num-prompts" className="flex items-center gap-1.5 text-xs font-bold text-gray-300 uppercase mb-1.5">
            <span className="material-symbols-outlined text-sm text-indigo-400">tag</span>
            <span># Jumlah</span>
          </label>
          <input
            id="vector-num-prompts"
            type="number"
            min={1}
            max={50}
            value={settings.numPrompts}
            onChange={(e) => settings.setNumPrompts(Math.max(1, parseInt(e.target.value, 10) || 1))}
            disabled={disabled || isLoading}
            className="w-full bg-[#202024] border border-white/[0.08] hover:border-white/20 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Visual Layout Preview Info Card */}
      {(() => {
        const currentPresetDef = VECTOR_LAYOUT_PRESETS.find(p => p.name === preset) || VECTOR_LAYOUT_PRESETS[0];
        return (
          <div className="p-3 rounded-xl bg-[#1c1c20] border border-white/[0.08] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="shrink-0 bg-black/60 p-2 rounded-lg border border-white/10 flex items-center justify-center shadow-inner">
                <LayoutMiniPreview layoutId={preset} className="w-14 h-8" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white truncate">{currentPresetDef.label}</span>
                  {currentPresetDef.itemsCount > 1 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {currentPresetDef.itemsCount} Objek / Lembar
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">{currentPresetDef.shortDesc}</p>
              </div>
            </div>
            <span className="text-[10px] text-indigo-400/90 font-medium px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 whitespace-nowrap hidden sm:inline-block">
              Auto Grid Schema
            </span>
          </div>
        );
      })()}

      {/* Background Putih Polos Toggle */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-[#1c1c20] border border-white/[0.08] hover:border-white/15 transition-all">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${whiteBg ? 'bg-white text-black shadow-md' : 'bg-gray-800 text-gray-400'}`}>
            <span className="material-symbols-outlined text-base">
              {whiteBg ? 'check_box_outline_blank' : 'palette'}
            </span>
          </div>
          <div>
            <span className="text-xs font-semibold text-white block">
              Background Putih Polos
            </span>
            <span className="text-[11px] text-gray-400 block">
              {whiteBg ? 'Semua objek diisolasi pada latar belakang putih bersih polos' : 'Latar belakang warna pastel lembut terisolasi'}
            </span>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={whiteBg}
          onClick={() => settings.setVectorWhiteBg?.(!whiteBg)}
          disabled={disabled || isLoading}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
            whiteBg ? 'bg-indigo-600' : 'bg-gray-700'
          }`}
          title="Toggle Background Putih Polos"
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              whiteBg ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || isLoading || (!((settings.conceptsInput || '').trim()) && (settings.vectorReferenceImages || []).length === 0)}
        className="w-full py-3.5 px-4 rounded-xl bg-[#8e8e93] hover:bg-[#a1a1a6] active:bg-[#7c7c80] text-black font-semibold text-sm flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mt-1"
      >
        {isLoading ? (
          <>
            <Spinner size="sm" />
            <span>Memproses...</span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-lg">auto_awesome</span>
            <span>Kembangkan & Generate</span>
          </>
        )}
      </button>
    </div>
  );
};
