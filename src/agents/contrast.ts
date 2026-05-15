// Tiny WCAG contrast utility used by the themeDesigner sub-agent to
// deterministically validate color pairs in the model's response. If any
// consequential pair (body text on background, button text on accent, etc.)
// falls below the AA threshold, themeDesigner re-runs once with the
// failures fed back into the prompt. Pure, no deps — kept separate so the
// math is testable / reusable.

export const WCAG_AA = 4.5;

export interface ColorPair {
  label: string;        // human-readable, e.g. "body text on background"
  fgVar: string;        // CSS var name, e.g. "--text-color"
  bgVar: string;        // CSS var name, e.g. "--bg-color"
}

export interface ContrastFailure {
  label: string;
  fgVar: string;
  fgValue: string;
  bgVar: string;
  bgValue: string;
  ratio: number;        // computed ratio (e.g. 2.13)
}

// Pairs we audit. Theme designer must produce values for every var named
// here, otherwise the audit silently skips that pair.
export const CRITICAL_PAIRS: ColorPair[] = [
  { label: 'body text on page background', fgVar: '--text-color', bgVar: '--bg-color' },
  { label: 'body text on dashboard card', fgVar: '--text-color', bgVar: '--card-bg' },
  { label: 'button label on primary button', fgVar: '--btn-text', bgVar: '--btn-bg' },
];

// Parse a CSS-vars dump like "--bg-color: #1a1a2e; --text-color: #f5f5f0; ..."
// into a flat record. Tolerant: ignores values it can't read (gradients,
// var() refs, etc.) by leaving them out of the result.
export function parseCssVars(cssText: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cssText)) !== null) {
    const name = match[1];
    const value = match[2].trim();
    out[name] = value;
  }
  return out;
}

// Audit a parsed CSS-vars map against CRITICAL_PAIRS. Returns only the
// pairs that fail. Pairs whose colors can't be resolved to RGB are skipped
// (we don't want to false-fail on a `rgba(...)` variant).
export function auditContrast(
  vars: Record<string, string>,
  pairs: ColorPair[] = CRITICAL_PAIRS,
  threshold: number = WCAG_AA,
): ContrastFailure[] {
  const failures: ContrastFailure[] = [];
  for (const pair of pairs) {
    const fgRaw = vars[pair.fgVar];
    const bgRaw = vars[pair.bgVar];
    if (!fgRaw || !bgRaw) continue;
    const fg = parseColor(fgRaw);
    const bg = parseColor(bgRaw);
    if (!fg || !bg) continue;
    // Composite fg over bg if it has alpha, since that's how the user
    // actually sees it. Same for bg if it has alpha (over white).
    const bgOpaque = bg.a < 1 ? compositeOver(bg, { r: 255, g: 255, b: 255, a: 1 }) : bg;
    const fgOpaque = fg.a < 1 ? compositeOver(fg, bgOpaque) : fg;
    const ratio = contrastRatio(fgOpaque, bgOpaque);
    if (ratio < threshold) {
      failures.push({
        label: pair.label,
        fgVar: pair.fgVar,
        fgValue: fgRaw,
        bgVar: pair.bgVar,
        bgValue: bgRaw,
        ratio,
      });
    }
  }
  return failures;
}

interface RGBA { r: number; g: number; b: number; a: number; }

function parseColor(raw: string): RGBA | null {
  const v = raw.trim().toLowerCase();
  // #rgb / #rrggbb / #rrggbbaa
  if (v.startsWith('#')) {
    const hex = v.slice(1);
    if (hex.length === 3) {
      const [r, g, b] = hex.split('').map((c) => parseInt(c + c, 16));
      return { r, g, b, a: 1 };
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b, a: 1 };
    }
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = parseInt(hex.slice(6, 8), 16) / 255;
      return { r, g, b, a };
    }
    return null;
  }
  // rgb(r, g, b) / rgba(r, g, b, a) — also handles modern "rgb(r g b / a)".
  const rgbMatch = v.match(/^rgba?\s*\(\s*([^)]+)\)$/);
  if (rgbMatch) {
    const parts = rgbMatch[1]
      .replace('/', ',')
      .split(',')
      .map((p) => p.trim());
    if (parts.length >= 3) {
      const r = parseChannel(parts[0]);
      const g = parseChannel(parts[1]);
      const b = parseChannel(parts[2]);
      const a = parts[3] !== undefined ? parseAlpha(parts[3]) : 1;
      if (r !== null && g !== null && b !== null && a !== null) {
        return { r, g, b, a };
      }
    }
    return null;
  }
  // hsl is rare in these themes; skip rather than mis-parse.
  return null;
}

function parseChannel(raw: string): number | null {
  if (raw.endsWith('%')) {
    const n = parseFloat(raw.slice(0, -1));
    return isNaN(n) ? null : Math.round((n / 100) * 255);
  }
  const n = parseFloat(raw);
  return isNaN(n) ? null : Math.round(n);
}

function parseAlpha(raw: string): number | null {
  if (raw.endsWith('%')) {
    const n = parseFloat(raw.slice(0, -1));
    return isNaN(n) ? null : n / 100;
  }
  const n = parseFloat(raw);
  return isNaN(n) ? null : n;
}

function compositeOver(top: RGBA, bottom: RGBA): RGBA {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: Math.round((top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a),
    g: Math.round((top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a),
    b: Math.round((top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a),
    a,
  };
}

function relativeLuminance(c: RGBA): number {
  const channel = (v: number) => {
    const sc = v / 255;
    return sc <= 0.03928 ? sc / 12.92 : Math.pow((sc + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

function contrastRatio(a: RGBA, b: RGBA): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
