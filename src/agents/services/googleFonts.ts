// Curated Google Fonts catalog used by the orchestrator's `list_fonts` tool
// and by `themeDesigner` as the enum constraint on font picks.
//
// Why a curated list instead of the live Google Fonts API:
// - No extra API key needed (Google Fonts Developer API requires its own).
// - The catalog has ~1,800 families, most of which are subtle variants of
//   each other; vetted picks produce more dramatic outputs by construction.
// - The enum on `themeDesigner`'s response schema forbids hallucinated names.
//
// Add a font: include it here with a `category` and a few short `vibes` tags.
// `vibes` is what the fuzzy `query` filter in `searchFonts` matches against.
//
// Keep this file dependency-free — it's pulled into the bundle.

export type FontCategory =
  | 'sans-serif'
  | 'serif'
  | 'display'
  | 'monospace'
  | 'handwriting'
  | 'decorative';

export interface FontEntry {
  family: string;
  category: FontCategory;
  vibes: string[];
}

export const FONT_CATALOG: FontEntry[] = [
  // Modern sans-serif — clean, tech-forward defaults.
  { family: 'Inter', category: 'sans-serif', vibes: ['modern', 'clean', 'minimal', 'tech'] },
  { family: 'Space Grotesk', category: 'sans-serif', vibes: ['modern', 'tech', 'clean', 'futuristic'] },
  { family: 'DM Sans', category: 'sans-serif', vibes: ['modern', 'clean', 'editorial'] },
  { family: 'Manrope', category: 'sans-serif', vibes: ['modern', 'clean'] },
  { family: 'Outfit', category: 'sans-serif', vibes: ['modern', 'clean', 'geometric'] },
  { family: 'Plus Jakarta Sans', category: 'sans-serif', vibes: ['modern', 'clean'] },
  { family: 'Work Sans', category: 'sans-serif', vibes: ['modern', 'clean'] },
  { family: 'Albert Sans', category: 'sans-serif', vibes: ['modern', 'clean', 'humanist'] },

  // Editorial / classical serif.
  { family: 'Playfair Display', category: 'serif', vibes: ['editorial', 'elegant', 'fashion', 'magazine'] },
  { family: 'EB Garamond', category: 'serif', vibes: ['classical', 'elegant', 'literary', 'historical'] },
  { family: 'Cormorant Garamond', category: 'serif', vibes: ['elegant', 'fashion', 'editorial', 'romantic'] },
  { family: 'Cinzel', category: 'serif', vibes: ['roman', 'historical', 'epic', 'classical', 'fantasy'] },
  { family: 'Italiana', category: 'serif', vibes: ['fashion', 'elegant', 'editorial', 'thin'] },
  { family: 'DM Serif Display', category: 'serif', vibes: ['editorial', 'elegant', 'modern serif'] },
  { family: 'Fraunces', category: 'serif', vibes: ['editorial', 'modern serif', 'fashion', 'expressive'] },
  { family: 'Spectral', category: 'serif', vibes: ['editorial', 'modern serif', 'literary'] },
  { family: 'Lora', category: 'serif', vibes: ['editorial', 'literary'] },
  { family: 'Crimson Pro', category: 'serif', vibes: ['literary', 'classical'] },
  { family: 'Marcellus', category: 'serif', vibes: ['classical', 'roman', 'elegant'] },
  { family: 'Libre Baskerville', category: 'serif', vibes: ['literary', 'classical'] },
  { family: 'Instrument Serif', category: 'serif', vibes: ['editorial', 'elegant', 'expressive'] },

  // Bold & display — for hero/dramatic typography.
  { family: 'Orbitron', category: 'display', vibes: ['futuristic', 'sci-fi', 'cyberpunk', 'tech', 'space'] },
  { family: 'Audiowide', category: 'display', vibes: ['retro', 'futuristic', '80s', 'arcade', 'neon'] },
  { family: 'Russo One', category: 'display', vibes: ['bold', 'sport', 'modern'] },
  { family: 'Michroma', category: 'display', vibes: ['futuristic', 'wide', 'sci-fi', 'tech'] },
  { family: 'Monoton', category: 'display', vibes: ['retro', '80s', 'neon', 'vintage', 'art deco'] },
  { family: 'Faster One', category: 'display', vibes: ['speed', 'racing', 'bold', 'arcade'] },
  { family: 'Black Ops One', category: 'display', vibes: ['military', 'rugged', 'stencil'] },
  { family: 'Bebas Neue', category: 'display', vibes: ['bold', 'condensed', 'editorial', 'sport', 'punchy'] },
  { family: 'Anton', category: 'display', vibes: ['bold', 'condensed', 'punchy'] },
  { family: 'Oswald', category: 'display', vibes: ['bold', 'condensed', 'editorial'] },
  { family: 'Archivo Black', category: 'display', vibes: ['bold', 'punchy'] },
  { family: 'Bowlby One', category: 'display', vibes: ['playful', 'chunky', 'bold', 'cartoon'] },
  { family: 'Alfa Slab One', category: 'display', vibes: ['bold', 'vintage', 'chunky', 'slab'] },
  { family: 'Big Shoulders Display', category: 'display', vibes: ['industrial', 'bold', 'condensed'] },
  { family: 'Bungee', category: 'display', vibes: ['urban', 'bold', 'playful', 'street'] },
  { family: 'Bungee Inline', category: 'display', vibes: ['urban', 'bold', 'playful', 'outline'] },
  { family: 'Bungee Shade', category: 'display', vibes: ['urban', 'bold', 'playful', '3d'] },
  { family: 'Six Caps', category: 'display', vibes: ['condensed', 'narrow', 'editorial'] },
  { family: 'Limelight', category: 'display', vibes: ['art deco', 'vintage', 'broadway', 'theater'] },
  { family: 'Abril Fatface', category: 'display', vibes: ['editorial', 'fashion', 'magazine', 'bold serif'] },
  { family: 'Lobster', category: 'display', vibes: ['retro', 'casual', 'script', 'friendly'] },
  { family: 'Righteous', category: 'display', vibes: ['retro', 'art deco', '70s'] },
  { family: 'Major Mono Display', category: 'display', vibes: ['minimal', 'futuristic', 'mono'] },

  // Monospace / terminal / pixel.
  { family: 'JetBrains Mono', category: 'monospace', vibes: ['mono', 'code', 'tech'] },
  { family: 'Space Mono', category: 'monospace', vibes: ['mono', 'tech', 'minimal'] },
  { family: 'IBM Plex Mono', category: 'monospace', vibes: ['mono', 'tech', 'classical'] },
  { family: 'Fira Code', category: 'monospace', vibes: ['mono', 'code'] },
  { family: 'Source Code Pro', category: 'monospace', vibes: ['mono', 'code'] },
  { family: 'Share Tech Mono', category: 'monospace', vibes: ['mono', 'tech', 'futuristic', 'sci-fi', 'terminal'] },
  { family: 'VT323', category: 'monospace', vibes: ['terminal', 'retro', 'computer', 'crt', 'hacker'] },
  { family: 'Press Start 2P', category: 'monospace', vibes: ['8-bit', 'arcade', 'pixel', 'retro', 'gaming'] },
  { family: 'Pixelify Sans', category: 'monospace', vibes: ['pixel', 'gaming', 'retro'] },
  { family: 'Silkscreen', category: 'monospace', vibes: ['pixel', 'lo-fi', 'retro'] },

  // Handwritten / casual.
  { family: 'Caveat', category: 'handwriting', vibes: ['handwritten', 'casual', 'sketch'] },
  { family: 'Dancing Script', category: 'handwriting', vibes: ['handwritten', 'elegant', 'script'] },
  { family: 'Pacifico', category: 'handwriting', vibes: ['handwritten', 'casual', 'beach', 'retro', 'surf'] },
  { family: 'Permanent Marker', category: 'handwriting', vibes: ['handwritten', 'bold', 'graffiti', 'street'] },
  { family: 'Shadows Into Light', category: 'handwriting', vibes: ['handwritten', 'casual'] },
  { family: 'Kalam', category: 'handwriting', vibes: ['handwritten', 'casual'] },
  { family: 'Architects Daughter', category: 'handwriting', vibes: ['handwritten', 'sketch', 'blueprint'] },
  { family: 'Indie Flower', category: 'handwriting', vibes: ['handwritten', 'casual'] },
  { family: 'Special Elite', category: 'handwriting', vibes: ['typewriter', 'vintage', 'noir', 'retro'] },

  // Decorative / horror / gothic / western — high-drama display fonts.
  { family: 'Creepster', category: 'decorative', vibes: ['horror', 'halloween', 'spooky'] },
  { family: 'Nosifer', category: 'decorative', vibes: ['horror', 'gothic', 'blood'] },
  { family: 'Eater', category: 'decorative', vibes: ['horror', 'gothic', 'monster'] },
  { family: 'Butcherman', category: 'decorative', vibes: ['horror', 'gothic', 'spooky'] },
  { family: 'Pirata One', category: 'decorative', vibes: ['gothic', 'medieval', 'pirate'] },
  { family: 'Metal Mania', category: 'decorative', vibes: ['metal', 'gothic', 'horror', 'rock'] },
  { family: 'UnifrakturMaguntia', category: 'decorative', vibes: ['gothic', 'medieval', 'blackletter'] },
  { family: 'Almendra Display', category: 'decorative', vibes: ['gothic', 'fantasy', 'medieval'] },
  { family: 'Smokum', category: 'decorative', vibes: ['western', 'cowboy', 'wild west'] },
  { family: 'Rye', category: 'decorative', vibes: ['western', 'cowboy', 'wild west'] },
  { family: 'IM Fell English', category: 'decorative', vibes: ['historical', 'medieval', 'vintage'] },
  { family: 'Cinzel Decorative', category: 'decorative', vibes: ['epic', 'fantasy', 'classical'] },
  { family: 'Rubik Glitch', category: 'decorative', vibes: ['glitch', 'cyberpunk', 'distorted', 'broken'] },
  { family: 'Rubik Mono One', category: 'decorative', vibes: ['bold', 'mono', 'modern'] },
  { family: 'Rubik Burned', category: 'decorative', vibes: ['distorted', 'damaged', 'glitch'] },
  { family: 'Rubik Pixels', category: 'decorative', vibes: ['pixel', 'retro', 'gaming', 'glitch'] },
];

