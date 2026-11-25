import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion } from 'motion/react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Check,
  CheckSquare,
  Copy,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { BlockType, Note, NoteBlock } from '../types/note';
import {
  blocksToPlainText,
  createBlock,
  formatRelativeDate,
} from '../utils/blocks';
import { filterSlashCommands, SlashMenu } from './SlashMenu';

// ─── types ────────────────────────────────────────────────────────────────────

interface BlockEditorProps {
  note: Note;
  focusMode: boolean;
  unfoldKey: number;
  isSplitPane?: boolean;
  onUpdateNote: (updater: (prev: Note) => Note) => void;
}

interface SlashState {
  isOpen: boolean;
  rangeFrom: number;
  rangeTo: number;
  query: string;
  position: { top: number; left: number };
  selectedIndex: number;
}

interface SelectionToolbarState {
  visible: boolean;
  top: number;
  left: number;
}

const INITIAL_SLASH_STATE: SlashState = {
  isOpen: false,
  rangeFrom: 0,
  rangeTo: 0,
  query: '',
  position: { top: 0, left: 0 },
  selectedIndex: 0,
};

const INITIAL_TOOLBAR_STATE: SelectionToolbarState = {
  visible: false,
  top: 0,
  left: 0,
};

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
}) => {
  const [slash, setSlash] = useState<SlashState>(INITIAL_SLASH_STATE);
  const [toolbar, setToolbar] = useState<SelectionToolbarState>(INITIAL_TOOLBAR_STATE);
  const [copiedNote, setCopiedNote] = useState(false);

  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const isInternalUpdateRef = useRef(false);
  const lastNoteIdRef = useRef(note.id);

  const filteredCommands = useMemo(() => filterSlashCommands(slash.query), [slash.query]);
  const closeSlashMenu = useCallback(() => setSlash(INITIAL_SLASH_STATE), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({
        placeholder: 'Begin writing, or type "/" for commands...',
      }),
    ],
    content: blocksToTiptapHtml(note.blocks),
    onUpdate: ({ editor: ed }) => {
      isInternalUpdateRef.current = true;
      const html = ed.getHTML();
      const nextBlocks = tiptapHtmlToBlocks(html);
      onUpdateNote((prev) => ({
        ...prev,
        blocks: nextBlocks,
        updatedAt: Date.now(),
      }));

      // Detect slash command trigger
      const { from } = ed.state.selection;
      const $pos = ed.state.doc.resolve(from);
      const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, undefined, '\ufffc');
      const match = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9-]*)$/);
      if (match) {
        const query = match[1] ?? '';
        const slashFrom = from - query.length - 1;
        const coords = ed.view.coordsAtPos(from);
        setSlash({
          isOpen: true,
          rangeFrom: slashFrom,
          rangeTo: from,
          query,
          position: { top: coords.bottom + 6, left: coords.left },
          selectedIndex: 0,
        });
      } else {
        setSlash((prev) => (prev.isOpen ? INITIAL_SLASH_STATE : prev));
      }
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to, empty } = ed.state.selection;
      if (empty || from === to) {
        setToolbar((prev) => (prev.visible ? INITIAL_TOOLBAR_STATE : prev));
        return;
      }
      const startCoords = ed.view.coordsAtPos(from);
      const endCoords = ed.view.coordsAtPos(to);
      const midLeft = (startCoords.left + endCoords.left) / 2;
      const clampedLeft = Math.max(16, Math.min(window.innerWidth - 380, midLeft - 170));
      const clampedTop = Math.max(12, Math.min(startCoords.top, endCoords.top) - 52);
      setToolbar({ visible: true, top: clampedTop, left: clampedLeft });
    },
  });

  // Sync editor content when switching notes
  useEffect(() => {
    if (!editor) return;
    if (lastNoteIdRef.current !== note.id) {
      lastNoteIdRef.current = note.id;
      isInternalUpdateRef.current = false;
      editor.commands.setContent(blocksToTiptapHtml(note.blocks), { emitUpdate: false });
      setSlash(INITIAL_SLASH_STATE);
      setToolbar(INITIAL_TOOLBAR_STATE);
    } else if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
    }
  }, [note.id, note.blocks, editor]);

  // Title auto-resize
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [note.title, note.id]);

  // Close toolbar on outside mousedown
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-selection-toolbar="true"]')) return;
      if (!editor) return;
      if (editor.state.selection.empty) {
        setToolbar((prev) => (prev.visible ? INITIAL_TOOLBAR_STATE : prev));
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [editor]);

  // Apply slash command
  const applySlashCommand = useCallback(
    (commandType: BlockType) => {
      if (!editor) return;
      const chain = editor
        .chain()
        .focus()
        .deleteRange({ from: slash.rangeFrom, to: slash.rangeTo });

      switch (commandType) {
        case 'h1':
          chain.setHeading({ level: 1 }).run();
          break;
        case 'h2':
          chain.setHeading({ level: 2 }).run();
          break;
        case 'bullet':
          chain.toggleBulletList().run();
          break;
        case 'numbered':
          chain.toggleOrderedList().run();
          break;
        case 'checklist':
          chain.toggleTaskList().run();
          break;
        case 'callout':
          chain.toggleBlockquote().run();
          break;
        case 'divider':
          chain.setHorizontalRule().run();
          break;
        default:
          chain.setParagraph().run();
          break;
      }
      closeSlashMenu();
    },
    [editor, slash.rangeFrom, slash.rangeTo, closeSlashMenu]
  );

  // Slash menu keyboard navigation
  const handleEditorKeyDownCapture = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!slash.isOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (filteredCommands.length > 0) {
          setSlash((prev) => ({
            ...prev,
            selectedIndex: (prev.selectedIndex + 1) % filteredCommands.length,
          }));
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (filteredCommands.length > 0) {
          setSlash((prev) => ({
            ...prev,
            selectedIndex:
              (prev.selectedIndex - 1 + filteredCommands.length) % filteredCommands.length,
          }));
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const chosen = filteredCommands[slash.selectedIndex];
        if (chosen) applySlashCommand(chosen.id);
        else closeSlashMenu();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeSlashMenu();
      }
    },
    [slash.isOpen, slash.selectedIndex, filteredCommands, applySlashCommand, closeSlashMenu]
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
      {/* Quiet top-right Undo / Redo / Copy Note bar */}
      {!focusMode && (
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
        <div onKeyDownCapture={handleEditorKeyDownCapture}>
          <EditorContent editor={editor} />
        </div>

        {/* Click target below editor */}
        <div
          onClick={() => editor?.commands.focus('end')}
          className="no-print min-h-[160px] flex-1 cursor-text"
          aria-hidden="true"
        />
      </motion.article>

      {/* Floating Selection Toolbar */}
      {toolbar.visible && editor && (
        <div
          data-selection-toolbar="true"
          onMouseDown={(e) => e.preventDefault()}
          className="no-print fixed z-50 flex items-center gap-0.5 rounded-xl px-2 py-1.5"
          style={{
            top: toolbar.top,
            left: toolbar.left,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-strong)',
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.12)',
            color: 'var(--ink-primary)',
          }}
        >
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className="rounded-md px-2 py-1 text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: editor.isActive('heading', { level: 1 })
                ? 'var(--accent-soft)'
                : 'transparent',
              color: editor.isActive('heading', { level: 1 })
                ? 'var(--accent)'
                : 'var(--ink-primary)',
            }}
          >
            H1
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className="rounded-md px-2 py-1 text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: editor.isActive('heading', { level: 2 })
                ? 'var(--accent-soft)'
                : 'transparent',
              color: editor.isActive('heading', { level: 2 })
                ? 'var(--accent)'
                : 'var(--ink-primary)',
            }}
          >
            H2
          </button>

          <button
            type="button"
            title="Bold (Ctrl+B / ⌘B)"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className="rounded-md px-2 py-1 text-[13px] font-bold transition-colors"
            style={{
              backgroundColor: editor.isActive('bold') ? 'var(--accent-soft)' : 'transparent',
              color: editor.isActive('bold') ? 'var(--accent)' : 'var(--ink-primary)',
            }}
          >
            <Bold className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Italic (Ctrl+I / ⌘I)"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{
              backgroundColor: editor.isActive('italic') ? 'var(--accent-soft)' : 'transparent',
              color: editor.isActive('italic') ? 'var(--accent)' : 'var(--ink-primary)',
            }}
          >
            <Italic className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Underline (Ctrl+U / ⌘U)"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{
              backgroundColor: editor.isActive('underline') ? 'var(--accent-soft)' : 'transparent',
              color: editor.isActive('underline') ? 'var(--accent)' : 'var(--ink-primary)',
            }}
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Code"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{
              backgroundColor: editor.isActive('code') ? 'var(--accent-soft)' : 'transparent',
              color: editor.isActive('code') ? 'var(--accent)' : 'var(--ink-primary)',
            }}
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Quote Callout"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{
              backgroundColor: editor.isActive('blockquote') ? 'var(--accent-soft)' : 'transparent',
              color: editor.isActive('blockquote') ? 'var(--accent)' : 'var(--ink-primary)',
            }}
          >
            <Quote className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Bullet List"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{
              backgroundColor: editor.isActive('bulletList') ? 'var(--accent-soft)' : 'transparent',
              color: editor.isActive('bulletList') ? 'var(--accent)' : 'var(--ink-primary)',
            }}
          >
            <List className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Numbered List"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{
              backgroundColor: editor.isActive('orderedList') ? 'var(--accent-soft)' : 'transparent',
              color: editor.isActive('orderedList') ? 'var(--accent)' : 'var(--ink-primary)',
            }}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Checklist"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{
              backgroundColor: editor.isActive('taskList') ? 'var(--accent-soft)' : 'transparent',
              color: editor.isActive('taskList') ? 'var(--accent)' : 'var(--ink-primary)',
            }}
          >
            <CheckSquare className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <SlashMenu
        isOpen={slash.isOpen}
        position={slash.position}
        items={filteredCommands}
        selectedIndex={slash.selectedIndex}
        onSelect={applySlashCommand}
        onHover={(i) => setSlash((prev) => ({ ...prev, selectedIndex: i }))}
        onClose={closeSlashMenu}
      />
    </div>
  );
};
