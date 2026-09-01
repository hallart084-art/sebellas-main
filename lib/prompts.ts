
import { UseSettingsReturn } from '../hooks/useSettings';
import { Type, ThinkingLevel } from '@google/genai';
import { applyQuickGenerateConfig } from './models';

const promptListSchema = {
 type: Type.ARRAY,
 items: {
 type: Type.STRING,
 description: 'A unique and creative prompt for AI image/video generation.'
 }
};

const footageObjectSchema = {
 type: Type.OBJECT,
 properties: {
 summary: { type: Type.STRING, description: "Isi dengan ringkasan singkat tentang keseluruhan scene atau video, merangkum inti adegan agar AI langsung menangkap konteks utama." },
 subject_details: {
 type: Type.OBJECT,
 properties: {
 appearance: { type: Type.STRING, description: "Jelaskan karakteristik visual subjek secara lengkap: fisik, pakaian, atribut tambahan, gaya gerak, dan detail penting lainnya." },
 subject_action_setting: { type: Type.STRING, description: "Jelaskan apa yang sedang dilakukan subjek: aksi, gestur, arah gerakan, pose, dan dinamika tubuh. Bisa mencakup ritme gerakan (lambat, cepat, halus, tegas, etc.)." },
 expression_or_mood: { type: Type.STRING, description: "Tuliskan ekspresi wajah, bahasa tubuh, atau mood emosional yang ingin ditampilkan." }
 },
 required: ["appearance", "subject_action_setting", "expression_or_mood"]
 },
 environment: {
 type: Type.OBJECT,
 properties: {
 background_setting: { type: Type.STRING, description: "Deskripsikan lokasi atau latar secara detail" }
 },
 required: ["background_setting"]
 },
 composition: {
 type: Type.OBJECT,
 properties: {
 camera_angle: { type: Type.STRING, description: "Isi dengan sudut pandang kamera." },
 framing: { type: Type.STRING, description: "Jelaskan bagaimana subjek ditempatkan dalam frame." },
 depth_of_field: { type: Type.STRING, description: "Tentukan fokus yang digunakan: shallow DOF, deep DOF, background blur, bokeh, etc." }
 },
 required: ["camera_angle", "framing", "depth_of_field"]
 },
 tone_color: {
 type: Type.OBJECT,
 properties: {
 dominant_tone: { type: Type.STRING, description: "Isi dengan tone warna utama pada video." },
 contrast_level: { type: Type.STRING, description: "Rendah, sedang, atau tinggi, etc." },
 saturation: { type: Type.STRING, description: "Deskripsikan tingkat saturasi: low, medium, high." }
 },
 required: ["dominant_tone", "contrast_level", "saturation"]
 },
 technical: {
 type: Type.OBJECT,
 properties: {
 camera_movement: { type: Type.STRING, description: "Tambahkan gerakan kamera untuk video." },
 camera_lens_type: { type: Type.STRING, description: "Tulis jenis kamera dan lensa yang digunakan." },
 lens_effects: { type: Type.STRING, description: "Tambahkan efek lensa yang dipakai." },
 lighting_style: { type: Type.STRING, description: "Tuliskan jenis cahaya yang digunakan." }
 },
 required: ["camera_movement", "camera_lens_type", "lens_effects", "lighting_style"]
 },
 extra_constraints: { type: Type.STRING, description: "Isi aturan tambahan seperti batasan artistik, hal yang harus dihindari, atau ambil dari negative prompt." },
 keywords: {
 type: Type.ARRAY,
 items: { type: Type.STRING },
 description: "Masukkan kata kunci penting yang mewakili tema, suasana, objek utama, atau detail yang wajib muncul."
 }
 },
 required: ["summary", "subject_details", "environment", "composition", "tone_color", "technical", "extra_constraints", "keywords"]
};

const footageListSchema = {
 type: Type.ARRAY,
 items: footageObjectSchema
};

const nonPhotographicStyleBanInstruction = `CRITICAL STYLE GUARDRAIL (FATAL PENALTY FOR VIOLATION): Output must remain purely camera-captured photographic in style. You are STRICTLY FORBIDDEN from using any non-photographic visual direction or wording, including but not limited to: vector, illustration, illustrated, cartoon, anime, manga, comic, cel-shaded, 3D render, CGI, digital art, painting, watercolor, oil painting, sketch, doodle, line art, flat design, low poly, voxel, icon style, logo style, posterized, graphic design, stylized illustration, mascot style. Never use those terms or their synonyms. If a concept implies those styles, you MUST reinterpret it into real-world camera-captured photographic language while preserving the subject intent. USING ANY OF THE FORBIDDEN WORDS WILL CAUSE THE SYSTEM TO CRASH AND REJECT YOUR OUTPUT.`;

const plainPromptFormattingInstruction = `Do not use Markdown formatting anywhere in the output, including inside JSON string values. Never wrap words or phrases with **, __, backticks, headings, or bullet markers. Write plain prompt text only.`;

const jsonStringSafetyInstruction = `CRITICAL JSON OUTPUT RULES (HIGHEST PRIORITY — VIOLATING ANY RULE MEANS TOTAL FAILURE):
1. VALID COMPLETE JSON: Your ENTIRE output must be a single, complete, valid JSON array. It MUST start with [ and MUST end with ]. NEVER leave the JSON array incomplete, truncated, or unclosed. An incomplete JSON array is a catastrophic failure.
2. NO RAW DOUBLE QUOTES: Any content you generate inside JSON string values — including brand names, product names, slogans, labels, or any quoted text — MUST NOT contain raw double quote characters. Use single quotes (') instead of double quotes (") inside string content. Example: write 'SebellasCafe' instead of "SebellasCafe".
3. JSON COMPLETION PRIORITY: If your response is getting long, you MUST prioritize properly closing every string with " and closing the array with ] over adding more detail. A complete JSON with shorter prompts is infinitely better than a truncated JSON with longer prompts. ALWAYS close the JSON array.`;

/**
 * Menghasilkan instruksi negative prompt yang efektif.
 * Dipakai oleh semua builder — satu sumber, tidak duplikasi.
 *
 * Penting: Tidak menggunakan format step-by-step atau header dengan bracket
 * karena format seperti itu mendorong AI menulis reasoning ke dalam output.
 */
const buildNegativePromptInstruction = (negativePrompt: string): string => {
  const baseNoTextRule = `UNIVERSAL MANDATORY NEGATIVE RESTRICTIONS (apply silently — do NOT write these rules or any reasoning in your output):
- STRICTLY ZERO TEXT: Absolutely NO text, NO typography, NO words, NO letters, NO numbers, NO fonts, NO slogans, NO labels, NO signs, NO watermark, NO logo text, NO signature, NO barcodes, NO captions, and NO fake script/writing anywhere. All surfaces, props, screens, signs, and backgrounds must be completely plain, blank, and textless.
`;
  if (!negativePrompt.trim()) {
    return baseNoTextRule + '\n';
  }
  return `${baseNoTextRule}- USER FORBIDDEN CONCEPTS: ${negativePrompt.trim()} (Never include them, their synonyms, related terms, or derivative concepts anywhere in your output).

`;
};

const photographicXmlTemplateInstruction = `XML FORMAT CONTRACT:
You are an expert prompt engineer. Your output MUST be a single JSON array containing exactly the requested number of strings.
Each string inside the array MUST be formatted EXACTLY as the following XML template.

CRITICAL RULE: The text inside the square brackets [...] are STRICT INSTRUCTIONS for the exact level of detail you must provide. You MUST read the explanation inside those brackets carefully and generate highly detailed, professional, and exhaustive descriptions that completely fulfill every requirement mentioned in the brackets! Do not be brief or superficial; elaborate extensively! DO NOT output the literal '[' and ']' characters. You MUST replace the entire bracketed section with your generated English text! Output ONLY continuous sentences inside the XML tags without any brackets or placeholder text! For tags that DO NOT contain square brackets (such as <Prohibitions>), you MUST copy the exact text provided in the template verbatim, without modifying, adding, or generating anything new! You MUST strictly maintain the exact XML structure. DO NOT omit, skip, or misspell any opening or closing XML tags. Every section MUST have correctly matched opening and closing tags (e.g. <Background>...</Background>). Do not accidentally close a tag with a different name.

CRITICAL JSON STRING RULE: Do NOT put raw line breaks (actual newline characters) or unescaped double quote characters (") inside any JSON string value. Each complete prompt MUST be output as a SINGLE-LINE JSON string — never as a multi-line string. Use the escaped literal \\n to represent a line break inside the prompt content, and use single-quote characters (') for any quoted text inside the prompt. Violating this rule produces invalid JSON that cannot be parsed.

CRITICAL: Your output must look like this JSON array (notice ALL content is on ONE LINE per string, using \\n for line breaks):
[
  "<Subject>
[DESKRIPSI_SUBJEK_UTAMA - Deskripsikan subjek secara spesifik. Contoh: \"An elegant cybernetic robot\", \"A minimalist ceramic teapot\", atau \"An adventurous female archaeologist in her late 30s\"].
[TEKSTUR_MATERIAL_DAN_FISIK - Sampaikan detail fisik mikro agar gambar terhindar dari kesan buatan AI. Contoh untuk manusia: \"Visible skin pores, fine facial hair, natural skin wrinkles, and organic lip creases\". Contoh untuk benda/lingkungan: \"Scratched anodized metal plates, brushed concrete textures, or matte unpolished clay\"].
[POSE_DAN_INTERAKSI_FISIK - Posisi tubuh atau cara subjek berinteraksi dengan sekitarnya. Contoh: \"Resting her calloused hands flat on the wooden table\" atau \"The object is positioned with a stable physical footprint\"].
</Subject>

<Style>
[GAYA_VISUAL_UTAMA - Tentukan medium visualnya. Apakah itu fotografi, seni digital, atau gaya tradisional? Contoh: \"Cinematic commercial editorial photography\", \"3D isometric miniature diorama\", \"Modern flat vector vector art\", \"Vibrant watercolor painting\", atau \"Retro 1980s anime screenshot\"].
[EMULASI_MEDIUM_DAN_WARNA - Atur karakteristik warna dan tekstur visual. Contoh: \"Rendered on 35mm physical color film with soft organic grain\" atau \"Using a muted pastel color palette with soft charcoal outlines\"].
</Style>

<Lighting>
[SUMBER_CAHAYA_DAN_ARAH - Deskripsikan dari mana arah cahaya datang dan intensitasnya. Contoh: \"Single-source natural window light coming from the left side\" atau \"A three-point studio softbox setup to eliminate harsh contrast\"].
[TEMPERATUR_WARNA_KELVIN - Atur suasana warna dengan temperatur fisik. Contoh: \"Warm golden lighting at 3200K\" atau \"Neutral daylight studio environment at 5500K\"].
[SABUK_BAYANGAN_DAN_KONTRAS - Bentuk bayangan yang terbentuk. Contoh: \"Soft, diffused contact shadows\" atau \"Dramatic chiaroscuro lighting with sharp, high-contrast shadows\"].
</Lighting>

<Background>
[LATAR_BELAKANG_DAN_MATERIAL - Detail area di sekitar subjek. Contoh: \"A rustic, clean-swept kitchen workspace with raw concrete walls\" atau \"A vast, atmospheric mountain valley engulfed in morning fog\"].
[KEDALAMAN_RUANG_SPASIAL - Atur jarak visual subjek dan latar belakang. Contoh: \"A deep physical distance from the subject, melting into a heavy out-of-focus bokeh blur\" atau \"A solid, clean off-white cardboard panel with no details\"].
</Background>

<Composition>
[PERSPEKTIF_DAN_SUDUT_PANDANG - Sudut pengambilan gambar oleh kamera virtual. Contoh: \"Eye-level straight shot\", \"Top-down bird's-eye view\", \"Low-angle heroic perspective\", atau \"Isometric 45-degree angle\"].
[SPESIFIKASI_LENSA_FISIK - Simulasi optik kamera nyata. Contoh: \"Captured with a virtual 50mm f/1.8 lens\", \"Shot on a 100mm macro lens for extreme close-up details\", atau \"Wide-angle lens with deep focus\"].
</Composition>

<Typography>
[TEKS_DAN_TIPOGRAFI - Jika gambar TIDAK memerlukan teks atau TIDAK ADA teks yang terlihat pada gambar referensi, HAPUS SELURUH section <Typography>...</Typography> ini dari output. JANGAN tulis 'NONE' atau section kosong. HANYA sertakan section <Typography> jika MEMANG ADA teks yang harus ditampilkan. Jika ada teks, deskripsikan secara detail. Contoh: "The banner features the text 'OPEN LATE' in a bold, white font"].
</Typography>

<Mandatory>
[MANDATORY_ELEMENTS - You MUST write an exhaustive numbered list of at least 5 to 10 highly specific, non-negotiable technical requirements for the image. Do NOT write simple, trivial, or brief bullet points. Each mandatory item MUST be a detailed, complex instruction specifying exact physical behaviors, material interactions, optical correctness, or compositional constraints. For example: "1. The metallic surfaces MUST display physically accurate, environment-mapped reflections that correctly distort along the curvature, with no artificial blooming." or "2. The depth of field MUST be razor-thin, ensuring the primary subject's eyes are in pin-sharp focus while foreground elements naturally fall out of focus with a creamy bokeh." List 5 to 10 items in this exhaustive, highly technical manner].
</Mandatory>

<Prohibitions>
No plastic look, no airbrushed or overly smooth skin, no exaggerated teeth-showing smiles, no digital lens flares, no glowing neon halo outlines around the subject, no floating objects, no missing shadows, no generic studio lighting, no warped fingers or hands, no overlapping text blocks, no misspelled words, no random decorative emojis, no watermarks, no artist signatures.
</Prohibitions>"
]
`;

