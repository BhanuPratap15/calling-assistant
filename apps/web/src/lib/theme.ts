/**
 * White-label theme: har client ka brand rang + sidebar style.
 * Server (root layout) isse CSS variables banata hai → page pehli paint se hi client ke rang me
 * (koi "flash" nahi). Components `indigo-*` classes use karte hain jo --brand-* se aati hain.
 *
 * Naya preset = yahan ek entry + API ke THEME_PRESETS (apps/api/src/platform/platform.constants.ts).
 */
export type Shade =
  50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
export type Palette = Record<Shade, string>;

const SHADES: Shade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const p = (...hex: string[]): Palette =>
  Object.fromEntries(SHADES.map((s, i) => [s, hex[i]])) as Palette;

export const THEME_PRESETS: Record<
  string,
  { label: string; palette: Palette }
> = {
  violet: {
    label: 'Royal violet',
    palette: p(
      '#f5f3ff',
      '#ede9fe',
      '#ddd6fe',
      '#c4b5fd',
      '#a48afb',
      '#8662f6',
      '#6e44eb',
      '#5b33d1',
      '#4b2aab',
      '#3e258a',
      '#26155e',
    ),
  },
  indigo: {
    label: 'Indigo',
    palette: p(
      '#eef2ff',
      '#e0e7ff',
      '#c7d2fe',
      '#a5b4fc',
      '#818cf8',
      '#6366f1',
      '#4f46e5',
      '#4338ca',
      '#3730a3',
      '#312e81',
      '#1e1b4b',
    ),
  },
  blue: {
    label: 'Ocean blue',
    palette: p(
      '#eff6ff',
      '#dbeafe',
      '#bfdbfe',
      '#93c5fd',
      '#60a5fa',
      '#3b82f6',
      '#2563eb',
      '#1d4ed8',
      '#1e40af',
      '#1e3a8a',
      '#172554',
    ),
  },
  sky: {
    label: 'Sky',
    palette: p(
      '#f0f9ff',
      '#e0f2fe',
      '#bae6fd',
      '#7dd3fc',
      '#38bdf8',
      '#0ea5e9',
      '#0284c7',
      '#0369a1',
      '#075985',
      '#0c4a6e',
      '#082f49',
    ),
  },
  teal: {
    label: 'Teal',
    palette: p(
      '#f0fdfa',
      '#ccfbf1',
      '#99f6e4',
      '#5eead4',
      '#2dd4bf',
      '#14b8a6',
      '#0d9488',
      '#0f766e',
      '#115e59',
      '#134e4a',
      '#042f2e',
    ),
  },
  emerald: {
    label: 'Emerald',
    palette: p(
      '#ecfdf5',
      '#d1fae5',
      '#a7f3d0',
      '#6ee7b7',
      '#34d399',
      '#10b981',
      '#059669',
      '#047857',
      '#065f46',
      '#064e3b',
      '#022c22',
    ),
  },
  green: {
    label: 'Fresh green',
    palette: p(
      '#f0fdf4',
      '#dcfce7',
      '#bbf7d0',
      '#86efac',
      '#4ade80',
      '#22c55e',
      '#16a34a',
      '#15803d',
      '#166534',
      '#14532d',
      '#052e16',
    ),
  },
  amber: {
    label: 'Amber',
    palette: p(
      '#fffbeb',
      '#fef3c7',
      '#fde68a',
      '#fcd34d',
      '#fbbf24',
      '#f59e0b',
      '#d97706',
      '#b45309',
      '#92400e',
      '#78350f',
      '#451a03',
    ),
  },
  orange: {
    label: 'Sunset orange',
    palette: p(
      '#fff7ed',
      '#ffedd5',
      '#fed7aa',
      '#fdba74',
      '#fb923c',
      '#f97316',
      '#ea580c',
      '#c2410c',
      '#9a3412',
      '#7c2d12',
      '#431407',
    ),
  },
  red: {
    label: 'Red',
    palette: p(
      '#fef2f2',
      '#fee2e2',
      '#fecaca',
      '#fca5a5',
      '#f87171',
      '#ef4444',
      '#dc2626',
      '#b91c1c',
      '#991b1b',
      '#7f1d1d',
      '#450a0a',
    ),
  },
  rose: {
    label: 'Rose',
    palette: p(
      '#fff1f2',
      '#ffe4e6',
      '#fecdd3',
      '#fda4af',
      '#fb7185',
      '#f43f5e',
      '#e11d48',
      '#be123c',
      '#9f1239',
      '#881337',
      '#4c0519',
    ),
  },
  pink: {
    label: 'Pink',
    palette: p(
      '#fdf2f8',
      '#fce7f3',
      '#fbcfe8',
      '#f9a8d4',
      '#f472b6',
      '#ec4899',
      '#db2777',
      '#be185d',
      '#9d174d',
      '#831843',
      '#500724',
    ),
  },
  slate: {
    label: 'Graphite',
    palette: p(
      '#f8fafc',
      '#f1f5f9',
      '#e2e8f0',
      '#cbd5e1',
      '#94a3b8',
      '#64748b',
      '#475569',
      '#334155',
      '#1e293b',
      '#0f172a',
      '#020617',
    ),
  },
};

