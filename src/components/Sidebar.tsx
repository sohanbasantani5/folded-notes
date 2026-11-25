import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronDown,
  Columns2,
  Download,
  FilePlus2,
  FolderOpen,
  LayoutGrid,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  Plus,
  Printer,
  Settings,
  Trash2,
} from 'lucide-react';
import { ExportFormat, Note, ViewMode } from '../types/note';
import { PAPER_TINTS } from '../data/themes';

export const InlineMascot: React.FC<{
  customMascotUrl: string | null;
  celebrating?: boolean;
  size?: number;
}> = ({ customMascotUrl, celebrating = false, size = 44 }) => (
  <motion.div
    animate={
      celebrating
        ? {
            y: [0, -8, 0, -4, 0],
            rotate: [0, -6, 6, -3, 0],
            scale: [1, 1.08, 1],
          }
        : {
            y: [0, -2.5, 0],
          }
    }
    transition={
      celebrating
        ? { duration: 0.65, ease: [0.22, 1, 0.36, 1] }
        : { duration: 3.4, repeat: Infinity, ease: 'easeInOut' }
    }
    style={{ width: size, height: size }}
    className="relative flex shrink-0 items-center justify-center select-none"
    aria-hidden="true"
  >
    {customMascotUrl ? (
      <img
        src={customMascotUrl}
        alt="folded notes mascot"
        style={{ width: size, height: size }}
        className="object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.12)]"
      />
    ) : (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.10)]"
      >
        <defs>
          <radialGradient id="mintBody" cx="38%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#B8F5E5" />
            <stop offset="55%" stopColor="#8CE2CC" />
            <stop offset="100%" stopColor="#6EC7B1" />
          </radialGradient>
          <linearGradient id="mintFold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D6FAF0" />
            <stop offset="100%" stopColor="#9EEAD7" />
          </linearGradient>
        </defs>
        <ellipse cx="12.5" cy="31" rx="5.5" ry="3.8" transform="rotate(-32 12.5 31)" fill="#86DEC8" />
        <ellipse cx="51.5" cy="36" rx="5.2" ry="3.6" transform="rotate(24 51.5 36)" fill="#7AD2BC" />
        <rect x="21" y="48" width="7.5" height="8" rx="3.75" fill="#76CEB8" />
        <rect x="35.5" y="48" width="7.5" height="8" rx="3.75" fill="#76CEB8" />
        <path
          d="M 32 11 C 20.5 11 14 18.5 14 31 C 14 43.5 21 51 32 51 C 43 51 50 43.5 50 31 C 50 26.8 49.3 23.2 48 20.3 L 38.7 11.7 C 36.6 11.2 34.4 11 32 11 Z"
          fill="url(#mintBody)"
        />
        <path
          d="M 38.5 11.6 C 38.5 16.5 41.2 20.5 48.1 20.4 C 45.4 16.3 42.3 13.4 38.5 11.6 Z"
          fill="url(#mintFold)"
        />
        <ellipse cx="22.5" cy="36.5" rx="3.6" ry="2.1" fill="#F29C9C" fillOpacity="0.45" />
        <ellipse cx="41.5" cy="36.5" rx="3.6" ry="2.1" fill="#F29C9C" fillOpacity="0.45" />
        <circle cx="25.5" cy="31.5" r="3.4" fill="#2A2630" />
        <circle cx="24.4" cy="30.3" r="1.15" fill="#FFFFFF" />
        <circle cx="26.7" cy="32.5" r="0.55" fill="#FFFFFF" />
        <circle cx="38.5" cy="31.5" r="3.4" fill="#2A2630" />
        <circle cx="37.4" cy="30.3" r="1.15" fill="#FFFFFF" />
        <circle cx="39.7" cy="32.5" r="0.55" fill="#FFFFFF" />
        <path
          d="M 29.2 35.8 C 29.2 37.9 34.8 37.9 34.8 35.8"
          stroke="#2A2630"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    )}
  </motion.div>
);

interface SidebarProps {
  notes: Note[];
  activeNoteId: string;
  wordCount: number;
  charCount: number;
  viewMode: ViewMode;
  splitScreen: boolean;
  isFullscreen: boolean;
  collapsed: boolean;
  customMascotUrl: string | null;
  mascotCelebrating: boolean;
  onCollapse: () => void;
  onNewNote: () => void;
  onOpenFile: (file: File) => void;
  onExport: (format: ExportFormat) => void;
  onSelectNote: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onToggleNotesGrid: () => void;
  onToggleSplitScreen: () => void;
  onToggleFullscreen: () => void;
  onPrint: () => void;
  onOpenSettings: () => void;
}

