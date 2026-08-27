
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
  if (!negativePrompt.trim()) return '';
  return `CONTENT RESTRICTIONS (apply silently — do NOT write these rules or any reasoning about them in your output):
The following concepts are strictly forbidden. Never include them, their synonyms, related terms, or derivative concepts anywhere in your generated prompts. If a forbidden concept is central to the subject, replace it with a thematically similar alternative. Apply this restriction invisibly — your output must only contain the final prompt text, nothing else.
Forbidden: ${negativePrompt.trim()}

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
    ? "isolated on solid single-color pure white background, solid white background, no floor, no ground line, zero gradients"
    : "isolated on solid single-color soft pastel background, no floor, no ground line, zero gradients";

  return `flat illustration style, strictly lineless vector art, no outlines, zero strokes, bold high-contrast flat cel shading, strong pronounced hard-edge shadows, ultra-vibrant sharp cheerful color palette with saturated azure blue and radiant bright orange, clean simplified solid color shapes, no tiny micro-details, no intricate textures, no small surface icons or decals, blank clean screens and props, stylized chunky rounded anatomy, ${bgClause}, modern microstock graphic asset, no complex gradients, no noise, no photorealism, no 3d render.`;
};

export const FLAT_ILLUSTRATION_SUFFIX = getFlatIllustrationSuffix(true);

export const getMonolineVectorSuffix = (whiteBg: boolean = true) => {
  const bgClause = whiteBg
    ? "perfectly isolated on solid pure white background, zero color background, pure white canvas"
    : "perfectly isolated on clean solid background";

  return `minimalist monoline vector art, continuous uniform single-weight black outline strokes, clean geometric linework, simplified abstract contour shapes, pure black and white line art, no colors, no fills, zero shading, zero gradients, no complex micro-textures, ${bgClause}, modern microstock graphic icon style, clean vector contour.`;
};

export const MONOLINE_VECTOR_SUFFIX = getMonolineVectorSuffix(true);

export const getGeometricSilhouetteSuffix = (whiteBg: boolean = true) => {
  const colorClause = whiteBg
    ? "strictly two colors only, solid black silhouette on solid pure white background, pure white canvas, zero color"
    : "strictly two colors only, solid white silhouette on solid pure black background, pure black canvas, zero color";

  return `geometric silhouette vector art, minimalist solid flat shape logo mark, bold solid vector masses, simple minimal elegant design, sharp planar facet cuts, clean aerodynamic contours, high-contrast black and white graphic emblem, ${colorClause}, no tiny micro-details, no intricate textures, zero outlines, zero strokes, zero line art, zero shading, zero gradients, clean modern icon asset.`;
};

export const GEOMETRIC_SILHOUETTE_SUFFIX = getGeometricSilhouetteSuffix(true);

export const getNegativeSpaceCutoutSuffix = (whiteBg: boolean = true) => {
  const colorClause = whiteBg
    ? "strictly two colors only, solid black and white, solid black subject on solid pure white background, pure white canvas, zero color"
    : "strictly two colors only, solid white on solid pure black background, pure black canvas, zero color";

  return `negative space vector art, clever negative space cutout logo emblem, dual-tone optical illusion graphic mark, subject facial features and lighting carved from solid negative space, simple minimal elegant design, clean geometric badge framing, pure black and white dual-tone, ${colorClause}, no tiny micro-details, no intricate textures, strictly solid flat shapes, zero outlines, zero strokes, zero gradients, zero shadows, clean corporate vector icon.`;
};

export const NEGATIVE_SPACE_CUTOUT_SUFFIX = getNegativeSpaceCutoutSuffix(true);

export const getActiveVectorSuffix = (artStyle?: string, whiteBg: boolean = true): string => {
  const chosenStyle = (artStyle || '').toLowerCase();
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

const buildVectorTextPrompt = (
  negativePrompt: string,
  numPrompts: number,
  artStyle?: string,
  preset?: string,
  pose?: string,
  attributes?: string,
  whiteBg?: boolean
) => {
  const chosenStyle = artStyle || 'Flat illustration';
  const chosenPreset = preset || 'Single Image';
  const isWhiteBg = whiteBg ?? true;

  const isMonolineVector = chosenStyle.toLowerCase().includes('monoline');
  const isGeometricSilhouette = chosenStyle.toLowerCase().includes('geometric silhouette');
  const isNegativeSpaceCutout = chosenStyle.toLowerCase().includes('negative space');
  const isFlatIllustration = chosenStyle.toLowerCase().includes('flat illustration');

  let activeSuffix = '';
  let styleRules = '';

  if (isMonolineVector) {
    activeSuffix = getMonolineVectorSuffix(isWhiteBg);
    styleRules = `MANDATORY PROMPT STRUCTURE & SUFFIX RULES (MONOLINE GEOMETRIC VECTOR):