const refStyleXmlTemplateInstruction = `XML FORMAT CONTRACT (CRITICAL FATAL PENALTY FOR VIOLATION):
You are an expert prompt engineer. Your output MUST be a single JSON array containing exactly the requested number of strings.
Each string inside the array MUST be formatted EXACTLY as the following XML template.

CRITICAL RULE: The text inside the square brackets [...] are STRICT INSTRUCTIONS for the exact level of detail you must provide. You MUST read the explanation inside those brackets carefully and generate highly detailed, professional, and exhaustive descriptions that completely fulfill every requirement mentioned in the brackets! Do not be brief or superficial; elaborate extensively! DO NOT output the literal '[' and ']' characters. You MUST replace the entire bracketed section with your generated English text! Output ONLY continuous sentences inside the XML tags without any brackets or placeholder text! For tags that DO NOT contain square brackets (such as <Prohibitions>), you MUST copy the exact text provided in the template verbatim, without modifying, adding, or generating anything new!

ABSOLUTE XML STRUCTURE REQUIREMENT:
You MUST strictly maintain the exact XML structure! DO NOT omit, skip, or misspell any opening or closing XML tags! Every section MUST have correctly matched opening and closing tags (e.g. if you open <Lighting>, you MUST close it with exactly </Lighting>). Do not accidentally close a tag with a different name. Do NOT nest tags inside each other. The order and structure of tags is NON-NEGOTIABLE. Failure to properly close tags will break the system.

CRITICAL JSON STRING RULE: Do NOT put raw line breaks (actual newline characters) or unescaped double quote characters (") inside any JSON string value. Each complete prompt MUST be output as a SINGLE-LINE JSON string — never as a multi-line string. Use the escaped literal \\n to represent a line break inside the prompt content, and use single-quote characters (') for any quoted text inside the prompt. Violating this rule produces invalid JSON that cannot be parsed.

CRITICAL: Your output must look like this JSON array (notice ALL content is on ONE LINE per string, using \\n for line breaks):
[
  "<Subject>
[DESKRIPSI_SUBJEK_UTAMA - Deskripsikan subjek secara spesifik. Contoh: \"An elegant cybernetic robot\", \"A minimalist ceramic teapot\", atau \"An adventurous female archaeologist in her late 30s\"].
[TEKSTUR_MATERIAL_DAN_FISIK - Sampaikan detail fisik mikro agar gambar terhindar dari kesan buatan AI. Contoh untuk manusia: \"Visible skin pores, fine facial hair, natural skin wrinkles, and organic lip creases\". Contoh untuk benda/lingkungan: \"Scratched anodized metal plates, brushed concrete textures, or matte unpolished clay\"].
[POSE_DAN_INTERAKSI_FISIK - Posisi tubuh atau cara subjek berinteraksi dengan sekitarnya. Contoh: \"Resting her calloused hands flat on the wooden table\" atau \"The object is positioned with a stable physical footprint\"].
</Subject>

<Style>
[GAYA_VISUAL_UTAMA - Tentukan medium visualnya. Apakah itu fotografi, seni digital, atau gaya tradisional? Contoh: \"Cinematic commercial editorial photography\", \"3D isometric miniature diorama\", \"Modern flat vector vector art\", \"Vibrant watercolor painting\", atau \"Retro 1980s anime screenshot\"].
[EMULASI_MEDIUM_DAN_WARNA - Atur karakteristik warna dan tekstur visual. Contoh: \"Rendered on 35mm physical color film with soft organic grain\" atau \"Using a muted pastel color palette with soft charcoal outlines\"].
</Style>

<Lighting>
[SUMBER_CAHAYA_DAN_ARAH - Deskripsikan dari mana arah cahaya datang dan intensitasnya. Contoh: \"Single-source natural window light coming from the left side\" atau \"A three-point studio softbox setup to eliminate harsh contrast\"].
[TEMPERATUR_WARNA_KELVIN - Atur suasana warna dengan temperatur fisik. Contoh: \"Warm golden lighting at 3200K\" atau \"Neutral daylight studio environment at 5500K\"].
[SABUK_BAYANGAN_DAN_KONTRAS - Bentuk bayangan yang terbentuk. Contoh: \"Soft, diffused contact shadows\" atau \"Dramatic chiaroscuro lighting with sharp, high-contrast shadows\"].
</Lighting>

<Background>
[LATAR_BELAKANG_DAN_MATERIAL - Detail area di sekitar subjek. Contoh: \"A rustic, clean-swept kitchen workspace with raw concrete walls\" atau \"A vast, atmospheric mountain valley engulfed in morning fog\"].
[KEDALAMAN_RUANG_SPASIAL - Atur jarak visual subjek dan latar belakang. Contoh: \"A deep physical distance from the subject, melting into a heavy out-of-focus bokeh blur\" atau \"A solid, clean off-white cardboard panel with no details\"].
</Background>

<Composition>
[PERSPEKTIF_DAN_SUDUT_PANDANG - Perspektif pengamatan visual terhadap subjek. Contoh: \"Eye-level straight perspective\", \"Top-down bird's-eye view\", \"Low-angle heroic perspective\", atau \"Isometric 45-degree angle\"].
</Composition>

<Typography>
[TEKS_DAN_TIPOGRAFI - Jika gambar TIDAK memerlukan teks atau TIDAK ADA teks yang terlihat pada gambar referensi, HAPUS SELURUH section <Typography>...</Typography> ini dari output. JANGAN tulis 'NONE' atau section kosong. HANYA sertakan section <Typography> jika MEMANG ADA teks yang harus ditampilkan. Jika ada teks, deskripsikan secara detail. Contoh: "The banner features the text 'OPEN LATE' in a bold, white font"].
</Typography>

<Mandatory>
[MANDATORY_ELEMENTS - You MUST write an exhaustive numbered list of at least 5 to 10 highly specific, non-negotiable technical requirements for the image. Do NOT write simple, trivial, or brief bullet points. Each mandatory item MUST be a detailed, complex instruction specifying exact physical behaviors, material interactions, optical correctness, or compositional constraints. For example: "1. The metallic surfaces MUST display physically accurate, environment-mapped reflections that correctly distort along the curvature, with no artificial blooming." or "2. The depth of field MUST be razor-thin, ensuring the primary subject's eyes are in pin-sharp focus while foreground elements naturally fall out of focus with a creamy bokeh." List 5 to 10 items in this exhaustive, highly technical manner].
</Mandatory>

<Prohibitions>
No plastic look, no airbrushed or overly smooth skin, no exaggerated teeth-showing smiles, no digital lens flares, no glowing neon halo outlines around the subject, no floating objects, no missing shadows, no generic studio lighting, no warped fingers or hands, no overlapping text blocks, no misspelled words, no random decorative emojis, no watermarks, no artist signatures.
</Prohibitions>"
]
`;

const humanAncestryInstruction = `HUMAN SUBJECT RULE: If any prompt contains human subjects, you must determine and write one race, ethnicity, nationality, regional ancestry, or ancestry descriptor for every visible human subject before returning the final JSON. For reference images or videos, first make an internal inventory of all visible humans, including secondary people, children, adults, background presenters, companions, patients, workers, or bystanders who are visually relevant. Describe each relevant human subject with their own descriptor, clothing, pose/action, expression, and relationship or placement in the scene; do not describe only the most prominent person when more than one human is visible. For text concepts, choose fitting descriptors that make each human subject specific. Use natural phrasing such as "a young woman of Japanese ancestry", "a Black man", "a Latina girl", "an elderly Nigerian woman", "a child of mixed European and East Asian ancestry", or "people of mixed ancestry" when exact ancestry is uncertain. Do not use only generic words like person, woman, man, child, model, worker, group, crowd, or subject without descriptors. Before final output, self-check every prompt and rewrite any human subject phrase that lacks its own descriptor or omits another visible human subject.`;

const actionPoseInstruction = `ACTION & POSE RULE: If the user's concept does not mention a specific action, pose, or activity for the subject, you MUST creatively determine and describe a fitting, natural action or pose. Do not leave the subject completely static or without a defined posture unless explicitly requested by the concept.`;

const sameAsReferenceStyleInstruction = `REFERENCE STYLE MODE: Match the actual visual medium and style of the reference, not a guessed style. First classify the reference internally as camera-captured, illustration, vector/graphic, 3D render, painting, anime/cartoon, or another visible medium. CRITICAL: If the reference contains a real human or is clearly a camera-captured photograph, the final prompt MUST maintain the camera-captured or photographic base medium. Do NOT let a solid-color, geometric, or abstract background trick you into classifying the entire image as an illustration or graphic design. For these photographic references, you MUST NOT label the overall style as digital illustration, vector, flat color design, graphic composition style, graphic illustration, line art, anime, or painting. However, if the photograph is a conceptual composite featuring real humans interacting with holographic, UI, or CGI overlay elements, you may describe those specific elements as "digital holograms", "UI overlays", or "3D graphic elements" within a photographic context. If the reference is genuinely a full illustration, vector, 3D, painted, graphic, anime, cartoon, or stylized, keep that visible medium faithfully instead of making it camera-captured. Do not invent camera bodies, lens names, focal lengths, aperture, shutter speed, ISO, DSLR/mirrorless wording, or other EXIF-style metadata. Describe only style traits that are actually visible in the reference. If the medium is uncertain, avoid naming an invented medium and describe only visible traits.`;

const photographicCameraOnlyInstruction = `PHOTOGRAPHIC STYLE LOCK: Describe the camera capture setup only. Do not add named eras, aesthetics, genres, film looks, editorial labels, or style labels such as "mid-2000s era", "documentary-style", "cinematic", "film still", "analog film", "vintage", "retro", "editorial", "fashion editorial", "magazine-style", or similar wording. Express the look only through concrete camera and capture details: shot type/framing, camera body, lens/focal length, aperture, shutter speed, ISO, focus, depth of field, background blur, and visible natural lighting direction/quality when relevant.`;

const cameraSettingsOrderInstruction = `PROMPT ORDERING RULE: Always construct the prompt by starting with the main subject and their action/environment first. Any photography styles, camera settings, lens details, lighting setup, and camera-specific metadata MUST be placed at the very end of the prompt.`;

const footageJsonTemplate = `{
 "summary": "short overall scene or video summary — merangkum inti adegan agar AI langsung menangkap konteks utama",
 "subject_details": {
 "appearance": "complete visual characteristics for every relevant human subject: ancestry descriptor, physical traits, clothing, attributes, movement style, and important details",
 "subject_action_setting": "what the subject is doing: action, gesture, movement direction, pose, body dynamics, and movement rhythm (slow, fast, smooth, firm, etc.)",
 "expression_or_mood": "facial expression, body language, or emotional mood for every relevant human subject"
 },
 "environment": {
 "background_setting": "detailed location or background description"
 },
 "composition": {
 "camera_angle": "camera angle or point of view",
 "framing": "how the subject is placed inside the frame",
 "depth_of_field": "focus style: shallow DOF, deep DOF, background blur, bokeh, etc."
 },
 "tone_color": {
 "dominant_tone": "main color tone of the video",
 "contrast_level": "low, medium, high, or specific contrast description",
 "saturation": "low, medium, high, or specific saturation description"
 },
 "technical": {
 "camera_movement": "camera movement for video",
 "camera_lens_type": "camera body and lens type used",
 "lens_effects": "lens effects applied",
 "lighting_style": "lighting style used"
 },
 "extra_constraints": "additional artistic limits, forbidden elements, or negative-prompt rules",
 "keywords": ["important theme, mood, main object, and required detail keywords"]
}`;

const buildFootageFormatInstruction = (numPrompts: number) => {
 return `FOOTAGE JSON FORMAT CONTRACT:
- Return ONLY valid JSON. No markdown, no prose before or after the JSON, no code fences.
- ${plainPromptFormattingInstruction}
- ${humanAncestryInstruction}
- The top-level value MUST be a JSON array containing exactly ${numPrompts} objects.
- Each array item MUST follow this exact object template and key names. Do not rename, omit, flatten, or add unrelated top-level keys.
- Each array item MUST be an actual JSON object, not a string that contains JSON, not labeled text, and not a prose prompt.
- Never output "Summary:", "Subject Details:", "Appearance:", or any other text-label format when JSON format is selected. Use the object keys shown below instead.
- Every value must be filled with specific, useful English details. Do not leave placeholders.
- Do not put raw line breaks inside JSON string values. Use one-line string values.
- Use double quotes for all JSON strings, no comments, no trailing commas.

Required template for each array item:
${footageJsonTemplate}`;
};


// --- TEXT-BASED PROMPT BUILDERS ---

const buildFotographicTextPrompt = (quality: 'default' | 'xml', negativePrompt: string, numPrompts: number) => {
 let wordCountInstruction: string;
 let detailInstruction: string;
 const forbiddenTechnicalLightingInstruction = "Do NOT include explicit studio/gear lighting setup instructions in the final prompt (for example: 'softbox', 'octabox', 'strip box', 'rim light', 'key light', 'fill light', 'three-point lighting', 'off-camera left/right', 'Rembrandt lighting'). Mention only visible natural or practical light quality when it helps the camera setup, such as 'soft morning light', 'backlit window light', or 'warm sunset glow'.";

 if (quality === 'xml') {
 wordCountInstruction = photographicXmlTemplateInstruction;
 detailInstruction = `You MUST fill every XML tag section with rich, elaborate English sentences. Each tag section must contain at least 2-3 detailed sentences. For <Subject>, describe every visible detail of the subject including physical features, clothing texture, accessories, pose, and micro-details like skin pores and fabric weave. For <Style>, specify the exact photographic medium and color treatment. For <Lighting>, describe light source direction, color temperature in Kelvin, and shadow behavior in detail. For <Background>, describe environment materials, spatial depth, and bokeh characteristics. For <Composition>, specify exact camera angle, lens focal length, aperture, and optical characteristics. For <Mandatory>, list at least 5 specific mandatory elements. ${forbiddenTechnicalLightingInstruction} ${photographicCameraOnlyInstruction} ${nonPhotographicStyleBanInstruction}`;
 } else { // 'default'
 wordCountInstruction = "Each prompt MUST be a minimum of 100 words and a maximum of 120 words long. The prompt MUST NOT be shorter than 100 words.";
 detailInstruction = `You MUST include detailed camera direction: camera model, lens type/focal length, aperture, shutter speed, ISO, focus point, depth of field, framing, and visible light quality when relevant. You may describe subject expression, clothing texture, and visible background elements only as scene content; do not turn them into a named style, era, color grade, genre, or mood label. ${forbiddenTechnicalLightingInstruction} ${photographicCameraOnlyInstruction} ${nonPhotographicStyleBanInstruction}`;
 }

 return `${buildNegativePromptInstruction(negativePrompt)}You are a highly creative AI image prompt generator. Your task is to process a single concept and generate a specified number of unique prompts in a JSON format.

Follow these instructions precisely:
1. The user will provide a single concept. You MUST process the concept directly and generate the output in English language. NEVER ask questions, NEVER refuse, and NEVER output conversational text. You MUST output ONLY the requested JSON array.
2. For this concept, you must generate EXACTLY ${numPrompts} unique prompts.
3. Each generated prompt must be strictly in English.
4. ${wordCountInstruction}
5. Ensure each prompt is unique and varies from others for the same concept.
6. Camera shot type details like 'close-up portrait', 'medium shot from a low angle', 'dynamic cowboy shot', 'waist-up shot' are mandatory to avoid full-body images.
7. Prompt Style: All prompts MUST be in a photographic style, aiming for a look achievable with a camera. ${detailInstruction} Avoid using words like 'photograph', 'photo', 'image', 'picture', 'real', 'realistic', 'portrayal', 'render', 'rendering', 'photorealistic', 'hyper-realistic' in the generated prompt. Do not use the word 'photographic' explicitly in the prompt. Do not prepend style/era phrases before the subject; start with the subject or camera framing.
8. ${humanAncestryInstruction}
9. ${actionPoseInstruction}
10. CRITICAL RULE: You MUST respond with a single, valid JSON array containing exactly ${numPrompts} strings. Each string in the array is a complete, unique prompt. Do NOT include any other text, explanations, or markdown formatting outside of the JSON array.
11. ${plainPromptFormattingInstruction}
12. ${cameraSettingsOrderInstruction}${quality === 'xml' ? '' : `\n13. ${jsonStringSafetyInstruction}`}`;
};

const buildIsolatedTextPrompt = (negativePrompt: string, numPrompts: number) => {
 const template = '[main subject], isolated on white background, studio shot, sharp focus, no shadow.';
 return `${buildNegativePromptInstruction(negativePrompt)}You are an expert creative assistant. Your job is to take a single concept, analyze its subject, and create prompts based on a template, returning them in a JSON array.

Template:
"${template}"

Core Task:
1. **Process Concept**: You MUST process the concept directly and generate the output in English language. NEVER ask questions, NEVER refuse, and NEVER output conversational text. For the single concept provided, you must generate EXACTLY ${numPrompts} unique prompts.
2. **Analyze Subject Only**: Analyze the concept's main subject and create a rich subject phrase, not a generic label. Include only details attached to the subject itself: category, age range when relevant, ancestry for humans, clothing, accessories, carried props, distinctive physical traits, pose, and subject action. Do NOT include location, scenery, environment, street, room, city, landscape, background, or context outside the subject.
3. **Fill Template**: Use the detailed subject phrase to replace the '[main subject]' placeholder in the template. The final prompt MUST NOT contain any square brackets and MUST be in English.
4. **CRITICAL FOR HUMANS**: If the concept's main subject is a person, it is MANDATORY to specify their background. You must include a specific race, ethnicity, OR ancestry (choose one). For example: 'a young woman of Japanese descent', 'an elderly Nigerian man', 'a person of Scottish ancestry'. This is a strict requirement for generating diverse and specific human subjects. Do not use generic terms; be specific.
5. TEMPLATE LOCK: Every output string MUST follow this exact structure and end immediately after "no shadow.": "[detailed main subject only], isolated on white background, studio shot, sharp focus, no shadow." Put only subject-specific detail before ", isolated on white background". Do not include original scene context or background details anywhere. Do not add lighting, lens, camera, mood, background, texture, clothing, color, or any extra descriptors after "no shadow."
6. JSON Output: You MUST respond with a single, valid JSON array containing exactly ${numPrompts} strings. Each string is a complete prompt from the filled template. Do NOT include any other text, explanations, or markdown formatting outside of the JSON array.
7. ${humanAncestryInstruction}
8. ${actionPoseInstruction}
9. ${plainPromptFormattingInstruction}
10. ${jsonStringSafetyInstruction}`;
};

const buildCustomTextPrompt = (template: string, negativePrompt: string, numPrompts: number) => {
 return `${buildNegativePromptInstruction(negativePrompt)}You are a creative AI assistant. Your task is to generate prompts based on a provided template and a single concept, returning a JSON array.

Template:
"${template}"

Core Task:
1. **Process Concept**: You MUST process the concept directly and generate the output in English language. NEVER ask questions, NEVER refuse, and NEVER output conversational text. For the single concept provided, generate EXACTLY ${numPrompts} unique variations.
2. **Fill Template**: For each variation, fill in the placeholders (e.g., [placeholder]) in the template based on the concept. The final generated prompt MUST NOT contain any square brackets and MUST be in English. CRITICAL TEXT PLACEHOLDER RULE: If the template contains a placeholder for text (e.g. [teks], [text], or similar) and there is NO text requested or found, you MUST completely remove the placeholder along with any surrounding quotes (e.g., "" or '') and extra spaces. Do NOT replace it with " " or empty quotes.
3. **CRITICAL FOR HUMANS**: If the concept involves a person, you MUST specify their background by including a specific race, ethnicity, OR ancestry (choose one) when filling placeholders.
4. TEMPLATE LOCK: Preserve the template's literal wording, order, separators, punctuation, and ending. Only replace placeholder text. Do not append extra camera metadata, lighting, lens, style, background, mood, keywords, or descriptive clauses that are not requested by the template.
5. **Ensure Variety**: Each generated prompt must be unique only through the placeholder-filled content, while preserving the same template structure.
6. JSON Output: You MUST respond with a single, valid JSON array containing exactly ${numPrompts} strings. Each string is a complete prompt. Do NOT include any other text, explanations, or markdown formatting outside of the JSON array.
7. ${humanAncestryInstruction}
8. ${actionPoseInstruction}
9. ${plainPromptFormattingInstruction}
10. ${jsonStringSafetyInstruction}`;
};

