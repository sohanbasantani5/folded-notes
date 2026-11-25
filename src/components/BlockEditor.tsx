import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion } from 'motion/react';
import { Editor } from '@tiptap/react';
import { Check, Copy, Redo2, Undo2 } from 'lucide-react';
import { Note, NoteBlock } from '../types/note';
import {
  blocksToPlainText,
  createBlock,
  formatRelativeDate,
} from '../utils/blocks';
import { RichEditorSurface } from './RichEditorSurface';

// ─── types ────────────────────────────────────────────────────────────────────

interface BlockEditorProps {
  note: Note;
  focusMode: boolean;
  unfoldKey: number;
  isSplitPane?: boolean;
  onUpdateNote: (updater: (prev: Note) => Note) => void;
  onEditorReady?: (editor: Editor | null) => void;
}

// ─── blocks ↔ Tiptap HTML conversion ─────────────────────────────────────────

function inlineToHtml(content: string): string {
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return content;
  }
  const escaped = content
    .replace(/&(?![a-z#0-9]+;)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function blocksToTiptapHtml(blocks: NoteBlock[]): string {
  if (!blocks || blocks.length === 0) return '<p></p>';
  const parts: string[] = [];
  let inUl = false;
  let inOl = false;
  let inTask = false;

  const closeLists = () => {
    if (inUl) { parts.push('</ul>'); inUl = false; }
    if (inOl) { parts.push('</ol>'); inOl = false; }
    if (inTask) { parts.push('</ul>'); inTask = false; }
  };

  for (const block of blocks) {
    const html = inlineToHtml(block.content);
    if (block.type === 'bullet') {
      if (inOl || inTask) closeLists();
      if (!inUl) { parts.push('<ul>'); inUl = true; }
      parts.push(`<li><p>${html}</p></li>`);
      continue;
    }
    if (block.type === 'numbered') {
      if (inUl || inTask) closeLists();
      if (!inOl) { parts.push('<ol>'); inOl = true; }
      parts.push(`<li><p>${html}</p></li>`);
      continue;
    }
    if (block.type === 'checklist') {
      if (inUl || inOl) closeLists();
      if (!inTask) { parts.push('<ul data-type="taskList">'); inTask = true; }
      parts.push(
        `<li data-type="taskItem" data-checked="${block.checked ? 'true' : 'false'}"><p>${html}</p></li>`
      );
      continue;
    }

    closeLists();

    switch (block.type) {
      case 'h1':
        parts.push(`<h1>${html}</h1>`);
        break;
      case 'h2':
        parts.push(`<h2>${html}</h2>`);
        break;
      case 'callout':
        parts.push(`<blockquote><p>${html}</p></blockquote>`);
        break;
      case 'divider':
        parts.push('<hr>');
        break;
      case 'image':
        parts.push(`<img src="${block.content.replace(/"/g, '&quot;')}" alt="Embedded image">`);
        break;
      default:
        parts.push(`<p>${html}</p>`);
        break;
    }
  }
  closeLists();
  return parts.join('');
}

function tiptapHtmlToBlocks(html: string): NoteBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: NoteBlock[] = [];

  for (const node of Array.from(doc.body.children)) {
    const tag = node.tagName.toLowerCase();
    if (tag === 'h1') {
      blocks.push(createBlock('h1', node.innerHTML));
    } else if (tag === 'h2' || tag === 'h3') {
      blocks.push(createBlock('h2', node.innerHTML));
    } else if (tag === 'hr') {
      blocks.push(createBlock('divider', ''));
    } else if (tag === 'img') {
      const src = node.getAttribute('src') ?? '';
      if (src) blocks.push(createBlock('image', src));
    } else if (tag === 'blockquote') {
      const inner = node.querySelector('p')?.innerHTML ?? node.innerHTML;
      blocks.push(createBlock('callout', inner));
    } else if (tag === 'ul') {
      const isTask = node.getAttribute('data-type') === 'taskList';
      for (const li of Array.from(node.children)) {
        if (li.tagName.toLowerCase() !== 'li') continue;
        const inner = li.querySelector('p')?.innerHTML ?? li.innerHTML;
        if (isTask) {
          const checked = li.getAttribute('data-checked') === 'true';
          blocks.push(createBlock('checklist', inner, checked));
        } else {
          blocks.push(createBlock('bullet', inner));
        }
      }
    } else if (tag === 'ol') {
      for (const li of Array.from(node.children)) {
        if (li.tagName.toLowerCase() !== 'li') continue;
        const inner = li.querySelector('p')?.innerHTML ?? li.innerHTML;
        blocks.push(createBlock('numbered', inner));
      }
    } else {
      blocks.push(createBlock('paragraph', node.innerHTML));
    }
  }

  return blocks.length > 0 ? blocks : [createBlock('paragraph', '')];
}

// ─── component ────────────────────────────────────────────────────────────────

export const BlockEditor: React.FC<BlockEditorProps> = ({
  note,
  focusMode,
  unfoldKey,
  isSplitPane = false,
  onUpdateNote,
  onEditorReady,
}) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);

  const contentHtml = useMemo(() => blocksToTiptapHtml(note.blocks), [note.blocks]);

  const handleEditorReady = useCallback(
    (ed: Editor | null) => {
      setEditor(ed);
      onEditorReady?.(ed);
    },
    [onEditorReady]
  );

  // Title auto-resize
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [note.title, note.id]);

  const handleChangeHtml = useCallback(
    (html: string) => {
      const nextBlocks = tiptapHtmlToBlocks(html);
      onUpdateNote((prev) => ({
        ...prev,
        blocks: nextBlocks,
        updatedAt: Date.now(),
      }));
    },
    [onUpdateNote]
  );

  const handleCopyNote = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(blocksToPlainText(note.title, note.blocks));
      setCopiedNote(true);
      setTimeout(() => setCopiedNote(false), 1800);
    } catch {
      /* ignore clipboard errors */
    }
  }, [note.title, note.blocks]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('.ProseMirror, textarea, button, input, a, [data-selection-toolbar="true"]')
      ) {
        return;
      }
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      editor?.commands.focus('end');
    },
    [editor]
  );

  return (
    <div
      onClick={handleCanvasClick}
      className="print-only-canvas relative h-full w-full overflow-y-auto cursor-text"
      style={{ backgroundColor: 'var(--bg-canvas)', perspective: '1200px' }}
    >
      {/* Quiet top-right Undo / Redo / Copy Note bar (main view) */}
      {!focusMode && !isSplitPane && (
        <div
          className="no-print sticky top-3 z-20 float-right mr-4 mt-3 flex items-center gap-0.5 rounded-lg px-1.5 py-1"
          style={{
            backgroundColor: 'var(--bg-canvas)',
            border: '1px solid var(--border-hairline)',
            color: 'var(--ink-muted)',
          }}
        >
          <button
            type="button"
            title="Undo (Ctrl+Z / ⌘Z)"
            disabled={!editor?.can().undo()}
            onClick={() => editor?.chain().focus().undo().run()}
            className="rounded p-1 transition-colors hover:bg-black/5 disabled:opacity-30"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Redo (Ctrl+Y / ⌘⇧Z)"
            disabled={!editor?.can().redo()}
            onClick={() => editor?.chain().focus().redo().run()}
            className="rounded p-1 transition-colors hover:bg-black/5 disabled:opacity-30"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <div className="mx-0.5 h-3.5 w-px" style={{ backgroundColor: 'var(--border-hairline)' }} />
          <button
            type="button"
            title="Copy note as text"
            onClick={handleCopyNote}
            className="rounded p-1 transition-colors hover:bg-black/5"
            style={{ color: copiedNote ? 'var(--accent)' : 'var(--ink-muted)' }}
          >
            {copiedNote ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}

      <motion.article
        key={`${note.id}-${unfoldKey}`}
        initial={{ opacity: 0, y: 14, rotateX: -4, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto flex min-h-full flex-col px-6 sm:px-10 md:px-12"
        style={{
          maxWidth: isSplitPane
            ? 'min(100%, var(--editor-width))'
            : 'calc(var(--editor-width) + 96px)',
          paddingTop: focusMode ? '72px' : isSplitPane ? '36px' : '58px',
          paddingBottom: '180px',
          transformOrigin: 'top center',
        }}
      >
        {/* Note Title */}
        <textarea
          ref={titleRef}
          rows={1}
          value={note.title}
          placeholder="Untitled Note"
          aria-label="Note title"
          onChange={(e) => {
            const val = e.target.value.replace(/\n/g, '');
            onUpdateNote((prev) => ({ ...prev, title: val, updatedAt: Date.now() }));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
              e.preventDefault();
              editor?.commands.focus('start');
            }
          }}
          className="folio-editor-font w-full resize-none overflow-hidden bg-transparent text-[30px] sm:text-[34px] font-semibold leading-[1.22] tracking-[-0.025em] outline-none placeholder:opacity-35"
          style={{
            color: 'var(--ink-primary)',
            textWrap: 'balance',
          }}
        />

        {/* Meta row */}
        <div
          className="no-print mt-2.5 mb-8 flex items-center gap-2 text-[12px] select-none"
          style={{
            color: 'var(--ink-muted)',
            opacity: focusMode ? 0 : 1,
            transition: 'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <span>Edited {formatRelativeDate(note.updatedAt)}</span>
          <span aria-hidden="true">·</span>
          <span>Type / for commands</span>
        </div>

        {/* Tiptap Editor Body */}
        <RichEditorSurface
          docKey={note.id}
          contentHtml={contentHtml}
          onChangeHtml={handleChangeHtml}
          onEditorReady={handleEditorReady}
        />

        {/* Click target below editor */}
        <div
          onClick={() => editor?.commands.focus('end')}
          className="no-print min-h-[160px] flex-1 cursor-text"
          aria-hidden="true"
        />
      </motion.article>
    </div>
  );
};