1. **LINE ART & UNIFORM STROKES**: Strictly continuous uniform single-weight black outline strokes. Clean, consistent stroke thickness throughout the entire artwork without calligraphic tapering, without hatching, without rough sketch lines.
2. **GEOMETRIC & ABSTRACT COMPOSITION**: Abstract and deconstruct the concept into clean geometric contour shapes (arcs, circles, polygonal facets, clean linear silhouettes). Keep the composition balanced, stylized, and iconic.
3. **COLOR & SHADING**: Strictly black line art on pure solid white background. No colors, no color fills, zero shading, zero cel shadows, zero gradients.
4. **BACKGROUND**: The subject MUST be cleanly isolated on a solid pure white background with zero background clutter, zero floor lines, and zero noise.
5. **MANDATORY SUFFIX**: Every single prompt MUST end with this exact paten suffix:
   "${activeSuffix}"

FEW-SHOT EXAMPLES:
- "wolf head" -> "A stylized geometric wolf head composed of symmetrical arched clean black lines and sharp polygonal facets, ${activeSuffix}"
- "desert landscape" -> "A minimalist desert landscape inside an arch frame with simplified rolling dunes, a geometric sun with straight radiant rays, and a stylized single palm tree, ${activeSuffix}"
- "coffee and plants" -> "A minimalist continuous line composition of a coffee cup with rising steam beside a stylized geometric monstera leaf in a clean vase, ${activeSuffix}"
- "elephant" -> "A stylized geometric elephant in profile view constructed with clean continuous curved black outlines and arch lines, ${activeSuffix}"`;
  } else if (isGeometricSilhouette) {
    activeSuffix = getGeometricSilhouetteSuffix(isWhiteBg);
    const subjectColor = isWhiteBg ? 'solid black' : 'solid white';
    const bgColor = isWhiteBg ? 'pure white' : 'pure black';
    styleRules = `MANDATORY PROMPT STRUCTURE & SUFFIX RULES (GEOMETRIC SILHOUETTE):
1. **STRICT TWO-COLOR BLACK AND WHITE ONLY (ZERO OTHER COLORS)**: Every prompt MUST strictly use only 2 colors: ${subjectColor} subject on ${bgColor} background. Absolutely NO third color, no yellow, no red, no blue, no gray tones.
2. **SIMPLE, MINIMALIST & ELEGANT (NO TINY DETAILS)**: Focus on bold, clean, sweeping vector masses with sharp planar facet cuts and clean aerodynamic contours. STRICTLY AVOID tiny micro-details, complex textures, small specks, or decorative clutter.
3. **STRICTLY LINELESS (ZERO STROKES)**: Absolutely NO outlines, NO strokes, NO line art, NO hatching. Every shape is a solid flat color block.
4. **MANDATORY SUFFIX**: Every single prompt MUST end with this exact paten suffix:
   "${activeSuffix}"

