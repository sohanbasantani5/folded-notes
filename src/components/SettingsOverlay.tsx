import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { Check, EyeOff, Film, ImagePlus, Play, RotateCcw, X } from 'lucide-react';
import {
  AccentId,
  AppSettings,
  FontId,
  TextWidthId,
  ThemeId,
} from '../types/note';
import {
  ACCENTS,
  FONTS,
  TEXT_WIDTHS,
  THEMES,
} from '../data/themes';
import { InlineMascot } from './Sidebar';

interface SettingsOverlayProps {
  settings: AppSettings;
  customMascotUrl: string | null;
  hasCustomVideo: boolean;
  onUploadMascot: (file: File) => void;
  onResetMascot: () => void;
  onUploadIntroVideo: (file: File) => void;
  onResetIntroVideo: () => void;
  onReplayIntro: () => void;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onClose: () => void;
}

const THEME_ORDER: ThemeId[] = [
  'aesthetic-paper',
  'pure-white',
  'pitch-black',
  'matte-charcoal',
  'soft-lavender-matte',
];

const FONT_ORDER: FontId[] = [
  'sf-pro',
  'manrope',
  'synonym',
  'bonny',
  'jetbrains-mono',
];

const WIDTH_ORDER: TextWidthId[] = ['narrow', 'medium', 'wide'];

const ACCENT_ORDER: AccentId[] = [
  'charcoal',
  'soft-lavender',
  'warm-ochre',
  'sage',
  'dusty-rose',
];

