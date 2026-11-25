import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Note, PaperTintId } from '../types/note';
import { PAPER_TINT_ORDER, PAPER_TINTS } from '../data/themes';
import {
  countNoteStats,
  formatRelativeDate,
  getNotePlainPreview,
} from '../utils/blocks';

interface NotesGridProps {
  notes: Note[];
  activeNoteId: string;
  onSelectNote: (noteId: string) => void;
  onCreateNote: (tint?: PaperTintId) => void;
  onChangeTint: (noteId: string, tint: PaperTintId) => void;
  onDeleteNote: (noteId: string) => void;
}

export const NotesGrid: React.FC<NotesGridProps> = ({
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onChangeTint,
  onDeleteNote,
}) => {
  const [query, setQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      if (n.title.toLowerCase().includes(q)) return true;
      return n.blocks.some((b) => b.content.toLowerCase().includes(q));
    });
  }, [notes, query]);

  return (
    <div
      className="h-full w-full overflow-y-auto px-6 py-10 sm:px-12 sm:py-12"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      <div className="mx-auto max-w-[1060px]">
        {/* Editorial Header Row */}
        <div
          className="flex flex-col gap-5 pb-7 sm:flex-row sm:items-end sm:justify-between"
          style={{ borderBottom: '1px solid var(--border-hairline)' }}
        >
          <div>
            <h1
              className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.025em] leading-tight"
              style={{ color: 'var(--ink-primary)', textWrap: 'balance' }}
            >
              Notes Archive
            </h1>
            <p
              className="mt-1.5 text-[13.5px]"
              style={{ color: 'var(--ink-muted)' }}
            >
              {notes.length} {notes.length === 1 ? 'folio' : 'folios'} stored locally · Select a sheet to unfold
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-hairline)',
              }}
            >
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--ink-muted)' }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter notes..."
                aria-label="Filter notes"
                className="w-40 sm:w-48 bg-transparent text-[13px] outline-none placeholder:opacity-45"
                style={{ color: 'var(--ink-primary)' }}
              />
            </div>

            <button
              type="button"
              onClick={() => onCreateNote()}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium whitespace-nowrap shrink-0 transition-opacity duration-200 hover:opacity-90"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--accent-ink)',
              }}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              New Note
            </button>
          </div>
        </div>

        {/* 3D Folded Paper Note Cards Grid */}
        <div className="mt-9 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Tactile New Folded Sheet Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="folded-card-scene"
          >
            <button
              type="button"
              onClick={() => onCreateNote()}
              className="group flex h-[238px] w-full flex-col items-center justify-center gap-3 rounded-[10px] text-center transition-all duration-300"
              style={{
                backgroundColor: 'transparent',
                border: '1.5px dashed var(--border-strong)',
                color: 'var(--ink-secondary)',
              }}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-105"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--ink-primary)',
                }}
              >
                <Plus className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <span className="block text-[14px] font-medium" style={{ color: 'var(--ink-primary)' }}>
                  Fresh Sheet
                </span>
                <span className="mt-0.5 block text-[12px]" style={{ color: 'var(--ink-muted)' }}>
                  Unfold a new note
                </span>
              </div>
            </button>
          </motion.div>

          {filteredNotes.map((note, idx) => {
            const tint = PAPER_TINTS[note.tint] ?? PAPER_TINTS['warm-paper'];
            const stats = countNoteStats(note.title, note.blocks);
            const preview = getNotePlainPreview(note, 145);
            const isSelected = note.id === activeNoteId;
            const isConfirming = confirmDeleteId === note.id;

            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.34,
                  delay: Math.min(idx * 0.04, 0.24),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="folded-card-scene"
              >
                <div
                  className="folded-card group relative h-[238px] w-full cursor-pointer"
                  onClick={() => onSelectNote(note.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectNote(note.id);
                    }
                  }}
                  aria-label={`Open note ${note.title || 'Untitled Note'}`}
                >
                  {/* Main Clipped Paper Sheet */}
                  <div
                    className="folded-card-sheet flex h-full w-full flex-col justify-between p-6"
                    style={{
                      backgroundColor: tint.surface,
                      color: tint.ink,
                      boxShadow: isSelected
                        ? `inset 0 0 0 1.5px ${tint.ink}`
                        : undefined,
                    }}
                  >
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <div className="flex items-start justify-between gap-2">
                        <h2
                          className="line-clamp-2 text-[17px] font-semibold leading-[1.32] tracking-[-0.015em]"
                          style={{ color: tint.ink, textWrap: 'balance' }}
                        >
                          {note.title.trim() || 'Untitled Note'}
                        </h2>
                      </div>

                      <p
                        className="mt-3 line-clamp-4 text-[13.5px] leading-[1.6]"
                        style={{ color: tint.muted }}
                      >
                        {preview || 'Empty sheet — click to begin writing.'}
                      </p>
                    </div>

                    {/* Footer Metadata + Hover Paper Tint & Delete Controls */}
                    <div className="mt-4 flex items-center justify-between pr-8">
                      <div
                        className="flex items-center gap-1.5 text-[11.5px] tabular-nums"
                        style={{ color: tint.muted }}
                      >
                        <span>
                          {stats.words} {stats.words === 1 ? 'word' : 'words'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeDate(note.updatedAt)}</span>
                      </div>

                      {/* Subtle Paper Tint Picker + Delete on Hover */}
                      <div
                        className="flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteId(null);
                                onDeleteNote(note.id);
                              }}
                              className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                              style={{
                                backgroundColor: '#9E3E3E',
                                color: '#FFFFFF',
                              }}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded px-1.5 py-0.5 text-[11px]"
                              style={{ color: tint.muted }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 mr-1">
                              {PAPER_TINT_ORDER.map((tintId) => {
                                const swatch = PAPER_TINTS[tintId];
                                const activeTint = tintId === note.tint;
                                return (
                                  <button
                                    key={tintId}
                                    type="button"
                                    title={swatch.name}
                                    aria-label={`Set paper tint to ${swatch.name}`}
                                    onClick={() => onChangeTint(note.id, tintId)}
                                    className="h-3.5 w-3.5 rounded-full transition-transform duration-150 hover:scale-110"
                                    style={{
                                      backgroundColor: swatch.foldDark,
                                      boxShadow: activeTint
                                        ? `0 0 0 1.5px ${tint.ink}`
                                        : 'inset 0 0 0 1px rgba(0,0,0,0.12)',
                                    }}
                                  />
                                );
                              })}
                            </div>
                            {notes.length > 1 && (
                              <button
                                type="button"
                                aria-label="Delete note"
                                onClick={() => setConfirmDeleteId(note.id)}
                                className="rounded p-1 transition-opacity duration-150 hover:opacity-100 opacity-70"
                                style={{ color: tint.ink }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Realistic 3D Curled/Folded Bottom-Right Corner Flap */}
                  <div
                    aria-hidden="true"
                    className="folded-card-flap"
                    style={{
                      background: `linear-gradient(135deg, ${tint.foldLight} 0%, ${tint.foldDark} 58%, ${tint.surface} 100%)`,
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {filteredNotes.length === 0 && (
          <div
            className="mt-16 text-center text-[14px]"
            style={{ color: 'var(--ink-muted)' }}
          >
            No notes match "{query}".
          </div>
        )}
      </div>
    </div>
  );
};
