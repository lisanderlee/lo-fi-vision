/**
 * Parse multiverse theme colors, enforce minimum contrast on text/button pairs, serialize :root-ready css string.
 */

import type { ThemePaletteHex } from "./types";

const MIN_RATIO_BODY = 4.5;
const MIN_RATIO_UI = 3.1;

const DEFAULTS: Record<string, string> = {
  "--bg-color": "#fdfbf7",
  "--text-color": "#2d2a26",
  "--card-bg": "#ffffff",
  "--accent-color": "#1a4d2e",
  "--accent-color-2": "#d4a373",
  "--btn-bg": "#1a4d2e",
  "--btn-text": "#fdfbf7",
  "--ui-radius": "12px",
  "--card-shadow": "0 10px 30px -10px rgba(0, 0, 0, 0.12)",
  "--divider-color": "rgba(15, 15, 15, 0.08)",
  "--font-family": "'Inter', ui-sans-serif, system-ui, sans-serif",
  "--display-font": "'Libre Baskerville', serif",
  "--heading-font": "'Playfair Display', serif",
};

const ORDER = [
  "--bg-color",
  "--text-color",
  "--card-bg",
  "--accent-color",
  "--accent-color-2",
  "--btn-bg",
  "--btn-text",
  "--ui-radius",
  "--card-shadow",
  "--divider-color",
  "--font-family",
  "--display-font",
  "--heading-font",
];

/** Exact stacks the app loads via Google Fonts; anything else falls back to DEFAULTS. */
const FONT_STACK_ALLOWLIST: Record<string, Set<string>> = {
  "--font-family": new Set([
    "'Inter', ui-sans-serif, system-ui, sans-serif",
    "'DM Sans', ui-sans-serif, system-ui, sans-serif",
    "'Nunito', ui-sans-serif, system-ui, sans-serif",
    "'Manrope', ui-sans-serif, system-ui, sans-serif",
    "'Source Sans 3', ui-sans-serif, system-ui, sans-serif",
  ]),
  "--heading-font": new Set([
    "'Playfair Display', serif",
    "'Libre Baskerville', serif",
    "'Fraunces', serif",
    "'Cormorant Garamond', serif",
    "'Spectral', serif",
    "'Lora', serif",
    "'Crimson Pro', serif",
  ]),
  "--display-font": new Set([
    "'Libre Baskerville', serif",
    "'Cormorant Garamond', serif",
    "'Spectral', serif",
    "'Lora', serif",
    "'Playfair Display', serif",
    "'Fraunces', serif",
    "'Crimson Pro', serif",
  ]),
};

function canonicalizeFontStack(s: string): string {
  return s
    .trim()
    .replace(/"/g, "'")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

/** First quoted family name, lowercased (e.g. playfair display); also handles unquoted first token. */
function primaryFamilyKey(stack: string): string | null {
  const canon = canonicalizeFontStack(stack);
  const m = canon.match(/'([^']+)'/);
  if (m?.[1]) return m[1].trim().toLowerCase();
  const first = canon.split(",")[0]?.trim();
  if (!first) return null;
  const unquoted = first.replace(/^["']|["']$/g, "").trim().toLowerCase();
  return unquoted || null;
}

function pickFromAllowlist(raw: string, key: "--font-family" | "--heading-font" | "--display-font"): string {
  const allow = FONT_STACK_ALLOWLIST[key];
  const n = canonicalizeFontStack(raw);
  if (allow.has(n)) return n;

  const incoming = primaryFamilyKey(n);
  if (incoming) {
    for (const opt of allow) {
      const optKey = primaryFamilyKey(opt);
      if (optKey && optKey === incoming) return opt;
    }
    for (const opt of allow) {
      const optKey = primaryFamilyKey(opt);
      if (optKey && (incoming.includes(optKey) || optKey.includes(incoming))) return opt;
    }
  }

  return DEFAULTS[key]!;
}

function sanitizeFontStacks(map: Map<string, string>) {
  for (const key of ["--font-family", "--heading-font", "--display-font"] as const) {
    const raw = map.get(key);
    if (!raw?.trim()) {
      map.set(key, DEFAULTS[key]!);
      continue;
    }
    map.set(key, pickFromAllowlist(raw, key));
  }
}

function parseHex(val: string): [number, number, number] | null {
  const s = val.trim();
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  const c = [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))));
  return "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
}