FEW-SHOT EXAMPLES:
- "wolf" -> "A stylized ${subjectColor} wolf in dynamic stalking profile with raised paw and sharp geometric fur facets on ${bgColor} background, ${activeSuffix}"
- "leaping lion" -> "A bold ${subjectColor} leaping lion silhouette in full stride with sharp geometric mane facets and dynamic angular leg joints on ${bgColor} background, ${activeSuffix}"
- "warrior chieftain" -> "A noble side-profile silhouette of a ${subjectColor} warrior chieftain wearing a tiered geometric feather headdress composed of clean angular wedge shapes on ${bgColor} background, ${activeSuffix}"
- "unicorn" -> "A graceful leaping ${subjectColor} unicorn silhouette with a sharp spiraled horn and stylized sweeping aerodynamic mane facets on ${bgColor} background, ${activeSuffix}"`;
  } else if (isNegativeSpaceCutout) {
    activeSuffix = getNegativeSpaceCutoutSuffix(isWhiteBg);
    const subjectColor = isWhiteBg ? 'solid black' : 'solid white';
    const bgColor = isWhiteBg ? 'pure white' : 'pure black';
    styleRules = `MANDATORY PROMPT STRUCTURE & SUFFIX RULES (NEGATIVE SPACE CUTOUT):
1. **STRICT TWO-COLOR BLACK AND WHITE ONLY (ZERO OTHER COLORS)**: Every prompt MUST strictly use only 2 colors: ${subjectColor} and ${bgColor}. If subject is black, background is white. If subject is white, background is black. Absolutely NO third color, no yellow, no red, no blue, no gray tones.
2. **SIMPLE, MINIMALIST & ELEGANT (NO TINY DETAILS)**: Focus on bold, clean geometric shapes. Clever negative space cutouts for major facial features, lighting, or silhouettes. STRICTLY AVOID tiny micro-details, complex textures, small specks, or decorative clutter.
3. **BADGE & FRAME INTEGRATION**: Seamlessly integrate the subject inside a clean geometric silhouette or framing (e.g. solid circular badge, rounded square tile, or silhouette frame).
4. **STRICTLY LINELESS (ZERO STROKES)**: Strictly flat solid fills and negative space cuts, zero outlines, zero strokes, zero gradients, zero shadows.
5. **MANDATORY SUFFIX**: Every single prompt MUST end with this exact paten suffix:
   "${activeSuffix}"

FEW-SHOT EXAMPLES:
- "lion head" -> "A fierce ${subjectColor} lion head emblem centered inside a solid circular badge, where the nose, muzzle, eyes, and mane highlights are ingeniously carved from negative space cutouts on ${bgColor} background, ${activeSuffix}"
- "heron bird" -> "An elegant ${subjectColor} silhouette of a heron bird in flight seamlessly integrated inside a rounded square frame, with streamlined wing feathers formed by negative space slices on ${bgColor} background, ${activeSuffix}"
- "bearded god" -> "A majestic bust profile of a bearded Greek god inside a solid circular emblem, with hair locks, chiseled brow, and deep jaw shadows sharply carved out through negative space on ${bgColor} background, ${activeSuffix}"
- "statue of liberty" -> "A low-angle head emblem of the Statue of Liberty, with the face, eyes, and crown spikes defined purely through high-contrast negative space shadow cuts on ${bgColor} background, ${activeSuffix}"`;
  } else if (isFlatIllustration) {
    activeSuffix = getFlatIllustrationSuffix(isWhiteBg);
    styleRules = `MANDATORY PROMPT STRUCTURE & SUFFIX RULES (FLAT ILLUSTRATION):
1. **ANATOMY & PROPORTIONS**: Simplified chunky rounded anatomy, clean stylized shapes, non-intricate body features, simple friendly facial expressions.
2. **NO MICRO-DETAILS**: Absolutely DO NOT include tiny badges, small icons, stickers, decals, complex UI charts, graphs, or text on props or surfaces. All props, helmets, laptops, and screens must be solid, blank, and minimalistic.
3. **COLOR & SHADING**: Colors must be ultra-vibrant, sharp, and cheerful with saturated azure blue and radiant bright orange accents. Shading must be bold, clean-cut, hard-edge 2-tone flat shadow shapes. Strictly zero outlines/strokes.
4. **SOLID SINGLE-COLOR BACKGROUND (STRICT)**: The background MUST be a single flat solid color with NO floor, NO ground surface, NO floor line, NO scenery, and ZERO gradients. The subject must be cleanly isolated on this single solid background.
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
- Every prompt must strictly follow "${chosenStyle}" with clean 2D vector styling, bold simplified shapes, and vivid color schemes.
- Strictly no photorealism, camera metadata, or 3D noise.`;
  }

  return `${buildNegativePromptInstruction(negativePrompt)}You are a world-class AI prompt engineer and visionary creative director specializing in 2D vector art and commercial microstock graphic assets.