const buildFootageJsonPrompt = (negativePrompt: string, numPrompts: number) => {
 const negPrefix = buildNegativePromptInstruction(negativePrompt);
 const baseInstruction = `${negPrefix}You are an expert AI video prompt generator that outputs ONLY raw valid JSON.

ABSOLUTE RULES - violating any of these means complete failure:
1. Your ENTIRE response must be a single valid JSON array. No introduction, no explanation, no markdown, no code fences, no text before or after the JSON.
2. The array must contain EXACTLY ${numPrompts} objects.
3. Each object MUST follow the exact template structure below. Do not rename, omit, add, or reorder any key.
4. Every string value must be filled with specific, useful English details. No placeholders allowed.
5. Do NOT put raw line breaks inside any JSON string value. All string values must be single-line.
6. Use double quotes for all strings. No comments, no trailing commas.
7. You MUST process the concept directly and generate the output in English language. NEVER ask questions, NEVER refuse, and NEVER output conversational text.
8. All output text must be strictly in English.
9. ${humanAncestryInstruction}
10. ${actionPoseInstruction}
11. ${plainPromptFormattingInstruction}
12. ${jsonStringSafetyInstruction}`;
 const formatInstruction = buildFootageFormatInstruction(numPrompts);
 return `${baseInstruction}\n${formatInstruction}`;
};
export const getFlatIllustrationSuffix = (whiteBg: boolean = true) => {
  const bgClause = whiteBg
    ? "isolated on solid single-color pure white background, solid white background, no floor, no ground line, zero gradients, no gradients"
    : "isolated on solid single-color soft pastel background, no floor, no ground line, zero gradients, no gradients";

  return `flat illustration style, strictly lineless vector art, no outlines, zero strokes, bold high-contrast flat cel shading, strong pronounced hard-edge shadows, ultra-vibrant sharp cheerful color palette with saturated azure blue and radiant bright orange, clean simplified solid color shapes, no tiny micro-details, no intricate textures, no small surface icons or decals, blank clean screens and props, stylized chunky rounded anatomy, ${bgClause}, modern microstock graphic asset, zero gradients, no gradients, no fake lighting, zero glow, no lens flare, no artificial lighting glare, no text, zero typography, no words, no letters, no watermark, no signatures, no labels, no noise, no photorealism, no 3d render.`;
};

export const FLAT_ILLUSTRATION_SUFFIX = getFlatIllustrationSuffix(true);

export const getFlatObjectIllustrationSuffix = (whiteBg: boolean = true) => {
  const bgClause = whiteBg
    ? "isolated on solid single-color pure white background, solid white background, no floor, no ground line, zero gradients, no gradients"
    : "isolated on solid single-color soft pastel background, no floor, no ground line, zero gradients, no gradients";

  return `flat illustration style, inanimate object vector graphic, strictly lineless vector art, no outlines, zero strokes, bold high-contrast flat cel shading, strong pronounced hard-edge shadows, ultra-vibrant sharp cheerful color palette with saturated azure blue and radiant bright orange, clean simplified solid color shapes, no tiny micro-details, no intricate textures, no small surface icons or decals, blank clean surfaces, chunky stylized 2D object geometry, no humans, no people, zero characters, no faces, ${bgClause}, modern microstock graphic asset, zero gradients, no gradients, no fake lighting, zero glow, no lens flare, no artificial lighting glare, no text, zero typography, no words, no letters, no watermark, no signatures, no labels, no noise, no photorealism, no 3d render.`;
};

export const FLAT_OBJECT_ILLUSTRATION_SUFFIX = getFlatObjectIllustrationSuffix(true);

export const getMonolineVectorSuffix = (whiteBg: boolean = true) => {
  const bgClause = whiteBg
    ? "perfectly isolated on solid pure white background, zero color background, pure white canvas, zero gradients, no gradients"
    : "perfectly isolated on clean solid background, zero gradients, no gradients";

  return `minimalist monoline vector art, continuous uniform single-weight black outline strokes, clean geometric linework, simplified abstract contour shapes, pure black and white line art, strictly no color, only black and white, no colors, no fills, zero shading, zero gradients, no gradients, no fake lighting, zero glow, no lens flare, no text, zero typography, no words, no letters, no watermark, no signatures, no labels, no complex micro-textures, ${bgClause}, modern microstock graphic icon style, clean vector contour.`;
};

export const MONOLINE_VECTOR_SUFFIX = getMonolineVectorSuffix(true);

export const getGeometricSilhouetteSuffix = (whiteBg: boolean = true) => {
  const colorClause = whiteBg
    ? "strictly two colors only, solid black silhouette on solid pure white background, pure white canvas, zero color, zero gradients, no gradients"
    : "strictly two colors only, solid white silhouette on solid pure black background, pure black canvas, zero color, zero gradients, no gradients";

  return `geometric silhouette vector art, minimalist solid flat shape logo mark, bold solid vector masses, simple minimal elegant design, sharp planar facet cuts, clean aerodynamic contours, high-contrast black and white graphic emblem, ${colorClause}, no tiny micro-details, no intricate textures, zero outlines, zero strokes, zero line art, zero shading, zero gradients, no gradients, no fake lighting, zero glow, no lens flare, no text, zero typography, no words, no letters, no watermark, no signatures, no labels, clean modern icon asset.`;
};

export const GEOMETRIC_SILHOUETTE_SUFFIX = getGeometricSilhouetteSuffix(true);

export const getNegativeSpaceCutoutSuffix = (whiteBg: boolean = true) => {
  const colorClause = whiteBg
    ? "strictly two colors only, solid black and white, solid black subject on solid pure white background, pure white canvas, zero color, zero gradients, no gradients"
    : "strictly two colors only, solid white on solid pure black background, pure black canvas, zero color, zero gradients, no gradients";

  return `negative space vector art, frameless free-standing silhouette cutout, clever negative space cutout graphic mark, dual-tone optical illusion, subject anatomical contours and lighting carved purely from solid negative space, simple minimal elegant design, strictly frameless, strictly no border, zero framing, zero outer badge, zero enclosing shape, no box, no circle frame, no border lines, pure black and white dual-tone, ${colorClause}, no tiny micro-details, no intricate textures, strictly solid flat shapes, zero outlines, zero strokes, zero gradients, no gradients, no fake lighting, zero glow, no lens flare, zero shadows, no text, zero typography, no words, no letters, no watermark, no signatures, no labels, clean corporate vector icon asset.`;
};

export const NEGATIVE_SPACE_CUTOUT_SUFFIX = getNegativeSpaceCutoutSuffix(true);

export const getAbstractPictogramLogoSuffix = (whiteBg: boolean = true) => {
  const bgClause = whiteBg
    ? "isolated on solid pure white background, solid white background, zero floor, no ground line, zero gradients, no gradients"
    : "isolated on clean solid background, zero floor, no ground line, zero gradients, no gradients";

  return `minimalist geometric logo mark, modern brand identity icon, radical abstraction, radical shape reduction, rhythmic repetition of geometric forms, minimalist pictogram silhouette, bold flat solid shapes, clever negative space silhouette, elegant geometric minimalism, Swiss graphic design aesthetic, pure flat vector on ${bgClause}, strictly lineless, no outlines, zero strokes, zero gradients, no gradients, no fake lighting, zero glow, no drop shadows, no text, zero typography, no words, no watermark, master logo design.`;
};

export const ABSTRACT_PICTOGRAM_LOGO_SUFFIX = getAbstractPictogramLogoSuffix(true);

export const getSeamlessVectorPatternSuffix = (whiteBg: boolean = true) => {
  return `seamless vector surface pattern design, full-bleed all-over repeating wallpaper print, strictly lineless vector art, no outlines, zero black contour strokes, no pencil lines, pure solid flat color shapes, vibrant fresh modern cheerful color palette with bright playful tones, edge-to-edge seamless pattern repeat, strictly flat 2d, no 3d objects, no 3d render, no realistic depth, zero gradients, no gradients, no fake lighting, zero glow, no lens flare, no drop shadows, no text, zero typography, no words, no watermark, textile and packaging commercial stock asset.`;
};

export const SEAMLESS_VECTOR_PATTERN_SUFFIX = getSeamlessVectorPatternSuffix(true);

export const getJerseyPatternSuffix = (whiteBg: boolean = true, concept: string = '') => {
  const lowerConcept = (concept || '').toLowerCase();

  let sportTitle = "professional sports jersey sublimation vector design";
  if (lowerConcept.includes('basket')) {
    sportTitle = "professional basketball jersey sublimation vector design";
  } else if (lowerConcept.includes('soccer') || lowerConcept.includes('football') || lowerConcept.includes('futsal') || lowerConcept.includes('sepak')) {
    sportTitle = "professional soccer football jersey sublimation vector design";
  } else if (lowerConcept.includes('esport') || lowerConcept.includes('gaming') || lowerConcept.includes('tournament')) {
    sportTitle = "professional esports gaming tournament jersey sublimation vector design";
  } else if (lowerConcept.includes('cycling') || lowerConcept.includes('sepeda') || lowerConcept.includes('bike')) {
    sportTitle = "professional road cycling jersey sublimation vector design";
  } else if (lowerConcept.includes('motocross') || lowerConcept.includes('mx') || lowerConcept.includes('dirt bike')) {
    sportTitle = "professional motocross racing jersey sublimation vector design";
  } else if (lowerConcept.includes('volley') || lowerConcept.includes('voli') || lowerConcept.includes('badminton') || lowerConcept.includes('tennis')) {
    sportTitle = "professional volleyball badminton athletic jersey sublimation vector design";
  } else if (lowerConcept.includes('rugby')) {
    sportTitle = "professional rugby sports jersey sublimation vector design";
  } else if (lowerConcept.includes('running') || lowerConcept.includes('marathon') || lowerConcept.includes('lari')) {
    sportTitle = "professional athletic running marathon jersey sublimation vector design";
  }

  if (whiteBg) {
    // Mode SATU MUKA (Single View Full-Bleed Rectangular Sublimation Pattern Panel)
    return `${sportTitle}, single full-bleed front torso sublimation graphic artwork panel, edge-to-edge rectangular sportswear pattern design touching all four canvas borders with STRICTLY NO SHIRT SILHOUETTE OUTLINES, NO COLLAR CUTOUTS, NO GARMENT BLUEPRINTS, AND NO MARGINS, featuring a small minimalist solid geometric shield crest icon on upper chest and clean flat solid uppercase word 'SPONSOR' in an ULTRA-HIGH-CONTRAST SOLID COLOR THAT SHARPLY CONTRASTS WITH THE UNDERLYING PATTERN (pure stark white on dark patterns or solid jet black on light patterns with 100% maximum legibility), pure 100% flat 2d vector art, razor-sharp hard-edge solid flat color planes, solid 2-tone color blocks, auto-trace friendly, strictly zero gradients, no color gradients, no smooth color blending, no soft transitions, no color fade, no ombré, no airbrush shading, no soft shading, zero glow effects, no bloom, no realistic fabric wrinkles, zero 3d rendering, zero fake lighting, zero shadows, no manufacturer brand logos, no watermark, commercial sportswear vector stock asset.`;
  }

  // Mode DUAL SPLIT 50:50 (Left: Mockup, Right: Pattern Panel)
  let mockupCut = "a clean flat 2d technical vector front-view athletic sports jersey shirt mockup";
  if (lowerConcept.includes('basket')) {
    mockupCut = "a clean flat 2d technical vector front-view athletic sleeveless basketball tank top mockup";
  } else if (lowerConcept.includes('soccer') || lowerConcept.includes('football') || lowerConcept.includes('futsal') || lowerConcept.includes('sepak')) {
    mockupCut = "a clean flat 2d technical vector front-view athletic soccer football jersey shirt mockup";
  } else if (lowerConcept.includes('esport') || lowerConcept.includes('gaming') || lowerConcept.includes('tournament')) {
    mockupCut = "a clean flat 2d technical vector front-view athletic esports tournament raglan jersey shirt mockup";
  } else if (lowerConcept.includes('cycling') || lowerConcept.includes('sepeda') || lowerConcept.includes('bike')) {
    mockupCut = "a clean flat 2d technical vector front-view athletic aerodynamic road cycling jersey shirt mockup";
  } else if (lowerConcept.includes('motocross') || lowerConcept.includes('mx') || lowerConcept.includes('dirt bike')) {
    mockupCut = "a clean flat 2d technical vector front-view heavy-duty long-sleeve motocross MX racing jersey shirt mockup";
  } else if (lowerConcept.includes('volley') || lowerConcept.includes('voli') || lowerConcept.includes('badminton') || lowerConcept.includes('tennis')) {
    mockupCut = "a clean flat 2d technical vector front-view ultra-light athletic short-sleeve volleyball badminton jersey shirt mockup";
  } else if (lowerConcept.includes('rugby')) {
    mockupCut = "a clean flat 2d technical vector front-view reinforced athletic rugby jersey shirt mockup";
  } else if (lowerConcept.includes('running') || lowerConcept.includes('marathon') || lowerConcept.includes('lari')) {
    mockupCut = "a clean flat 2d technical vector front-view breathable performance athletic running marathon jersey shirt mockup";
  }

  const bgClause = "isolated on solid pure white background, solid white canvas, zero floor, no ground shadow, zero gradients, no gradients";

  return `${sportTitle}, dual split 50:50 vertical presentation layout: the left vertical half displays ${mockupCut} on solid pure white background canvas, THE ENTIRE JERSEY BODY MUST BE FULLY COVERED BY THE DESCRIBED SUBLIMATION GRAPHIC MOTIF, the jersey mockup must be 100% FLAT with ZERO GRADIENTS ZERO SHADING ZERO SHADOWS ZERO FABRIC WRINKLES on the garment body, featuring a small minimalist solid geometric shield crest icon on chest and clean flat solid uppercase word 'SPONSOR' in a BOLD ULTRA-HIGH-CONTRAST COLOR THAT SHARPLY CONTRASTS WITH THE UNDERLYING PATTERN (pure stark white on dark patterns or solid jet black on light patterns with distinct maximum legibility), ABSOLUTELY NO SQUAD NUMBERS ON THE MOCKUP, the right vertical half is a 100% PURE FULL-BLEED FLAT 2D VECTOR SUBLIMATION GRAPHIC ARTWORK PANEL (displaying the expanded master graphic motif) touching all canvas edges with ABSOLUTELY ZERO WORDS, ZERO LETTERS, ZERO NUMBERS, ZERO SPONSOR TEXT, ZERO CHEST BADGES, ZERO CREST ICONS, ZERO CLUB EMBLEMS, ZERO LOGOS, ZERO BORDER LINES, ZERO OUTER FRAMES, NO MARGINS, NO BOUNDING BOX, AND NO SHIRT BLUEPRINT OUTLINES, pure 100% flat 2d vector art, razor-sharp hard-edge solid flat color planes, solid 2-tone color blocks, auto-trace friendly, strictly zero gradients, no color gradients, no smooth color blending, no soft transitions, no color fade, no ombré, no airbrush shading, no soft shading, zero glow effects, no bloom, no realistic fabric wrinkles, zero 3d rendering, zero fake lighting, zero shadows, no manufacturer brand logos, no watermark, ${bgClause}, commercial sportswear vector stock asset.`;
};

export const JERSEY_PATTERN_SUFFIX = getJerseyPatternSuffix(true);

export const getCarWrapLiverySuffix = (whiteBg: boolean = true) => {
  const bgClause = whiteBg
    ? "isolated on solid pure white background, solid white canvas, zero floor, no ground shadow, zero gradients, no gradients"
    : "isolated on clean solid high-contrast background, zero floor, no ground shadow, zero gradients, no gradients";

  return `professional car wrap livery vector design, authentic motorsport racing decal stripes, ultra-high contrast vibrant color blocking, asymmetric aerodynamic velocity graphics, dual split 50:50 presentation layout: top half displays a clean flat 2d vector side-profile illustration of an unbranded generic vehicle with clean solid base body and bold high-contrast racing livery decals sweeping across the side panels, bottom half is the EXACT IDENTICAL full-bleed edge-to-edge flat 2d vector livery decal graphic banner touching all canvas edges with strictly zero border lines, zero outer frame, no margins, no bounding box, no car blueprints, and no car silhouette outlines, pure 100% flat 2d vector art, razor-sharp hard-edge ultra-high-contrast solid flat color planes, ultra-vibrant punchy palette, auto-trace friendly, strictly no dull muddy colors, no low-contrast tones, strictly no all-over repeating wallpaper patterns, no dense honeycomb mesh textures, no repeating spiral vortexes, no uniform grids, no repetitive geometric tiles, strictly zero gradients, no color gradients, no color fade, no ombré, no airbrush shading, no photographic reflections, zero fake lighting, no glow, no bloom, no soft shadows, no car brand logos, no text, zero typography, no words, no letters, no sponsor badges, no watermark, ${bgClause}, commercial automotive vector stock asset.`;
};

