import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion } from 'motion/react';
import {
  Bold,
  Check,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  Quote,
  Trash2,
} from 'lucide-react';
import { BlockType, Note, NoteBlock } from '../types/note';
import {
  createBlock,
  formatRelativeDate,
  parseTextToBlocks,
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
  blockId: string | null;
  slashIndex: number;
  query: string;
  position: { top: number; left: number };
  selectedIndex: number;
}

interface SelectionToolbarState {
  visible: boolean;
  blockId: string | null;
  top: number;
  left: number;
}

const INITIAL_SLASH_STATE: SlashState = {
  isOpen: false,
  blockId: null,
  slashIndex: -1,
  query: '',
  position: { top: 0, left: 0 },
  selectedIndex: 0,
};

const INITIAL_TOOLBAR_STATE: SelectionToolbarState = {
  visible: false,
  blockId: null,
  top: 0,
  left: 0,
};

// ─── html ↔ plain-text helpers ───────────────────────────────────────────────

/** Convert legacy **bold** / *italic* / `code` markdown to real HTML. */
function markdownInlineToHtml(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

/** Extract plain text from an HTML string (strips tags). */
function htmlToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent ?? div.innerText ?? '';
}

/** Sanitise pasted / stored HTML to only allow safe inline formatting. */
function sanitiseInlineHtml(html: string): string {
  // Allow: strong, em, code, br, span. Strip everything else.
  return html
    .replace(/<(?!\/?(?:strong|em|code|br|span)[>\s])[^>]+>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n');
}

/**
 * Convert a block's stored content string → safe HTML string for
 * contentEditable. Handles both legacy markdown and already-HTML content.
 */
function contentToHtml(content: string): string {
  // If content already contains HTML tags trust it (came from contentEditable)
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return sanitiseInlineHtml(content);
  }
  // Legacy plain-text / markdown → convert inline markers then escape bare &<>
  const escaped = content
    .replace(/&(?![a-z#0-9]+;)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return markdownInlineToHtml(escaped);
}

/**
 * Serialise a contentEditable div's innerHTML back to a storable string.
 * We keep it as HTML so round-trips are lossless.
 */
function getBlockHtml(el: HTMLElement): string {
  // Replace <br> with \n so plain-text exports still work
  return el.innerHTML
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ');
}

// ─── caret helpers ────────────────────────────────────────────────────────────

/** Get the caret character offset inside a contentEditable element. */
function getCaretOffset(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

/** Set caret to a character offset inside a contentEditable element. */
function setCaretOffset(el: HTMLElement, offset: number): void {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = (node as Text).length;
    if (remaining <= len) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
    remaining -= len;
  }
  // fallback: place at end
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/** Get the screen rect for the current selection mid-point. */
function getSelectionMidRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const rects = range.getClientRects();
  if (rects.length === 0) return range.getBoundingClientRect();
  // Return the rect of the last line so the toolbar appears above it
  return rects[rects.length - 1];
}

/** Get text inside a contentEditable before the caret position. */
function getTextBeforeCaret(el: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';
  const range = sel.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString();
}

// ─── component ────────────────────────────────────────────────────────────────

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
  const [toolbar, setToolbar] = useState<SelectionToolbarState>(INITIAL_TOOLBAR_STATE);

  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  // contentEditable divs keyed by block id
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // pending focus: { blockId, caret? }
  const pendingFocusRef = useRef<{ blockId: string; caret?: number } | null>(null);
  // Track whether a contentEditable input came from programmatic set (suppress re-render loop)
  const suppressInputRef = useRef<Set<string>>(new Set());

  const filteredCommands = useMemo(() => filterSlashCommands(slash.query), [slash.query]);

  // ── title auto-resize ────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [note.title, note.id]);

  // ── reset on note change ─────────────────────────────────────────────────
  useEffect(() => {
    setSlash(INITIAL_SLASH_STATE);
    setToolbar(INITIAL_TOOLBAR_STATE);
    if (!note.blocks.some((b) => b.id === activeBlockId)) {
      setActiveBlockId(note.blocks[0]?.id ?? null);
    }
  }, [note.id]);

  // ── sync contentEditable innerHTML when block content changes externally ──
  useEffect(() => {
    for (const block of note.blocks) {
      const el = blockRefs.current[block.id];
      if (!el) continue;
      if (suppressInputRef.current.has(block.id)) {
        suppressInputRef.current.delete(block.id);
        continue;
      }
      const expected = contentToHtml(block.content);
      if (el.innerHTML !== expected) {
        const offset = getCaretOffset(el);
        el.innerHTML = expected;
        try { setCaretOffset(el, offset); } catch { /* ignore */ }
      }
    }
  }, [note.blocks]);

  // ── pending focus ─────────────────────────────────────────────────────────
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    const el = blockRefs.current[pending.blockId];
    if (el) {
      el.focus();
      if (typeof pending.caret === 'number') {
        try { setCaretOffset(el, pending.caret); } catch { /* ignore */ }
      }
      setActiveBlockId(pending.blockId);
      pendingFocusRef.current = null;
    }
  }, [note.blocks]);

  // ── close toolbar on outside mousedown ───────────────────────────────────
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-selection-toolbar="true"]')) return;
      setToolbar((prev) => (prev.visible ? INITIAL_TOOLBAR_STATE : prev));
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // ─── update helpers ───────────────────────────────────────────────────────

  const closeSlashMenu = useCallback(() => setSlash(INITIAL_SLASH_STATE), []);

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

  // ─── selection toolbar show ───────────────────────────────────────────────

  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setToolbar((prev) => (prev.visible ? INITIAL_TOOLBAR_STATE : prev));
      return;
    }
    // Find which block the selection is in
    const anchorNode = sel.anchorNode;
    let blockId: string | null = null;
    for (const [id, el] of Object.entries(blockRefs.current)) {
      if (el && el.contains(anchorNode)) {
        blockId = id;
        break;
      }
    }
    if (!blockId) return;

    const rect = getSelectionMidRect();
    if (!rect) return;
    const clampedLeft = Math.max(16, Math.min(window.innerWidth - 360, rect.left + rect.width / 2 - 160));
    const clampedTop = Math.max(12, rect.top - 52);
    setToolbar({ visible: true, blockId, top: clampedTop, left: clampedLeft });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [handleSelectionChange]);

  // ─── rich-text formatting ─────────────────────────────────────────────────

  /** Apply an inline format to the current selection using Range/execCommand fallback. */
  const applyInlineFormat = useCallback(
    (tag: 'strong' | 'em' | 'code') => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);

      // Check if the selection is already wrapped in this tag
      const container = range.commonAncestorContainer;
      const parentEl =
        container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as HTMLElement);
      const alreadyWrapped = parentEl?.closest(tag) !== null;

      if (alreadyWrapped) {
        // Unwrap: replace the parent tag with its inner content
        const wrapper = parentEl!.closest(tag)!;
        const fragment = document.createDocumentFragment();
        while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
        wrapper.parentNode?.replaceChild(fragment, wrapper);
      } else {
        // Wrap selection
        const wrapper = document.createElement(tag);
        try {
          range.surroundContents(wrapper);
        } catch {
          // surroundContents fails on partial selections spanning elements — extract & wrap
          const extracted = range.extractContents();
          wrapper.appendChild(extracted);
          range.insertNode(wrapper);
        }
      }

      // Persist to block state
      if (toolbar.blockId) {
        const el = blockRefs.current[toolbar.blockId];
        if (el) {
          suppressInputRef.current.add(toolbar.blockId);
          const html = getBlockHtml(el);
          updateBlocks((bs) =>
            bs.map((b) => (b.id === toolbar.blockId ? { ...b, content: html } : b))
          );
        }
      }
      setToolbar(INITIAL_TOOLBAR_STATE);
    },
    [toolbar.blockId, updateBlocks]
  );

  const convertBlockType = useCallback(
    (blockId: string, nextType: BlockType) => {
      updateBlocks((bs) =>
        bs.map((b) =>
          b.id === blockId
            ? { ...b, type: nextType, checked: nextType === 'checklist' ? Boolean(b.checked) : undefined }
            : b
        )
      );
      setToolbar(INITIAL_TOOLBAR_STATE);
      pendingFocusRef.current = { blockId };
    },
    [updateBlocks]
  );

  // ─── slash command ────────────────────────────────────────────────────────

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
          const plainText = htmlToPlainText(current.content);
          const cleaned = (
            plainText.slice(0, slashIdx) + plainText.slice(slashIdx + removeLength)
          ).trim();
          const next = [...blocks];
          if (cleaned.length === 0) {
            next.splice(index, 1, dividerBlock, nextParagraph);
          } else {
            next.splice(index, 1, { ...current, content: cleaned }, dividerBlock, nextParagraph);
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
          const plainText = htmlToPlainText(block.content);
          const before = plainText.slice(0, slashIdx);
          const after = plainText.slice(slashIdx + removeLength);
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

  // ─── input handler (contentEditable) ─────────────────────────────────────

  const detectSlashTrigger = useCallback(
    (blockId: string, textBefore: string, el: HTMLDivElement) => {
      const match = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9-]*)$/);
      if (match) {
        const query = match[1] ?? '';
        const slashPos = textBefore.length - query.length - 1;
        const sel = window.getSelection();
        let pos = { top: 0, left: 0 };
        if (sel && sel.rangeCount > 0) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          pos = { top: rect.bottom + 6, left: rect.left };
        }
        setSlash({ isOpen: true, blockId, slashIndex: slashPos, query, position: pos, selectedIndex: 0 });
      } else if (slash.isOpen && slash.blockId === blockId) {
        closeSlashMenu();
      }
    },
    [slash.isOpen, slash.blockId, closeSlashMenu]
  );

  const handleBlockInput = useCallback(
    (block: NoteBlock, el: HTMLDivElement) => {
      const html = getBlockHtml(el);
      const plainText = htmlToPlainText(html);

      // Markdown shortcuts (only on plain-text paragraph blocks)
      if (block.type === 'paragraph') {
        if (plainText === '# ') {
          updateBlocks((bs) => bs.map((b) => (b.id === block.id ? { ...b, type: 'h1', content: '' } : b)));
          closeSlashMenu();
          return;
        }
        if (plainText === '## ') {
          updateBlocks((bs) => bs.map((b) => (b.id === block.id ? { ...b, type: 'h2', content: '' } : b)));
          closeSlashMenu();
          return;
        }
        if (plainText === '- ' || plainText === '* ') {
          updateBlocks((bs) => bs.map((b) => (b.id === block.id ? { ...b, type: 'bullet', content: '' } : b)));
          closeSlashMenu();
          return;
        }
        if (plainText === '1. ') {
          updateBlocks((bs) => bs.map((b) => (b.id === block.id ? { ...b, type: 'numbered', content: '' } : b)));
          closeSlashMenu();
          return;
        }
        if (plainText === '[] ' || plainText === '[ ] ') {
          updateBlocks((bs) =>
            bs.map((b) => (b.id === block.id ? { ...b, type: 'checklist', content: '', checked: false } : b))
          );
          closeSlashMenu();
          return;
        }
        if (plainText === '> ') {
          updateBlocks((bs) => bs.map((b) => (b.id === block.id ? { ...b, type: 'callout', content: '' } : b)));
          closeSlashMenu();
          return;
        }
        if (plainText === '---') {
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

      suppressInputRef.current.add(block.id);
      updateBlocks((bs) => bs.map((b) => (b.id === block.id ? { ...b, content: html } : b)));

      const textBefore = getTextBeforeCaret(el);
      detectSlashTrigger(block.id, textBefore, el);
    },
    [updateBlocks, detectSlashTrigger, closeSlashMenu]
  );

  // ─── keydown handler (contentEditable) ───────────────────────────────────

  const focusAdjacentTextBlock = useCallback(
    (currentIndex: number, direction: -1 | 1) => {
      let cursor = currentIndex + direction;
      while (cursor >= 0 && cursor < note.blocks.length) {
        const candidate = note.blocks[cursor];
        if (candidate.type !== 'divider') {
          const el = blockRefs.current[candidate.id];
          if (el) {
            el.focus();
            if (direction === -1) {
              setCaretOffset(el, el.textContent?.length ?? 0);
            } else {
              setCaretOffset(el, 0);
            }
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
    (block: NoteBlock, index: number, e: React.KeyboardEvent<HTMLDivElement>) => {
      const mod = e.metaKey || e.ctrlKey;
      const el = e.currentTarget;

      // Ctrl/Cmd+B → bold
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        applyInlineFormat('strong');
        return;
      }
      // Ctrl/Cmd+I → italic
      if (mod && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        applyInlineFormat('em');
        return;
      }
      // Ctrl/Cmd+A → select all content in the note body
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        // Find the blocks container and select all
        const container = el.closest('.folded-blocks-container') as HTMLElement | null;
        if (container) {
          const range = document.createRange();
          range.selectNodeContents(container);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        } else {
          // Fallback: select within current block
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
        return;
      }

      // Slash menu navigation
      if (slash.isOpen && slash.blockId === block.id) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (filteredCommands.length > 0) {
            setSlash((prev) => ({ ...prev, selectedIndex: (prev.selectedIndex + 1) % filteredCommands.length }));
          }
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (filteredCommands.length > 0) {
            setSlash((prev) => ({
              ...prev,
              selectedIndex: (prev.selectedIndex - 1 + filteredCommands.length) % filteredCommands.length,
            }));
          }
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const chosen = filteredCommands[slash.selectedIndex];
          if (chosen) applySlashCommand(chosen.id);
          else closeSlashMenu();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeSlashMenu();
          return;
        }
      }

      const plainText = el.textContent ?? '';
      const caretOffset = getCaretOffset(el);

      // Enter → split block
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const isList =
          block.type === 'bullet' || block.type === 'numbered' || block.type === 'checklist';

        if (isList && plainText.trim() === '') {
          updateBlocks((bs) =>
            bs.map((b) => (b.id === block.id ? { ...b, type: 'paragraph', checked: undefined } : b))
          );
          return;
        }

        const html = getBlockHtml(el);
        // Split at caret: use plain text positions for simplicity (rich text in content after split)
        const beforeText = plainText.slice(0, caretOffset);
        const afterText = plainText.slice(caretOffset);
        const nextType: BlockType = isList ? block.type : 'paragraph';
        const nextBlock = createBlock(nextType, afterText, false);

        updateBlocks((bs) => {
          const copy = [...bs];
          copy[index] = { ...block, content: beforeText };
          copy.splice(index + 1, 0, nextBlock);
          return copy;
        });
        pendingFocusRef.current = { blockId: nextBlock.id, caret: 0 };
        return;
      }

      // Backspace at start → merge or convert
      if (e.key === 'Backspace' && caretOffset === 0) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) return; // let browser handle selection delete

        if (block.type !== 'paragraph') {
          e.preventDefault();
          updateBlocks((bs) =>
            bs.map((b) => (b.id === block.id ? { ...b, type: 'paragraph', checked: undefined } : b))
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
          const prevPlain = htmlToPlainText(prevBlock.content);
          const mergeCaret = prevPlain.length;
          const curHtml = getBlockHtml(el);
          const curPlain = htmlToPlainText(curHtml);
          updateBlocks((bs) => {
            const copy = [...bs];
            copy[index - 1] = { ...prevBlock, content: prevPlain + curPlain };
            copy.splice(index, 1);
            return copy;
          });
          pendingFocusRef.current = { blockId: prevBlock.id, caret: mergeCaret };
        }
        return;
      }

      // Arrow navigation between blocks
      if (e.key === 'ArrowUp' && caretOffset === 0) {
        e.preventDefault();
        focusAdjacentTextBlock(index, -1);
        return;
      }
      if (e.key === 'ArrowDown' && caretOffset === plainText.length) {
        e.preventDefault();
        focusAdjacentTextBlock(index, 1);
      }
    },
    [
      slash,
      filteredCommands,
      applySlashCommand,
      applyInlineFormat,
      closeSlashMenu,
      updateBlocks,
      note.blocks,
      focusAdjacentTextBlock,
    ]
  );

  // ─── paste handler ─────────────────────────────────────────────────────────

  const handleBlockPaste = useCallback(
    (block: NoteBlock, index: number, e: React.ClipboardEvent<HTMLDivElement>) => {
      const pasted = e.clipboardData.getData('text/plain');
      if (!pasted || !pasted.includes('\n')) return; // let browser handle single-line paste

      e.preventDefault();
      const el = e.currentTarget;
      const caretOffset = getCaretOffset(el);
      const plainText = el.textContent ?? '';
      const prefix = plainText.slice(0, caretOffset);
      const suffix = plainText.slice(caretOffset);

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

      const inserted = parsed.length === 1 ? [mergedFirst] : [mergedFirst, ...middle, mergedLast];

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

  // ─── canvas click (click anywhere → focus last block) ────────────────────

  const focusBlockAtEnd = useCallback(
    (targetBlock?: NoteBlock) => {
      const blockToFocus = targetBlock ?? note.blocks[note.blocks.length - 1];
      if (!blockToFocus || blockToFocus.type === 'divider') {
        const fresh = createBlock('paragraph', '');
        updateBlocks((bs) => [...bs, fresh]);
        pendingFocusRef.current = { blockId: fresh.id, caret: 0 };
        return;
      }
      const el = blockRefs.current[blockToFocus.id];
      if (el) {
        el.focus();
        setCaretOffset(el, el.textContent?.length ?? 0);
        setActiveBlockId(blockToFocus.id);
      }
    },
    [note.blocks, updateBlocks]
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[contenteditable], textarea, button, input, a, [data-selection-toolbar="true"]')) {
        return;
      }
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      focusBlockAtEnd();
    },
    [focusBlockAtEnd]
  );

  // ─── derived ───────────────────────────────────────────────────────────────

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

  const activeToolbarBlock = useMemo(
    () => note.blocks.find((b) => b.id === toolbar.blockId) ?? null,
    [note.blocks, toolbar.blockId]
  );

  // Check if selection is bold/italic/code (for toolbar highlight)
  const selectionFormats = useMemo<{ bold: boolean; italic: boolean; code: boolean }>(() => {
    if (!toolbar.visible) return { bold: false, italic: false, code: false };
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0)
      return { bold: false, italic: false, code: false };
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const el =
      container.nodeType === Node.TEXT_NODE ? container.parentElement : (container as HTMLElement);
    return {
      bold: !!el?.closest('strong'),
      italic: !!el?.closest('em'),
      code: !!el?.closest('code'),
    };
  }, [toolbar]);

  // ─── contentEditable ref helper ───────────────────────────────────────────

  /** Create a ref callback that sets the initial innerHTML and stores the ref. */
  const makeBlockRef = useCallback(
    (block: NoteBlock) => (el: HTMLDivElement | null) => {
      blockRefs.current[block.id] = el;
      if (el && el.innerHTML === '') {
        el.innerHTML = contentToHtml(block.content);
      }
    },
    []
  );

  // ─── render ───────────────────────────────────────────────────────────────

  /** Shared contentEditable class and style for each block type. */
  const ceBase =
    'folio-editor-font block w-full outline-none bg-transparent empty:before:opacity-35 empty:before:content-[attr(data-placeholder)] empty:before:pointer-events-none empty:before:select-none';

  return (
    <div
      onClick={handleCanvasClick}
      className="print-only-canvas relative h-full w-full overflow-y-auto cursor-text"
      style={{ backgroundColor: 'var(--bg-canvas)', perspective: '1200px' }}
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
        {/* Title */}
        <textarea
          ref={titleRef}
          rows={1}
          value={note.title}
          placeholder="Untitled Note"
          aria-label="Note title"
          onFocus={() => setActiveBlockId('__title__')}
          onChange={(e) => {
            const val = e.target.value.replace(/\n/g, '');
            onUpdateNote((prev) => ({ ...prev, title: val, updatedAt: Date.now() }));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
              e.preventDefault();
              const firstText = note.blocks.find((b) => b.type !== 'divider');
              if (firstText) {
                const el = blockRefs.current[firstText.id];
                if (el) {
                  el.focus();
                  setCaretOffset(el, 0);
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

        {/* Meta row */}
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

        {/* Blocks */}
        <div className="space-y-2.5 folded-blocks-container">
          {note.blocks.map((block, idx) => {
            const isActive = activeBlockId === block.id;
            const dimmed = focusMode && activeBlockId !== null && !isActive;
            const dimStyle = {
              opacity: dimmed ? 0.22 : 1,
              transition: 'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1)',
            };

            // ── divider ──
            if (block.type === 'divider') {
              return (
                <div
                  key={block.id}
                  className="group relative flex items-center py-4"
                  style={dimStyle}
                >
                  <hr
                    className="print-divider w-full border-0"
                    style={{ height: '1px', backgroundColor: 'var(--border-strong)' }}
                  />
                  <button
                    type="button"
                    aria-label="Remove divider"
                    onClick={() => updateBlocks((bs) => bs.filter((b) => b.id !== block.id))}
                    className="no-print absolute right-0 rounded-md p-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100"
                    style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--ink-muted)' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            }

            // ── callout ──
            if (block.type === 'callout') {
              return (
                <div
                  key={block.id}
                  className="print-callout relative my-3 rounded-xl px-5 py-4"
                  style={{
                    backgroundColor: 'var(--bg-callout)',
                    border: '1px solid var(--border-hairline)',
                    ...dimStyle,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="select-none font-serif text-xl leading-none pt-0.5"
                      style={{ color: 'var(--accent)' }}
                    >
                      "
                    </span>
                    <div
                      ref={makeBlockRef(block)}
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder="Write a callout or excerpt..."
                      aria-label="Callout block"
                      onFocus={() => setActiveBlockId(block.id)}
                      onInput={() => {
                        const el = blockRefs.current[block.id];
                        if (el) handleBlockInput(block, el);
                      }}
                      onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                      onPaste={(e) => handleBlockPaste(block, idx, e)}
                      className={`${ceBase} text-[15.5px] italic placeholder:opacity-40`}
                      style={{ color: 'var(--ink-primary)' }}
                    />
                  </div>
                </div>
              );
            }

            // ── checklist ──
            if (block.type === 'checklist') {
              return (
                <div
                  key={block.id}
                  className="flex items-start gap-3 py-0.5"
                  style={dimStyle}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={Boolean(block.checked)}
                    aria-label="Toggle checklist item"
                    onClick={() =>
                      updateBlocks((bs) =>
                        bs.map((b) => (b.id === block.id ? { ...b, checked: !b.checked } : b))
                      )
                    }
                    className="mt-[5px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] transition-colors duration-200"
                    style={{
                      backgroundColor: block.checked ? 'var(--accent)' : 'transparent',
                      border: `1.5px solid ${block.checked ? 'var(--accent)' : 'var(--border-strong)'}`,
                      color: 'var(--accent-ink)',
                    }}
                  >
                    {block.checked && <Check className="h-3 w-3" strokeWidth={2.5} />}
                  </button>
                  <div
                    ref={makeBlockRef(block)}
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Checklist item..."
                    aria-label="Checklist item"
                    onFocus={() => setActiveBlockId(block.id)}
                    onInput={() => {
                      const el = blockRefs.current[block.id];
                      if (el) handleBlockInput(block, el);
                    }}
                    onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                    onPaste={(e) => handleBlockPaste(block, idx, e)}
                    className={`${ceBase} text-[16px] placeholder:opacity-35 ${block.checked ? 'line-through' : ''}`}
                    style={{ color: block.checked ? 'var(--ink-muted)' : 'var(--ink-primary)' }}
                  />
                </div>
              );
            }

            // ── bullet ──
            if (block.type === 'bullet') {
              return (
                <div key={block.id} className="flex items-start gap-3 py-0.5" style={dimStyle}>
                  <span
                    aria-hidden="true"
                    className="mt-[2px] w-4 shrink-0 select-none text-center text-[16px]"
                    style={{ color: 'var(--accent)' }}
                  >
                    •
                  </span>
                  <div
                    ref={makeBlockRef(block)}
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="List item..."
                    aria-label="Bullet list item"
                    onFocus={() => setActiveBlockId(block.id)}
                    onInput={() => {
                      const el = blockRefs.current[block.id];
                      if (el) handleBlockInput(block, el);
                    }}
                    onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                    onPaste={(e) => handleBlockPaste(block, idx, e)}
                    className={`${ceBase} text-[16px] placeholder:opacity-35`}
                    style={{ color: 'var(--ink-primary)' }}
                  />
                </div>
              );
            }

            // ── numbered ──
            if (block.type === 'numbered') {
              return (
                <div key={block.id} className="flex items-start gap-3 py-0.5" style={dimStyle}>
                  <span
                    aria-hidden="true"
                    className="mt-[2px] min-w-[20px] shrink-0 select-none text-right font-mono text-[13.5px] tabular-nums"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    {numberedIndices[block.id] ?? 1}.
                  </span>
                  <div
                    ref={makeBlockRef(block)}
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Numbered item..."
                    aria-label="Numbered list item"
                    onFocus={() => setActiveBlockId(block.id)}
                    onInput={() => {
                      const el = blockRefs.current[block.id];
                      if (el) handleBlockInput(block, el);
                    }}
                    onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                    onPaste={(e) => handleBlockPaste(block, idx, e)}
                    className={`${ceBase} text-[16px] placeholder:opacity-35`}
                    style={{ color: 'var(--ink-primary)' }}
                  />
                </div>
              );
            }

            // ── h1 ──
            if (block.type === 'h1') {
              return (
                <div key={block.id} className="pt-5 pb-1" style={dimStyle}>
                  <div
                    ref={makeBlockRef(block)}
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Heading 1"
                    aria-label="Heading 1"
                    onFocus={() => setActiveBlockId(block.id)}
                    onInput={() => {
                      const el = blockRefs.current[block.id];
                      if (el) handleBlockInput(block, el);
                    }}
                    onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                    onPaste={(e) => handleBlockPaste(block, idx, e)}
                    className={`${ceBase} text-[24px] font-semibold leading-[1.3] tracking-[-0.02em] placeholder:opacity-35`}
                    style={{ color: 'var(--ink-primary)' }}
                  />
                </div>
              );
            }

            // ── h2 ──
            if (block.type === 'h2') {
              return (
                <div key={block.id} className="pt-4 pb-0.5" style={dimStyle}>
                  <div
                    ref={makeBlockRef(block)}
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="Heading 2"
                    aria-label="Heading 2"
                    onFocus={() => setActiveBlockId(block.id)}
                    onInput={() => {
                      const el = blockRefs.current[block.id];
                      if (el) handleBlockInput(block, el);
                    }}
                    onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                    onPaste={(e) => handleBlockPaste(block, idx, e)}
                    className={`${ceBase} text-[19px] font-semibold leading-[1.38] tracking-[-0.015em] placeholder:opacity-35`}
                    style={{ color: 'var(--ink-primary)' }}
                  />
                </div>
              );
            }

            // ── paragraph (default) ──
            return (
              <div key={block.id} className="py-0.5" style={dimStyle}>
                <div
                  ref={makeBlockRef(block)}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder={
                    idx === 0 && note.blocks.length === 1
                      ? 'Begin writing, or type "/" for commands...'
                      : ''
                  }
                  aria-label="Paragraph"
                  onFocus={() => setActiveBlockId(block.id)}
                  onInput={() => {
                    const el = blockRefs.current[block.id];
                    if (el) handleBlockInput(block, el);
                  }}
                  onKeyDown={(e) => handleBlockKeyDown(block, idx, e)}
                  onPaste={(e) => handleBlockPaste(block, idx, e)}
                  className={`${ceBase} text-[16px] placeholder:opacity-35`}
                  style={{ color: 'var(--ink-primary)' }}
                />
              </div>
            );
          })}
        </div>

        {/* Click target below blocks */}
        <div
          onClick={() => focusBlockAtEnd()}
          className="no-print min-h-[160px] flex-1 cursor-text"
          aria-hidden="true"
        />
      </motion.article>

      {/* Selection toolbar */}
      {toolbar.visible && toolbar.blockId && (
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
          {(['h1', 'h2', 'paragraph'] as BlockType[]).map((headingType, i) => {
            const label = i === 0 ? 'H1' : i === 1 ? 'H2' : 'P';
            const isCurrent = activeToolbarBlock?.type === headingType;
            return (
              <button
                key={label}
                type="button"
                onClick={() => convertBlockType(toolbar.blockId!, headingType)}
                className="rounded-md px-2 py-1 text-[13px] font-medium transition-colors"
                style={{
                  backgroundColor: isCurrent ? 'var(--accent-soft)' : 'transparent',
                  color: isCurrent ? 'var(--accent)' : 'var(--ink-primary)',
                }}
              >
                {label}
              </button>
            );
          })}

          <button
            type="button"
            title="Bold (Ctrl+B / ⌘B)"
            onMouseDown={(e) => { e.preventDefault(); applyInlineFormat('strong'); }}
            className="rounded-md px-2 py-1 text-[13px] font-bold transition-colors"
            style={{
              backgroundColor: selectionFormats.bold ? 'var(--accent-soft)' : 'transparent',
              color: selectionFormats.bold ? 'var(--accent)' : 'var(--ink-primary)',
            }}
          >
            <Bold className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Italic (Ctrl+I / ⌘I)"
            onMouseDown={(e) => { e.preventDefault(); applyInlineFormat('em'); }}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{
              backgroundColor: selectionFormats.italic ? 'var(--accent-soft)' : 'transparent',
              color: selectionFormats.italic ? 'var(--accent)' : 'var(--ink-primary)',
            }}
          >
            <Italic className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Code"
            onMouseDown={(e) => { e.preventDefault(); applyInlineFormat('code'); }}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
            style={{
              backgroundColor: selectionFormats.code ? 'var(--accent-soft)' : 'transparent',
              color: selectionFormats.code ? 'var(--accent)' : 'var(--ink-primary)',
            }}
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Quote Callout"
            onClick={() => convertBlockType(toolbar.blockId!, 'callout')}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
          >
            <Quote className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Bullet List"
            onClick={() => convertBlockType(toolbar.blockId!, 'bullet')}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
          >
            <List className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Numbered List"
            onClick={() => convertBlockType(toolbar.blockId!, 'numbered')}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            title="Checklist"
            onClick={() => convertBlockType(toolbar.blockId!, 'checklist')}
            className="rounded-md p-1.5 transition-colors hover:bg-black/5"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
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
