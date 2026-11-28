import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent, Editor, Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
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
import {
  formatExportDateTag,
  formatFullEditTimestamp,
  formatMarginEditDate,
  toCalendarDateKey,
} from '../utils/blocks';
import { filterSlashCommands, SlashMenu } from './SlashMenu';

export interface RichEditorSurfaceProps {
  /** Key identifying the document (e.g. note.id) so external switches reset content. */
  docKey: string;
  /** Initial / external HTML content. */
  contentHtml: string;
  /** Placeholder text when empty. */
  placeholder?: string;
  /** Whether to show quiet right-margin edit date labels. */
  showMarginDates?: boolean;
  /** Whether there is no outer right margin (e.g. Split Screen pane). */
  compactMarginDates?: boolean;
  /** Called whenever the editor HTML changes. */
  onChangeHtml: (html: string) => void;
  /** Called when the Tiptap Editor instance is created or updated. */
  onEditorReady?: (editor: Editor | null) => void;
  /** Optional className for the wrapper. */
  className?: string;
}

const TIMESTAMP_NODE_TYPES = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'image',
] as const;

const TIMESTAMP_NODE_SET = new Set<string>(TIMESTAMP_NODE_TYPES);
const blockTimestampPluginKey = new PluginKey('blockTimestamp');

const BlockTimestamp = Extension.create({
  name: 'blockTimestamp',

  addGlobalAttributes() {
    return [
      {
        types: [...TIMESTAMP_NODE_TYPES],
        attributes: {
          updatedAt: {
            default: null,
            parseHTML: (element) => {
              const raw = element.getAttribute('data-updated-at');
              if (!raw) return null;
              const parsed = Number(raw);
              return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
            },
            renderHTML: (attributes) => {
              if (!attributes.updatedAt) return {};
              return { 'data-updated-at': String(attributes.updatedAt) };
            },
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: blockTimestampPluginKey,
        appendTransaction(transactions, _oldState, newState) {
          const activeTrs = transactions.filter(
            (tr) =>
              tr.docChanged &&
              !tr.getMeta('preventUpdate') &&
              !tr.getMeta('history$') &&
              !tr.getMeta('blockTimestampApplied') &&
              !tr.getMeta('skipBlockTimestamp')
          );
          if (activeTrs.length === 0) return null;

          const activeSet = new Set(activeTrs);
          const touchedTopPositions = new Set<number>();

          const addTopBlockAtPos = (pos: number) => {
            const clamped = Math.max(0, Math.min(pos, newState.doc.content.size));
            const $r = newState.doc.resolve(clamped);
            if ($r.depth >= 1) {
              touchedTopPositions.add($r.before(1));
            }
          };

          for (let tIdx = 0; tIdx < transactions.length; tIdx += 1) {
            const tr = transactions[tIdx];
            if (!activeSet.has(tr)) continue;

            for (let sIdx = 0; sIdx < tr.steps.length; sIdx += 1) {
              const step = tr.steps[sIdx];
              const stepBeforeDoc = tr.docs[sIdx];
              const stepMap = tr.mapping.maps[sIdx];

              const maybeStepPos = (step as unknown as { pos?: unknown }).pos;
              if (typeof maybeStepPos === 'number') {
                let mappedPos = maybeStepPos;
                for (let k = sIdx + 1; k < tr.mapping.maps.length; k += 1) {
                  mappedPos = tr.mapping.maps[k].map(mappedPos, 1);
                }
                for (let tNext = tIdx + 1; tNext < transactions.length; tNext += 1) {
                  mappedPos = transactions[tNext].mapping.map(mappedPos, 1);
                }
                addTopBlockAtPos(mappedPos);
              }

              stepMap.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
                let effectiveNewStart = newStart;
                let effectiveNewEnd = newEnd;

                const maybeReplace = step as unknown as {
                  from?: number;
                  to?: number;
                  slice?: { size: number; openStart: number; content: { childCount: number } };
                };
                if (
                  typeof maybeReplace.from === 'number' &&
                  typeof maybeReplace.to === 'number' &&
                  maybeReplace.from === maybeReplace.to &&
                  maybeReplace.slice &&
                  maybeReplace.slice.size > 0 &&
                  maybeReplace.slice.openStart >= 1 &&
                  maybeReplace.slice.content.childCount >= 2 &&
                  stepBeforeDoc
                ) {
                  const $oldFrom = stepBeforeDoc.resolve(maybeReplace.from);
                  if ($oldFrom.depth === 1) {
                    if (
                      $oldFrom.parentOffset === $oldFrom.parent.content.size &&
                      effectiveNewStart < effectiveNewEnd
                    ) {
                      effectiveNewStart += 1;
                    } else if (
                      $oldFrom.parentOffset === 0 &&
                      $oldFrom.parent.content.size > 0 &&
                      effectiveNewEnd > effectiveNewStart
                    ) {
                      effectiveNewEnd -= 1;
                    }
                  }
                }

                let mappedFrom = effectiveNewStart;
                let mappedTo = effectiveNewEnd;
                const isRange = mappedFrom < mappedTo;

                for (let k = sIdx + 1; k < tr.mapping.maps.length; k += 1) {
                  mappedFrom = tr.mapping.maps[k].map(mappedFrom, isRange ? 1 : 0);
                  mappedTo = tr.mapping.maps[k].map(mappedTo, isRange ? -1 : 0);
                }
                for (let tNext = tIdx + 1; tNext < transactions.length; tNext += 1) {
                  mappedFrom = transactions[tNext].mapping.map(mappedFrom, isRange ? 1 : 0);
                  mappedTo = transactions[tNext].mapping.map(mappedTo, isRange ? -1 : 0);
                }

                newState.doc.forEach((_node, nodePos, _index) => {
                  const node = newState.doc.nodeAt(nodePos);
                  if (!node) return;
                  const nodeEnd = nodePos + node.nodeSize;
                  const overlaps =
                    mappedFrom === mappedTo
                      ? mappedFrom > nodePos && mappedFrom < nodeEnd
                      : nodeEnd > mappedFrom && nodePos < mappedTo;
                  if (overlaps) {
                    touchedTopPositions.add(nodePos);
                  }
                });
              });
            }
          }

          if (touchedTopPositions.size === 0) return null;

          const now = Date.now();
          const outTr = newState.tr;
          let modified = false;

          newState.doc.forEach((node, nodePos) => {
            if (!touchedTopPositions.has(nodePos)) return;
            if (!TIMESTAMP_NODE_SET.has(node.type.name)) return;
            const prevTs = node.attrs.updatedAt as number | null | undefined;
            if (!prevTs || Math.abs(now - prevTs) >= 1000) {
              outTr.setNodeMarkup(nodePos, undefined, {
                ...node.attrs,
                updatedAt: now,
              });
              modified = true;
            }
          });

          if (!modified) return null;
          outTr.setMeta('blockTimestampApplied', true);
          return outTr;
        },
      }),
    ];
  },
});

