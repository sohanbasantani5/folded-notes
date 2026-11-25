import React, { useEffect, useRef } from 'react';
import {
  CheckSquare,
  Heading1,
  Heading2,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
} from 'lucide-react';
import { BlockType } from '../types/note';

export interface SlashCommandItem {
  id: BlockType;
  label: string;
  description: string;
  keywords: string[];
  shortcutHint: string;
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    id: 'numbered',
    label: 'Numbered List',
    description: 'Sequential 1. 2. 3. steps',
    keywords: ['numbered', 'ordered', 'list', '1', 'ol', 'steps'],
    shortcutHint: '1.',
  },
  {
    id: 'bullet',
    label: 'Bullet List',
    description: 'Clean bulleted points',
    keywords: ['bullet', 'list', 'ul', 'points', '-'],
    shortcutHint: '•',
  },
  {
    id: 'checklist',
    label: 'Checklist',
    description: 'Interactive task items',
    keywords: ['checklist', 'todo', 'task', 'check', 'box', '[]'],
    shortcutHint: '[ ]',
  },
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Primary section heading',
    keywords: ['heading', 'h1', 'title', 'large', '#'],
    shortcutHint: 'H1',
  },
  {
    id: 'h2',
    label: 'Heading 2',
    description: 'Secondary subheading',
    keywords: ['heading', 'h2', 'subheading', 'medium', '##'],
    shortcutHint: 'H2',
  },
  {
    id: 'divider',
    label: 'Divider Line',
    description: 'Subtle horizontal hairline rule',
    keywords: ['divider', 'line', 'rule', 'hr', 'separator', '---'],
    shortcutHint: '—',
  },
  {
    id: 'callout',
    label: 'Callout / Quote',
    description: 'Highlighted thought or citation',
    keywords: ['callout', 'quote', 'blockquote', 'note', 'excerpt', '>'],
    shortcutHint: '“”',
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Upload or embed an image',
    keywords: ['image', 'photo', 'picture', 'img', 'upload'],
    shortcutHint: 'IMG',
  },
];

export function filterSlashCommands(query: string): SlashCommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q))
  );
}

function CommandIcon({ type }: { type: BlockType }) {
  const cls = 'w-4 h-4 shrink-0';
  switch (type) {
    case 'numbered':
      return <ListOrdered className={cls} strokeWidth={1.7} />;
    case 'bullet':
      return <List className={cls} strokeWidth={1.7} />;
    case 'checklist':
      return <CheckSquare className={cls} strokeWidth={1.7} />;
    case 'h1':
      return <Heading1 className={cls} strokeWidth={1.7} />;
    case 'h2':
      return <Heading2 className={cls} strokeWidth={1.7} />;
    case 'divider':
      return <Minus className={cls} strokeWidth={1.7} />;
    case 'callout':
      return <Quote className={cls} strokeWidth={1.7} />;
    case 'image':
      return <ImageIcon className={cls} strokeWidth={1.7} />;
    default:
      return null;
  }
}

interface SlashMenuProps {
  isOpen: boolean;
  position: { top: number; left: number };
  items: SlashCommandItem[];
  selectedIndex: number;
  onSelect: (type: BlockType) => void;
  onHover: (index: number) => void;
  onClose: () => void;
}

export const SlashMenu: React.FC<SlashMenuProps> = ({
  isOpen,
  position,
  items,
  selectedIndex,
  onSelect,
  onHover,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const menuWidth = 264;
  const estimatedHeight = Math.min(items.length * 46 + 44, 340);
  const clampedLeft = Math.max(
    12,
    Math.min(position.left, window.innerWidth - menuWidth - 16)
  );
  const showAbove = position.top + estimatedHeight > window.innerHeight - 16;
  const clampedTop = showAbove
    ? Math.max(12, position.top - estimatedHeight - 28)
    : Math.max(12, position.top);

  return (
    <div
      ref={menuRef}
      role="listbox"
      aria-label="Insert block"
      className="no-print fixed z-50 w-[264px] rounded-xl py-1.5 backdrop-blur-md"
      style={{
        top: clampedTop,
        left: clampedLeft,
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-strong)',
        boxShadow: '0 14px 36px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.06)',
        transition: 'opacity 180ms cubic-bezier(0.22, 1, 0.36, 1), transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5 text-[11px] font-medium"
        style={{ color: 'var(--ink-muted)' }}
      >
        <span>Insert block</span>
        <span className="tabular-nums">↑↓ · Enter</span>
      </div>
      <div
        className="mx-2 mb-1 h-px"
        style={{ backgroundColor: 'var(--border-hairline)' }}
      />
      {items.length === 0 ? (
        <div
          className="px-3 py-3 text-xs"
          style={{ color: 'var(--ink-muted)' }}
        >
          No matching block type
        </div>
      ) : (
        <div className="max-h-[280px] overflow-y-auto px-1.5">
          {items.map((item, idx) => {
            const active = idx === selectedIndex;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(item.id);
                }}
                onMouseEnter={() => onHover(idx)}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150"
                style={{
                  backgroundColor: active ? 'var(--bg-subtle)' : 'transparent',
                  color: 'var(--ink-primary)',
                }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                  style={{
                    backgroundColor: active ? 'var(--accent-soft)' : 'var(--bg-canvas)',
                    color: active ? 'var(--accent)' : 'var(--ink-secondary)',
                    border: '1px solid var(--border-hairline)',
                  }}
                >
                  <CommandIcon type={item.id} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-tight">
                    {item.label}
                  </span>
                  <span
                    className="block truncate text-[11px] leading-tight mt-0.5"
                    style={{ color: 'var(--ink-muted)' }}
                  >
                    {item.description}
                  </span>
                </span>
                <span
                  className="shrink-0 font-mono text-[11px]"
                  style={{ color: 'var(--ink-muted)' }}
                >
                  {item.shortcutHint}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
