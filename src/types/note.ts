export type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'bullet'
  | 'numbered'
  | 'checklist'
  | 'divider'
  | 'callout';

export interface NoteBlock {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
}

export type PaperTintId =
  | 'warm-paper'
  | 'soft-lavender'
  | 'pale-butter'
  | 'soft-blush'
  | 'stone-gray';

export interface Note {
  id: string;
  title: string;
  blocks: NoteBlock[];
  tint: PaperTintId;
  referenceText: string;
  createdAt: number;
  updatedAt: number;
}

export type ThemeId =
  | 'aesthetic-paper'
  | 'pure-white'
  | 'pitch-black'
  | 'matte-charcoal'
  | 'soft-lavender-matte';

export type FontId =
  | 'sf-pro'
  | 'manrope'
  | 'synonym'
  | 'bonny'
  | 'jetbrains-mono';

export type TextWidthId = 'narrow' | 'medium' | 'wide';

export type AccentId =
  | 'charcoal'
  | 'soft-lavender'
  | 'warm-ochre'
  | 'sage'
  | 'dusty-rose';

export type ExportFormat = 'txt' | 'md' | 'html' | 'doc' | 'pdf' | 'json';

export type ViewMode = 'editor' | 'grid';

export interface AppSettings {
  theme: ThemeId;
  textWidth: TextWidthId;
  font: FontId;
  spacedMode: boolean;
  accent: AccentId;
  focusMode: boolean;
  sidebarCollapsed: boolean;
  splitScreen: boolean;
  swapSplitPanes: boolean;
  showIntroOnStartup?: boolean;
}