import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Eraser, Undo2 } from 'lucide-react';
import { Note } from '../types/note';
import { BlockEditor } from './BlockEditor';

interface SplitScreenWorkspaceProps {
  note: Note;
  focusMode: boolean;
  swapped: boolean;
  unfoldKey: number;
  onSwapPanes: () => void;
  onUpdateNote: (updater: (prev: Note) => Note) => void;
}

export const SplitScreenWorkspace: React.FC<SplitScreenWorkspaceProps> = ({
  note,
  focusMode,
  swapped,
  unfoldKey,
  onSwapPanes,
  onUpdateNote,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPercent, setLeftPercent] = useState<number>(46);
  const [dragging, setDragging] = useState(false);
  const [clearedBackup, setClearedBackup] = useState<string | null>(null);

  const referenceWordCount = useMemo(() => {
    const trimmed = note.referenceText.trim();
    return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  }, [note.referenceText]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const rawPct = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.max(26, Math.min(74, rawPct));
      setLeftPercent(clamped);
    };

    const handleUp = () => setDragging(false);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  const handleClearReference = () => {
    if (!note.referenceText.trim()) return;
    setClearedBackup(note.referenceText);
    onUpdateNote((prev) => ({
      ...prev,
      referenceText: '',
      updatedAt: Date.now(),
    }));
  };

  const handleUndoClear = () => {
    if (clearedBackup === null) return;
    const restored = clearedBackup;
    setClearedBackup(null);
    onUpdateNote((prev) => ({
      ...prev,
      referenceText: restored,
      updatedAt: Date.now(),
    }));
  };

  const referencePane = (
    <section
      aria-label="Reference and Paste pane"
      className="no-print flex h-full min-w-0 flex-col"
      style={{ backgroundColor: 'var(--bg-sidebar)' }}
    >
      <div
        className="flex items-center justify-between gap-3 px-6 py-3"
        style={{ borderBottom: '1px solid var(--border-hairline)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="text-[12.5px] font-semibold tracking-[-0.01em] whitespace-nowrap"
            style={{ color: 'var(--ink-primary)' }}
          >
            Reference / Paste
          </span>
          <span
            className="text-[11.5px] tabular-nums whitespace-nowrap"
            style={{ color: 'var(--ink-muted)' }}
          >
            · {referenceWordCount} {referenceWordCount === 1 ? 'word' : 'words'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {clearedBackup !== null && !note.referenceText && (
            <button
              type="button"
              onClick={handleUndoClear}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-colors duration-200"
              style={{
                color: 'var(--accent)',
                backgroundColor: 'var(--accent-soft)',
              }}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
          )}
          <button
            type="button"
            onClick={onSwapPanes}
            title="Swap left and right panes"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-colors duration-200 hover:opacity-100"
            style={{
              color: 'var(--ink-secondary)',
              backgroundColor: 'transparent',
            }}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Swap Panes
          </button>
          <button
            type="button"
            onClick={handleClearReference}
            disabled={!note.referenceText.trim()}
            title="Clear reference text"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-opacity duration-200 disabled:opacity-35"
            style={{ color: 'var(--ink-secondary)' }}
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear Reference
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <textarea
          value={note.referenceText}
          onChange={(e) => {
            if (clearedBackup !== null) setClearedBackup(null);
            const val = e.target.value;
            onUpdateNote((prev) => ({
              ...prev,
              referenceText: val,
              updatedAt: Date.now(),
            }));
          }}
          placeholder="Paste study questions, source excerpts, transcripts, or prompt templates here for side-by-side reference..."
          aria-label="Reference material"
          className="folio-editor-font h-full min-h-[360px] w-full resize-none bg-transparent text-[14.5px] leading-[1.75] outline-none placeholder:opacity-40"
          style={{ color: 'var(--ink-secondary)' }}
        />
      </div>
    </section>
  );

  const editorPane = (
    <section
      aria-label="Write and Answer pane"
      className="flex h-full min-w-0 flex-col"
      style={{ backgroundColor: 'var(--bg-canvas)' }}
    >
      <div
        className="no-print flex items-center justify-between gap-3 px-6 py-3"
        style={{ borderBottom: '1px solid var(--border-hairline)' }}
      >
        <span
          className="text-[12.5px] font-semibold tracking-[-0.01em] whitespace-nowrap"
          style={{ color: 'var(--ink-primary)' }}
        >
          Write / Answer
        </span>
        <span
          className="text-[11.5px] whitespace-nowrap"
          style={{ color: 'var(--ink-muted)' }}
        >
          Slash commands active
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <BlockEditor
          note={note}
          focusMode={focusMode}
          unfoldKey={unfoldKey}
          isSplitPane
          onUpdateNote={onUpdateNote}
        />
      </div>
    </section>
  );

  const firstPane = swapped ? editorPane : referencePane;
  const secondPane = swapped ? referencePane : editorPane;

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full flex-col md:flex-row overflow-hidden"
    >
      <div
        className="h-1/2 md:h-full min-w-0 shrink-0"
        style={{
          flexBasis: `${leftPercent}%`,
          transition: dragging ? 'none' : 'flex-basis 260ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {firstPane}
      </div>

      {/* Tactile Draggable Resize Divider */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize split screen panes"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onDoubleClick={() => setLeftPercent(50)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setLeftPercent((p) => Math.max(26, p - 4));
          if (e.key === 'ArrowRight') setLeftPercent((p) => Math.min(74, p + 4));
        }}
        title="Drag to resize · Double-click to reset"
        className="no-print group relative hidden md:flex w-[9px] shrink-0 cursor-col-resize items-center justify-center"
        style={{ backgroundColor: 'var(--bg-canvas)' }}
      >
        <div
          className="h-full w-px transition-colors duration-200"
          style={{
            backgroundColor: dragging ? 'var(--accent)' : 'var(--border-hairline)',
          }}
        />
        <div
          className="absolute h-9 w-[3px] rounded-full opacity-40 transition-all duration-200 group-hover:opacity-100"
          style={{
            backgroundColor: dragging ? 'var(--accent)' : 'var(--ink-muted)',
          }}
        />
      </div>

      {/* Mobile horizontal divider */}
      <div
        className="no-print h-px w-full shrink-0 md:hidden"
        style={{ backgroundColor: 'var(--border-hairline)' }}
      />

      <div className="min-h-0 min-w-0 flex-1 h-1/2 md:h-full">
        {secondPane}
      </div>
    </div>
  );
};
