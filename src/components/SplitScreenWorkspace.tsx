import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Editor } from '@tiptap/react';
import { ArrowLeftRight, Eraser, Redo2, Undo2 } from 'lucide-react';
import { Note } from '../types/note';
import { htmlToText } from '../utils/blocks';
import { BlockEditor } from './BlockEditor';
import { RichEditorSurface } from './RichEditorSurface';

interface SplitScreenWorkspaceProps {
  note: Note;
  focusMode: boolean;
  swapped: boolean;
  unfoldKey: number;
  onSwapPanes: () => void;
  onUpdateNote: (updater: (prev: Note) => Note) => void;
}

function referenceToHtml(raw: string): string {
  if (!raw) return '<p></p>';
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
  return raw
    .split(/\n/)
    .map((line) => {
      const escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<p>${escaped}</p>`;
    })
    .join('');
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
  const [refEditor, setRefEditor] = useState<Editor | null>(null);
  const [writeEditor, setWriteEditor] = useState<Editor | null>(null);

  const referencePlain = useMemo(() => htmlToText(note.referenceText), [note.referenceText]);
  const referenceWordCount = useMemo(() => {
    const trimmed = referencePlain.trim();
    return trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  }, [referencePlain]);

  const referenceHtml = useMemo(
    () => referenceToHtml(note.referenceText),
    [note.referenceText]
  );

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
    if (!referencePlain.trim()) return;
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

  const handleReferenceChange = useCallback(
    (html: string) => {
      if (clearedBackup !== null) setClearedBackup(null);
      onUpdateNote((prev) => ({
        ...prev,
        referenceText: html,
        updatedAt: Date.now(),
      }));
    },
    [clearedBackup, onUpdateNote]
  );

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

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            title="Undo (Ctrl+Z / ⌘Z)"
            disabled={!refEditor?.can().undo()}
            onClick={() => refEditor?.chain().focus().undo().run()}
            className="rounded p-1 transition-colors hover:bg-black/5 disabled:opacity-30"
            style={{ color: 'var(--ink-muted)' }}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Y / ⌘⇧Z)"
            disabled={!refEditor?.can().redo()}
            onClick={() => refEditor?.chain().focus().redo().run()}
            className="rounded p-1 transition-colors hover:bg-black/5 disabled:opacity-30"
            style={{ color: 'var(--ink-muted)' }}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>

          {clearedBackup !== null && !referencePlain.trim() && (
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
            disabled={!referencePlain.trim()}
            title="Clear reference text"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-opacity duration-200 disabled:opacity-35"
            style={{ color: 'var(--ink-secondary)' }}
          >
            <Eraser className="h-3.5 w-3.5" />
            Clear Reference
          </button>
        </div>
      </div>

      <div
        onClick={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('.ProseMirror, button, input, a, [data-selection-toolbar="true"]')) {
            return;
          }
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed) return;
          refEditor?.commands.focus('end');
        }}
        className="flex-1 overflow-y-auto px-6 py-6 cursor-text"
      >
        <RichEditorSurface
          docKey={`ref-${note.id}`}
          contentHtml={referenceHtml}
          placeholder="Paste study questions, source excerpts, or type '/' for commands..."
          onChangeHtml={handleReferenceChange}
          onEditorReady={setRefEditor}
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
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="Undo (Ctrl+Z / ⌘Z)"
            disabled={!writeEditor?.can().undo()}
            onClick={() => writeEditor?.chain().focus().undo().run()}
            className="rounded p-1 transition-colors hover:bg-black/5 disabled:opacity-30"
            style={{ color: 'var(--ink-muted)' }}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Y / ⌘⇧Z)"
            disabled={!writeEditor?.can().redo()}
            onClick={() => writeEditor?.chain().focus().redo().run()}
            className="rounded p-1 transition-colors hover:bg-black/5 disabled:opacity-30"
            style={{ color: 'var(--ink-muted)' }}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <span
            className="ml-1 text-[11.5px] whitespace-nowrap"
            style={{ color: 'var(--ink-muted)' }}
          >
            Slash commands active
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <BlockEditor
          note={note}
          focusMode={focusMode}
          unfoldKey={unfoldKey}
          isSplitPane
          onUpdateNote={onUpdateNote}
          onEditorReady={setWriteEditor}
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
