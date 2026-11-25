import {
  AccentId,
  AppSettings,
  FontId,
  PaperTintId,
  TextWidthId,
  ThemeId,
} from '../types/note';

export interface ThemePalette {
  id: ThemeId;
  name: string;
  description: string;
  isDark: boolean;
  canvas: string;
  sidebar: string;
  surface: string;
  subtle: string;
  callout: string;
  inkPrimary: string;
  inkSecondary: string;
  inkMuted: string;
  borderHairline: string;
  borderStrong: string;
}

export const THEMES: Record<ThemeId, ThemePalette> = {
  'aesthetic-paper': {
    id: 'aesthetic-paper',
    name: 'Aesthetic Paper',
    description: 'Warm archival stock with deep matte ink',
    isDark: false,
    canvas: '#F6F5F2',
    sidebar: '#EFECE6',
    surface: '#FCFBF9',
    subtle: '#E8E5DD',
    callout: '#EEEBE3',
    inkPrimary: '#111111',
    inkSecondary: '#4E4C46',
    inkMuted: '#827F77',
    borderHairline: 'rgba(17, 17, 17, 0.085)',
    borderStrong: 'rgba(17, 17, 17, 0.16)',
  },
  'pure-white': {
    id: 'pure-white',
    name: 'Pure White',
    description: 'Crisp gallery sheet with stark clarity',
    isDark: false,
    canvas: '#FFFFFF',
    sidebar: '#F7F7F6',
    surface: '#FFFFFF',
    subtle: '#EFEFEE',
    callout: '#F5F5F4',
    inkPrimary: '#111111',
    inkSecondary: '#525252',
    inkMuted: '#888886',
    borderHairline: 'rgba(17, 17, 17, 0.08)',
    borderStrong: 'rgba(17, 17, 17, 0.16)',
  },
  'pitch-black': {
    id: 'pitch-black',
    name: 'Pitch Black',
    description: 'Obsidian night writing without glare',
    isDark: true,
    canvas: '#0A0A0B',
    sidebar: '#101012',
    surface: '#151518',
    subtle: '#1D1D21',
    callout: '#141417',
    inkPrimary: '#F4F3EF',
    inkSecondary: '#ABA9A3',
    inkMuted: '#6E6D68',
    borderHairline: 'rgba(244, 243, 239, 0.09)',
    borderStrong: 'rgba(244, 243, 239, 0.17)',
  },
  'matte-charcoal': {
    id: 'matte-charcoal',
    name: 'Matte Charcoal',
    description: 'Soft graphite slate for extended sessions',
    isDark: true,
    canvas: '#1B1B1F',
    sidebar: '#161619',
    surface: '#232328',
    subtle: '#2B2B31',
    callout: '#232328',
    inkPrimary: '#E8E7E2',
    inkSecondary: '#A8A6A0',
    inkMuted: '#75746F',
    borderHairline: 'rgba(232, 231, 226, 0.09)',
    borderStrong: 'rgba(232, 231, 226, 0.17)',
  },
  'soft-lavender-matte': {
    id: 'soft-lavender-matte',
    name: 'Soft Lavender Matte',
    description: 'Quiet mineral violet tinted stationery',
    isDark: false,
    canvas: '#F4F1FA',
    sidebar: '#ECE7F6',
    surface: '#FAF8FD',
    subtle: '#E4DEF0',
    callout: '#EAE4F4',
    inkPrimary: '#1C1926',
    inkSecondary: '#544E63',
    inkMuted: '#857F94',
    borderHairline: 'rgba(28, 25, 38, 0.085)',
    borderStrong: 'rgba(28, 25, 38, 0.16)',
  },
};

export interface FontOption {
  id: FontId;
  name: string;
  category: string;
  family: string;
  sample: string;
  tracking: string;
  leading: string;
}