Your task is to take the user's concept and generate EXACTLY ${numPrompts} unique, wildly creative, and intellectually rich 2D prompts in English, returned as a JSON array.

CRITICAL CREATIVE INTELLIGENCE & BROAD HORIZON DIVERSIFICATION RULES:
1. **WILD LATERAL THINKING & NON-CLICHÉ PERSPECTIVES**:
   - Act as an exceptionally imaginative, smart creative assistant. Break far away from boring, generic, or repetitive clichés!
   - For ANY concept (e.g. "natal/christmas", "animals", "coffee", "technology", "professions", "sports", "nature", "food", "lifestyle"):
     * Unpack 10 completely diverse, vibrant visual narratives and micro-scenes across the prompts.
     * Explore varied scene contexts: cozy atmospheric indoor moments, dynamic outdoor activities, intricate craft/workshops, joyful celebrations, serene nature encounters, and abstract geometric focal emblems.
     * If theme is a category/collection: Feature a **distinct, iconic entity/species/job** for EVERY prompt (e.g. for Christmas: gingerbread baker, retro postal bicycle in snow, Scandinavian cabin window with knitted stocking, geometric reindeer in birch woods, brass band choir musician, minimalist hot cocoa flatlay, star of Bethlehem archway).
     * If theme is a single specific subject: Wildly vary the perspective, action dynamics, emotional energy, lighting mood, and interaction with props.
2. **MULTI-ANGLE & COMPOSITIONAL DYNAMICS**:
   - Explore diverse viewpoints across prompts: dynamic low-angle silhouettes, intimate focal micro-details, elegant side-profile motions, high overhead flatlay arrangements, and symmetrical geometric emblem framings.
3. **STYLE-AWARE MORPHOLOGY & POSE**:
   - If **Flat illustration**: Describe subjects with chunky stylized rounded proportions, cheerful everyday micro-moments, and bold solid color props.
   - If **Monoline geometric vector**: Describe subjects with abstract geometric deconstruction, linear continuous contour arcs, polygonal facets, and clean symmetrical icon/emblem/archway framing.
   - If **Geometric silhouette**: Describe subjects as bold solid planar masses with sharp facet cuts, dynamic aerodynamic profiles, and clean contour silhouettes.
   - If **Negative space cutout**: Describe subjects with clever negative space facial/shadow cutouts and geometric badge framing (circular badge, rounded square tile, or silhouette frame).

Creative Configuration:
- Art Style: ${chosenStyle}
- Preset Format: ${chosenPreset}
${pose ? `- Target Pose: ${pose}` : '- Target Pose: Dynamically vary distinct actions, expressive gestures, and postures across prompts without repetition.'}
${attributes ? `- Target Attributes: ${attributes}` : '- Target Attributes: Keep props clean, solid, and simplified without intricate surface clutter.'}

${styleRules}