export const CAR_WRAP_LIVERY_SUFFIX = getCarWrapLiverySuffix(true);

export const getActiveVectorSuffix = (artStyle?: string, whiteBg: boolean = true, concept: string = ''): string => {
  const chosenStyle = (artStyle || '').toLowerCase();
  if (chosenStyle.includes('jersey') || chosenStyle.includes('jersy')) {
    return getJerseyPatternSuffix(whiteBg, concept);
  }
  if (chosenStyle.includes('livery') || chosenStyle.includes('wrap')) {
    return getCarWrapLiverySuffix(whiteBg);
  }
  if (chosenStyle.includes('pattern') || chosenStyle.includes('seamless')) {
    return getSeamlessVectorPatternSuffix(whiteBg);
  }
  if (chosenStyle.includes('pictogram') || chosenStyle.includes('logo') || chosenStyle.includes('abstract')) {
    return getAbstractPictogramLogoSuffix(whiteBg);
  }
  if (chosenStyle.includes('object')) {
    return getFlatObjectIllustrationSuffix(whiteBg);
  }
  if (chosenStyle.includes('monoline')) {
    return getMonolineVectorSuffix(whiteBg);
  }
  if (chosenStyle.includes('geometric silhouette')) {
    return getGeometricSilhouetteSuffix(whiteBg);
  }
  if (chosenStyle.includes('negative space')) {
    return getNegativeSpaceCutoutSuffix(whiteBg);
  }
  return getFlatIllustrationSuffix(whiteBg);
};

// ─────────────────────────────────────────────────────────────────────────────
// DUAL-PHASE MULTI-ITEM LAYOUT HELPERS
// Exported so App.tsx can run Phase 1 then Phase 2 with 2 separate API calls,
// each only responsible for half the items. Sufiks is assembled client-side.
// ─────────────────────────────────────────────────────────────────────────────

/** Returns layout prefix text + total slot count for a given preset string. */
export const getMultiItemLayoutMeta = (preset: string): { layoutPrefix: string; slotCount: number } | null => {
  const p = preset || '';
  if (p.includes('Layout 1')) return { slotCount: 5, layoutPrefix: 'A flat vector asset collection sheet on a single solid background containing 5 isolated elements: on the left side is a large prominent hero subject, and arranged on the right side are four smaller distinct elements. ' };
  if (p.includes('Layout 2')) return { slotCount: 5, layoutPrefix: 'A flat vector asset collection sheet on a single solid background containing 5 isolated elements: arranged on the left side are four smaller distinct elements, and on the right side is a large prominent hero subject. ' };
  if (p.includes('Layout 3')) return { slotCount: 5, layoutPrefix: 'A flat vector asset collection sheet on a single solid background containing 5 isolated elements: in the center is a large prominent hero subject, flanked by two smaller elements on the left, and two smaller elements on the right. ' };
  if (p.includes('Layout 4')) return { slotCount: 6, layoutPrefix: 'A flat vector asset collection sheet on a single solid background containing 6 evenly spaced isolated elements: ' };
  if (p.includes('Layout 5')) return { slotCount: 12, layoutPrefix: 'A flat vector asset collection sheet on a single solid background containing 12 evenly spaced isolated elements: ' };
  if (p.includes('Layout 6')) return { slotCount: 4, layoutPrefix: 'A flat vector asset collection sheet on a single solid background containing 4 evenly spaced isolated elements: ' };
  if (p.includes('Layout 7')) return { slotCount: 3, layoutPrefix: 'A flat vector asset collection sheet on a single solid background containing 3 evenly spaced isolated elements side-by-side: ' };
  if (p.includes('Sticker')) return { slotCount: 6, layoutPrefix: 'A cohesive die-cut sticker collection sheet on a single solid background containing 6 isolated stylized vector stickers with clean white die-cut contour borders evenly spaced: ' };
  return null;
};

/**
 * Phase 1 prompt — API #1 generates item_1 through item_half.
 * Returns { contents, config }.
 */
const buildMultiItemSchema = (startIdx: number, endIdx: number) => {
  const properties: Record<string, any> = {};
  const required: string[] = [];
  for (let i = startIdx; i <= endIdx; i++) {
    properties[`item_${i}`] = { type: Type.STRING };
    required.push(`item_${i}`);
  }
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties,
      required,
    }
  };
};

export const buildMultiItemPhase1Prompt = (
  concept: string,
  slotCount: number,
  half: number,
  artStyle: string,
  numPrompts: number,
  entropySeed: string,
  systemInstruction: string
): { contents: string; config: any } => {
  const exampleLines: string[] = [];
  for (let i = 1; i <= half; i++) {
    exampleLines.push(`  "item_${i}": "your ultra-detailed 40+ word description for item ${i} here..."`);
  }

  const contents = `You are a world-class microstock prompt engineer. Concept: "${concept}". [Seed: ${entropySeed}]

YOUR ROLE: Generate ONLY items 1 through ${half} for EACH of the ${numPrompts} prompts.
ART STYLE: "${artStyle}"
TOTAL ITEMS PER SHEET: ${slotCount} (a colleague will generate items ${half + 1} to ${slotCount})

OUTPUT FORMAT — A valid JSON array of ${numPrompts} objects:
[
  {
${exampleLines.join(',\n')}
  },
  ... (repeat for all ${numPrompts} prompts)
]

MANDATORY RULES:
1. Each "item_N" MUST start with "N)" (e.g. "1) a sushi nigiri set...").
2. Each item MUST be AT LEAST 40 WORDS. Describe: specific subject, pose/state, materials, colors, unique prop/detail.
3. Use the DEPTH-FIRST rule: exhaust all specific primary subjects of "${concept}" (e.g. for "Asian food": sushi → rendang → pho → matcha → dim sum) before expanding to tools or props.
4. Across the ${numPrompts} prompts, NO two prompts may share the same primary subject for the same item slot.
5. Rotate cultural origins and composition angles across prompts.
6. DO NOT generate items ${half + 1} to ${slotCount}. Leave those to your colleague.
7. Return ONLY the JSON array. No markdown, no suffix, no extra text.`;

  const config: any = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: buildMultiItemSchema(1, half),
    temperature: 1.0,
    topP: 0.97,
    maxOutputTokens: Math.min(8192, Math.max(2048, numPrompts * half * 80)),
  };

  return { contents, config };
};

/**
 * Phase 2 prompt — API #2 generates item_{half+1} through item_{slotCount}.
 * Receives phase1Context (array of short summaries of what Phase 1 chose per prompt).
 * Returns { contents, config }.
 */
export const buildMultiItemPhase2Prompt = (
  concept: string,
  slotCount: number,
  half: number,
  artStyle: string,
  numPrompts: number,
  entropySeed: string,
  phase1Context: string[],   // e.g. ["sushi, rendang, pho", "burger, ramen, taco", ...]
  systemInstruction: string
): { contents: string; config: any } => {
  const exampleLines: string[] = [];
  for (let i = half + 1; i <= slotCount; i++) {
    exampleLines.push(`  "item_${i}": "your ultra-detailed 40+ word description for item ${i} here..."`);
  }

  const contextBlock = phase1Context
    .map((ctx, idx) => `  Prompt ${idx + 1}: items 1-${half} already use → ${ctx}`)
    .join('\n');

  const contents = `You are a world-class microstock prompt engineer. Concept: "${concept}". [Seed: ${entropySeed}-P2]

YOUR ROLE: Generate ONLY items ${half + 1} through ${slotCount} for EACH of the ${numPrompts} prompts.
ART STYLE: "${artStyle}"
TOTAL ITEMS PER SHEET: ${slotCount}

ALREADY TAKEN SUBJECTS (your colleague generated items 1-${half} — do NOT repeat these):
${contextBlock}

OUTPUT FORMAT — A valid JSON array of ${numPrompts} objects:
[
  {
${exampleLines.join(',\n')}
  },
  ... (repeat for all ${numPrompts} prompts)
]

MANDATORY RULES:
1. Each "item_N" MUST start with "N)" (e.g. "${half + 1}) a bibimbap stone pot...").
2. Each item MUST be AT LEAST 40 WORDS. Describe: specific subject, pose/state, materials, colors, unique prop/detail.
3. Your items MUST NOT use any subject listed in "ALREADY TAKEN SUBJECTS" for the same prompt.
4. Continue the DEPTH-FIRST rule: keep exhausting primary subjects of "${concept}" that were not yet used.
5. Maintain the same cohesive thematic universe and art style across all items.
6. DO NOT generate items 1 to ${half}. Leave those to your colleague.
7. Return ONLY the JSON array. No markdown, no suffix, no extra text.`;

  const config: any = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: buildMultiItemSchema(half + 1, slotCount),
    temperature: 1.0,
    topP: 0.97,
    maxOutputTokens: Math.min(8192, Math.max(2048, numPrompts * (slotCount - half) * 80)),
  };

  return { contents, config };
};