// Names always available to themeDesigner's enum, regardless of whether
// `list_fonts` was called this turn. Keeps the catalog closed-set without
// forcing the orchestrator to call list_fonts every run.
export const ALL_FONT_FAMILIES: string[] = FONT_CATALOG.map((f) => f.family);

export interface SearchFontsArgs {
  category?: FontCategory;
  query?: string;
  limit?: number;
}

export interface FontSearchHit {
  family: string;
  category: FontCategory;
  vibes: string[];
}

// Pure local search over FONT_CATALOG. Filters by category and ranks by how
// many query tokens match family-name or vibes tags. Deterministic.
export function searchFonts(args: SearchFontsArgs): FontSearchHit[] {
  const limit = Math.max(1, Math.min(args.limit ?? 20, 50));
  const tokens = (args.query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  let pool = FONT_CATALOG;
  if (args.category) pool = pool.filter((f) => f.category === args.category);

  if (tokens.length === 0) {
    return pool.slice(0, limit);
  }

  const scored = pool
    .map((f) => {
      const haystack = [f.family.toLowerCase(), ...f.vibes];
      let score = 0;
      for (const token of tokens) {
        if (haystack.some((h) => h.includes(token))) score += 1;
      }
      return { entry: f, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);

  // If literally nothing matched the query, fall back to category-only
  // results so the model sees something useful instead of an empty list.
  return scored.length > 0 ? scored : pool.slice(0, limit);
}

// Tracks which font families have already had a <link> injected so we
// don't append duplicate stylesheet requests on rapid re-shifts.
const _loadedFonts = new Set<string>();

export interface GoogleFontLoadReq {
  family: string;
  weights?: number[];
  italic?: boolean;
}

/**
 * Idempotently inject a Google Fonts <link> tag for each requested family.
 * Safe to call in the browser only (no-ops in SSR / test environments).
 */
export function loadGoogleFonts(fonts: GoogleFontLoadReq[]): void {
  if (typeof document === 'undefined') return;

  for (const req of fonts) {
    const key = req.family;
    if (_loadedFonts.has(key)) continue;
    _loadedFonts.add(key);

    const weights = req.weights && req.weights.length > 0 ? req.weights : [400, 700];
    const familyParam = req.family.replace(/ /g, '+');

    // Build ital,wght axis descriptor: "0,400;0,700;1,400;1,700"
    const axes: string[] = [];
    for (const w of weights) {
      axes.push(`0,${w}`);
    }
    if (req.italic) {
      for (const w of weights) {
        axes.push(`1,${w}`);
      }
    }
    axes.sort();

    const href = `https://fonts.googleapis.com/css2?family=${familyParam}:ital,wght@${axes.join(';')}&display=swap`;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }
}
