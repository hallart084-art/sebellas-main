import React from 'react';
import { UseSettingsReturn } from '../hooks/useSettings';
import { AI_MODELS, VECTOR_ART_STYLES, DEFAULT_VECTOR_ART_STYLE, getModelProvider } from '../constants';
import { generateModelContent } from '../lib/apiClient';
import { readStoredProviderApiKeys } from '../hooks/useGemini';
import Spinner from './Spinner';

export { VECTOR_ART_STYLES };

export const VECTOR_PRESETS = [
  'Single Image',
  'Sticker Pack / Set',
  'Icon Set Grid',
  'Pattern / Seamless',
] as const;

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        settings.setVectorReferenceImage?.(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDropImage = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          settings.setVectorReferenceImage?.(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePasteImage = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : [];
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        e.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            settings.setVectorReferenceImage?.(reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleRandomIdea = async () => {
    if (disabled || isLoading || isRolling) return;
    setIsRolling(true);

    const currentStyle = (artStyle || '').toLowerCase();

    let styleInstruction = '';
    if (currentStyle.includes('jersey') || currentStyle.includes('jersy')) {
      const JERSEY_DOMAINS = [
        'modern geometric velocity prism shards futsal football jersey',
        'aerodynamic falcon wing predator slash esports tournament jersey',
        'high-octane kinetic speed slash sleeveless basketball jersey',
        'hydrodynamic fluid isobar topographic contour road cycling jersey',
        'sweeping curved Teamgeist wave panels forest green soccer kit',
        'archival crescent shoulder Total 90 football jersey kit',
        'aggressive modern Polynesian chevron motif rugby jersey',
        'ultra-light aerodynamic speed chevron volleyball badminton jersey',
        'flame velocity diagonal sash streak motocross race jersey',
        'urban constructivist kinetic angular color-block street football jersey',
      ];
      const picked = JERSEY_DOMAINS[Math.floor(Math.random() * JERSEY_DOMAINS.length)];
      styleInstruction = `Generate 1 fresh, highly dynamic athletic sports jersey concept in English (2 to 5 words only). Focus on: "${picked}". Focus on real sports jersey kits (soccer, basketball, esports, cycling, volleyball, motocross). NEVER output brand logos, letters, or numbers.`;
    } else if (currentStyle.includes('livery') || currentStyle.includes('wrap')) {
      const LIVERY_DOMAINS = [
        'fluid liquid drift smoke wave decals for sports coupe',
        'aggressive geometric speed shard racing stripes for modern supercar',
        'ferocious aerodynamic predator claw racing decals for drift sedan',
        'dynamic aerodynamic rally speed slashes for hot hatchback',
        'kinetic vector dot matrix racing stripes for commercial cargo box van',
        'desert rally racing speed streaks for 4x4 trophy truck',
        'lightning chevron velocity blades for widebody GT racer',
        'high-speed flame velocity swoosh decals for performance track car',
      ];
      const picked = LIVERY_DOMAINS[Math.floor(Math.random() * LIVERY_DOMAINS.length)];
      styleInstruction = `Generate 1 fresh, highly dynamic automotive motorsport racing livery / car wrap decal concept in English (2 to 5 words only). Focus on: "${picked}". Focus on real racing stripes, speed swooshes, asymmetric velocity slashes, and drift decals. STRICTLY FORBIDDEN: NEVER output repeating wallpaper patterns, honeycomb meshes, spiral vortexes, car brand names, letters, or numbers.`;
    } else if (currentStyle.includes('pictogram') || currentStyle.includes('logo') || currentStyle.includes('abstract')) {
      const LOGO_DOMAINS = [
        'stylized wildlife animal emblem with rhythmic comb tines (stag, gazelle, falcon, lion, whale)',
        'minimalist culinary gastronomy symbol (espresso steam glyph, burger emblem, sushi mark)',
        'modern kinetic sports speed icon (aerodynamic runner mark, cyclist blade glyph)',
        'botanical leaf flourishing arabesque seal (monstera, lotus crown, olive branch)',
        'modern academic architectural temple crest (knowledge beacon, graduation cap star)',
        'artisan craftsman portrait emblem (bearded barista, chef profile, astronaut helmet)',
      ];
      const picked = LOGO_DOMAINS[Math.floor(Math.random() * LOGO_DOMAINS.length)];
      styleInstruction = `Generate 1 fresh, ultra-minimalist, iconic brand logo mark or abstract pictogram concept in English (2 to 4 words only). Focus on: "${picked}". Think Swiss graphic design, Zalo Estévez style, radical shape reduction.`;
    } else if (currentStyle.includes('pattern') || currentStyle.includes('seamless')) {
      const PATTERN_DOMAINS = [
        'vibrant retro 1970s Scandinavian organic Matisse floral pattern',
        'swimming pool top-down liquid blue water caustics ripple pattern',
        'playful cheerful scattered breakfast food doodles with bright happy colors',
        'cute baby woodland animal face silhouettes with forest leaves',
        'modern geometric op-art herringbone wave line maze pattern',
        'back-to-school educational stationery doodles with science icons',
        'friendly pediatric healthcare doodles with stethoscopes and smiling hearts',
      ];
      const picked = PATTERN_DOMAINS[Math.floor(Math.random() * PATTERN_DOMAINS.length)];
      styleInstruction = `Generate 1 fresh, vibrant, cheerful 2D seamless surface pattern / wallpaper theme in English (2 to 5 words only). Focus on: "${picked}". Think playful, colorful, all-over surface print.`;
    } else if (currentStyle.includes('object')) {
      const OBJECT_DOMAINS = [
        'precision artisan woodworking and mechanical workshop power tools',
        'professional barista espresso coffee brewing station and grinder',
        'futuristic electric mobility vehicles, delivery vans, and scooters',
        'vintage analog twin-lens photography camera and optical lenses',
        'cutting-edge STEM biotechnology laboratory microscope and glassware',
        'modern indoor botanical gardening tools, ceramic pots, and shears',
      ];
      const picked = OBJECT_DOMAINS[Math.floor(Math.random() * OBJECT_DOMAINS.length)];
      styleInstruction = `Generate 1 fresh, high-value commercial inanimate physical object / vehicle / tool set concept in English (2 to 5 words only). Focus on: "${picked}". STRICT RULE: INANIMATE OBJECTS ONLY (Zero humans, zero characters, zero faces).`;
    } else if (currentStyle.includes('geometric silhouette') || currentStyle.includes('negative space')) {
      const SILHOUETTE_DOMAINS = [
        'powerful wild predator animal head (arctic wolf, charging bull, roaring lion, soaring eagle)',
        'noble athletic warrior or mythical creature (winged griffin, roaring dragon, pegasus)',
        'dynamic athletic gymnast or runner in dramatic mid-air leap',
        'iconic wildlife forest stag deer with magnificent branching antlers',
        'ancient mythical titan or bearded Olympian god bust',
      ];
      const picked = SILHOUETTE_DOMAINS[Math.floor(Math.random() * SILHOUETTE_DOMAINS.length)];
      styleInstruction = `Generate 1 fresh, powerful, high-contrast silhouette or negative space subject in English (2 to 4 words only). Focus on: "${picked}". Subject must have dramatic anatomical contour and high visual impact.`;
    } else {
      const GENERAL_DOMAINS = [
        'renewable green energy and environmental engineering',
        'specialized medical healthcare and modern wellness',
        'artisan craft workshop and handmade manufacturing',
        'logistics supply chain and smart delivery commute',
        'cutting-edge STEM laboratory science and robotics',
        'culinary gastronomy and artisan specialty baking',
        'outdoor athletics sports and active lifestyle',
        'wildlife nature encounters and adorable domestic pets',
        'creative visual design architecture and photography',
        'fintech smart business analysis and investment growth',
      ];
      const picked = GENERAL_DOMAINS[Math.floor(Math.random() * GENERAL_DOMAINS.length)];
      styleInstruction = `Generate 1 fresh, highly specific, high-value commercial 2D microstock vector theme in English (2 to 5 words only). Focus on the domain of: "${picked}".`;
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
        contents: `${styleInstruction} STRICT RULES: Output ONLY plain text in English. DO NOT output JSON. DO NOT use curly braces, brackets, quotes, markdown code blocks, or JSON keys. NEVER output meta words like 'AI', 'vector', 'illustration', or 'prompt'. Output ONLY the raw subject phrase (2 to 5 words).`,
        config: {
          temperature: 1.0,
          maxOutputTokens: 60,
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
        .replace(/^(theme|concept|idea|here is|here's|prompt):\s*/i, '')
        .replace(/\b(ai[- ]powered|ai[- ]generated|ai assistant|\bai\b|artificial intelligence|vector|illustration|microstock)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .replace(/[\r\n].*/s, '')
        .trim();

      if (cleaned && cleaned.length >= 2 && cleaned.length <= 80) {
        settings.setConceptsInput(cleaned);
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

      {/* Gambar Referensi (Kiri) & Instruksi Tambahan (Kanan) (2 Column) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Kolom Kiri: Tempel / Unggah Gambar Referensi */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-indigo-400">image</span>
              <span>Tempel Gambar (Opsional)</span>
            </label>
            {settings.vectorReferenceImage && (
              <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Terpasang
              </span>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled || isLoading}
          />

          {settings.vectorReferenceImage ? (
            <div className="relative group w-full h-[88px] bg-[#202024] border border-indigo-500/40 rounded-xl overflow-hidden flex items-center p-2 gap-3">
              <img
                src={settings.vectorReferenceImage}
                alt="Referensi Visual"
                className="h-full w-20 object-cover rounded-lg border border-white/10 shrink-0 bg-black/40"
              />
              <div className="flex-1 min-w-0 pr-6">
                <p className="text-xs font-medium text-white truncate">Gambar Referensi Visual</p>
                <p className="text-[11px] text-gray-400 mt-0.5">AI akan membaca DNA motif, warna & siluet sport gambar ini</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  settings.setVectorReferenceImage?.('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                disabled={disabled || isLoading}
                className="absolute top-2 right-2 p-1 rounded-lg bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/30 transition-all cursor-pointer"
                title="Hapus Gambar"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleDropImage}
              className="w-full h-[88px] bg-[#202024] border border-dashed border-white/15 hover:border-indigo-500/60 hover:bg-[#26262b] rounded-xl p-2.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
              title="Klik untuk memilih file, atau tekan Ctrl + V untuk tempel gambar screenshot"
            >
              <span className="material-symbols-outlined text-gray-400 group-hover:text-indigo-400 text-xl transition-colors mb-1">
                add_photo_alternate
              </span>
              <p className="text-xs text-gray-300 group-hover:text-white font-medium">
                Tempel (<span className="text-indigo-400 font-semibold">Ctrl+V</span>) / Klik Unggah
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                AI akan membedah motif DNA & warna gambar
              </p>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Instruksi Teks Tambahan */}
        <div>
          <label htmlFor="vector-instruction" className="text-xs font-medium text-gray-400 block mb-1.5 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-indigo-400">edit_note</span>
            <span>Instruksi Tambahan dari Gambar (Opsional)</span>
          </label>
          <textarea
            id="vector-instruction"
            value={settings.vectorInstruction || ''}
            onChange={(e) => settings.setVectorInstruction?.(e.target.value)}
            placeholder="e.g. fokus ke ombak birunya, ubah jadi jersey basket, palet warna merah putih..."
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
            <span className="material-symbols-outlined text-sm text-indigo-400">settings</span>
            <span>Preset</span>
          </label>
          <div className="relative">
            <select
              id="vector-preset"
              value={preset}
              onChange={(e) => settings.setVectorPreset?.(e.target.value)}
              disabled={disabled || isLoading}
              className="w-full appearance-none bg-[#202024] border border-white/[0.08] hover:border-white/20 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 pr-8 text-sm text-white focus:outline-none transition-all cursor-pointer truncate"
            >
              {VECTOR_PRESETS.map((p) => (
                <option key={p} value={p} className="bg-[#18181b] text-white">
                  {p}
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
        disabled={disabled || isLoading || !settings.conceptsInput.trim()}
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