export const buildVectorTextPrompt = (
  negativePrompt: string,
  numPrompts: number,
  artStyle?: string,
  preset?: string,
  pose?: string,
  attributes?: string,
  whiteBg?: boolean,
  concept: string = ''
) => {
  const chosenStyle = artStyle || 'Flat illustration';
  const chosenPreset = preset || 'Single Image';
  const isWhiteBg = whiteBg ?? true;

  const isJerseyPattern = chosenStyle.toLowerCase().includes('jersey') || chosenStyle.toLowerCase().includes('jersy');
  const isCarWrapLivery = !isJerseyPattern && (chosenStyle.toLowerCase().includes('livery') || chosenStyle.toLowerCase().includes('wrap'));
  const isSeamlessPattern = !isJerseyPattern && !isCarWrapLivery && (chosenStyle.toLowerCase().includes('pattern') || chosenStyle.toLowerCase().includes('seamless'));
  const isAbstractPictogramLogo = !isJerseyPattern && !isCarWrapLivery && !isSeamlessPattern && (chosenStyle.toLowerCase().includes('pictogram') || chosenStyle.toLowerCase().includes('logo'));
  const isFlatObjectIllustration = !isJerseyPattern && !isCarWrapLivery && !isSeamlessPattern && !isAbstractPictogramLogo && chosenStyle.toLowerCase().includes('object');
  const isMonolineVector = !isJerseyPattern && !isCarWrapLivery && !isSeamlessPattern && !isAbstractPictogramLogo && chosenStyle.toLowerCase().includes('monoline');
  const isGeometricSilhouette = !isJerseyPattern && !isCarWrapLivery && !isSeamlessPattern && !isAbstractPictogramLogo && chosenStyle.toLowerCase().includes('geometric silhouette');
  const isNegativeSpaceCutout = !isJerseyPattern && !isCarWrapLivery && !isSeamlessPattern && !isAbstractPictogramLogo && chosenStyle.toLowerCase().includes('negative space');
  const isFlatIllustration = !isJerseyPattern && !isCarWrapLivery && !isSeamlessPattern && !isAbstractPictogramLogo && !isFlatObjectIllustration && chosenStyle.toLowerCase().includes('flat illustration');

  let activeSuffix = '';
  let styleRules = '';

  if (isJerseyPattern) {
    activeSuffix = getJerseyPatternSuffix(isWhiteBg, concept);
    styleRules = `MANDATORY PROMPT STRUCTURE & SUFFIX RULES (JERSEY SUBLIMATION PATTERN):
1. **AUTHENTIC SOCCER & SPORTSWEAR SUBLIMATION DESIGN (STRICTLY NO GENERIC WALLPAPERS / NO CAR LIVERIES)**:
   - This is an authentic sportswear sublimation kit design for football/soccer and athletic apparel.
   - The design MUST feature a balanced holistic composition designed specifically for a sports garment: front torso graphic, collar integration, sleeve harmony, and chest sponsor/crest placement zone.
   - **STRICT BAN**: DO NOT create random repeating tile wallpapers, generic abstract backgrounds, or vehicle decal stickers.

2. **MASTER SOCCER JERSEY APPAREL ARCHETYPES (CHOOSE & EXPAND)**:
   - **Archetype 1 (Liquid Marble & Topographic Swirls)**: Organic marbling fluid flow, liquid distortion ripples, biomorphic topographical contour lines, and flowing camo-liquid curves.
   - **Archetype 2 (90s Retro Geometric & Chevron Speed Shards)**: Multi-angled diagonal speed slashes, layered V-shaped chevron arrows, fractured diamond matrix blocks, and German/Dutch 1988-90 inspired geometric tessellations.
   - **Archetype 3 (Distressed Dry-Brush & Splatter Sashes)**: Grunge paintbrush sweeps, dry-brush textured diagonal sashes across the chest, spray stencil splatter textures, and aggressive dynamic streak bands.
   - **Archetype 4 (Halftone Dot Matrix & Gradient Mesh Fades)**: Fading halftone dot matrix grids transitioning from dense to dispersed, engineered mesh texture illusions, and dynamic micro-dot energy rays.
   - **Archetype 5 (Modernized Club Stripes & Tournament Sashes)**: Modernized vertical bar stripes embedded with micro-geometric hatching, dynamic diagonal tournament sashes, and symmetrical chest chevron winglets.
   - **Archetype 6 (Cultural / Ornamental / Subtle Tonal Jacquard)**: Subtle tone-on-tone jacquard embossing, traditional ornamental geometric borders, and tribal/batik line art integrated into central vertical chest bands.

3. **DYNAMIC APPAREL CUT & COLLAR ROTATION**:
   - In your prompt concept, ALWAYS specify a distinct collar and sleeve cut for variety:
     * "crossover ribbed V-neck with contrast raglan sleeves"
     * "classic 90s fold-over polo collar with button placket"
     * "two-tone ribbed crew neck with contrasting shoulder yoke panels"
     * "modern aerodynamic stand-up blade collar with curved flank mesh inserts"
     * "overlapping wrap-around ribbed collar with matching patterned short sleeves"

4. **100% FLAT 2D VECTOR & AUTO-TRACE FRIENDLY (ZERO GRADIENTS, ZERO SHADOWS, ZERO 3D)**:
   - Hard-edge solid flat color planes only. Zero photographic reflections, zero airbrush shading, zero glow/bloom, zero 3D fabric folds/wrinkles.
   - **STRICT WORD BAN**: DO NOT USE 'gold', 'golden', 'titanium', 'metallic', 'chrome', 'bronze', 'silver', 'neon', 'glowing', 'cyber', or 'amber'. Use solid flat colors: 'solid canary yellow', 'solid stark white', 'solid jet black', 'solid crimson red', 'solid royal blue', 'solid emerald green', 'solid solar orange'.

5. **BOLD 2-3 TONE ATHLETIC COLOR HARMONY**:
   - High-contrast sportswear palettes: (e.g. crimson red + obsidian black + stark white, royal samurai blue + cyber cyan + crisp white, forest green + acid lime + jet black, vibrant magenta + midnight navy + stark white, bold solar orange + deep navy + crisp white).

6. **ULTRA-HIGH CONTRAST EMBLEM & SPONSOR LOGO**:
   - The chest crest shield and 'SPONSOR' text must have extreme, punchy color contrast against the torso pattern (e.g. solid crisp white typography over dark/dense patterns, or solid jet black over light/bright patterns) ensuring 100% sharp legibility without clashing.

7. **DO NOT OUTPUT THE SUFFIX**:
   - The system will automatically append the layout/mockup suffix. YOU MUST ONLY OUTPUT THE CORE JERSEY & GRAPHIC CONCEPT.

FEW-SHOT EXAMPLES (CONCEPT ONLY):
- "korea tiger red" -> "Dynamic tiger-stripe camouflage dry-brush pattern in deep crimson and bright scarlet across the torso, paired with a crossover ribbed V-neck and contrast obsidian black flank panels"
- "indonesia dark chevron" -> "Tonal charcoal and jet black diagonal chevron speed stripes with fine pinstripe hatching across the chest, featuring a two-tone ribbed crew neck and solid black raglan sleeves"
- "fluid ocean wave" -> "Undulating topographical liquid marble swirls in deep samurai blue and crisp white sweeping across the torso, framed by a classic ribbed collar and solid contrast sleeve cuffs"
- "90s retro geometric diamond" -> "Aggressive 1990s retro geometric chevron shards and fading halftone dot matrix blocks in electric cyan, royal blue, and stark white with a fold-over polo collar"
- "tribal cultural ornament" -> "Symmetrical ornamental tribal contour motifs flanking a solid solar yellow vertical chest band on a jet black negative space base, with a modern blade collar"
- "grunge diagonal slash" -> "Distressed dry-brush diagonal speed sashes in bold crimson and matte black slicing across a clean white negative space torso with contrast shoulder yokes"`;
  } else if (isCarWrapLivery) {
    styleRules = `MANDATORY PROMPT STRUCTURE & RULES (CAR WRAP LIVERY):
1. **AUTHENTIC MOTORSPORT RACING DECALS (STRICTLY NO WALLPAPER / NO REPETITIVE TEXTURE TILES)**:
   - The vehicle MUST have a clean, solid base body color (e.g. solid stark white body, solid pitch black body, or solid dark graphite grey).
   - Livery graphics are **DIRECTIONAL ASYMMETRICAL RACING DECAL STRIPES & SPEED ACCENTS** covering 30% to 60% of the side flank (sweeping aggressively from front fender/bumper across the doors to the rear quarter panels).
   - **STRICTLY FORBIDDEN**: All-over repetitive texture prints, dense honeycomb mesh wallpapers, repeating hexagonal grids, hypnotic spiral vortexes, uniform wallpaper prints plastered over the vehicle body, polka dots, checkerboard tiles.
   - **MANDATORY**: Follow the user's concept. If they want tribal, use sweeping tribal curves. If they want geometric, use angular speed cuts. Keep the shapes appropriate and diverse.

2. **STRICT HIGH-CONTRAST 3-TONE MOTORSPORT COLOR FORMULA (ZERO METALLICS & ZERO DULL/MUDDY COLORS)**:
   - Every prompt MUST enforce high-contrast, razor-sharp 3-tone color harmony that pops with extreme clarity on pure solid background.
   - **STRICT WORD BAN**: DO NOT USE 'gold', 'golden', 'titanium', 'metallic', 'chrome', 'bronze', 'silver', 'neon', 'glowing', 'cyber', or 'amber'.
   - Strictly FORBIDDEN: Dull muddy midtones, low-contrast grey-on-grey blends, washed-out tones, or dark graphics that disappear into a dark vehicle body.

3. **MANDATORY DIVERSITY ACROSS 4 FLUID WRAPPING ARCHETYPES (NEUTRAL SHAPES)**:
   - **Archetype 1 (Fluid Liquid & Drift Flow)**: Undulating curvilinear ribbons, sweeping aerodynamic arcs, and organic fluid velocity streaks.
   - **Archetype 2 (Tribal & Flame Contours)**: Aggressive tribal curves, biomorphic flame licks, and stylized sweeping claw marks.
   - **Archetype 3 (Classic Racing Stripes)**: Clean horizontal dual racing stripes, elegant pinstripe borders, and minimalist vintage rally decals.
   - **Archetype 4 (Modern Kinetic Angular)**: Diagonal aerodynamic speed slashes, geometric thrust blocks, and fragmented polygonal energy facets.

4. **100% FLAT 2D VECTOR & AUTO-TRACE FRIENDLY**:
   - Both the vehicle preview and the wrap graphic must be rendered with hard-edge, solid flat color planes without photographic reflections, without soft gradients, without 3D shading, and without glowing bloom.

5. **DO NOT OUTPUT THE SUFFIX**:
   - The system will automatically append the layout/mockup suffix. YOU MUST ONLY OUTPUT THE CORE GRAPHIC CONCEPT. Do not write the layout instructions!

FEW-SHOT EXAMPLES (CONCEPT ONLY):
- "liquid lava flow supercar" -> "Flowing undulating solar orange magma contour ribbons and dynamic dark charcoal fluid sweep contours hugging the rear widebody fenders of a stark white GT supercar"
- "aggressive cyber slash drift car" -> "Explosive diagonal electric cyan speed slashes and fractured obsidian black crystal lightning blades thrusting forward across the side doors of a sleek performance drift sedan"
- "mecha claw rally hatch" -> "Sweeping biomechanical claw cuts and razor sharp aerodynamic winglet facets in acid lime and stark white across the rear quarter panel of a stealth black rally hot hatch"
- "retro synthwave truck" -> "Precision high-density halftone dot matrix gradients and angular magenta racing sashes sweeping across the cargo box side of a commercial truck"`;
  } else if (isSeamlessPattern) {
    activeSuffix = getSeamlessVectorPatternSuffix(isWhiteBg);
    styleRules = `MANDATORY PROMPT STRUCTURE & SUFFIX RULES (SEAMLESS VECTOR PATTERN):
1. **FULL-BLEED SEAMLESS ALL-OVER REPEAT**:
   - Design an edge-to-edge seamless repeating surface pattern (wallpaper, textile print, wrapping paper packaging aesthetic).
   - Randomly scatter or rhythmically tile diverse theme elements (icons, fruits, creatures, tools, botanicals, abstract shapes) evenly across the entire surface.
2. **STRICTLY LINELESS 2D FLAT VECTOR (ZERO OUTLINES & ZERO 3D)**:
   - Absolutely NO outlines, NO black contour lines, NO sketch strokes, NO 3D objects, and NO 3D renders.
   - All characters, animals, and objects must be formed purely from solid flat color patches and shapes.
3. **VIBRANT FRESH MODERN CHEERFUL COLOR PALETTE**:
   - Use fresh, bright, joyful, and modern color harmonies (e.g. coral pink, sunny yellow, azure blue, lime green, bright orange, soft cream or pastel background).
   - Zero gradients, no gradients, no fake lighting, zero glow, no drop shadows.
4. **STRICTLY ZERO TEXT / ZERO WATERMARKS**:
   - Absolutely NO letters, NO words, NO typography, NO watermark, NO signatures.
5. **MANDATORY SUFFIX**: Every single prompt MUST end with this exact paten suffix:
   "${activeSuffix}"

FEW-SHOT EXAMPLES:
- "food / fruits" -> "A vibrant retro seamless pattern of randomly scattered food doodles: smiling strawberries, juicy watermelon slices, fried egg shapes, golden croissants, and tiny colorful star dots on solid clean off-white background, ${activeSuffix}"
- "cute pets / cats" -> "A playful all-over seamless pattern of minimalist cute cat face silhouettes, scattered paw prints, yarn balls, fish bones, and tiny star doodles evenly distributed on solid pastel mint green background, ${activeSuffix}"
- "water / pool" -> "A minimalist top-down swimming pool water ripple seamless pattern, composed of interlocking liquid blue blob shapes, azure curved water caustics, and clean white fluid ripple lines in flat 2D layers, ${activeSuffix}"
- "retro floral" -> "A bold 1970s retro Scandinavian floral seamless pattern, featuring organic interlocking olive green Matisse leaf shapes, blooming daisy flowers, and vibrant orange sun blob centers on warm cream canvas, ${activeSuffix}"
- "doctor / medical" -> "A vibrant all-over seamless pattern of scattered cute female and male doctor characters, medical stethoscope shapes, first-aid cross symbols, and band-aid icons, all drawn with chunky solid flat color blocks and zero outlines, ${activeSuffix}"`;
  } else if (isAbstractPictogramLogo) {
    activeSuffix = getAbstractPictogramLogoSuffix(isWhiteBg);
    styleRules = `MANDATORY PROMPT STRUCTURE & SUFFIX RULES (ABSTRACT PICTOGRAM LOGO):
1. **RADICAL ABSTRACTION & SHAPE REDUCTION**:
   - Deconstruct any subject into an ultra-minimalist, iconic brand symbol or geometric pictogram.
   - Do NOT write complex literal anatomy or over-detailed descriptions. Treat the subject as a unified iconic mark (Swiss design / Sagi Haviv / Zalo Estévez style).
2. **RHYTHMIC REPETITION OF GEOMETRIC FORMS**:
   - Utilize rhythmic repetition (e.g. parallel curved slats, comb tines, fanned wing rays, layered planar arches, or repeating geometric cuts) to create movement and harmony.
3. **CLEVER NEGATIVE SPACE SILHOUETTES**:
   - Major internal features, eyes, feathers, horns, or steam/speed lines must be carved as clean negative space channels and slits.
4. **STRICTLY LINELESS, ZERO GRADIENTS & ZERO FAKE LIGHTING**:
   - Solid flat color planes only. Zero outlines, zero strokes, zero gradients, no gradients, no fake lighting, zero glow, no lens flare, zero drop shadows.
5. **STRICTLY ZERO TEXT / ZERO WATERMARKS**:
   - Absolutely NO letters, NO words, NO typography, NO watermark, NO signatures.
6. **MANDATORY SUFFIX**: Every single prompt MUST end with this exact paten suffix:
   "${activeSuffix}"

FEW-SHOT EXAMPLES:
- "deer / gazelle" -> "An elegant stylized deer logo mark, sleek minimalist silhouette with rhythmic comb antler tines and fluid geometric body planes, ${activeSuffix}"
- "falcon / eagle" -> "A modern bird in flight emblem, stylized curved neck silhouette with three fanned rhythmic wing slats sculpted in negative space, ${activeSuffix}"
- "burger" -> "An iconic culinary burger emblem, modern food symbol formed by rhythmic horizontal solid bar slabs and a smooth semi-circle bun silhouette, ${activeSuffix}"
- "coffee" -> "A sleek modern coffee cup emblem, minimalist crescent cup silhouette paired with dual ascending rhythmic steam curves in negative space, ${activeSuffix}"
- "runner" -> "A dynamic athletic speed runner mark, abstract aerodynamic silhouette formed by three sweeping rhythmic forward-angled geometric shards, ${activeSuffix}"
- "queen / female face" -> "An elegant regal queen profile emblem, minimalist geometric head silhouette framed by flowing stylized hair ribbons and crowned with a bold three-point geometric crown in negative space, ${activeSuffix}"`;
  } else if (isFlatObjectIllustration) {
    activeSuffix = getFlatObjectIllustrationSuffix(isWhiteBg);
    styleRules = `MANDATORY PROMPT STRUCTURE & SUFFIX RULES (FLAT OBJECT ILLUSTRATION - INANIMATE OBJECTS & PROPS ONLY):
1. **STRICTLY INANIMATE OBJECTS ONLY (ZERO HUMANS, ZERO CHARACTERS, ZERO FACES)**:
   - Focus PURELY on inanimate physical objects, vehicles, industrial machines, scientific tools, culinary items, furniture, consumer electronics, botanical specimens, or architectural props.
   - Absolutely NO humans, NO drivers, NO workers, NO children, NO animals, NO cartoon mascots, NO anthropomorphic faces, NO eyes, and NO smiles on objects.
2. **CHUNKY 2D SHAPES & CLEAN VECTOR GEOMETRY**:
   - Heavy simplified silhouettes with bold geometric bevels and clean 2D cutouts.
3. **HIGH-CONTRAST SOLID COLOR PLANES**:
   - Bold flat color blocking with hard-edge flat shadow planes. Zero gradients, no gradients, zero fake lighting, zero glow.
4. **SOLID SINGLE-COLOR BACKGROUND (STRICT)**:
   - Isolated on clean solid background with zero floor, zero ground shadow.
5. **MANDATORY SUFFIX**: Every single prompt MUST end with this exact paten suffix:
   "${activeSuffix}"

FEW-SHOT EXAMPLES:
- "coffee machine" -> "An artisan commercial chrome espresso coffee maker machine with portafilter, dual pressure dials, and steam wand, chunky 2D geometric vector styling, ${activeSuffix}"
- "power drill" -> "A cordless industrial rotary hammer power drill with textured grip handle, lithium battery pack, and steel chuck bit in 3/4 isometric perspective, ${activeSuffix}"
- "microscope" -> "A precision laboratory compound optical microscope with brass turret lenses, mechanical slide stage, and solid base, ${activeSuffix}"
- "delivery van" -> "A modern electric commercial delivery box cargo van in sleek side profile with solid aerodynamic body panels and charging port, ${activeSuffix}"
- "gardening shears" -> "A heavy-duty bypass pruning garden shears with ergonomic rubberized handles and sharp steel blades, ${activeSuffix}"`;
  } else if (isMonolineVector) {
    activeSuffix = getMonolineVectorSuffix(isWhiteBg);
    styleRules = `MANDATORY PROMPT STRUCTURE & SUFFIX RULES (MONOLINE GEOMETRIC VECTOR):
1. **UNIFORM SINGLE-WEIGHT CONTINUOUS LINE ART**: Pure continuous uniform-weight black stroke line art.
2. **GEOMETRIC PLANAR DECONSTRUCTION**: Subjects deconstructed into elegant intersecting geometric lines, circular arcs, and clean vector nodes.
3. **ZERO FILL COLORS, ZERO GRADIENTS & ZERO SHADING**: 100% black line art on pure clean background.
4. **STRICT COLOR BAN**: You MUST NOT write ANY color names (e.g. do not write red, blue, green, yellow, brown, etc.). The prompt must be strictly black and white. Your description MUST purely focus on geometry, contour, shape, and line intersections.
5. **MANDATORY SUFFIX**: Every single prompt MUST end with this exact paten suffix:
   "${activeSuffix}"

FEW-SHOT EXAMPLES:
- "eagle in flight" -> "A majestic eagle soaring with wings outstretched, composed of precise uniform single-weight geometric monoline curves and intersecting arc segments, ${activeSuffix}"
- "motorcycle" -> "A vintage cafe racer motorcycle side profile, defined purely by continuous single-weight black contour line work with geometric wireframe spokes, ${activeSuffix}"
- "astronomy telescope" -> "A precision astronomical observatory telescope on a tripod, rendered in clean geometric single-weight monoline vector line art, ${activeSuffix}"`;
  } else if (isGeometricSilhouette) {
    activeSuffix = getGeometricSilhouetteSuffix(isWhiteBg);
    styleRules = `MANDATORY PROMPT STRUCTURE & SUFFIX RULES (GEOMETRIC SILHOUETTE):
1. **HIGH-CONTRAST 2-COLOR SOLID SHAPE MASS**: Pure solid black silhouette shape with sharp planar facet contours.
2. **STRICTLY LINELESS (ZERO STROKES / NO OUTLINES)**: Formed purely from solid filled black shapes.
3. **DYNAMIC AERODYNAMIC FLOW**: Bold forward momentum, powerful stance, and clean anatomical silhouette.
4. **MANDATORY SUFFIX**: Every single prompt MUST end with this exact paten suffix:
   "${activeSuffix}"

FEW-SHOT EXAMPLES:
- "charging bull" -> "A powerful muscular charging bull silhouette in aggressive forward leap with lowered horns and sharp geometric contour facets, solid black fill, ${activeSuffix}"
- "howling wolf" -> "A dramatic howling wolf silhouette perched on a cliff ledge, sharp planar fur edge cuts and chiseled jaw contour, solid black shape, ${activeSuffix}"
- "gymnast" -> "A dynamic athletic gymnast silhouette in mid-air arched split leap, elegant aerodynamic contour with sharp angular planar cuts, ${activeSuffix}"`;
  } else if (isNegativeSpaceCutout) {
    activeSuffix = getNegativeSpaceCutoutSuffix(isWhiteBg);
    const subjectColor = isWhiteBg ? 'solid black' : 'solid crisp white';
    const bgColor = isWhiteBg ? 'solid white' : 'solid dark';
    styleRules = `MANDATORY PROMPT STRUCTURE & SUFFIX RULES (NEGATIVE SPACE CUTOUT - STRICTLY FRAMELESS SILHOUETTES):
1. **FRAMELESS SILHOUETTES ONLY (STRICT BAN ON ALL BADGES/FRAMES/BOXES/CIRCLES)**:
   - The subject MUST be a 100% free-standing solid silhouette cut directly onto the background.
   - Absolutely NO badge shapes, NO shield frames, NO circular containers, NO outer bounding boxes, and NO emblem borders.
2. **INTERNAL DETAILS CARVED OUT OF NEGATIVE SPACE**:
   - The subject's internal features (eyes, jawlines, wing feathers, muscle separations, facial contours) MUST be carved as clean negative space channels and slits.
3. **MANDATORY SUFFIX**: Every single prompt MUST end with this exact paten suffix:
   "${activeSuffix}"

FEW-SHOT EXAMPLES:
- "athletic figure" -> "A dynamic ${subjectColor} athletic figure in mid-leap with limb muscles, momentum lines, and anatomical contours carved sharply from negative space slices on ${bgColor} background, free-standing silhouette, strictly no badge, no border, ${activeSuffix}"
- "bearded god" -> "A majestic bust profile of a bearded Greek god with hair locks, chiseled brow, and deep jaw shadows sharply carved out through negative space on ${bgColor} background, strictly frameless, no border, ${activeSuffix}"
- "wolf in motion" -> "A stylized ${subjectColor} running wolf silhouette with fur facets, eye, and jaw highlights defined purely through high-contrast negative space cuts on ${bgColor} background, free-standing silhouette, no border, no frame, ${activeSuffix}"`;
  } else if (isFlatIllustration) {
    activeSuffix = getFlatIllustrationSuffix(isWhiteBg);
    styleRules = `MANDATORY PROMPT STRUCTURE & SUFFIX RULES (FLAT ILLUSTRATION):
1. **ANATOMY & PROPORTIONS**: Simplified chunky rounded anatomy, clean stylized shapes, non-intricate body features, simple friendly facial expressions.
2. **NO MICRO-DETAILS**: Absolutely DO NOT include tiny badges, small icons, stickers, decals, complex UI charts, graphs, or text on props or surfaces. All props, helmets, laptops, and screens must be solid, blank, and minimalistic.
3. **COLOR & SHADING**: Colors must be ultra-vibrant, sharp, and cheerful with saturated azure blue and radiant bright orange accents. Shading must be bold, clean-cut, hard-edge 2-tone flat shadow shapes. Strictly zero outlines/strokes, zero gradients, no gradients, no fake lighting, zero glow, no lens flare, no artificial lighting glare.
4. **SOLID SINGLE-COLOR BACKGROUND (STRICT)**: The background MUST be a single flat solid color with NO floor, NO ground surface, NO floor line, NO scenery, zero gradients, no gradients, and zero fake lighting. The subject must be cleanly isolated on this single solid background.
5. **MANDATORY SUFFIX**: Every single prompt MUST end with this exact paten suffix:
   "${activeSuffix}"

FEW-SHOT EXAMPLES:
- "technician" -> "A joyful male electrical technician with chunky build wearing a plain bright orange safety vest and solid yellow hardhat holding a blank tablet next to simple clean solar panels, ${activeSuffix}"
- "man watering plant" -> "A cheerful man with chunky build and simple smiling face happily kneeling to water a potted plant with a yellow watering can, ${activeSuffix}"
- "sport player" -> "A cheerful young basketball player with chunky cartoon build wearing a solid orange basketball jersey and blue shorts dribbling a simple basketball, ${activeSuffix}"
- "robot assistant" -> "A cute chubby white and deep cobalt blue AI robot with bulbous rounded body and glowing cyan visor holding a solid yellow folder, ${activeSuffix}"`;
  } else {
    activeSuffix = getFlatIllustrationSuffix(isWhiteBg);
    styleRules = `MANDATORY PROMPT STRUCTURE:
- Every prompt must strictly follow "${chosenStyle}" with clean 2D vector styling, bold simplified shapes, zero gradients, no gradients, no fake lighting, zero glow, no lens flare, and vivid color schemes.
- Strictly no photorealism, camera metadata, or 3D noise.`;
  }

  const isJersey = chosenStyle.toLowerCase().includes('jersey') || chosenStyle.toLowerCase().includes('jersy');
  const isCarWrap = chosenStyle.toLowerCase().includes('livery') || chosenStyle.toLowerCase().includes('wrap');

  const cleanMotif = concept
    .replace(/(basketball|soccer|football|futsal|esports|cycling|motocross|volleyball|badminton|rugby|running)?\s*(jersey|shirt|kit|tank top)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || concept;

  const extraRule = isCarWrap
    ? `\n- STRICT BAN: DO NOT write full wallpaper textures or repeating tiles. Focus 100% on aerodynamic racing decal graphics: "${cleanMotif}".`
    : '';

  const isAbstractGraphicStyle = isJersey || isCarWrap || isSeamlessPattern;

  let expansionRules = '';
  if (isJersey) {
    expansionRules = `
═══════════════════════════════════════════════════════════════════════════════════════
👑 AUTHENTIC SOCCER & SPORTS JERSEY SUBLIMATION EXPANSION (MANDATORY FOR JERSEYS)
═══════════════════════════════════════════════════════════════════════════════════════

You are a legendary Head Kit Designer for global football/soccer clubs (like Nike, Adidas, Puma, Umbro).
When expanding ANY user concept/keyword for a Jersey design:

1. 🎯 **HOLISTIC SPORTSWEAR GARMENT COMPOSITION (NOT JUST A WALLPAPER)**:
   - You MUST design a complete, authentic sportswear kit: front torso graphic, collar/neckline construction, sleeve treatment, and dynamic flank panels.
   - STRICT BAN: DO NOT output inanimate props, isolated objects (like cameras or coffee), generic wallpaper tiles, or car decals.

2. 👕 **MANDATORY 6 MASTER SOCCER SUBLIMATION ARCHETYPES**:
   - **Archetype 1 (Liquid Distortion & Topographic Marble)**: Fluid marbling distortion, biomorphic contour wave ripples, flowing camo-liquid curves across torso.
   - **Archetype 2 (90s Retro Geometric Chevrons & Speed Shards)**: Layered V-chevrons, diamond matrix blocks, fractured speed slashes, 1988-90 German/Dutch retro kit geometry.
   - **Archetype 3 (Distressed Dry-Brush & Splatter Sashes)**: Grunge paintbrush streaks, textured diagonal sashes, dry-brush splatter effects across chest.
   - **Archetype 4 (Halftone Dot Matrix & Gradient Mesh Fades)**: Fading halftone dot grids transitioning from dense chest to dispersed hem, engineered breathable mesh illusions.
   - **Archetype 5 (Modernized Club Stripes & Tournament Sashes)**: Modernized vertical bar stripes with embedded geometric micro-hatching, diagonal lightning edge sashes.
   - **Archetype 6 (Cultural / Ornamental / Subtle Tonal Jacquard)**: Subtle tone-on-tone jacquard texture embossing, ornamental traditional/tribal geometric borders on chest or sleeves.

3. ✂️ **DYNAMIC APPAREL CUT & COLLAR ROTATION**:
   - In every prompt, explicitly describe a unique collar & sleeve style:
     * "crossover ribbed V-neck with contrast raglan sleeves"
     * "classic 90s polo collar with button placket"
     * "two-tone ribbed crew neck with contrasting shoulder yoke panels"
     * "modern aerodynamic stand-up blade collar with curved flank mesh inserts"
     * "overlapping wrap-around ribbed collar with matching patterned sleeves"

4. 🚫 **STRICT ZERO-REPETITION**:
   - In ANY batch of prompts, dynamically rotate across different Archetypes (e.g. Prompt 1: Liquid Marble, Prompt 2: 90s Chevron Shards, Prompt 3: Distressed Brush Sash, Prompt 4: Halftone Mesh, etc.) and different collar styles!

5. 💎 **AUTHENTIC SPORTSWEAR TERMINOLOGY**:
   - Use precise, vivid vector terminology: "fading halftone dot matrix", "topographical liquid swirl", "dry-brush diagonal sash", "crossover ribbed V-neck", "tonal pinstripe hatching", "contrasting shoulder yokes", "aerodynamic flank panels".`;
  } else if (isCarWrap) {
    expansionRules = `
═══════════════════════════════════════════════════════════════════════════════════════
👑 MOTORSPORT CAR WRAP LIVERY EXPANSION RULES (MANDATORY FOR CAR WRAPS)
═══════════════════════════════════════════════════════════════════════════════════════

When processing ANY user concept/keyword for a Car Wrap Livery:
1. 🎯 **DIRECTIONAL RACING DECALS (STRICTLY NO WALLPAPERS / NO FULL TEXTURES)**:
   - Focus 100% on aerodynamic racing decal stripes, speed shards, fluid drift graphics, and high-contrast color blocking sweeping across vehicle side panels.
   - STRICT BAN: DO NOT create repeating wallpaper grids or texture tiles.

2. 🏎️ **DIVERSE MOTORSPORT ARCHETYPES**:
   - Rotate between: Fluid Drift Liquid ribbons, Aggressive Tribal Claw arcs, Classic Dual Racing Stripes, and Modern Kinetic Angular thrust blocks.

3. 💎 **AUTHENTIC AUTOMOTIVE TERMINOLOGY**:
   - Use precise vector terms: "aerodynamic velocity streaks", "razor-sharp winglet facets", "high-contrast diagonal speed slashes", "sweeping side fender decal".`;
  } else if (isSeamlessPattern) {
    expansionRules = `
═══════════════════════════════════════════════════════════════════════════════════════
👑 SEAMLESS SURFACE PATTERN EXPANSION RULES
═══════════════════════════════════════════════════════════════════════════════════════

1. 🎯 **FULL-BLEED SEAMLESS ALL-OVER REPEAT**:
   - Design an edge-to-edge seamless repeating surface pattern (textile print, wallpaper, packaging aesthetic).
   - Scatter or rhythmically tile theme motifs evenly across the canvas. Lineless 2D flat vector only.`;
  } else {
    expansionRules = `
════════════════════════════════════════════════════════════════════════════════════
👑 ULTRA-SMART DEPTH-FIRST CROSS-NICHE MICROSTOCK EXPANSION ENGINE (MANDATORY)
════════════════════════════════════════════════════════════════════════════════════

You are a world-class microstock art director. Your task: given a concept, generate the MAXIMUM possible number of unique, specific, commercially-valuable subjects BEFORE ever expanding to related or peripheral topics.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — DEPTH-FIRST PRIMARY EXHAUSTION (MOST IMPORTANT RULE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
First, generate a mental list of ALL specific primary subjects within the concept.
Then fill prompts with them ONE BY ONE, in order of diversity, BEFORE moving to related topics.

EXAMPLES OF CORRECT DEPTH-FIRST EXHAUSTION:

Concept "Asian food" (10 prompts requested):
  Prompt 1 → sushi nigiri set (Japanese)
  Prompt 2 → beef rendang (Indonesian)
  Prompt 3 → matcha dessert roll (Japanese)
  Prompt 4 → pho bo noodle bowl (Vietnamese)
  Prompt 5 → dim sum basket set (Chinese)
  Prompt 6 → bibimbap stone pot (Korean)
  Prompt 7 → pad thai stir fry (Thai)
  Prompt 8 → miso ramen bowl (Japanese)
  Prompt 9 → banh mi sandwich (Vietnamese)
  Prompt 10 → nasi goreng fried rice (Indonesian)
  ← ALL 10 prompts filled with actual Asian food dishes. Zero repetition, zero jumping to "chopsticks" or "bamboo steamer" yet.

Concept "animals" (12 prompts requested):
  Prompt 1 → golden retriever puppy
  Prompt 2 → arctic fox
  Prompt 3 → giant panda
  Prompt 4 → humpback whale
  Prompt 5 → barn owl
  Prompt 6 → chameleon
  Prompt 7 → axolotl
  Prompt 8 → capybara
  Prompt 9 → snow leopard
  Prompt 10 → red macaw parrot
  Prompt 11 → sea otter
  Prompt 12 → meerkat
  ← ALL 12 prompts are actual animals. Zero repetition of species type.

Concept "vehicles" (8 prompts requested):
  Prompt 1 → vintage red Vespa scooter
  Prompt 2 → electric cargo bicycle
  Prompt 3 → steam locomotive train
  Prompt 4 → hot air balloon
  Prompt 5 → wooden sailboat
  Prompt 6 → military jeep off-road
  Prompt 7 → city double-decker bus
  Prompt 8 → racing go-kart

ONLY AFTER the primary list is exhausted (or if the numPrompts count exceeds available primaries), THEN expand to closely related tools, props, ingredients, or scenes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — CROSS-NICHE DIVERSITY WITHIN THE PRIMARY LIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Even within the primary list, you MUST vary across sub-categories. For "Asian food", do NOT list 5 Japanese dishes in a row. Rotate: Japanese → Indonesian → Vietnamese → Korean → Thai → Chinese → Indian → Filipino, etc.

ABSOLUTE FORBIDDEN within any batch:
  ✗ Same primary subject type in two prompts (e.g., two "ramen" prompts)
  ✗ Same cultural origin back-to-back (e.g., two Japanese dishes consecutively)
  ✗ Same composition angle in adjacent prompts (e.g., two overhead flat-lays)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — ULTRA-SPECIFIC SUBJECT NAMING (NO GENERIC LABELS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✗ FORBIDDEN: "a food item", "an animal", "a dish", "a vehicle"
  ✓ REQUIRED: "golden-glazed Korean corn dog with mozzarella stretch", "arctic wolf mid-leap in snowstorm", "vintage Kawasaki café racer motorcycle"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — COMPOSITIONAL ANGLE VARIETY (MANDATORY ROTATION)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rotate visual angles across prompts:
  - Overhead top-down flat-lay
  - 3/4 isometric view
  - Dramatic low-angle hero shot
  - Intimate eye-level close-up
  - Clean side-profile silhouette

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — COMMERCIAL MICROSTOCK SEO PRIORITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Every subject must be commercially in-demand on Adobe Stock, Shutterstock, and Freepik. Prioritize subjects with high real-world buyer search volume.`;
  }

  let layoutInstruction = '';
  const isLayout1 = chosenPreset.includes('Layout 1');
  const isLayout2 = chosenPreset.includes('Layout 2');
  const isLayout3 = chosenPreset.includes('Layout 3');
  const isLayout4 = chosenPreset.includes('Layout 4');
  const isLayout5 = chosenPreset.includes('Layout 5');
  const isLayout6 = chosenPreset.includes('Layout 6');
  const isLayout7 = chosenPreset.includes('Layout 7');
  const isStickerSet = chosenPreset.includes('Sticker');
  const isMultiItemLayout = isLayout1 || isLayout2 || isLayout3 || isLayout4 || isLayout5 || isLayout6 || isLayout7 || isStickerSet;

  if (isMultiItemLayout) {
    let layoutSchema = '';
    let totalItems = 5;
    if (isLayout1) {
      totalItems = 5;
      layoutSchema = 'A flat vector asset collection sheet on a single solid background containing 5 isolated elements: on the left side is a large prominent hero subject, and arranged on the right side are four smaller distinct elements. ';
    } else if (isLayout2) {
      totalItems = 5;
      layoutSchema = 'A flat vector asset collection sheet on a single solid background containing 5 isolated elements: arranged on the left side are four smaller distinct elements, and on the right side is a large prominent hero subject. ';
    } else if (isLayout3) {
      totalItems = 5;
      layoutSchema = 'A flat vector asset collection sheet on a single solid background containing 5 isolated elements: in the center is a large prominent hero subject, flanked by two smaller elements on the left, and two smaller elements on the right. ';
    } else if (isLayout4) {
      totalItems = 6;
      layoutSchema = 'A flat vector asset collection sheet on a single solid background containing 6 evenly spaced isolated elements: ';
    } else if (isLayout5) {
      totalItems = 12;
      layoutSchema = 'A flat vector asset collection sheet on a single solid background containing 12 evenly spaced isolated elements: ';
    } else if (isLayout6) {
      totalItems = 4;
      layoutSchema = 'A flat vector asset collection sheet on a single solid background containing 4 evenly spaced isolated elements: ';
    } else if (isLayout7) {
      totalItems = 3;
      layoutSchema = 'A flat vector asset collection sheet on a single solid background containing 3 evenly spaced isolated elements side-by-side: ';
    } else if (isStickerSet) {
      totalItems = 6;
      layoutSchema = 'A cohesive die-cut sticker collection sheet on a single solid background containing 6 isolated stylized vector stickers with clean white die-cut contour borders evenly spaced: ';
    }

    layoutInstruction = `
═══════════════════════════════════════════════════════════════════════════════════════
👑 MANDATORY MULTI-ITEM BUNDLE PACK & GRID LAYOUT FORMULA (${chosenPreset.toUpperCase()})
═══════════════════════════════════════════════════════════════════════════════════════
1. 🎯 **SINGLE COHESIVE THEME**:
   - Every single generated prompt must describe ONE unified thematic universe (e.g. "Modern Coffee Barista Artisans", "Deep Space Astronaut Explorers").
   - ALL ${totalItems} items/slots MUST share the exact same cohesive art style, identical high-contrast color palette, and matching stylistic morphology!

2. 📐 **MANDATORY LAYOUT STRUCTURE**:
   - Every prompt MUST structure the canvas using this exact composition format:
     "${layoutSchema}"

3. 💎 **DEEP, EXHAUSTIVE CHARACTERIZATION PER ITEM (EQUAL TO SINGLE IMAGE QUALITY)**:
   - YOU MUST NOT write brief, lazy, or generic summaries for the slots (e.g. do NOT just say "a lion, a bear").
   - ⚠️ EXTREME LENGTH REQUIRED: You MUST write AT LEAST 40 WORDS FOR EVERY SINGLE ITEM in the grid! 
   - ⚠️ DO NOT SKIP ITEMS: You must explicitly write out the description for EVERY numbered item (e.g., "1) [description], 2) [description]..."). If the layout asks for 6 items, you MUST write exactly 6 detailed items!
   - For EVERY SINGLE SLOT, describe its exact physical pose, its intricate clothing/gear, its distinct materials and colors, a unique prop it is holding, and its specific facial expression or micro-details!
   - Every slot must be described with the massive depth and richness of a standalone heroic illustration! You MUST NOT truncate or skip any slots!

4. 🚫 **STRICT ZERO-TEXT CONTRACT**:
   - STRICTLY FORBIDDEN: DO NOT write label headers in uppercase like "ONE DOMINANT HERO VERTICAL PANEL" or "A 2x2 QUAD GRID". Midjourney will literally render these words as text in the image!
   - Weave the layout purely as natural English descriptions.
   - The final artwork must have STRICTLY ZERO TEXT, ZERO LETTERS, ZERO NUMBERS, ZERO LABELS, AND ZERO WATERMARKS.`;
  }

  return `${buildNegativePromptInstruction(negativePrompt)}You are an elite, world-class Creative Director and Master Prompt Engineer specializing in high-end 2D commercial vector graphics, microstock illustration, and iconic visual branding (Adobe Stock, Shutterstock, Freepik, Getty standard).

Your core mission is to deeply understand the user's concept and perform an ULTRA-INTELLIGENT, HIERARCHICAL HIGH-SEO COMMERCIAL MICROSTOCK EXPANSION. You must produce EXACTLY ${numPrompts} wildly creative, intellectually sophisticated, completely non-repetitive, and commercially high-demand prompt variations in English, returned as a JSON array.
${expansionRules}

7. 🎨 **ART-STYLE SPECIALIZED MORPHOLOGY**:
   - **Flat illustration**: Chunky stylized anatomical proportions, friendly expressive micro-moments, clean solid blank props (no fake text/badges), ultra-vibrant contrast palettes (azure blue, warm amber, bright orange), and sharp 2-tone flat shadow blocking.
   - **Flat object illustration**: Purely inanimate physical objects, vehicles, gear, tools, and props with chunky 2D geometry, vibrant contrast colors, sharp hard-edge flat shadows, strictly zero humans, zero characters, zero faces.
   - **Monoline geometric vector**: Pure continuous uniform single-weight black contour line art, abstract geometric planar deconstruction, zero colors, zero gradients, zero shadows.
   - **Geometric silhouette**: Powerful aerodynamic contour silhouettes with sharp planar facet cuts, high-contrast solid mass shapes, strictly lineless (no strokes), 100% two-color black/white contrast.
   - **Negative space cutout**: Ingenious free-standing silhouette cutouts (strictly frameless, zero border, zero outer badge/frame/box/circle) where facial features, muscles, or lighting highlights are sharply carved out of negative space.
${layoutInstruction}
Creative Configuration:
- Selected Art Style: ${chosenStyle}
- Preset Format: ${chosenPreset}
${pose ? `- Specified Target Pose: ${pose}` : '- Target Pose: Dynamically vary distinct postures, actions, and gestures across all prompts without repetition.'}
${attributes ? `- Specified Attributes: ${attributes}` : '- Target Attributes: Keep props clean, iconic, solid, and simplified without intricate surface noise.'}

${styleRules}${extraRule}

Core Output Rules:
1. **Excellence**: Deliver EXACTLY ${numPrompts} prompts of unmatched artistic quality, descriptive clarity, and commercial stock appeal.
2. **JSON Format**: You MUST output ONLY a valid JSON array of ${numPrompts} strings. Zero introductory remarks, zero explanations, zero markdown fences outside JSON.
3. ${actionPoseInstruction}
4. ${plainPromptFormattingInstruction}
5. ${jsonStringSafetyInstruction}`;
};

export const buildTextPrompt = (concept: string, settings: UseSettingsReturn & { thematicAngle?: string }, isQuick: boolean) => {
  let systemInstruction: string;
  let schema: object = promptListSchema;
  const entropySeed = Math.random().toString(36).substring(2, 8);
  const angleClause = settings.thematicAngle ? `\n- DIVERSITY PILLAR: ${settings.thematicAngle}` : '';
  let contents = `Process the following concept: "${concept}" [Creative Horizon Seed: ${entropySeed} - Explore wild, non-cliché, highly imaginative, diverse multi-perspective angles${angleClause}]`;
  
  const isVector = settings.styleOption === 'vector' || settings.inputMode === 'vector' || !!settings.vectorArtStyle;

  if (isVector) {
    const chosenArtStyle = settings.vectorArtStyle || 'Flat illustration';
    const isWhiteBg = settings.vectorWhiteBg ?? true;
    const activeSuffix = getActiveVectorSuffix(chosenArtStyle, isWhiteBg, concept);

    const chosenPreset = settings.vectorPreset || 'Single Image';
    const isLayout1 = chosenPreset.includes('Layout 1');
    const isLayout2 = chosenPreset.includes('Layout 2');
    const isLayout3 = chosenPreset.includes('Layout 3');
    const isLayout4 = chosenPreset.includes('Layout 4');
    const isLayout5 = chosenPreset.includes('Layout 5');
    const isLayout6 = chosenPreset.includes('Layout 6');
    const isLayout7 = chosenPreset.includes('Layout 7');
    const isStickerSet = chosenPreset.includes('Sticker');
    const isMultiItemLayout = isLayout1 || isLayout2 || isLayout3 || isLayout4 || isLayout5 || isLayout6 || isLayout7 || isStickerSet;

    systemInstruction = buildVectorTextPrompt(
      settings.negativePrompt,
      settings.numPrompts,
      chosenArtStyle,
      chosenPreset,
      settings.vectorPose,
      settings.vectorAttributes,
      isWhiteBg,
      concept
    );

    if (isMultiItemLayout) {
      let layoutFormula = '';
      let slotCount = 5;
      if (isLayout1) {
        slotCount = 5;
        layoutFormula = 'A flat vector asset collection sheet on a single solid background containing 5 isolated elements: on the left side is a large prominent hero subject, and arranged on the right side are four smaller distinct elements. ';
      } else if (isLayout2) {
        slotCount = 5;
        layoutFormula = 'A flat vector asset collection sheet on a single solid background containing 5 isolated elements: arranged on the left side are four smaller distinct elements, and on the right side is a large prominent hero subject. ';
      } else if (isLayout3) {
        slotCount = 5;
        layoutFormula = 'A flat vector asset collection sheet on a single solid background containing 5 isolated elements: in the center is a large prominent hero subject, flanked by two smaller elements on the left, and two smaller elements on the right. ';
      } else if (isLayout4) {
        slotCount = 6;
        layoutFormula = 'A flat vector asset collection sheet on a single solid background containing 6 evenly spaced isolated elements: ';
      } else if (isLayout5) {
        slotCount = 12;
        layoutFormula = 'A flat vector asset collection sheet on a single solid background containing 12 evenly spaced isolated elements: ';
      } else if (isLayout6) {
        slotCount = 4;
        layoutFormula = 'A flat vector asset collection sheet on a single solid background containing 4 evenly spaced isolated elements: ';
      } else if (isLayout7) {
        slotCount = 3;
        layoutFormula = 'A flat vector asset collection sheet on a single solid background containing 3 evenly spaced isolated elements side-by-side: ';
      } else if (isStickerSet) {
        slotCount = 6;
        layoutFormula = 'A cohesive die-cut sticker collection sheet on a single solid background containing 6 isolated stylized vector stickers with clean white die-cut contour borders evenly spaced: ';
      }

      // Build the per-item numbered instruction list
      const exampleItemLines: string[] = [];
      exampleItemLines.push(`  "layout_prefix": "${layoutFormula}"`);
      for (let i = 1; i <= slotCount; i++) {
        exampleItemLines.push(`  "item_${i}": "your ultra-detailed 40+ word description for item ${i} here..."`);
      }

      contents = `You are a world-class microstock prompt engineer. Generate EXACTLY ${settings.numPrompts} bundle pack prompts for concept: "${concept}". [Seed: ${entropySeed}${angleClause}]

LAYOUT PREFIX (copy this exactly for every prompt): "${layoutFormula}"
ART STYLE: "${chosenArtStyle}"
SLOT COUNT: ${slotCount} items per sheet

OUTPUT FORMAT — Return a valid JSON array of ${settings.numPrompts} objects. Each object MUST have the layout_prefix key and EXACTLY ${slotCount} item keys:
[
  {
${exampleItemLines.join(',\n')}
  },
  ... (repeat for all ${settings.numPrompts} prompts)
]

MANDATORY RULES FOR EVERY ITEM:
1. The "layout_prefix" value must be copied exactly from above (do NOT change it).
2. Each "item_N" value MUST be a single string starting with "N)" (e.g., "1) a golden retriever...").
3. Each item MUST be AT LEAST 40 WORDS LONG. Describe: pose, clothing/fur/material, colors, a unique held prop, and facial expression.
4. ALL ${slotCount} items in every prompt MUST share the same cohesive thematic universe of "${concept}".
5. Zero uppercase layout labels (e.g., "HERO PANEL"). Write naturally.
6. DO NOT skip any item. Every object MUST have ALL ${slotCount} item keys filled with unique creative content.
7. DO NOT output the style suffix. The system appends it automatically.

Return ONLY the JSON array. No markdown, no extra text.`;
    } else {
      contents = `Process the concept: "${concept}" and generate EXACTLY ${settings.numPrompts} unique, wildly creative prompts in JSON array format using the Hierarchical High-SEO Microstock Priority. [Session Exploration Seed: ${entropySeed}${angleClause}]

CRITICAL DIVERSITY & FORMULA REQUIREMENT:
- Act as an ultra-smart, wildly creative commercial microstock director.
- Selected Art Style: "${chosenArtStyle}"
- For every prompt, write a rich, highly specific 2D vector graphic scene/motif description, followed by the mandatory style suffix:
"[DETAILED 2D GRAPHIC SCENE/MOTIF DESCRIPTION], ${activeSuffix}"

Return ONLY a valid JSON array of ${settings.numPrompts} complete prompt strings.`;
    }
  } else {
    switch (settings.styleOption) {
      case 'isolated':
        systemInstruction = buildIsolatedTextPrompt(settings.negativePrompt, settings.numPrompts);
        break;
      case 'custom':
        const template = settings.customTemplate.trim();
        systemInstruction = buildCustomTextPrompt(template, settings.negativePrompt, settings.numPrompts);
        break;
      case 'footage':
        systemInstruction = buildFootageJsonPrompt(settings.negativePrompt, settings.numPrompts);
        schema = footageListSchema;
        break;
      case 'photographic':
      default:
        systemInstruction = buildFotographicTextPrompt(settings.promptQualityOption, settings.negativePrompt, settings.numPrompts);
        break;
    }
  }
 
  const config: any = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: schema,
    temperature: 0.95,
    topP: 0.95,
    maxOutputTokens: Math.min(8192, Math.max(2048, settings.numPrompts * 400)),
  };
  applyQuickGenerateConfig(config, settings.selectedModel, isQuick);
  return { systemInstruction, contents, config };
};

