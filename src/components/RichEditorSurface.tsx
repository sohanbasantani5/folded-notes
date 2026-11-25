import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import {
  Bold,
  CheckSquare,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { BlockType } from '../types/note';
import { filterSlashCommands, SlashMenu } from './SlashMenu';

export interface RichEditorSurfaceProps {
  /** Key identifying the document (e.g. note.id) so external switches reset content. */
  docKey: string;
  /** Initial / external HTML content. */
  contentHtml: string;
  /** Placeholder text when empty. */
  placeholder?: string;
  /** Called whenever the editor HTML changes. */
  onChangeHtml: (html: string) => void;
  /** Called when the Tiptap Editor instance is created or updated. */
  onEditorReady?: (editor: Editor | null) => void;
  /** Optional className for the wrapper. */
  className?: string;
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

/** Compress an image File client-side (max 1400px wide, 0.85 quality) → data URL. */
function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const maxWidth = 1400;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const isPng = file.type === 'image/png';
        const mime = isPng ? 'image/png' : 'image/webp';
        let dataUrl = canvas.toDataURL(mime, 0.85);
        if (!isPng && !dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export const RichEditorSurface: React.FC<RichEditorSurfaceProps> = ({
  docKey,
  contentHtml,
  placeholder = 'Begin writing, or type "/" for commands...',
  onChangeHtml,
  onEditorReady,
  className,
}) => {
  const [slash, setSlash] = useState<SlashState>(INITIAL_SLASH_STATE);
  const [toolbar, setToolbar] = useState<SelectionToolbarState>(INITIAL_TOOLBAR_STATE);

  const isInternalUpdateRef = useRef(false);
  const lastDocKeyRef = useRef(docKey);
  const lastExternalHtmlRef = useRef(contentHtml);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const filteredCommands = useMemo(() => filterSlashCommands(slash.query), [slash.query]);
  const closeSlashMenu = useCallback(() => setSlash(INITIAL_SLASH_STATE), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        undoRedo: {
          depth: 100,
          newGroupDelay: 250,
        },
      }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: true, autolink: true, linkOnPaste: true }),
    ],
    content: contentHtml,
    editorProps: {
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (!file) continue;
            event.preventDefault();
            compressImageFile(file).then((src) => {
              const { schema, tr } = view.state;
              const node = schema.nodes.image?.create({ src });
              if (node) view.dispatch(tr.replaceSelectionWith(node));
            }).catch(() => {});
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (imageFiles.length === 0) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        for (const file of imageFiles) {
          compressImageFile(file).then((src) => {
            const { schema, tr } = view.state;
            const node = schema.nodes.image?.create({ src });
            if (node) {
              const pos = coords?.pos ?? view.state.selection.from;
              view.dispatch(tr.insert(pos, node));
            }
          }).catch(() => {});
        }
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      isInternalUpdateRef.current = true;
      const html = ed.getHTML();
      lastExternalHtmlRef.current = html;
      onChangeHtml(html);

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

  useEffect(() => {
    onEditorReady?.(editor ?? null);
  }, [editor, onEditorReady]);

  // Sync editor content when switching notes or when cleared/restored externally
  useEffect(() => {
    if (!editor) return;
    if (lastDocKeyRef.current !== docKey) {
      lastDocKeyRef.current = docKey;
      lastExternalHtmlRef.current = contentHtml;
      isInternalUpdateRef.current = false;
      editor.commands.setContent(contentHtml, { emitUpdate: false });
      setSlash(INITIAL_SLASH_STATE);
      setToolbar(INITIAL_TOOLBAR_STATE);
      return;
    }
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    if (contentHtml !== lastExternalHtmlRef.current) {
      lastExternalHtmlRef.current = contentHtml;
      editor.commands.setContent(contentHtml, { emitUpdate: false });
    }
  }, [docKey, contentHtml, editor]);

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
        case 'image':
          chain.run();
          imageInputRef.current?.click();
          break;
        default:
          chain.setParagraph().run();
          break;
      }
      closeSlashMenu();
    },
    [editor, slash.rangeFrom, slash.rangeTo, closeSlashMenu]
  );

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

  return (
    <div className={className} onKeyDownCapture={handleEditorKeyDownCapture}>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file || !editor) return;
          compressImageFile(file)
            .then((src) => {
              editor.chain().focus().setImage({ src }).run();
            })
            .catch(() => {});
        }}
      />
      <EditorContent editor={editor} />

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
            title="Link"
            onClick={() => {
              if (editor.isActive('link')) {
                editor.chain().focus().unsetLink().run();
                return;
              }
              const url = window.prompt('Enter URL');
              if (url && url.trim()) {
                editor.chain().focus().setLink({ href: url.trim() }).run();
              }
            }}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{
              backgroundColor: editor.isActive('link') ? 'var(--accent-soft)' : 'transparent',
              color: editor.isActive('link') ? 'var(--accent)' : 'var(--ink-primary)',
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
              backgroundColor: editor.isActive('orderedList')
                ? 'var(--accent-soft)'
                : 'transparent',
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
