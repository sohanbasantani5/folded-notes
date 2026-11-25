import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Trash2 } from 'lucide-react';
import { BlockType, Note, NoteBlock } from '../types/note';
import {
  createBlock,
  formatRelativeDate,
  parseTextToBlocks,
} from '../utils/blocks';
import {
  filterSlashCommands,
  SlashMenu,
} from './SlashMenu';

interface BlockEditorProps {
  note: Note;
  focusMode: boolean;
  unfoldKey: number;
  isSplitPane?: boolean;
  onUpdateNote: (updater: (prev: Note) => Note) => void;
}

interface SlashState {
  isOpen: boolean;
  blockId: string | null;
  slashIndex: number;
  query: string;
  position: { top: number; left: number };
  selectedIndex: number;
}

const INITIAL_SLASH_STATE: SlashState = {
  isOpen: false,
  blockId: null,
  slashIndex: -1,
  query: '',
  position: { top: 0, left: 0 },
  selectedIndex: 0,
};

function getCaretScreenCoordinates(
  textarea: HTMLTextAreaElement,
  caretPos: number
): { top: number; left: number } {
  const rect = textarea.getBoundingClientRect();
  const style = window.getComputedStyle(textarea);

  const mirror = document.createElement('div');
  mirror.style.position = 'fixed';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.width = `${rect.width}px`;
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.fontStyle = style.fontStyle;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.paddingTop = style.paddingTop;
  mirror.style.paddingRight = style.paddingRight;
  mirror.style.paddingBottom = style.paddingBottom;
  mirror.style.paddingLeft = style.paddingLeft;
  mirror.style.border = style.border;
  mirror.style.boxSizing = style.boxSizing;

  const beforeText = textarea.value.slice(0, caretPos);
  mirror.textContent = beforeText;

  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const markerTop = marker.offsetTop;
  const markerLeft = marker.offsetLeft;
  const lineHeight = parseFloat(style.lineHeight) || 24;
  document.body.removeChild(mirror);

  return {
    top: rect.top + markerTop - textarea.scrollTop + lineHeight + 6,
    left: rect.left + markerLeft - textarea.scrollLeft,
  };
}

interface AutoTextareaProps {
  value: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onClick?: (e: React.MouseEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

const AutoTextarea: React.FC<AutoTextareaProps> = ({
  value,
  placeholder,
  className,
  style,
  ariaLabel,
  textareaRef,
  onChange,
  onKeyDown,
  onFocus,
  onClick,
  onPaste,
}) => {
  const localRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const el = localRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    resize();
  }, [value, resize]);

  useEffect(() => {
    const el = localRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => resize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [resize]);

  return (
    <textarea
      ref={(el) => {
        localRef.current = el;
        textareaRef(el);
      }}
      rows={1}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onClick={onClick}
      onPaste={onPaste}
      className={`block w-full resize-none overflow-hidden bg-transparent outline-none ${className ?? ''}`}
      style={style}
    />
  );
};

export const BlockEditor: React.FC<BlockEditorProps> = ({
  note,
  focusMode,
  unfoldKey,
  isSplitPane = false,
  onUpdateNote,
}) => {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(
    note.blocks[0]?.id ?? null
  );
  const [slash, setSlash] = useState<SlashState>(INITIAL_SLASH_STATE);
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const pendingFocusRef = useRef<{ blockId: string; caret?: number } | null>(null);

  const filteredCommands = useMemo(
    () => filterSlashCommands(slash.query),
    [slash.query]
  );

  // Sync title textarea height on note switch or width change
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [note.title, note.id]);

  // Reset active block when switching notes
  useEffect(() => {
    setSlash(INITIAL_SLASH_STATE);
    if (!note.blocks.some((b) => b.id === activeBlockId)) {
      setActiveBlockId(note.blocks[0]?.id ?? null);
    }
  }, [note.id]);