// --- IMAGE-BASED PROMPT BUILDERS ---

const buildImageAnalysisPrompt = (style: 'photographic' | 'sameAsReference', quality: 'default' | 'xml', negativePrompt: string, numPrompts: number) => {
 
 let wordCountInstruction: string;
 let mainInstruction: string;

 if (quality === 'xml') {
 wordCountInstruction = style === 'sameAsReference' ? refStyleXmlTemplateInstruction : photographicXmlTemplateInstruction;
 if (style === 'sameAsReference') {
 const detail = "Each prompt must be an extremely detailed and faithful description formatted into the XML tags. For <Subject>, exhaustively describe every visible human subject with their ancestry, age, expression, skin texture, hair, clothing fabric and fit, pose, gesture, and physical micro-details. For <Style>, identify and describe the exact visual medium, artistic treatment, color palette, and rendering texture of the reference. For <Lighting>, describe visible light direction, intensity, color temperature, and shadow patterns exactly as seen. For <Background>, describe every environmental element, material, spatial depth, and atmospheric detail. For <Composition>, describe the viewing angle and perspective. For <Mandatory>, list at least 5 specific elements that must be preserved. Keep it faithful to the reference and do not add camera metadata.";
 mainInstruction = `Based on your analysis of the provided image, generate EXACTLY ${numPrompts} prompts in SAME-AS-REFERENCE STYLE. ${sameAsReferenceStyleInstruction} ${detail}`;
 } else { // photographic
 const detail = "Each prompt must be extremely detailed within the XML tags. For <Subject>, exhaustively describe every visible human subject with ancestry, age, expression, skin texture and pores, hair, clothing fabric/fit/texture, pose, gesture, and physical micro-details. For <Style>, specify exact photographic medium and color film emulation. For <Lighting>, describe visible light source, direction, intensity, color temperature in Kelvin, and shadow contrast in detail. For <Background>, describe environment materials, textures, spatial depth, and bokeh. For <Composition>, specify camera angle, exact lens focal length, aperture, and optical characteristics. For <Mandatory>, list at least 5 specific mandatory elements.";
 mainInstruction = `Based on your analysis of the provided image, generate EXACTLY ${numPrompts} prompts. FOR EACH PROMPT, re-imagine the image's content in a new PHOTOGRAPHIC style. ${detail} Do not include studio-gear lighting setup terms. Do not use the word 'photographic' explicitly. ${photographicCameraOnlyInstruction} ${nonPhotographicStyleBanInstruction}`;
 }
 } else { // 'default'
 wordCountInstruction = "Each prompt must be a minimum of 100 words and a maximum of 120 words long. The prompt MUST NOT be shorter than 100 words.";
 if (style === 'sameAsReference') {
 const detail = "Each prompt must be an extremely detailed and faithful description of the provided reference. Focus on capturing visible nuances: every relevant human subject, each person's expression, clothing, pose/action, placement, relationship to other people, background, composition, visible lighting, color palette, mood, medium, texture, and exact artistic or visual treatment. Do not add camera metadata.";
 mainInstruction = `Based on your analysis of the provided image, generate EXACTLY ${numPrompts} prompts in SAME-AS-REFERENCE STYLE. ${sameAsReferenceStyleInstruction} ${detail}`;
 } else { // photographic
 const detail = "Each prompt must be extremely detailed about every relevant visible human subject, each person's clothing, pose/action, expression, placement, relationship to others, objects, environment, textures, materials, framing, and visible light. Camera model, lens type/focal length, aperture, shutter speed, ISO, focus point, and depth of field should carry the photographic treatment. Do NOT include studio/gear setup wording such as softbox, octabox, key/fill/rim light, or off-camera direction.";
 mainInstruction = `Based on your analysis of the provided image, generate EXACTLY ${numPrompts} prompts. FOR EACH PROMPT, re-imagine the image's content in a new PHOTOGRAPHIC style. ${detail} Do not use the word 'photographic' explicitly. ${photographicCameraOnlyInstruction} ${nonPhotographicStyleBanInstruction}`;
 }
 }
 const systemInstruction = `${buildNegativePromptInstruction(negativePrompt)}You are an AI that analyzes an image to generate descriptive prompts for AI image generation. General rules: All output must be strictly in English. Do NOT use forbidden words like "image", "photo", "picture", "description", "photograph", "real", "realistic", "portrayal", "render", "rendering", "photorealistic", "hyper-realistic". ${humanAncestryInstruction} CRITICAL CONSISTENCY RULE: Before generating the prompts, internally decide on ONE specific, confident ancestry/race/ethnicity descriptor for each visible human subject. You MUST lock in this decision and use the EXACT SAME ancestry descriptor for that specific person across ALL ${numPrompts} generated prompts. Do not change their ancestry between variations. If the reference contains multiple humans, every generated prompt must preserve and describe the multi-person composition unless the user explicitly asks to isolate only one person. CRITICAL: You MUST respond with a single, valid JSON array containing exactly ${numPrompts} strings. Do NOT include any other text, explanations, or markdown formatting outside of the JSON array. ${plainPromptFormattingInstruction}${quality === 'xml' ? '' : ` ${jsonStringSafetyInstruction}`}`;
 const contents = `${mainInstruction}\n\n${wordCountInstruction}\n\nRemember: Maintain strict ancestry consistency. Determine the precise ancestry for each human once, and apply that same description to all generated prompts in the array.`;
 return { systemInstruction, contents };
};