export const SettingsOverlay: React.FC<SettingsOverlayProps> = ({
  settings,
  customMascotUrl,
  hasCustomVideo,
  onUploadMascot,
  onResetMascot,
  onUploadIntroVideo,
  onResetIntroVideo,
  onReplayIntro,
  onUpdateSettings,
  onClose,
}) => {
  const currentTheme = THEMES[settings.theme];
  const currentFont = FONTS[settings.font];
  const mascotInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const introEnabled = settings.showIntroOnStartup ?? true;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      role="dialog"
      aria-modal="true"
      aria-label="Workspace Settings"
      className="no-print fixed inset-0 z-50 flex flex-col overflow-y-auto"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 sm:px-12 backdrop-blur-md"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--bg-canvas) 90%, transparent)',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        <div className="flex items-center gap-3">
          <InlineMascot customMascotUrl={customMascotUrl} size={32} />
          <h1 className="text-[18px] font-semibold tracking-[-0.02em]" style={{ color: 'var(--ink-primary)' }}>
            Settings
          </h1>
          <span className="hidden sm:inline text-[12.5px]" style={{ color: 'var(--ink-muted)' }}>
            · Appearance, typography, mascot & intro
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="folio-hover-surface flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-200"
          style={{
            color: 'var(--ink-primary)',
            border: '1px solid var(--border-hairline)',
          }}
        >
          <span>Done</span>
          <span className="font-mono text-[11px]" style={{ color: 'var(--ink-muted)' }}>
            Esc
          </span>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-[920px] px-6 py-10 sm:px-12 sm:py-12 space-y-12"
      >
        {/* 1. Themes */}
        <section>
          <div className="mb-5">
            <h2 className="text-[16px] font-semibold tracking-[-0.015em]" style={{ color: 'var(--ink-primary)' }}>
              Matte Palette
            </h2>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-muted)' }}>
              Five glare-free archival surfaces calibrated for sustained reading and drafting.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            {THEME_ORDER.map((id) => {
              const t = THEMES[id];
              const active = settings.theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onUpdateSettings({ theme: id })}
                  className="group flex flex-col rounded-xl p-3.5 text-left transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border-hairline)',
                  }}
                >
                  <div
                    className="mb-3 flex h-16 w-full flex-col justify-between rounded-lg p-2.5"
                    style={{ backgroundColor: t.canvas, border: `1px solid ${t.borderHairline}` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold" style={{ color: t.inkPrimary }}>
                        Aa
                      </span>
                      {active && (
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full"
                          style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
                        >
                          <Check className="h-2.5 w-2.5" strokeWidth={2.6} />
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="h-1 w-3/4 rounded-full opacity-60" style={{ backgroundColor: t.inkPrimary }} />
                      <div className="h-1 w-1/2 rounded-full opacity-30" style={{ backgroundColor: t.inkPrimary }} />
                    </div>
                  </div>
                  <span className="text-[13px] font-medium leading-snug" style={{ color: 'var(--ink-primary)' }}>
                    {t.name}
                  </span>
                  <span className="mt-0.5 font-mono text-[10.5px]" style={{ color: 'var(--ink-muted)' }}>
                    {t.canvas}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <hr style={{ border: 0, borderTop: '1px solid var(--border-hairline)' }} />

        {/* 2. Typography */}
        <section>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[16px] font-semibold tracking-[-0.015em]" style={{ color: 'var(--ink-primary)' }}>
                Typography
              </h2>
              <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-muted)' }}>
                Choose the voice of your page—humanist sans, editorial serif, or precision monospace.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.spacedMode}
              onClick={() =>
                onUpdateSettings({
                  spacedMode: !settings.spacedMode,
                  ...(settings.spacedMode ? {} : { font: 'manrope' }),
                })
              }
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-left transition-colors duration-200 self-start sm:self-auto"
              style={{
                backgroundColor: settings.spacedMode ? 'var(--accent-soft)' : 'var(--bg-surface)',
                border: settings.spacedMode ? '1px solid var(--accent)' : '1px solid var(--border-hairline)',
              }}
            >
              <div>
                <span className="block text-[13px] font-medium whitespace-nowrap" style={{ color: 'var(--ink-primary)' }}>
                  Spaced Mode
                </span>
                <span className="block text-[11px] whitespace-nowrap" style={{ color: 'var(--ink-muted)' }}>
                  Manrope · 0.08em · 1.9 line-height
                </span>
              </div>
              <span
                className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200"
                style={{ backgroundColor: settings.spacedMode ? 'var(--accent)' : 'var(--border-strong)' }}
              >
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full transition-transform duration-200"
                  style={{
                    backgroundColor: settings.spacedMode ? 'var(--accent-ink)' : 'var(--bg-surface)',
                    transform: settings.spacedMode ? 'translateX(18px)' : 'translateX(3px)',
                  }}
                />
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FONT_ORDER.map((id) => {
              const f = FONTS[id];
              const active = !settings.spacedMode && settings.font === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onUpdateSettings({ font: id, spacedMode: false })}
                  className="flex flex-col justify-between rounded-xl p-4 text-left transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border-hairline)',
                  }}
                >
                  <div className="text-[24px] font-medium leading-none" style={{ fontFamily: f.family, color: 'var(--ink-primary)' }}>
                    Ag
                  </div>
                  <div className="mt-4">
                    <div className="text-[13px] font-medium" style={{ color: 'var(--ink-primary)' }}>
                      {f.name}
                    </div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                      {f.category}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className="mt-5 rounded-xl px-6 py-5"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}
          >
            <div className="mb-2 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              Live Specimen · {settings.spacedMode ? 'Spaced Mode (Manrope)' : currentFont.name}
            </div>
            <p className="folio-editor-font text-[16px]" style={{ color: 'var(--ink-primary)', maxWidth: '64ch' }}>
              Good writing tools quiet the room. Every margin, letterform, and pause exists so complex ideas can unfold cleanly from first note to final script.
            </p>
          </div>
        </section>

        <hr style={{ border: 0, borderTop: '1px solid var(--border-hairline)' }} />

        {/* 3. Text Width & Accent */}
        <section className="grid grid-cols-1 gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-[16px] font-semibold tracking-[-0.015em]" style={{ color: 'var(--ink-primary)' }}>
              Text Measure
            </h2>
            <p className="mt-1 mb-4 text-[13px]" style={{ color: 'var(--ink-muted)' }}>
              Control maximum column width for comfortable line scanning.
            </p>
            <div className="space-y-2">
              {WIDTH_ORDER.map((id) => {
                const w = TEXT_WIDTHS[id];
                const active = settings.textWidth === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onUpdateSettings({ textWidth: id })}
                    className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all duration-200"
                    style={{
                      backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-surface)',
                      border: active ? '1px solid var(--accent)' : '1px solid var(--border-hairline)',
                    }}
                  >
                    <div>
                      <span className="block text-[13.5px] font-medium" style={{ color: 'var(--ink-primary)' }}>
                        {w.label}
                      </span>
                      <span className="block text-[11.5px]" style={{ color: 'var(--ink-muted)' }}>
                        {w.subtitle}
                      </span>
                    </div>
                    <span className="font-mono text-[12px] tabular-nums" style={{ color: active ? 'var(--accent)' : 'var(--ink-muted)' }}>
                      {w.px}px
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-8">
            <div>
              <h2 className="text-[16px] font-semibold tracking-[-0.015em]" style={{ color: 'var(--ink-primary)' }}>
                Matte Accent
              </h2>
              <p className="mt-1 mb-4 text-[13px]" style={{ color: 'var(--ink-muted)' }}>
                Five restrained inks used sparingly for active states and checkboxes.
              </p>

              <div className="grid grid-cols-5 gap-2.5">
                {ACCENT_ORDER.map((id) => {
                  const a = ACCENTS[id];
                  const active = settings.accent === id;
                  const swatchColor = currentTheme.isDark ? a.dark : a.light;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onUpdateSettings({ accent: id })}
                      className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 transition-all duration-200"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: active ? '1.5px solid var(--accent)' : '1px solid var(--border-hairline)',
                      }}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: swatchColor }}>
                        {active && (
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} style={{ color: currentTheme.isDark ? a.darkInk : a.lightInk }} />
                        )}
                      </span>
                      <span className="text-center text-[11px] leading-tight" style={{ color: 'var(--ink-secondary)' }}>
                        {a.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              className="rounded-xl p-5"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--ink-primary)' }}
                  >
                    <EyeOff className="h-4 w-4" strokeWidth={1.65} />
                  </span>
                  <div>
                    <h3 className="text-[14px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
                      Focus Mode
                    </h3>
                    <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
                      Hides sidebar and chrome, dims surrounding paragraphs, and keeps only a quiet corner exit button.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.focusMode}
                  aria-label="Toggle Focus Mode"
                  onClick={() => {
                    const next = !settings.focusMode;
                    onUpdateSettings({ focusMode: next });
                    if (next) onClose();
                  }}
                  className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200"
                  style={{ backgroundColor: settings.focusMode ? 'var(--accent)' : 'var(--border-strong)' }}
                >
                  <span
                    className="inline-block h-4 w-4 rounded-full transition-transform duration-200"
                    style={{
                      backgroundColor: settings.focusMode ? 'var(--accent-ink)' : 'var(--bg-surface)',
                      transform: settings.focusMode ? 'translateX(23px)' : 'translateX(4px)',
                    }}
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        <hr style={{ border: 0, borderTop: '1px solid var(--border-hairline)' }} />

        {/* 4. Mascot & Launch Intro */}
        <section>
          <div className="mb-5">
            <h2 className="text-[16px] font-semibold tracking-[-0.015em]" style={{ color: 'var(--ink-primary)' }}>
              Mascot & Launch Intro
            </h2>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-muted)' }}>
              Upload your mint-green mascot PNG (white background removed automatically) and custom intro video.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div
              className="flex items-center justify-between gap-4 rounded-xl p-5"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}
            >
              <div className="flex items-center gap-3.5">
                <InlineMascot customMascotUrl={customMascotUrl} size={48} />
                <div>
                  <h3 className="text-[14px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
                    Sidebar Mascot
                  </h3>
                  <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                    {customMascotUrl ? 'Custom PNG active (transparent)' : 'Default mint folded-paper mascot'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={mascotInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadMascot(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => mascotInputRef.current?.click()}
                  className="folio-hover-surface flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium"
                  style={{ border: '1px solid var(--border-hairline)', color: 'var(--ink-primary)' }}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  <span>Upload PNG</span>
                </button>
                {customMascotUrl && (
                  <button
                    type="button"
                    onClick={onResetMascot}
                    title="Reset mascot"
                    className="folio-hover-surface flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ border: '1px solid var(--border-hairline)', color: 'var(--ink-muted)' }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div
              className="flex flex-col justify-between gap-4 rounded-xl p-5"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hairline)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
                    Launch Intro on Startup
                  </h3>
                  <p className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                    {hasCustomVideo ? 'Custom .mp4/.webm video loaded' : 'Default 2.5s animated mascot intro'}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={introEnabled}
                  onClick={() => onUpdateSettings({ showIntroOnStartup: !introEnabled })}
                  className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200"
                  style={{ backgroundColor: introEnabled ? 'var(--accent)' : 'var(--border-strong)' }}
                >
                  <span
                    className="inline-block h-4 w-4 rounded-full transition-transform duration-200"
                    style={{
                      backgroundColor: introEnabled ? 'var(--accent-ink)' : 'var(--bg-surface)',
                      transform: introEnabled ? 'translateX(23px)' : 'translateX(4px)',
                    }}
                  />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadIntroVideo(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="folio-hover-surface flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium"
                  style={{ border: '1px solid var(--border-hairline)', color: 'var(--ink-primary)' }}
                >
                  <Film className="h-3.5 w-3.5" />
                  <span>Upload Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onReplayIntro();
                  }}
                  className="folio-hover-surface flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium"
                  style={{ border: '1px solid var(--border-hairline)', color: 'var(--ink-primary)' }}
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Replay Intro</span>
                </button>
                {hasCustomVideo && (
                  <button
                    type="button"
                    onClick={onResetIntroVideo}
                    title="Remove custom video"
                    className="folio-hover-surface flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ border: '1px solid var(--border-hairline)', color: 'var(--ink-muted)' }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <hr style={{ border: 0, borderTop: '1px solid var(--border-hairline)' }} />

        <section className="pb-6">
          <h2 className="mb-4 text-[14px] font-semibold" style={{ color: 'var(--ink-primary)' }}>
            Keyboard Shortcuts
          </h2>
          <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2 text-[13px]">
            {[
              ['Export active note (.md)', 'Ctrl+S · ⌘S'],
              ['Export / Save as PDF', 'Ctrl+P · ⌘P'],
              ['Toggle Split Screen', 'Ctrl+\\ · ⌘\\'],
              ['Insert block command palette', '/'],
              ['Exit Settings or Focus Mode', 'Esc'],
            ].map(([label, keys]) => (
              <div
                key={label}
                className="flex items-center justify-between py-1.5"
                style={{ borderBottom: '1px solid var(--border-hairline)' }}
              >
                <span style={{ color: 'var(--ink-secondary)' }}>{label}</span>
                <span className="font-mono text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                  {keys}
                </span>
              </div>
            ))}
          </div>
        </section>
      </motion.div>
    </motion.div>
  );
};