export const FONTS: Record<FontId, FontOption> = {
  'sf-pro': {
    id: 'sf-pro',
    name: 'SF Pro Display',
    category: 'System Neo-Grotesque',
    family: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
    sample: 'Clarity begins when noise leaves the page.',
    tracking: '-0.01em',
    leading: '1.68',
  },
  manrope: {
    id: 'manrope',
    name: 'Manrope',
    category: 'Geometric Sans',
    family: '"Manrope", -apple-system, BlinkMacSystemFont, sans-serif',
    sample: 'Measured cadence for deep thinking and study.',
    tracking: '-0.008em',
    leading: '1.72',
  },
  synonym: {
    id: 'synonym',
    name: 'Synonym',
    category: 'Humanist Sans',
    family: '"Synonym", "Manrope", sans-serif',
    sample: 'Warm humanist proportion built for long drafts.',
    tracking: '-0.004em',
    leading: '1.72',
  },
  bonny: {
    id: 'bonny',
    name: 'Bonny',
    category: 'Editorial Serif',
    family: '"Bonny", Georgia, "Times New Roman", serif',
    sample: 'Literary serif poise with crisp editorial ink.',
    tracking: '0.002em',
    leading: '1.76',
  },
  'jetbrains-mono': {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    category: 'Monospace',
    family: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
    sample: 'Structured precision for prompts and scripts.',
    tracking: '-0.01em',
    leading: '1.74',
  },
};

export interface TextWidthOption {
  id: TextWidthId;
  label: string;
  px: number;
  subtitle: string;
}

export const TEXT_WIDTHS: Record<TextWidthId, TextWidthOption> = {
  narrow: { id: 'narrow', label: 'Narrow', px: 580, subtitle: '580px · Pocket book measure' },
  medium: { id: 'medium', label: 'Medium', px: 720, subtitle: '720px · Balanced editorial' },
  wide: { id: 'wide', label: 'Wide', px: 920, subtitle: '920px · Expansive script canvas' },
};

export interface AccentOption {
  id: AccentId;
  name: string;
  light: string;
  lightSoft: string;
  lightInk: string;
  dark: string;
  darkSoft: string;
  darkInk: string;
}

export const ACCENTS: Record<AccentId, AccentOption> = {
  charcoal: {
    id: 'charcoal',
    name: 'Charcoal',
    light: '#242426',
    lightSoft: 'rgba(36, 36, 38, 0.09)',
    lightInk: '#F6F5F2',
    dark: '#DFDDD7',
    darkSoft: 'rgba(223, 221, 215, 0.12)',
    darkInk: '#111111',
  },
  'soft-lavender': {
    id: 'soft-lavender',
    name: 'Soft Lavender',
    light: '#6D6191',
    lightSoft: 'rgba(109, 97, 145, 0.12)',
    lightInk: '#FAF8FD',
    dark: '#ADA0D4',
    darkSoft: 'rgba(173, 160, 212, 0.16)',
    darkInk: '#15121F',
  },
  'warm-ochre': {
    id: 'warm-ochre',
    name: 'Warm Ochre',
    light: '#9A6F34',
    lightSoft: 'rgba(154, 111, 52, 0.12)',
    lightInk: '#FDFBF7',
    dark: '#CFA263',
    darkSoft: 'rgba(207, 162, 99, 0.16)',
    darkInk: '#1A140B',
  },
  sage: {
    id: 'sage',
    name: 'Sage',
    light: '#4F6E5B',
    lightSoft: 'rgba(79, 110, 91, 0.12)',
    lightInk: '#F8FAF8',
    dark: '#88AA94',
    darkSoft: 'rgba(136, 170, 148, 0.16)',
    darkInk: '#101913',
  },
  'dusty-rose': {
    id: 'dusty-rose',
    name: 'Dusty Rose',
    light: '#935C62',
    lightSoft: 'rgba(147, 92, 98, 0.12)',
    lightInk: '#FDF9F9',
    dark: '#C99096',
    darkSoft: 'rgba(201, 144, 150, 0.16)',
    darkInk: '#1D1213',
  },
};

export interface PaperTintOption {
  id: PaperTintId;
  name: string;
  surface: string;
  foldLight: string;
  foldDark: string;
  ink: string;
  muted: string;
  border: string;
}

