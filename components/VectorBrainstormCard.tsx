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

export const MICROSTOCK_VECTOR_IDEAS = [
  // 1. Renewable Energy & Sustainability
  'solar panel installer on rooftop',
  'wind turbine maintenance engineer',
  'electric vehicle charging station',
  'urban rooftop organic garden',
  'smart water irrigation system',
  'hydroponic vertical farming',
  'recycled plastic craft artisan',
  'electric battery research scientist',

  // 2. Health, Medicine & Wellness
  'pediatrician examining child',
  'surgeon preparing sterile instruments',
  'physical therapist assisting patient',
  'yoga instructor in mountain pose',
  'pharmacist dispensing medicine',
  'microbiologist with electron microscope',
  'paramedic in ambulance rescue',
  'dentist checking dental mirror tool',

  // 3. Specialized Crafts & Artisans
  'ceramic pottery wheel artisan',
  'leather shoes cobbler workshop',
  'woodworker carving furniture joint',
  'glassblower shaping molten vase',
  'blacksmith forging heated steel',
  'watchmaker repairing antique gear',
  'specialty coffee roaster sampling beans',
  'tailor measuring suit fabric',

  // 4. Logistics, Supply Chain & Urban Services
  'electric cargo bicycle delivery courier',
  'automated warehouse logistics robot',
  'air cargo freight loader',
  'refrigerated food delivery van',
  'harbor container crane operator',
  'postal worker sorting mail parcels',
  'electric bus rapid transit commute',

  // 5. Tech, Engineering & Science
  'data center fiber optic technician',
  'satellite antenna telecommunications specialist',
  'quantum processor testing engineer',
  'cyber security analyst with firewall shield',
  'drone pilot mapping agricultural fields',
  'space telescope astrophysicist',
  'friendly smart service robot assistant',

  // 6. Culinary & Artisan Food
  'artisan sourdough baker scoring dough',
  'pastry chef piping delicate macaron',
  'sushi master slicing fresh sashimi',
  'barista pouring swan latte art',
  'chocolatier tempering dark cocoa',
  'wood fired pizza pizzaiolo',

  // 7. Sports, Fitness & Outdoor Adventure
  'bouldering rock climber reaching grip',
  'gravel bike cyclist on forest trail',
  'swimmer diving off starting block',
  'badminton player smashing shuttlecock',
  'trail runner crossing wooden bridge',
  'kayaker paddling through calm river',
  'archer aiming at target bullseye',

  // 8. Nature, Wildlife & Animals
  'playful golden retriever puppy running',
  'curious red fox in snowy meadow',
  'majestic stag deer in misty birch forest',
  'fluffy calico cat napping on bookshelf',
  'humpback whale breaching ocean wave',
  'barn owl perched on oak branch',
  'sea turtle gliding over coral reef',

  // 9. Creative Arts & Media
  'landscape photographer with tripod at sunrise',
  'ui designer sketching mobile app wireframe',
  'sound engineer adjusting mixing console',
  'calligrapher with ink brush on paper',
  'architect reviewing blueprint with scale ruler',
  'animator with digital drawing tablet',

  // 10. Modern Finance & Business
  'financial analyst reviewing growth chart',
  'startup founders pitching on whiteboard',
  'global market currency exchange icon',
  'fintech digital wallet payment',
  'secure cloud computing data vault',
];

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
  const artStyle = settings.vectorArtStyle || (VECTOR_ART_STYLES[0] || '');
  const preset = settings.vectorPreset || 'Single Image';
  const pose = settings.vectorPose || '';
  const attributes = settings.vectorAttributes || '';
  const whiteBg = settings.vectorWhiteBg ?? true;

  const handleRandomIdea = async () => {
    if (disabled || isLoading || isRolling) return;
    setIsRolling(true);

    const INDUSTRY_DOMAINS = [
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
    const pickedDomain = INDUSTRY_DOMAINS[Math.floor(Math.random() * INDUSTRY_DOMAINS.length)];

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

      if (activeKey) {
        const rawContent = await generateModelContent({
          model: settings.selectedModel,
          apiKey: activeKey,
          contents: `Generate 1 fresh, highly specific, high-value commercial 2D microstock vector theme in English (2 to 5 words only). Focus on the domain of: "${pickedDomain}". STRICT RULE: NEVER output meta words like 'AI', 'vector', 'illustration', or 'prompt'. Output ONLY the raw subject phrase without quotes or explanation.`,
          config: {
            temperature: 1.0,
            maxOutputTokens: 60,
          },
        });

        const cleaned = (rawContent || '')
          .replace(/^["'`\s.\-]+|["'`\s.\-]+$/g, '')
          .replace(/^(theme|concept|idea|here is|here's|prompt):\s*/i, '')
          .replace(/\b(ai[- ]powered|ai[- ]generated|ai assistant|\bai\b|artificial intelligence|vector|illustration|microstock)\b/gi, '')
          .replace(/\s{2,}/g, ' ')
          .replace(/\n.*/s, '')
          .trim();

        if (cleaned && cleaned.length >= 3 && cleaned.length <= 60) {
          settings.setConceptsInput(cleaned);
          setIsRolling(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Real-time AI idea generation fallback to offline list:', err);
    } finally {
      setIsRolling(false);
    }

    // Graceful fallback to rich curated list
    const availableIdeas = MICROSTOCK_VECTOR_IDEAS.filter(
      (idea) => idea.toLowerCase() !== settings.conceptsInput.trim().toLowerCase()
    );
    const randomPick = availableIdeas[Math.floor(Math.random() * availableIdeas.length)] || MICROSTOCK_VECTOR_IDEAS[0];
    settings.setConceptsInput(randomPick);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disabled && !isLoading) {
      onGenerate();
    }
  };

  return (
    <div className="vector-brainstorm-card w-full rounded-2xl bg-[#141416] border border-white/[0.08] p-5 sm:p-6 shadow-2xl text-white flex flex-col gap-4">
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

      {/* Pose & Attributes (2 Column) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="vector-pose" className="text-xs font-medium text-gray-400 block mb-1.5">
            Pose (Opsional)
          </label>
          <input
            id="vector-pose"
            type="text"
            value={pose}
            onChange={(e) => settings.setVectorPose?.(e.target.value)}
            placeholder="AI akan menentukan jika kosong"
            disabled={disabled || isLoading}
            className="w-full bg-[#202024] border border-white/[0.08] hover:border-white/20 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-all"
          />
        </div>
        <div>
          <label htmlFor="vector-attributes" className="text-xs font-medium text-gray-400 block mb-1.5">
            Attributes (Opsional)
          </label>
          <input
            id="vector-attributes"
            type="text"
            value={attributes}
            onChange={(e) => settings.setVectorAttributes?.(e.target.value)}
            placeholder="AI akan menentukan jika kosong"
            disabled={disabled || isLoading}
            className="w-full bg-[#202024] border border-white/[0.08] hover:border-white/20 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-all"
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
