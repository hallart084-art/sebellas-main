const fs = require('fs');
let content = fs.readFileSync('lib/prompts.ts', 'utf-8');

const engine01 = `export const getFlatIllustrationZeroPointOneIdeationEngine = () => {
  return \`1. 🎯 **MASTER PROMPT FORMULA & THEME DECONSTRUCTION**:
   - The user provides a THEME. Treat the theme as a broad visual umbrella, then develop it into specific, commercially useful microstock illustration concepts.
   - The theme must NOT simply be repeated. Expand it into concrete subjects, roles, categories, activities, props, poses, movements, expressions, and visual contexts.
   - **MANDATORY PROMPT FORMULA**: [SUBJECT] + [SPECIFIC ACTIVITY] + [SUPPORTING PROPS] + [POSE / MOVEMENT] + [EXPRESSION] + [VISUAL CONCEPT]
   - Write the visual concept first, then append the MASTER STYLE naturally at the end (the system will append the suffix automatically).
   
2. **CONCEPT DEVELOPMENT RULES**:
   - Always identify the subject explicitly. Do not use vague phrases such as "a character related to the theme."
   - Develop the theme into different specific subjects and categories (e.g. Theme "Animal Mascot" -> "fox designer", "panda teacher", "bear chef").
   - **Animal Mascot**: Always combine the animal with a clear role, profession, or subject.
   - **Sports Athlete**: Use HUMAN ATHLETES ONLY unless requested otherwise. Clearly identify the sport and athletic activity (e.g. basketball athlete, soccer athlete, tennis player).
   - Do NOT automatically add the word "Professional" at the beginning (unless requested). Start directly with the specific subject (e.g. "Farmer planting tomato seedlings...").
   - Every concept should contain a specific activity or action. Avoid static and generic descriptions.
   - Vary the concepts through: subject type, profession, category, activity, tools, equipment, props, pose, movement, body position, facial expression, visual situation.
   - Supporting props must strengthen the main concept. Avoid random decorative objects. Props and screens must remain BLANK (zero text/logos).
   - Avoid repetitive concepts. Each prompt should provide a meaningful visual variation.
   - Keep the composition visually clean, simple, and easy to isolate. Do not add unnecessary background elements, environmental clutter, tiny decorative details, or complex textures.
   - Do not introduce animals into human-only themes (athletes, workers, doctors, etc) unless explicitly requested.\`;
};

`;

content = content.replace(
  'const getUniversalMicrostockIdeationEngine = (isVector: boolean, isFlatObject: boolean = false) => {',
  engine01 + 'const getUniversalMicrostockIdeationEngine = (isVector: boolean, isFlatObject: boolean = false) => {'
);

const suffix01 = `export const getFlatIllustrationZeroPointOneSuffix = (whiteBg: boolean = true) => {
  const bgClause = whiteBg
    ? "isolated on solid single-color pure white background, solid white background, no floor, no ground line, zero gradients, no gradients"
    : "isolated on solid single-color soft pastel background, no floor, no ground line, zero gradients, no gradients";

  return \`flat illustration style, strictly lineless vector art, no outlines, zero strokes, bold high-contrast flat cel shading, strong pronounced hard-edge shadows, ultra-vibrant sharp cheerful color palette with saturated azure blue and radiant bright orange, clean simplified solid color shapes, no tiny micro-details, no intricate textures, no small surface icons or decals, blank clean screens and props, stylized chunky rounded anatomy, \${bgClause}, no fake lighting, zero glow, no lens flare, no artificial lighting glare, no text, zero typography, no words, no letters, no watermark, no signatures, no labels, no noise, no photorealism, no 3d render.\`;
};

`;

content = content.replace(
  'export const FLAT_ILLUSTRATION_SUFFIX = getFlatIllustrationSuffix(true);',
  suffix01 + 'export const FLAT_ILLUSTRATION_SUFFIX = getFlatIllustrationSuffix(true);'
);

content = content.replace(
  /if \(chosenStyle\.includes\('negative space'\)\) \{\s*return getNegativeSpaceCutoutSuffix\(whiteBg\);\s*\}/,
  `if (chosenStyle.includes('negative space')) {\n    return getNegativeSpaceCutoutSuffix(whiteBg);\n  }\n  if (chosenStyle === 'flat illustration 0.1') {\n    return getFlatIllustrationZeroPointOneSuffix(whiteBg);\n  }`
);

content = content.replace(
  'const isFlatObjectIllustration = chosenStyle.includes(\'flat object illustration\');',
  'const isFlatObjectIllustration = chosenStyle.includes(\'flat object illustration\');\n  const isFlatIllustration01 = chosenStyle === \'flat illustration 0.1\';'
);

content = content.replace(
  '${getUniversalMicrostockIdeationEngine(true, isFlatObjectIllustration)}',
  '${isFlatIllustration01 ? getFlatIllustrationZeroPointOneIdeationEngine() : getUniversalMicrostockIdeationEngine(true, isFlatObjectIllustration)}'
);

fs.writeFileSync('lib/prompts.ts', content, 'utf-8');
console.log('done');