function relativeLuminance(rgb: [number, number, number]): number {
  const lin = rgb.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

/** HSL in [0,1]; preserves hue while adjusting lightness for accessible contrast. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  let s = 0;
  if (d > 1e-6) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return [h, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  let x = t;
  if (x < 0) x += 1;
  if (x > 1) x -= 1;
  if (x < 1 / 6) return p + (q - p) * 6 * x;
  if (x < 1 / 2) return q;
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s < 1e-6) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/**
 * Nudge foreground toward required contrast while keeping hue (and saturation) from the model.
 * Falls back to neutral anchors only if the sweep cannot reach minRatio (rare).
 */
function adjustForegroundForContrast(
  fg: [number, number, number],
  surface: [number, number, number],
  minRatio: number
): [number, number, number] {
  if (contrastRatio(fg, surface) >= minRatio) return fg;

  const Lsurf = relativeLuminance(surface);
  const needDarkText = Lsurf > 0.2;
  const [h, s0, l0] = rgbToHsl(fg[0], fg[1], fg[2]);
  const s = Math.max(s0, 0.08);

  if (needDarkText) {
    let lo = 0;
    let hi = l0;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      const cand = hslToRgb(h, s, mid);
      if (contrastRatio(cand, surface) >= minRatio) lo = mid;
      else hi = mid;
    }
    const adjusted = hslToRgb(h, s, lo);
    if (contrastRatio(adjusted, surface) >= minRatio) return adjusted;
  } else {
    let lo = l0;
    let hi = 1;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      const cand = hslToRgb(h, s, mid);
      if (contrastRatio(cand, surface) >= minRatio) hi = mid;
      else lo = mid;
    }
    const adjusted = hslToRgb(h, s, hi);
    if (contrastRatio(adjusted, surface) >= minRatio) return adjusted;
  }

  const fallback: [number, number, number] = needDarkText ? [26, 26, 26] : [245, 245, 245];
  let cur: [number, number, number] = [...fg] as [number, number, number];
  for (let i = 0; i < 24; i++) {
    if (contrastRatio(cur, surface) >= minRatio) return cur;
    cur = [
      cur[0] + (fallback[0] - cur[0]) * 0.28,
      cur[1] + (fallback[1] - cur[1]) * 0.28,
      cur[2] + (fallback[2] - cur[2]) * 0.28,
    ] as [number, number, number];
  }
  return fallback;
}

export function parseCssVariablesString(css: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /(--[\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const val = m[2].trim().replace(/\s*!important\s*$/i, "");
    map.set(m[1].trim(), val);
  }
  return map;
}

function applyThemeToMap(theme: Partial<ThemePaletteHex> | undefined, map: Map<string, string>) {
  if (!theme) return;
  const set = (k: keyof ThemePaletteHex, cssKey: string) => {
    const v = theme[k];
    if (v !== undefined && String(v).trim()) map.set(cssKey, String(v).trim());
  };
  set("bg", "--bg-color");
  set("text", "--text-color");
  set("cardBg", "--card-bg");
  set("accent", "--accent-color");
  set("accent2", "--accent-color-2");
  set("btnBg", "--btn-bg");
  set("btnText", "--btn-text");
  set("uiRadius", "--ui-radius");
  set("cardShadow", "--card-shadow");
  set("dividerColor", "--divider-color");
}

function fillDefaults(map: Map<string, string>) {
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (!map.has(k) || !map.get(k)?.trim()) map.set(k, v);
  }
}

function repairMap(map: Map<string, string>) {
  const fixPair = (textKey: string, surfaceKey: string, minRatio: number) => {
    const t = map.get(textKey);
    const s = map.get(surfaceKey);
    if (!t || !s) return;
    const tc = parseHex(t);
    const sc = parseHex(s);
    if (!tc || !sc) return;
    if (contrastRatio(tc, sc) >= minRatio) return;
    const fixed = adjustForegroundForContrast(tc, sc, minRatio);
    map.set(textKey, toHex(fixed));
  };

  fixPair("--text-color", "--bg-color", MIN_RATIO_BODY);
  fixPair("--text-color", "--card-bg", MIN_RATIO_BODY);
  fixPair("--btn-text", "--btn-bg", MIN_RATIO_UI);
}

export function serializeCssVariableMap(map: Map<string, string>): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const key of ORDER) {
    if (map.has(key)) {
      parts.push(`${key}: ${map.get(key)};`);
      seen.add(key);
    }
  }
  for (const [k, v] of map) {
    if (!seen.has(k)) parts.push(`${k}: ${v};`);
  }
  return parts.join(" ");
}

/**
 * Merge optional structured theme + cssVariables string, default missing keys, repair contrast, return css string for :root.
 */
export function processMultiverseThemeCss(input: {
  cssVariables?: string;
  theme?: Partial<ThemePaletteHex>;
}): string {
  let map = input.cssVariables ? parseCssVariablesString(input.cssVariables) : new Map();
  applyThemeToMap(input.theme, map);
  fillDefaults(map);
  repairMap(map);
  sanitizeFontStacks(map);
  return serializeCssVariableMap(map);
}