  // Execute pending focus after state update
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    const el = blockRefs.current[pending.blockId];
    if (el) {
      el.focus();
      const pos =
        typeof pending.caret === 'number'
          ? Math.min(pending.caret, el.value.length)
          : el.value.length;
      el.setSelectionRange(pos, pos);
      setActiveBlockId(pending.blockId);
      pendingFocusRef.current = null;
    }
  }, [note.blocks]);

  const closeSlashMenu = useCallback(() => {
    setSlash(INITIAL_SLASH_STATE);
  }, []);

  const updateBlocks = useCallback(
    (updater: (blocks: NoteBlock[]) => NoteBlock[]) => {
      onUpdateNote((prev) => {
        const nextBlocks = updater(prev.blocks);
        return {
          ...prev,
          blocks: nextBlocks.length > 0 ? nextBlocks : [createBlock('paragraph', '')],
          updatedAt: Date.now(),
        };
      });
    },
    [onUpdateNote]
  );

  const applySlashCommand = useCallback(
    (commandType: BlockType) => {
      if (!slash.blockId) return;
      const targetId = slash.blockId;
      const slashIdx = slash.slashIndex;
      const removeLength = slash.query.length + 1;

      if (commandType === 'divider') {
        const nextParagraph = createBlock('paragraph', '');
        const dividerBlock = createBlock('divider', '');

        updateBlocks((blocks) => {
          const index = blocks.findIndex((b) => b.id === targetId);
          if (index === -1) return blocks;
          const current = blocks[index];
          const cleaned = (
            current.content.slice(0, slashIdx) +
            current.content.slice(slashIdx + removeLength)
          ).trim();

          const next = [...blocks];
          if (cleaned.length === 0) {
            next.splice(index, 1, dividerBlock, nextParagraph);
          } else {
            next.splice(
              index,
              1,
              { ...current, content: cleaned },
              dividerBlock,
              nextParagraph
            );
          }
          return next;
        });

        pendingFocusRef.current = { blockId: nextParagraph.id, caret: 0 };
        closeSlashMenu();
        return;
      }

      let nextCaret = slashIdx;
      updateBlocks((blocks) =>
        blocks.map((block) => {
          if (block.id !== targetId) return block;
          const before = block.content.slice(0, slashIdx);
          const after = block.content.slice(slashIdx + removeLength);
          const combined = (before + after).replace(/^\s+/, '');
          nextCaret = Math.min(before.length, combined.length);
          return {
            ...block,
            type: commandType,
            content: combined,
            checked: commandType === 'checklist' ? Boolean(block.checked) : undefined,
          };
        })
      );

      pendingFocusRef.current = { blockId: targetId, caret: nextCaret };
      closeSlashMenu();
    },
    [slash, updateBlocks, closeSlashMenu]
  );

  const detectSlashTrigger = useCallback(
    (blockId: string, value: string, caret: number, textarea: HTMLTextAreaElement) => {
      const beforeCaret = value.slice(0, caret);
      const match = beforeCaret.match(/(?:^|\s)\/([a-zA-Z0-9-]*)$/);
      if (match) {
        const query = match[1] ?? '';
        const slashPos = caret - query.length - 1;
        const pos = getCaretScreenCoordinates(textarea, caret);
        setSlash({
          isOpen: true,
          blockId,
          slashIndex: slashPos,
          query,
          position: pos,
          selectedIndex: 0,
        });
      } else if (slash.isOpen && slash.blockId === blockId) {
        closeSlashMenu();
      }
    },
    [slash.isOpen, slash.blockId, closeSlashMenu]
  );

  const handleBlockChange = useCallback(
    (block: NoteBlock, e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextVal = e.target.value;
      const caret = e.target.selectionStart ?? nextVal.length;

      // Instant Markdown prefix triggers at start of paragraph
      if (block.type === 'paragraph') {
        if (nextVal === '# ') {
          updateBlocks((bs) =>
            bs.map((b) => (b.id === block.id ? { ...b, type: 'h1', content: '' } : b))
          );
          closeSlashMenu();
          return;
        }
        if (nextVal === '## ') {
          updateBlocks((bs) =>
            bs.map((b) => (b.id === block.id ? { ...b, type: 'h2', content: '' } : b))
          );
          closeSlashMenu();
          return;
        }
        if (nextVal === '- ' || nextVal === '* ') {
          updateBlocks((bs) =>
            bs.map((b) => (b.id === block.id ? { ...b, type: 'bullet', content: '' } : b))
          );
          closeSlashMenu();
          return;
        }
        if (nextVal === '1. ') {
          updateBlocks((bs) =>
            bs.map((b) => (b.id === block.id ? { ...b, type: 'numbered', content: '' } : b))
          );
          closeSlashMenu();
          return;
        }
        if (nextVal === '[] ' || nextVal === '[ ] ') {
          updateBlocks((bs) =>
            bs.map((b) =>
              b.id === block.id ? { ...b, type: 'checklist', content: '', checked: false } : b
            )
          );
          closeSlashMenu();
          return;
        }
        if (nextVal === '> ') {
          updateBlocks((bs) =>
            bs.map((b) => (b.id === block.id ? { ...b, type: 'callout', content: '' } : b))
          );
          closeSlashMenu();
          return;
        }
        if (nextVal === '---') {
          const nextPara = createBlock('paragraph', '');
          updateBlocks((bs) => {
            const idx = bs.findIndex((b) => b.id === block.id);
            if (idx === -1) return bs;
            const copy = [...bs];
            copy.splice(idx, 1, createBlock('divider'), nextPara);
            return copy;
          });
          pendingFocusRef.current = { blockId: nextPara.id, caret: 0 };
          closeSlashMenu();
          return;
        }
      }

      updateBlocks((bs) =>
        bs.map((b) => (b.id === block.id ? { ...b, content: nextVal } : b))
      );

      detectSlashTrigger(block.id, nextVal, caret, e.target);
    },
    [updateBlocks, detectSlashTrigger, closeSlashMenu]
  );

  const focusAdjacentTextBlock = useCallback(
    (currentIndex: number, direction: -1 | 1) => {
      let cursor = currentIndex + direction;
      while (cursor >= 0 && cursor < note.blocks.length) {
        const candidate = note.blocks[cursor];
        if (candidate.type !== 'divider') {
          const el = blockRefs.current[candidate.id];
          if (el) {
            el.focus();
            const pos = direction === -1 ? el.value.length : 0;
            el.setSelectionRange(pos, pos);
            setActiveBlockId(candidate.id);
          }
          return true;
        }
        cursor += direction;
      }
      if (direction === -1 && titleRef.current) {
        titleRef.current.focus();
        const len = titleRef.current.value.length;
        titleRef.current.setSelectionRange(len, len);
        return true;
      }
      return false;
    },
    [note.blocks]
  );

  const handleBlockKeyDown = useCallback(
    (block: NoteBlock, index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Slash menu keyboard control
      if (slash.isOpen && slash.blockId === block.id) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (filteredCommands.length > 0) {
            setSlash((prev) => ({
              ...prev,
              selectedIndex: (prev.selectedIndex + 1) % filteredCommands.length,
            }));
          }
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (filteredCommands.length > 0) {
            setSlash((prev) => ({
              ...prev,
              selectedIndex:
                (prev.selectedIndex - 1 + filteredCommands.length) %
                filteredCommands.length,
            }));
          }
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const chosen = filteredCommands[slash.selectedIndex];
          if (chosen) {
            applySlashCommand(chosen.id);
          } else {
            closeSlashMenu();
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeSlashMenu();
          return;
        }
      }

      const target = e.currentTarget;
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;

      // Enter: create next block (continue list or exit empty list)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();

        const isList =
          block.type === 'bullet' ||
          block.type === 'numbered' ||
          block.type === 'checklist';

        if (isList && block.content.trim() === '') {
          updateBlocks((bs) =>
            bs.map((b) =>
              b.id === block.id ? { ...b, type: 'paragraph', checked: undefined } : b
            )
          );
          return;
        }

        const before = block.content.slice(0, start);
        const after = block.content.slice(end);
        const nextType: BlockType = isList ? block.type : 'paragraph';
        const nextBlock = createBlock(nextType, after, false);

        updateBlocks((bs) => {
          const copy = [...bs];
          copy[index] = { ...block, content: before };
          copy.splice(index + 1, 0, nextBlock);
          return copy;
        });

        pendingFocusRef.current = { blockId: nextBlock.id, caret: 0 };
        return;
      }

      // Backspace at position 0
      if (e.key === 'Backspace' && start === 0 && end === 0) {
        if (block.type !== 'paragraph') {
          e.preventDefault();
          updateBlocks((bs) =>
            bs.map((b) =>
              b.id === block.id ? { ...b, type: 'paragraph', checked: undefined } : b
            )
          );
          return;
        }

        if (index > 0) {
          e.preventDefault();
          const prevBlock = note.blocks[index - 1];
          if (prevBlock.type === 'divider') {
            updateBlocks((bs) => bs.filter((b) => b.id !== prevBlock.id));
            return;
          }
          const mergeCaret = prevBlock.content.length;
          updateBlocks((bs) => {
            const copy = [...bs];
            copy[index - 1] = {
              ...prevBlock,
              content: prevBlock.content + block.content,
            };
            copy.splice(index, 1);
            return copy;
          });
          pendingFocusRef.current = { blockId: prevBlock.id, caret: mergeCaret };
        }
        return;
      }

      // ArrowUp at very start
      if (e.key === 'ArrowUp' && start === 0 && end === 0) {
        e.preventDefault();
        focusAdjacentTextBlock(index, -1);
        return;
      }

      // ArrowDown at very end
      if (e.key === 'ArrowDown' && start === block.content.length && end === block.content.length) {
        e.preventDefault();
        focusAdjacentTextBlock(index, 1);
      }
    },
    [
      slash,
      filteredCommands,
      applySlashCommand,
      closeSlashMenu,
      updateBlocks,
      note.blocks,
      focusAdjacentTextBlock,
    ]
  );

  const handleBlockPaste = useCallback(
    (block: NoteBlock, index: number, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pasted = e.clipboardData.getData('text/plain');
      if (!pasted || !pasted.includes('\n')) return;

      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart ?? block.content.length;
      const end = target.selectionEnd ?? block.content.length;
      const prefix = block.content.slice(0, start);
      const suffix = block.content.slice(end);

      const { blocks: parsed } = parseTextToBlocks(pasted);
      if (parsed.length === 0) return;

      const first = parsed[0];
      const last = parsed[parsed.length - 1];
      const mergedFirst: NoteBlock = {
        ...block,
        type: prefix.trim() ? block.type : first.type,
        content: prefix + first.content,
        checked: !prefix.trim() && first.type === 'checklist' ? first.checked : block.checked,
      };
      const middle = parsed.slice(1, -1);
      const mergedLast: NoteBlock =
        parsed.length === 1
          ? { ...mergedFirst, content: mergedFirst.content + suffix }
          : { ...last, content: last.content + suffix };

      const inserted =
        parsed.length === 1 ? [mergedFirst] : [mergedFirst, ...middle, mergedLast];

      updateBlocks((bs) => {
        const copy = [...bs];
        copy.splice(index, 1, ...inserted);
        return copy;
      });

      pendingFocusRef.current = {
        blockId: mergedLast.id,
        caret: mergedLast.content.length - suffix.length,
      };
    },
    [updateBlocks]
  );

  const handleCanvasBottomClick = useCallback(() => {
    const last = note.blocks[note.blocks.length - 1];
    if (!last || last.type === 'divider') {
      const fresh = createBlock('paragraph', '');
      updateBlocks((bs) => [...bs, fresh]);
      pendingFocusRef.current = { blockId: fresh.id, caret: 0 };
    } else {
      const el = blockRefs.current[last.id];
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        setActiveBlockId(last.id);
      }
    }
  }, [note.blocks, updateBlocks]);

  // Compute sequential numbered list indices
  const numberedIndices = useMemo(() => {
    const map: Record<string, number> = {};
    let counter = 0;
    for (const block of note.blocks) {
      if (block.type === 'numbered') {
        counter += 1;
        map[block.id] = counter;
      } else {
        counter = 0;
      }
    }
    return map;
  }, [note.blocks]);

  return (
    <div
      className="print-only-canvas relative h-full w-full overflow-y-auto"
      style={{
        backgroundColor: 'var(--bg-canvas)',
        perspective: '1200px',
      }}
    >
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
          onFocus={() => setActiveBlockId('__title__')}
          onChange={(e) => {
            const val = e.target.value.replace(/\n/g, '');
            onUpdateNote((prev) => ({
              ...prev,
              title: val,
              updatedAt: Date.now(),
            }));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
              e.preventDefault();
              const firstText = note.blocks.find((b) => b.type !== 'divider');
              if (firstText) {
                const el = blockRefs.current[firstText.id];
                if (el) {
                  el.focus();
                  el.setSelectionRange(0, 0);
                  setActiveBlockId(firstText.id);
                }
              }
            }
          }}
          className="folio-editor-font w-full resize-none overflow-hidden bg-transparent text-[30px] sm:text-[34px] font-semibold leading-[1.22] tracking-[-0.025em] outline-none placeholder:opacity-35"
          style={{
            color: 'var(--ink-primary)',
            textWrap: 'balance',
            opacity: focusMode && activeBlockId && activeBlockId !== '__title__' ? 0.32 : 1,
            transition: 'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />

        {/* Quiet unboxed metadata line */}
        <div
          className="no-print mt-2.5 mb-8 flex items-center gap-2 text-[12px]"
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

        {/* Blocks List */}
        <div className="space-y-2.5">
          {note.blocks.map((block, idx) => {
            const isActive = activeBlockId === block.id;
            const dimmed = focusMode && activeBlockId !== null && !isActive;

            if (block.type === 'divider') {
              return (
                <div
                  key={block.id}
                  className="group relative flex items-center py-4"
                  style={{
                    opacity: dimmed ? 0.25 : 1,
                    transition: 'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <hr
                    className="print-divider w-full border-0"
                    style={{
                      height: '1px',
                      backgroundColor: 'var(--border-strong)',
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Remove divider"
                    onClick={() =>
                      updateBlocks((bs) => bs.filter((b) => b.id !== block.id))
                    }
                    className="no-print absolute right-0 rounded-md p-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100"
                    style={{
                      backgroundColor: 'var(--bg-canvas)',
                      color: 'var(--ink-muted)',
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }

            if (block.type === 'callout') {
              return (
                <div
                  key={block.id}
                  className="print-callout relative my-3 rounded-xl px-5 py-4"
                  style={{
                    backgroundColor: 'var(--bg-callout)',
                    border: '1px solid var(--border-hairline)',
                    opacity: dimmed ? 0.22 : 1,
                    transition:
                      'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1), background-color 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="select-none font-serif text-xl leading-none pt-0.5"
                      style={{ color: 'var(--accent)' }}
                    >
                      “
                    </span>
                    <AutoTextarea
                      value={block.content}
                      placeholder="Write a callout or excerpt..."
                      ariaLabel="Callout block"
                      textareaRef={(el) => {
                        blockRefs.current[block.id] = el;
                      }}
                      onChange={(e) => handleBlockChange(block, e)}
                      onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                      onFocus={() => setActiveBlockId(block.id)}
                      onPaste={(e) => handleBlockPaste(block, idx, e)}
                      className="folio-editor-font text-[15.5px] italic placeholder:opacity-40"
                      style={{ color: 'var(--ink-primary)' }}
                    />
                  </div>
                </div>
              );
            }

            if (block.type === 'checklist') {
              return (
                <div
                  key={block.id}
                  className="flex items-start gap-3 py-0.5"
                  style={{
                    opacity: dimmed ? 0.22 : 1,
                    transition: 'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={Boolean(block.checked)}
                    aria-label="Toggle checklist item"
                    onClick={() =>
                      updateBlocks((bs) =>
                        bs.map((b) =>
                          b.id === block.id ? { ...b, checked: !b.checked } : b
                        )
                      )
                    }
                    className="mt-[5px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] transition-colors duration-200"
                    style={{
                      backgroundColor: block.checked ? 'var(--accent)' : 'transparent',
                      border: `1.5px solid ${
                        block.checked ? 'var(--accent)' : 'var(--border-strong)'
                      }`,
                      color: 'var(--accent-ink)',
                    }}
                  >
                    {block.checked && <Check className="h-3 w-3" strokeWidth={2.5} />}
                  </button>
                  <AutoTextarea
                    value={block.content}
                    placeholder="Checklist item..."
                    ariaLabel="Checklist item"
                    textareaRef={(el) => {
                      blockRefs.current[block.id] = el;
                    }}
                    onChange={(e) => handleBlockChange(block, e)}
                    onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                    onFocus={() => setActiveBlockId(block.id)}
                    onPaste={(e) => handleBlockPaste(block, idx, e)}
                    className={`folio-editor-font text-[16px] placeholder:opacity-35 ${
                      block.checked ? 'line-through' : ''
                    }`}
                    style={{
                      color: block.checked ? 'var(--ink-muted)' : 'var(--ink-primary)',
                    }}
                  />
                </div>
              );
            }

            if (block.type === 'bullet') {
              return (
                <div
                  key={block.id}
                  className="flex items-start gap-3 py-0.5"
                  style={{
                    opacity: dimmed ? 0.22 : 1,
                    transition: 'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="mt-[2px] w-4 shrink-0 select-none text-center text-[16px]"
                    style={{ color: 'var(--accent)' }}
                  >
                    •
                  </span>
                  <AutoTextarea
                    value={block.content}
                    placeholder="List item..."
                    ariaLabel="Bullet list item"
                    textareaRef={(el) => {
                      blockRefs.current[block.id] = el;
                    }}
                    onChange={(e) => handleBlockChange(block, e)}
                    onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                    onFocus={() => setActiveBlockId(block.id)}
                    onPaste={(e) => handleBlockPaste(block, idx, e)}
                    className="folio-editor-font text-[16px] placeholder:opacity-35"
                    style={{ color: 'var(--ink-primary)' }}
                  />
                </div>
              );
            }

            if (block.type === 'numbered') {
              return (
                <div
                  key={block.id}
                  className="flex items-start gap-3 py-0.5"
                  style={{
                    opacity: dimmed ? 0.22 : 1,
                    transition: 'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="mt-[2px] min-w-[20px] shrink-0 select-none text-right font-mono text-[13.5px] tabular-nums"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    {numberedIndices[block.id] ?? 1}.
                  </span>
                  <AutoTextarea
                    value={block.content}
                    placeholder="Numbered item..."
                    ariaLabel="Numbered list item"
                    textareaRef={(el) => {
                      blockRefs.current[block.id] = el;
                    }}
                    onChange={(e) => handleBlockChange(block, e)}
                    onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                    onFocus={() => setActiveBlockId(block.id)}
                    onPaste={(e) => handleBlockPaste(block, idx, e)}
                    className="folio-editor-font text-[16px] placeholder:opacity-35"
                    style={{ color: 'var(--ink-primary)' }}
                  />
                </div>
              );
            }

            if (block.type === 'h1') {
              return (
                <div
                  key={block.id}
                  className="pt-5 pb-1"
                  style={{
                    opacity: dimmed ? 0.22 : 1,
                    transition: 'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <AutoTextarea
                    value={block.content}
                    placeholder="Heading 1"
                    ariaLabel="Heading 1"
                    textareaRef={(el) => {
                      blockRefs.current[block.id] = el;
                    }}
                    onChange={(e) => handleBlockChange(block, e)}
                    onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                    onFocus={() => setActiveBlockId(block.id)}
                    onPaste={(e) => handleBlockPaste(block, idx, e)}
                    className="folio-editor-font text-[24px] font-semibold leading-[1.3] tracking-[-0.02em] placeholder:opacity-35"
                    style={{ color: 'var(--ink-primary)' }}
                  />
                </div>
              );
            }

            if (block.type === 'h2') {
              return (
                <div
                  key={block.id}
                  className="pt-4 pb-0.5"
                  style={{
                    opacity: dimmed ? 0.22 : 1,
                    transition: 'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                >
                  <AutoTextarea
                    value={block.content}
                    placeholder="Heading 2"
                    ariaLabel="Heading 2"
                    textareaRef={(el) => {
                      blockRefs.current[block.id] = el;
                    }}
                    onChange={(e) => handleBlockChange(block, e)}
                    onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                    onFocus={() => setActiveBlockId(block.id)}
                    onPaste={(e) => handleBlockPaste(block, idx, e)}
                    className="folio-editor-font text-[19px] font-semibold leading-[1.38] tracking-[-0.015em] placeholder:opacity-35"
                    style={{ color: 'var(--ink-primary)' }}
                  />
                </div>
              );
            }

            // Default Paragraph
            return (
              <div
                key={block.id}
                className="py-0.5"
                style={{
                  opacity: dimmed ? 0.22 : 1,
                  transition: 'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <AutoTextarea
                  value={block.content}
                  placeholder={
                    idx === 0 && note.blocks.length === 1
                      ? 'Begin writing, or type "/" for commands...'
                      : ''
                  }
                  ariaLabel="Paragraph"
                  textareaRef={(el) => {
                    blockRefs.current[block.id] = el;
                  }}
                  onChange={(e) => handleBlockChange(block, e)}
                  onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                  onFocus={() => setActiveBlockId(block.id)}
                  onPaste={(e) => handleBlockPaste(block, idx, e)}
                  className="folio-editor-font text-[16px] placeholder:opacity-35"
                  style={{ color: 'var(--ink-primary)' }}
                />
              </div>
            );
          })}
        </div>

        {/* Clickable generous bottom breathing area */}
        <div
          onClick={handleCanvasBottomClick}
          className="no-print min-h-[160px] flex-1 cursor-text"
          aria-hidden="true"
        />
      </motion.article>

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