Core Output Rules:
1. **Process Concept**: Process the main concept and generate EXACTLY ${numPrompts} unique, imaginative prompts in English. NEVER ask questions, NEVER refuse, and NEVER output conversational text.
2. **JSON Output**: You MUST respond with a single, valid JSON array containing exactly ${numPrompts} strings. Do NOT include any other text, markdown, or code fences outside of the JSON array.
3. ${actionPoseInstruction}
4. ${plainPromptFormattingInstruction}
5. ${jsonStringSafetyInstruction}`;
};

export const buildTextPrompt = (concept: string, settings: UseSettingsReturn, isQuick: boolean) => {
  let systemInstruction: string;
  let schema: object = promptListSchema;
  const entropySeed = Math.random().toString(36).substring(2, 8);
  let contents = `Process the following concept: "${concept}" [Creative Horizon Seed: ${entropySeed} - Explore wild, non-cliché, highly imaginative, diverse multi-perspective angles]`;
  
  switch (settings.styleOption) {
    case 'isolated':
      systemInstruction = buildIsolatedTextPrompt(settings.negativePrompt, settings.numPrompts);
      break;
    case 'vector': {
      const chosenArtStyle = settings.vectorArtStyle || 'Flat illustration';
      const isWhiteBg = settings.vectorWhiteBg ?? true;
      const isMonoline = chosenArtStyle.toLowerCase().includes('monoline');
      const isGeometricSilhouette = chosenArtStyle.toLowerCase().includes('geometric silhouette');
      const isNegativeSpaceCutout = chosenArtStyle.toLowerCase().includes('negative space');
      
      let activeSuffix = getFlatIllustrationSuffix(isWhiteBg);
      if (isMonoline) activeSuffix = getMonolineVectorSuffix(isWhiteBg);
      else if (isGeometricSilhouette) activeSuffix = getGeometricSilhouetteSuffix(isWhiteBg);
      else if (isNegativeSpaceCutout) activeSuffix = getNegativeSpaceCutoutSuffix(isWhiteBg);

      systemInstruction = buildVectorTextPrompt(
        settings.negativePrompt,
        settings.numPrompts,
        chosenArtStyle,
        settings.vectorPreset,
        settings.vectorPose,
        settings.vectorAttributes,
        isWhiteBg
      );
      contents = `Process the concept: "${concept}" and generate EXACTLY ${settings.numPrompts} unique, wildly creative prompts in JSON array format. [Session Exploration Seed: ${entropySeed}]

CRITICAL DIVERSITY & FORMULA REQUIREMENT:
- Act as an ultra-smart, wildly creative assistant. Think broadly and laterally from unexpected angles, rich micro-moments, and diverse sub-entities.
- Every single prompt in the JSON array MUST strictly follow this exact structure:
"[AI EXPANDED MAIN CONCEPT WITH SPECIFIC POSE, SUBJECT, AND GEOMETRIC ACTIONS], ${activeSuffix}"

Return ONLY a valid JSON array of ${settings.numPrompts} strings.`;
      break;
    }
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
 
 const config: any = {
 systemInstruction,
 responseMimeType: 'application/json',
 responseSchema: schema,
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

const buildImageVectorAnalysisPrompt = (negativePrompt: string, numPrompts: number) => {
  const systemInstruction = `${buildNegativePromptInstruction(negativePrompt)}You are an expert AI visual analyst specializing in 2D vector graphic prompts.
Task: Analyze the image and generate EXACTLY ${numPrompts} unique vector illustration prompts based on the subject and composition.

Instructions:
1. **Analyze Subject**: Identify the core subjects, characters, objects, and silhouettes in the image.
2. **Translate to Vector Style**: Re-imagine the subject in clean 2D vector graphic art style: flat design, crisp vector outlines, smooth curves, stylized shapes, solid and gradient color fills, modern SVG sticker/asset aesthetic, clean background.
3. **No Photographic Elements**: Do not use camera lenses, focal lengths, ISO, shutter speed, realistic skin pores, or photorealistic terms.
4. **Consistency**: Maintain ancestry consistency for any visible human subjects across variations.
5. **JSON Output**: You MUST respond with a single, valid JSON array containing exactly ${numPrompts} strings. Do NOT include any other text, markdown, or code fences outside of the JSON array.
6. ${humanAncestryInstruction}
7. ${plainPromptFormattingInstruction}
8. ${jsonStringSafetyInstruction}`;

  const contents = `Analyze the image and generate EXACTLY ${numPrompts} vector illustration prompts based on the system instructions, returning a JSON array.\n\nRemember: Maintain strict ancestry consistency. Determine the precise ancestry for each human once, and apply that same description to all generated prompts in the array.`;
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
 ({ systemInstruction, contents: textContent } = buildImageVectorAnalysisPrompt(settings.negativePrompt, settings.numPrompts));
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