const buildImageIsolatedAnalysisPrompt = (negativePrompt: string, numPrompts: number) => {
 const template = '[main subject], isolated on white background, studio shot, sharp focus, no shadow.';
 const systemInstruction = `${buildNegativePromptInstruction(negativePrompt)}You are an expert AI visual analyst. Task: Analyze the image and generate prompts based on a template. Template: "${template}". Core Task: 1. Generate EXACTLY ${numPrompts} unique prompts. 2. Analyze only the visible subject or subject group in detail. The '[main subject]' replacement must be a rich subject phrase, not a generic label. If multiple humans are visible, treat them as a subject group and describe each relevant person with age range when relevant, race/ethnicity/ancestry, hairstyle, clothing, accessories, carried props, distinctive physical traits, pose, action, and relationship/placement to the other people. Do NOT include location, scenery, environment, street, room, city, landscape, background, or context outside the subject group. ${humanAncestryInstruction} CRITICAL CONSISTENCY RULE: Before generating the prompts, internally decide on ONE specific, confident ancestry/race/ethnicity descriptor for each visible human subject. You MUST lock in this decision and use the EXACT SAME ancestry descriptor for that specific person across ALL ${numPrompts} generated prompts. Do not change their ancestry between variations. 3. Fill the template, the final prompt MUST NOT contain square brackets. 4. TEMPLATE LOCK: Every output string MUST follow this exact structure and end immediately after "no shadow.": "[detailed subject or subject group only], isolated on white background, studio shot, sharp focus, no shadow." Put only visible subject detail before ", isolated on white background". Do not include original scene context or background details anywhere. Do not add lighting, lens, camera, mood, background, or any extra descriptors after "no shadow." 5. All output must be strictly in English. 6. JSON Output: You MUST respond with a single, valid JSON array containing exactly ${numPrompts} strings. Do NOT include any other text, explanations, or markdown formatting outside of the JSON array. 7. ${plainPromptFormattingInstruction} 8. ${jsonStringSafetyInstruction}`;
 const contents = `Analyze the image carefully and generate EXACTLY ${numPrompts} prompts based on the template. Make the [main subject] replacement specific to the visible subject or subject group. If more than one human is visible, include each relevant person with clothing, accessories, pose, carried props, relationship/placement, and ancestry descriptor. Exclude the original location, scenery, street, room, background, and environment. Return a JSON array.\n\nRemember: Maintain strict ancestry consistency. Determine the precise ancestry for each human once, and apply that same description to all generated prompts in the array.`;
 return { systemInstruction, contents };
};