export const PAPER_TINTS: Record<PaperTintId, PaperTintOption> = {
  'warm-paper': {
    id: 'warm-paper',
    name: 'Warm Paper',
    surface: '#F5F1E8',
    foldLight: '#EAE3D4',
    foldDark: '#D8CEB8',
    ink: '#1E1C19',
    muted: '#6E695F',
    border: 'rgba(30, 28, 25, 0.08)',
  },
  'soft-lavender': {
    id: 'soft-lavender',
    name: 'Soft Lavender',
    surface: '#EFEBF7',
    foldLight: '#E3DCF1',
    foldDark: '#CFC4E4',
    ink: '#1E1A29',
    muted: '#68617A',
    border: 'rgba(30, 26, 41, 0.08)',
  },
  'pale-butter': {
    id: 'pale-butter',
    name: 'Pale Butter',
    surface: '#F6F2DC',
    foldLight: '#ECE5C5',
    foldDark: '#DCD2A7',
    ink: '#221F15',
    muted: '#706A54',
    border: 'rgba(34, 31, 21, 0.08)',
  },
  'soft-blush': {
    id: 'soft-blush',
    name: 'Soft Blush',
    surface: '#F6ECE9',
    foldLight: '#EBDCD8',
    foldDark: '#DAC4BE',
    ink: '#241B1A',
    muted: '#75625F',
    border: 'rgba(36, 27, 26, 0.08)',
  },
  'stone-gray': {
    id: 'stone-gray',
    name: 'Stone Gray',
    surface: '#ECECE8',
    foldLight: '#E0E0DA',
    foldDark: '#CECEC6',
    ink: '#1C1D1B',
    muted: '#686964',
    border: 'rgba(28, 29, 27, 0.08)',
  },
};

export const PAPER_TINT_ORDER: PaperTintId[] = [
  'warm-paper',
  'soft-lavender',
  'pale-butter',
  'soft-blush',
  'stone-gray',
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'aesthetic-paper',
  textWidth: 'medium',
  font: 'manrope',
  spacedMode: false,
  accent: 'charcoal',
  focusMode: false,
  sidebarCollapsed: false,
  splitScreen: false,
  swapSplitPanes: false,
};

export function applySettingsToDocument(settings: AppSettings): void {
  const root = document.documentElement;
  const theme = THEMES[settings.theme] ?? THEMES['aesthetic-paper'];
  const accent = ACCENTS[settings.accent] ?? ACCENTS.charcoal;
  const font = FONTS[settings.font] ?? FONTS.manrope;
  const width = TEXT_WIDTHS[settings.textWidth] ?? TEXT_WIDTHS.medium;

  root.dataset.theme = theme.id;
  root.dataset.dark = String(theme.isDark);

  root.style.setProperty('--bg-canvas', theme.canvas);
  root.style.setProperty('--bg-sidebar', theme.sidebar);
  root.style.setProperty('--bg-surface', theme.surface);
  root.style.setProperty('--bg-subtle', theme.subtle);
  root.style.setProperty('--bg-callout', theme.callout);
  root.style.setProperty('--ink-primary', theme.inkPrimary);
  root.style.setProperty('--ink-secondary', theme.inkSecondary);
  root.style.setProperty('--ink-muted', theme.inkMuted);
  root.style.setProperty('--border-hairline', theme.borderHairline);
  root.style.setProperty('--border-strong', theme.borderStrong);

  root.style.setProperty('--accent', theme.isDark ? accent.dark : accent.light);
  root.style.setProperty('--accent-soft', theme.isDark ? accent.darkSoft : accent.lightSoft);
  root.style.setProperty('--accent-ink', theme.isDark ? accent.darkInk : accent.lightInk);

  const activeFontFamily = settings.spacedMode ? FONTS.manrope.family : font.family;
  root.style.setProperty('--editor-font', activeFontFamily);
  root.style.setProperty('--editor-tracking', settings.spacedMode ? '0.08em' : font.tracking);
  root.style.setProperty('--editor-leading', settings.spacedMode ? '1.9' : font.leading);
  root.style.setProperty('--editor-width', `${width.px}px`);
}