interface MarginDateLabel {
  key: string;
  label: string;
  exportLabel: string;
  tooltip: string;
  top: number;
  blockTop: number;
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
  showMarginDates = false,
  compactMarginDates = false,
  onChangeHtml,
  onEditorReady,
  className,
}) => {
  const [slash, setSlash] = useState<SlashState>(INITIAL_SLASH_STATE);
  const [toolbar, setToolbar] = useState<SelectionToolbarState>(INITIAL_TOOLBAR_STATE);
  const [marginLabels, setMarginLabels] = useState<MarginDateLabel[]>([]);
  const [isCompactMargin, setIsCompactMargin] = useState<boolean>(compactMarginDates);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
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
      BlockTimestamp,
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

  const recomputeMarginLabels = useCallback(() => {
    const wrapperEl = wrapperRef.current;
    if (!editor || !showMarginDates || !wrapperEl || editor.isDestroyed) {
      setMarginLabels([]);
      return;
    }

    const wrapperRect = wrapperEl.getBoundingClientRect();
    const scrollContainer = wrapperEl.closest('.overflow-y-auto');
    const containerRight = scrollContainer
      ? scrollContainer.getBoundingClientRect().right
      : window.innerWidth;
    const spaceOnRight = containerRight - wrapperRect.right;
    setIsCompactMargin(compactMarginDates || spaceOnRight < 96);

    const nextLabels: MarginDateLabel[] = [];
    let prevDateKey: string | null = null;
    const nowTs = Date.now();

    editor.state.doc.forEach((node, offset) => {
      if (node.type.name === 'horizontalRule') {
        return;
      }

      const rawTs = node.attrs.updatedAt;
      const ts =
        typeof rawTs === 'number' && Number.isFinite(rawTs) && rawTs > 0
          ? rawTs
          : null;
      const dateKey = ts ? toCalendarDateKey(ts) : null;

      if (ts && dateKey && dateKey !== prevDateKey) {
        const dom = editor.view.nodeDOM(offset);
        if (dom instanceof HTMLElement) {
          const firstLineEl = dom.matches('ul, ol, blockquote')
            ? dom.querySelector('p, li') ?? dom
            : dom;
          const targetRect = firstLineEl.getBoundingClientRect();
          const lineHeight = parseFloat(window.getComputedStyle(firstLineEl).lineHeight);
          const effectiveLh = Number.isFinite(lineHeight) ? lineHeight : 24;
          const blockTop = dom.getBoundingClientRect().top - wrapperRect.top;
          const firstLineTop = targetRect.top - wrapperRect.top;
          const alignedTop =
            dom.tagName === 'IMG'
              ? firstLineTop + 6
              : firstLineTop + Math.max(0, (effectiveLh - 16) / 2);

          nextLabels.push({
            key: `${offset}-${dateKey}`,
            label: formatMarginEditDate(ts, nowTs),
            exportLabel: formatExportDateTag(ts),
            tooltip: formatFullEditTimestamp(ts),
            top: alignedTop,
            blockTop,
          });
        }
      }

      prevDateKey = dateKey;
    });

    setMarginLabels(nextLabels);
  }, [editor, showMarginDates, compactMarginDates]);

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
      requestAnimationFrame(recomputeMarginLabels);
      return;
    }
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      requestAnimationFrame(recomputeMarginLabels);
      return;
    }
    if (contentHtml !== lastExternalHtmlRef.current) {
      lastExternalHtmlRef.current = contentHtml;
      editor.commands.setContent(contentHtml, { emitUpdate: false });
      requestAnimationFrame(recomputeMarginLabels);
    }
  }, [docKey, contentHtml, editor, recomputeMarginLabels]);

  // Recompute margin labels on resize, layout transitions, and editor updates
  useEffect(() => {
    if (!editor || !showMarginDates) {
      setMarginLabels([]);
      return;
    }

    let rafId = requestAnimationFrame(recomputeMarginLabels);
    const settleTimer = window.setTimeout(recomputeMarginLabels, 380);
    const schedule = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(recomputeMarginLabels);
    };

    editor.on('update', schedule);
    window.addEventListener('resize', schedule);
    document.fonts?.ready?.then(schedule).catch(() => {});

    const wrapperEl = wrapperRef.current;
    const scrollContainer = wrapperEl?.closest('.overflow-y-auto') ?? null;
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(schedule)
        : null;
    if (ro && wrapperEl) ro.observe(wrapperEl);
    if (ro && scrollContainer) ro.observe(scrollContainer);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(settleTimer);
      editor.off('update', schedule);
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
    };
  }, [editor, showMarginDates, recomputeMarginLabels]);

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
    <div
      ref={wrapperRef}
      className={className ? `relative ${className}` : 'relative'}
      onKeyDownCapture={handleEditorKeyDownCapture}
    >
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

      {showMarginDates && marginLabels.length > 0 && (
        <div
          aria-hidden="true"
          className="no-print folio-print-gutter pointer-events-none absolute inset-0 z-10"
        >
          {marginLabels.map((item) => {
            const compactTop = Math.max(-14, item.blockTop - 13);
            return (
              <span
                key={item.key}
                title={item.tooltip}
                className={`folio-margin-date-label pointer-events-auto absolute select-none whitespace-nowrap ${
                  isCompactMargin ? 'folio-margin-date-label--compact' : ''
                }`}
                style={
                  {
                    '--compact-top': `${compactTop}px`,
                    top: isCompactMargin ? `${compactTop}px` : `${item.top}px`,
                    ...(isCompactMargin ? { right: 0 } : { left: 'calc(100% + 24px)' }),
                    fontSize: isCompactMargin ? '10.5px' : '11px',
                    lineHeight: isCompactMargin ? '12px' : '16px',
                    color: 'var(--ink-muted)',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                  } as React.CSSProperties & Record<'--compact-top', string>
                }
              >
                <span className="folio-margin-screen-text">{item.label}</span>
                <span className="folio-margin-print-text">{item.exportLabel}</span>
              </span>
            );
          })}
        </div>
      )}

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