export const SIDEBAR_STYLES = {
  dark: 'Dark',
  light: 'Light',
  brand: 'Brand colour',
} as const;
export const LOGIN_STYLES = {
  split: 'Split (brand panel + form)',
  centered: 'Centered card',
} as const;

// ---------------- custom colour → 11 shades ----------------

function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) * 60
      : max === g
        ? ((b - r) / d + 2) * 60
        : ((r - g) / d + 4) * 60;
  return [h, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) =>
    lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (
    '#' +
    [f(0), f(8), f(4)]
      .map((x) =>
        Math.round(x * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** Ek rang (#RRGGBB) se poori palette: 600 = diya hua rang, baaki lightness scale */
export function paletteFromHex(hex: string): Palette {
  const [h, s] = hexToHsl(hex);
  const lightness: Record<Shade, number> = {
    50: 97,
    100: 94,
    200: 87,
    300: 77,
    400: 65,
    500: 55,
    600: 0, // = base
    700: 0,
    800: 0,
    900: 0,
    950: 0,
  };
  const [, , baseL] = hexToHsl(hex);
  const out = {} as Palette;
  for (const shade of SHADES) {
    if (shade === 600) out[shade] = hex.toLowerCase();
    else if (shade > 600) {
      const step = { 700: 0.82, 800: 0.66, 900: 0.52, 950: 0.34 }[shade as 700];
      out[shade] = hslToHex(h, Math.min(100, s * 1.02), baseL * step);
    } else {
      // Bahut gehra base rang ho to halke shades bhi thode kam saturated
      out[shade] = hslToHex(
        h,
        Math.min(s, shade <= 100 ? 90 : 95),
        Math.max(lightness[shade], baseL + 4),
      );
    }
  }
  return out;
}

export interface ThemeInput {
  themePreset?: string | null;
  primaryColor?: string | null;
  sidebarStyle?: string | null;
}

export function paletteFor(theme: ThemeInput): Palette {
  if (theme.primaryColor && /^#[0-9a-f]{6}$/i.test(theme.primaryColor))
    return paletteFromHex(theme.primaryColor);
  return (THEME_PRESETS[theme.themePreset ?? ''] ?? THEME_PRESETS.violet)
    .palette;
}

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** CSS variables (:root) — globals.css ke defaults ko override karte hain */
export function themeVariables(theme: ThemeInput): Record<string, string> {
  const pal = paletteFor(theme);
  const vars: Record<string, string> = {};
  for (const s of SHADES) vars[`--brand-${s}`] = pal[s];

  const style = theme.sidebarStyle ?? 'dark';
  if (style === 'light') {
    Object.assign(vars, {
      '--sidebar-bg': '#ffffff',
      '--sidebar-bg-2': '#fbfbfd',
      '--sidebar-border': 'rgb(16 24 40 / 0.08)',
      '--sidebar-text': '#475467',
      '--sidebar-text-active': pal[700],
      '--sidebar-title': '#101828',
      '--sidebar-muted': 'rgb(16 24 40 / 0.4)',
      '--sidebar-icon': 'rgb(16 24 40 / 0.4)',
      '--sidebar-icon-active': pal[600],
      '--sidebar-hover': 'rgb(16 24 40 / 0.04)',
      '--sidebar-hover-text': '#101828',
      '--sidebar-active': `rgb(${rgb(pal[500])} / 0.12)`,
      '--sidebar-rule': 'rgb(16 24 40 / 0.08)',
    });
  } else if (style === 'brand') {
    Object.assign(vars, {
      '--sidebar-bg': pal[900],
      '--sidebar-bg-2': pal[950],
      '--sidebar-text': `rgb(${rgb(pal[100])} / 0.75)`,
      '--sidebar-active': 'rgb(255 255 255 / 0.14)',
      '--sidebar-icon-active': pal[200],
    });
  } else {
    vars['--sidebar-active'] = `rgb(${rgb(pal[500])} / 0.16)`;
    vars['--sidebar-icon-active'] = pal[300];
  }
  return vars;
}

export function themeCss(theme: ThemeInput): string {
  const body = Object.entries(themeVariables(theme))
    .map(([k, v]) => `${k}:${v};`)
    .join('');
  return `:root{${body}}`;
}