const EXPORT_OPTIONS: { format: ExportFormat; label: string; ext: string }[] = [
  { format: 'pdf', label: 'PDF Document', ext: '.pdf' },
  { format: 'md', label: 'Markdown', ext: '.md' },
  { format: 'txt', label: 'Plain Text', ext: '.txt' },
  { format: 'html', label: 'Web Document', ext: '.html' },
  { format: 'doc', label: 'Word Document', ext: '.doc' },
  { format: 'json', label: 'Full Backup', ext: '.json' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  activeNoteId,
  wordCount,
  charCount,
  viewMode,
  splitScreen,
  isFullscreen,
  collapsed,
  customMascotUrl,
  mascotCelebrating,
  onCollapse,
  onNewNote,
  onOpenFile,
  onExport,
  onSelectNote,
  onDeleteNote,
  onToggleNotesGrid,
  onToggleSplitScreen,
  onToggleFullscreen,
  onPrint,
  onOpenSettings,
}) => {
  const [exportOpen, setExportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [exportOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenFile(file);
    }
    e.target.value = '';
  };

  return (
    <aside
      aria-label="Workspace sidebar"
      className="no-print flex h-full shrink-0 flex-col select-none overflow-hidden"
      style={{
        width: collapsed ? 0 : 240,
        opacity: collapsed ? 0 : 1,
        pointerEvents: collapsed ? 'none' : 'auto',
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: collapsed ? 'none' : '1px solid var(--border-hairline)',
        transition:
          'width 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms cubic-bezier(0.22, 1, 0.36, 1), background-color 320ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div className="flex h-full w-[240px] flex-col px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (viewMode === 'grid') onToggleNotesGrid();
            }}
            className="flex items-center gap-2 text-left whitespace-nowrap shrink-0"
            style={{ color: 'var(--ink-primary)' }}
          >
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0">
              <path d="M3.25 2.5H14.75V11.8L11.3 15.5H3.25V2.5Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
              <path d="M11.2 15.4V11.8H14.65" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
            </svg>
            <span className="text-[14.5px] font-semibold tracking-[-0.02em]">folded notes.</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNewNote}
              title="New Note"
              className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11.5px] font-medium whitespace-nowrap shrink-0 transition-opacity duration-200 hover:opacity-90"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.1} />
              New
            </button>
            <button
              type="button"
              onClick={onCollapse}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="folio-hover-surface flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-200"
              style={{ color: 'var(--ink-muted)' }}
            >
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.65} />
            </button>
          </div>
        </div>

        <div
          className="mt-5 grid grid-cols-2 gap-3 py-3"
          style={{
            borderTop: '1px solid var(--border-hairline)',
            borderBottom: '1px solid var(--border-hairline)',
          }}
        >
          <div>
            <div className="font-mono text-[17px] font-medium leading-tight tabular-nums" style={{ color: 'var(--ink-primary)' }}>
              {wordCount.toLocaleString()}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              {wordCount === 1 ? 'Word' : 'Words'}
            </div>
          </div>
          <div>
            <div className="font-mono text-[17px] font-medium leading-tight tabular-nums" style={{ color: 'var(--ink-primary)' }}>
              {charCount.toLocaleString()}
            </div>
            <div className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              {charCount === 1 ? 'Character' : 'Characters'}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 px-2 text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>
            File
          </div>
          <div className="space-y-0.5">
            <SidebarActionButton icon={<FilePlus2 className="h-4 w-4" strokeWidth={1.6} />} label="New" onClick={onNewNote} />
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.src,.md,.json,text/plain,text/markdown"
              onChange={handleFileChange}
              className="hidden"
              aria-hidden="true"
            />
            <SidebarActionButton
              icon={<FolderOpen className="h-4 w-4" strokeWidth={1.6} />}
              label="Open"
              hint=".txt · .src"
              onClick={() => fileInputRef.current?.click()}
            />

            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setExportOpen((v) => !v)}
                aria-expanded={exportOpen}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors duration-200"
                style={{
                  color: 'var(--ink-primary)',
                  backgroundColor: exportOpen ? 'var(--bg-subtle)' : 'transparent',
                }}
              >
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <span style={{ color: 'var(--ink-secondary)' }}>
                    <Download className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                  Save / Export
                </span>
                <ChevronDown
                  className="h-3.5 w-3.5 shrink-0 transition-transform duration-200"
                  style={{
                    color: 'var(--ink-muted)',
                    transform: exportOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>

              {exportOpen && (
                <div
                  className="mt-1 rounded-lg py-1"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-strong)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  {EXPORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.format}
                      type="button"
                      onClick={() => {
                        setExportOpen(false);
                        onExport(opt.format);
                      }}
                      className="folio-hover-surface flex w-full items-center justify-between px-3 py-1.5 text-left text-[12.5px] transition-colors duration-150"
                      style={{ color: 'var(--ink-primary)' }}
                    >
                      <span>{opt.label}</span>
                      <span className="font-mono text-[11px]" style={{ color: 'var(--ink-muted)' }}>
                        {opt.ext}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-hairline)' }}>
          <div className="mb-1.5 px-2 text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>
            Workspace
          </div>
          <div className="space-y-0.5">
            <SidebarActionButton
              icon={<LayoutGrid className="h-4 w-4" strokeWidth={1.6} />}
              label="Notes Grid"
              hint={String(notes.length)}
              active={viewMode === 'grid'}
              onClick={onToggleNotesGrid}
            />
            <SidebarActionButton
              icon={<Columns2 className="h-4 w-4" strokeWidth={1.6} />}
              label="Split Screen"
              hint="Ctrl+\ · ⌘\"
              active={splitScreen && viewMode === 'editor'}
              onClick={onToggleSplitScreen}
            />
            <SidebarActionButton
              icon={isFullscreen ? <Minimize2 className="h-4 w-4" strokeWidth={1.6} /> : <Maximize2 className="h-4 w-4" strokeWidth={1.6} />}
              label={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              active={isFullscreen}
              onClick={onToggleFullscreen}
            />
            <SidebarActionButton icon={<Printer className="h-4 w-4" strokeWidth={1.6} />} label="Print" onClick={onPrint} />
            <SidebarActionButton icon={<Settings className="h-4 w-4" strokeWidth={1.6} />} label="Settings" onClick={onOpenSettings} />
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col pt-4" style={{ borderTop: '1px solid var(--border-hairline)' }}>
          <div className="mb-1.5 flex items-center justify-between px-2 text-[11px] font-medium" style={{ color: 'var(--ink-muted)' }}>
            <span>Recent Notes</span>
            <span className="tabular-nums">{notes.length}</span>
          </div>
          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
            {notes.map((n) => {
              const isCurrent = n.id === activeNoteId && viewMode === 'editor';
              const tint = PAPER_TINTS[n.tint] ?? PAPER_TINTS['warm-paper'];
              return (
                <div
                  key={n.id}
                  className="group flex items-center gap-1 rounded-lg transition-colors duration-150"
                  style={{ backgroundColor: isCurrent ? 'var(--bg-subtle)' : 'transparent' }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectNote(n.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: tint.foldDark, border: '1px solid rgba(0,0,0,0.1)' }}
                    />
                    <span
                      className="truncate text-[12.5px]"
                      style={{
                        color: isCurrent ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                        fontWeight: isCurrent ? 500 : 400,
                      }}
                    >
                      {n.title.trim() || 'Untitled Note'}
                    </span>
                  </button>
                  {notes.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Delete ${n.title || 'Untitled Note'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteNote(n.id);
                      }}
                      className="mr-1 rounded p-1 opacity-0 transition-opacity duration-150 group-hover:opacity-70 hover:!opacity-100 focus-visible:opacity-100"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border-hairline)' }}>
          <div className="flex items-center gap-2.5">
            <InlineMascot customMascotUrl={customMascotUrl} celebrating={mascotCelebrating} size={42} />
            <div className="leading-tight">
              <div className="text-[11.5px] font-medium" style={{ color: 'var(--ink-secondary)' }}>
                {mascotCelebrating ? 'Saved!' : 'folded notes.'}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--ink-muted)' }}>
                Local · Zero-cost
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

const SidebarActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  hint?: string;
  active?: boolean;
  onClick: () => void;
}> = ({ icon, label, hint, active = false, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="folio-hover-surface flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors duration-200"
    style={{
      backgroundColor: active ? 'var(--accent-soft)' : undefined,
      color: active ? 'var(--accent)' : 'var(--ink-primary)',
    }}
  >
    <span className="flex items-center gap-2.5 whitespace-nowrap">
      <span style={{ color: active ? 'var(--accent)' : 'var(--ink-secondary)' }}>{icon}</span>
      {label}
    </span>
    {hint && (
      <span className="font-mono text-[10px] tabular-nums whitespace-nowrap" style={{ color: active ? 'var(--accent)' : 'var(--ink-muted)' }}>
        {hint}
      </span>
    )}
  </button>
);