const buildImageCustomAnalysisPrompt = (template: string, negativePrompt: string, numPrompts: number) => {
  const systemInstruction = `${buildNegativePromptInstruction(negativePrompt)}You are an expert AI visual analyst. Task: Analyze the image and use it to fill a text template with placeholders (e.g., [main subject]). Template: "${template}". Core Task: 1. Analyze Image. ${humanAncestryInstruction} CRITICAL CONSISTENCY RULE: Before generating the prompts, internally decide on ONE specific, confident ancestry/race/ethnicity descriptor for each visible human subject. You MUST lock in this decision and use the EXACT SAME ancestry descriptor for that specific person across ALL ${numPrompts} generated variations. Do not change their ancestry between variations. If the image contains multiple humans, fill any subject-related placeholder with all relevant visible human subjects unless the template explicitly asks for only one subject. 2. Generate EXACTLY ${numPrompts} unique variations. 3. Fill Template, the final prompt MUST NOT contain square brackets. CRITICAL TEXT PLACEHOLDER RULE: If the template contains a placeholder for text (e.g. [teks], [text], or similar) and there is NO text visible in the image, you MUST completely remove the placeholder along with any surrounding quotes (e.g., "" or '') and extra spaces. Do NOT replace it with " " or empty quotes. 4. TEMPLATE LOCK: Preserve the template's literal wording, order, separators, punctuation, and ending. Only replace placeholder text. Do not append extra camera metadata, lighting, lens, style, background, mood, keywords, or descriptive clauses that are not requested by the template. 5. All output must be strictly in English. 6. JSON Output: You MUST respond with a single, valid JSON array containing exactly ${numPrompts} strings. Do NOT include any other text, explanations, or markdown formatting outside of the JSON array. 7. ${plainPromptFormattingInstruction} 8. ${jsonStringSafetyInstruction}`;
 const contents = `Analyze the image and generate EXACTLY ${numPrompts} prompts based on the template, returning a JSON array. If multiple humans are visible, include each relevant person in subject placeholders with their own ancestry descriptor and visual details.\n\nRemember: Maintain strict ancestry consistency. Determine the precise ancestry for each human once, and apply that same description to all generated prompts in the array.`;
 return { systemInstruction, contents };
};

const buildImageFootageAnalysisPrompt = (negativePrompt: string, numPrompts: number) => {
 const negPrefix = buildNegativePromptInstruction(negativePrompt);
 const baseInstruction = `${negPrefix}You are an expert AI visual analyst for video prompts. Task: Meticulously analyze the image and generate descriptive video prompts. Instructions: 1. Analyze Image Deeply. ${humanAncestryInstruction} CRITICAL CONSISTENCY RULE: Before generating the prompts, internally decide on ONE specific, confident ancestry/race/ethnicity descriptor for each visible human subject. You MUST lock in this decision and use the EXACT SAME ancestry descriptor for that specific person across ALL ${numPrompts} generated variations. Do not change their ancestry between variations. If the image contains multiple humans, every prompt must describe each relevant person, their placement/relationship, action or pose, and ancestry descriptor. 2. Generate EXACTLY ${numPrompts} unique video prompts. 3. All output text must be strictly in English. 4. JSON Output: You MUST respond with a single, valid JSON array containing exactly ${numPrompts} items. Do NOT include any other text, explanations, or markdown formatting outside of the JSON array. 5. ${plainPromptFormattingInstruction} 6. ${jsonStringSafetyInstruction}`;
 
 const formatInstruction = buildFootageFormatInstruction(numPrompts);
 
 const systemInstruction = `${baseInstruction}\n${formatInstruction}`;
 const contents = `Analyze the image and provide EXACTLY ${numPrompts} video prompts based on the system instructions, returning a JSON array. If multiple humans are visible, include each relevant person with their own ancestry descriptor and visual/action details.\n\nRemember: Maintain strict ancestry consistency. Determine the precise ancestry for each human once, and apply that same description to all generated prompts in the array.`;
 return { systemInstruction, contents };
};

const buildImageVectorAnalysisPrompt = (
  negativePrompt: string,
  numPrompts: number,
  artStyle?: string,
  whiteBg: boolean = true
) => {
  const chosenStyle = artStyle || 'Flat illustration';
  const lowerStyle = chosenStyle.toLowerCase();
  const isJerseyPattern = lowerStyle.includes('jersey') || lowerStyle.includes('jersy');
  const isCarWrap = lowerStyle.includes('car') || lowerStyle.includes('wrap') || lowerStyle.includes('livery');

  let categoryContext = '';
  if (isJerseyPattern) {
    categoryContext = `
CATEGORY: Jersey Sublimation Pattern
- You are generating motif/pattern descriptions for sports jersey sublimation designs.
- Focus on describing the GRAPHIC PATTERN only — geometric shapes, flow direction, color blocks, panel arrangements.
- DO NOT write words like 'jersey', 'shirt', 'kit', 'tank top', 'mockup', 'sublimation', 'dual split', 'presentation layout' — the system appends the layout suffix automatically.
- DO NOT describe the garment shape, collar, sleeves, or mockup. ONLY describe the pure graphic artwork/pattern.`;
  } else if (isCarWrap) {
    categoryContext = `
CATEGORY: Car Wrap Racing Livery
- You are generating graphic descriptions for vehicle wrap liveries.
- Focus on describing the GRAPHIC DECALS only — racing stripes, swooshes, tribal tears, geometric blocks, sponsor panels.
- DO NOT write words like 'car', 'vehicle', 'sedan', 'wheels', 'windows', 'mockup', 'wrap', 'livery' — the system appends the layout suffix automatically.
- DO NOT describe the car body shape. ONLY describe the pure graphic artwork/decals.`;
  } else {
    categoryContext = `
CATEGORY: ${chosenStyle}
- Focus on describing the visual subject, composition, and color scheme from the reference image.
- DO NOT append any format suffix like 'flat 2d vector', 'isolated on white', etc. — the system adds that automatically.`;
  }

  const systemInstruction = `${buildNegativePromptInstruction(negativePrompt)}You are a Visual Reference Analyst. Your job is to study the reference image and generate CONCEPT DESCRIPTIONS that capture the exact same visual DNA and coverage level.

IMPORTANT: You generate ONLY the creative motif/concept description. The system will automatically append the standard format suffix. Do NOT include any suffix, layout description, or format instructions in your output.

Task: Generate EXACTLY ${numPrompts} concept descriptions as a JSON array of strings.
${categoryContext}

## HOW TO READ THE IMAGE:
1. **COVERAGE & NEGATIVE SPACE (CRITICAL)**: Is this a FULL-BODY aggressive pattern covering everything, or a MINIMALIST design (e.g. 80% solid white with just one graphic on the chest)? If the image is mostly a solid color, your prompt MUST explicitly state "vast clean negative space" and pinpoint where the graphic lives (e.g., "chest band", "lower flank panels", "shoulder accent").
2. **MOTIF (DON'T FORCE GEOMETRY)**: What exact shape or pattern do you see? Is it curved, flowing, organic, tribal, flaming, geometric, or classic? Describe its TRUE nature (e.g., "fluid tribal flame curves on sleeves", "elegant curved pinstripes", "classic horizontal stripes", "sharp diagonal shards"). DO NOT use words like "shards", "angular", or "geometric" if the original image has smooth, curved, or tribal lines!
3. **COLORS**: What is the BASE color? What are the 2-3 accent colors? Name them specifically (e.g. "jet black", "crimson red").
4. **FLOW**: What's the visual direction? Horizontal bands? Diagonal sweeps? Radial burst? Organic flow?

## HOW TO CREATE VARIATIONS:
Each prompt must be a DEVELOPMENT of the reference — recognizably similar in its core DNA but CREATIVELY EXPANDED:
- **COVERAGE (STRICT)**: If the reference is minimalist, ALL variations MUST be minimalist (retain the same ratio of vast negative space). If it features a central block, keep the central block layout. DO NOT generate full-body concepts from a minimalist image.
- **MOTIF (EVOLVE, DON'T RANDOMIZE)**: Identify the TRUE shape family in the reference. If the image has tribal curves/flames, evolve them into "sweeping tribal arcs" or "dynamic fluid flame contours". If the image has elegant curved contour lines, evolve them into "sweeping aerodynamic arcs" or "organic fluid pipelines". DO NOT hallucinate "angular shards" or "geometric blocks" onto curved/organic designs. Expand on the reference's specific shape family creatively.
- **COLORS**: Start from the reference palette but you CAN develop. Keep at least 1-2 anchor colors, explore complementary accents.

## EXAMPLES OF CORRECT OUTPUT (Concept Only):
[REFERENCE HAS TRIBAL CURVES] -> "Minimalist fluid tribal flame curves in bold crimson red wrapping around the sleeves and lower flanks, set against a vast clean samurai blue negative space base"
[REFERENCE HAS CURVED PINSTRIPES] -> "Minimalist sweeping aerodynamic curved contour pipelines in deep crimson red framing a jet black raglan shoulder panel, set against vast clean white negative space"
[REFERENCE HAS CENTRAL BLOCK] -> "Bold central hexagonal chest shield block in solid jet black, framed by layered architectural borders in crimson and cream, utilizing clean symmetrical negative space"
[FULL-BODY REFERENCE] -> "Aggressive full-body diagonal velocity shards in deep crimson red and jet black angular panels intersecting across the entire canvas"
[BAD EXAMPLE] -> "professional sports jersey sublimation vector design, dual split 50:50..." (NEVER output suffixes)

## RULES:
- Output ONLY the creative concept/motif description. NO suffix. NO layout description.
- BANNED words: 'gold', 'golden', 'titanium', 'metallic', 'chrome', 'bronze', 'silver', 'neon', 'glowing', 'cyber', 'glitch', 'shiny', 'amber', 'gradient', 'ombre'.
- Each prompt describes flat solid color artwork only.
- JSON array of exactly ${numPrompts} strings. No markdown, no commentary.
${humanAncestryInstruction}
${plainPromptFormattingInstruction}
${jsonStringSafetyInstruction}`;

  const contents = `Study this reference image — it is your ONLY creative source.

Read the EXACT level of coverage (minimalist vs full-body), negative space, pattern shape family (curved, tribal, geometric, etc), color palette, and visual flow from this image.

Generate EXACTLY ${numPrompts} concept descriptions that are faithful developments of what you see:
- If the image is minimalist or uses a central block, YOUR PROMPTS MUST RETAIN THAT LAYOUT (explicitly mention negative space and placement).
- EVOLVE THE SHAPE: Respect the TRUE shape (e.g. if it has tribal curves, make variations of tribal curves; if it has organic waves, make variations of organic waves). DO NOT force "shards" or "angular blocks" onto curved or organic designs.
- Colors developed from the reference (keep anchors, explore new accents).

Output ONLY the concept description for each prompt. Do NOT include any suffix, layout, or format instructions.

Return as JSON array.`;

  return { systemInstruction, contents };
};

export const buildImagePrompt = (image: { data: string; mimeType: string }, settings: UseSettingsReturn, isQuick: boolean) => {
  const imagePart = { inlineData: { mimeType: image.mimeType, data: image.data } };

  let systemInstruction: string, textContent: string;
  let schema: object = promptListSchema;

  switch (settings.styleOption) {
    case 'isolated':
      ({ systemInstruction, contents: textContent } = buildImageIsolatedAnalysisPrompt(settings.negativePrompt, settings.numPrompts));
      break;
    case 'vector':
      ({ systemInstruction, contents: textContent } = buildImageVectorAnalysisPrompt(settings.negativePrompt, settings.numPrompts, settings.vectorArtStyle, settings.vectorWhiteBg));
      break;
    case 'custom':
      const template = settings.customTemplate.trim();
      ({ systemInstruction, contents: textContent } = buildImageCustomAnalysisPrompt(template, settings.negativePrompt, settings.numPrompts));
      break;
    case 'footage':
      ({ systemInstruction, contents: textContent } = buildImageFootageAnalysisPrompt(settings.negativePrompt, settings.numPrompts));
      schema = footageListSchema;
      break;
    case 'photographic':
    case 'sameAsReference':
    default:
      ({ systemInstruction, contents: textContent } = buildImageAnalysisPrompt(settings.styleOption, settings.promptQualityOption, settings.negativePrompt, settings.numPrompts));
      break;
  }

  const textPart = { text: textContent };
  const contents = { parts: [imagePart, textPart] };
  const config: any = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: schema,
  };
  applyQuickGenerateConfig(config, settings.selectedModel, isQuick);

  return { contents, config };
};

// --- VIDEO-BASED PROMPT BUILDERS ---

const buildVideoFootageAnalysisPrompt = (negativePrompt: string, numPrompts: number) => {
 const negPrefix = buildNegativePromptInstruction(negativePrompt);
 
 const baseInstruction = `${negPrefix}You are an expert AI cinematic analyst specializing in generating descriptive video prompts. Your task is to perform a deep, multi-modal analysis of an entire video file, breaking it down into key scenes and transitions to generate a specified number of unique, highly detailed video prompts, returned as a JSON array.

**Your analysis MUST follow this two-step process:**

**Step 1: Deep Video Analysis**
First, "watch" the entire video to understand its structure and flow. Your internal analysis must identify:
- **Overall Narrative & Pacing:** What is the story or sequence of events? Is the pacing fast and energetic, slow and contemplative, or does it change?
- **Key Scenes:** Segment the video into distinct key scenes. A new scene is defined by a significant change in location, subject, action, or emotional tone.
- **Scene-Specific Details:** For each key scene, analyze the subjects, their actions, the setting, camera work (movements like pans, tilts, tracking shots), lighting, and mood.
- **Human Subject Inventory:** For each key scene, identify every relevant visible human, not only the primary subject. Track each person's ancestry descriptor, clothing, pose/action, expression, placement, and relationship to the other people in that scene.
- **Transitions:** Note how the scenes connect. Are there hard cuts, fades, dissolves, or other cinematic transitions? These are crucial for creating dynamic prompts.

**Step 2: Dynamic Prompt Generation**
Now, based on your deep analysis, generate the prompts. Follow these instructions precisely:
1. For the single video provided, generate EXACTLY ${numPrompts} unique video prompts. Each prompt should be a cinematic description of a specific key scene or a transition between scenes that you identified.
2. **Focus on dynamism:** Instead of a static description, write prompts that describe action, movement, and change over a brief moment in time, as if giving direction for a video clip. When a scene contains multiple humans, preserve the multi-person action and describe each relevant person rather than collapsing them into "people" or "a group".
3. All output text must be strictly in English.
4. ${humanAncestryInstruction}
5. JSON Output: You MUST respond with a single, valid JSON array containing exactly ${numPrompts} items. Do NOT include any other text, explanations, or markdown formatting outside of the JSON array.
6. ${plainPromptFormattingInstruction} 7. ${jsonStringSafetyInstruction}`;

 const formatInstruction = buildFootageFormatInstruction(numPrompts);
 
 const systemInstruction = `${baseInstruction}\n${formatInstruction}`;
 
 const contents = `Analyze the entire video by identifying key scenes, transitions, and every relevant visible human subject in each scene. Then, provide EXACTLY ${numPrompts} dynamic video prompts based on the system instructions, returning a JSON array.`;

 return { systemInstruction, contents };
};


export const buildVideoPrompt = (videoData: { data: string; mimeType: string }, settings: UseSettingsReturn, isQuick: boolean) => {
 const videoPart = {
 inlineData: {
 mimeType: videoData.mimeType,
 data: videoData.data
 }
 };

 let systemInstruction: string, textContent: string;
 let schema: object = promptListSchema;

 // Video mode is now locked to 'footage' style. We directly use the improved footage prompt builder.
 ({ systemInstruction, contents: textContent } = buildVideoFootageAnalysisPrompt(settings.negativePrompt, settings.numPrompts));
 schema = footageListSchema;

 const textPart = { text: textContent };
 const contents = { parts: [videoPart, textPart] };
 const config: any = {
 systemInstruction,
 responseMimeType: 'application/json',
        responseSchema: schema,
    };
    applyQuickGenerateConfig(config, settings.selectedModel, isQuick);
    
    return { contents, config };
};
