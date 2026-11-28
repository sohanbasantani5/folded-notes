import { BlockType, ExportFormat, Note, NoteBlock } from '../types/note';

/** Strip HTML tags and decode basic entities → plain text. */
export function htmlToText(html: string): string {
  // If no tags present, return as-is
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|blockquote|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createBlock(
  type: BlockType = 'paragraph',
  content = '',
  checked = false,
  updatedAt?: number
): NoteBlock {
  return {
    id: createId(),
    type,
    content,
    ...(type === 'checklist' ? { checked } : {}),
    ...(typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0
      ? { updatedAt }
      : {}),
  };
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function toCalendarDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatMarginEditDate(timestamp: number, nowTs = Date.now()): string {
  const date = new Date(timestamp);
  const now = new Date(nowTs);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((todayStart - targetStart) / 86400000);

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';

  const day = date.getDate();
  const month = SHORT_MONTHS[date.getMonth()];
  if (date.getFullYear() === now.getFullYear()) {
    return `${day} ${month}`;
  }
  return `${day} ${month} ${date.getFullYear()}`;
}

export function formatFullEditTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getDate();
  const month = SHORT_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `Updated ${day} ${month} ${year}, ${time}`;
}

export function formatExportDateTag(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getDate();
  const month = SHORT_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `Updated ${day} ${month} ${year}`;
}

export function countNoteStats(title: string, blocks: NoteBlock[]): {
  words: number;
  characters: number;
} {
  const parts: string[] = [];
  if (title.trim()) {
    parts.push(title);
  }
  for (const b of blocks) {
    if (b.type !== 'divider' && b.content.length > 0) {
      parts.push(htmlToText(b.content));
    }
  }
  const combined = parts.join('\n');
  const trimmed = combined.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const characters = combined.length;
  return { words, characters };
}

export function getNotePlainPreview(note: Note, maxLength = 150): string {
  const lines: string[] = [];
  for (const b of note.blocks) {
    if (b.type === 'divider') continue;
    const text = htmlToText(b.content).trim();
    if (!text) continue;
    if (b.type === 'checklist') {
      lines.push(`${b.checked ? '☑' : '☐'} ${text}`);
    } else if (b.type === 'bullet') {
      lines.push(`• ${text}`);
    } else {
      lines.push(text);
    }
    if (lines.join(' ').length >= maxLength) break;
  }
  const joined = lines.join(' · ');
  if (joined.length <= maxLength) return joined;
  return `${joined.slice(0, maxLength).trimEnd()}…`;
}

export function blocksToMarkdown(
  title: string,
  blocks: NoteBlock[],
  includeEditDates = false
): string {
  const lines: string[] = [];
  if (title.trim()) {
    lines.push(`# ${title.trim()}`, '');
  }
  let numberedIndex = 0;
  let prevDateKey: string | null = null;

  for (const block of blocks) {
    const dateKey =
      typeof block.updatedAt === 'number' && block.updatedAt > 0
        ? toCalendarDateKey(block.updatedAt)
        : null;
    if (includeEditDates && block.updatedAt && dateKey && dateKey !== prevDateKey) {
      if (lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
      }
      lines.push(`[${formatExportDateTag(block.updatedAt)}]`);
    }
    if (block.type !== 'divider') {
      prevDateKey = dateKey;
    }

    if (block.type === 'numbered') {
      numberedIndex += 1;
    } else {
      numberedIndex = 0;
    }
    const text = htmlToText(block.content);

    switch (block.type) {
      case 'h1':
        lines.push(`# ${text}`);
        break;
      case 'h2':
        lines.push(`## ${text}`);
        break;
      case 'bullet':
        lines.push(`- ${text}`);
        break;
      case 'numbered':
        lines.push(`${numberedIndex}. ${text}`);
        break;
      case 'checklist':
        lines.push(`- [${block.checked ? 'x' : ' '}] ${text}`);
        break;
      case 'divider':
        lines.push('---');
        break;
      case 'callout':
        lines.push(`> ${text}`);
        break;
      case 'image':
        lines.push(`![image](${block.content})`);
        break;
      default:
        lines.push(text);
        break;
    }
  }

  return lines.join('\n');
}

export function blocksToPlainText(
  title: string,
  blocks: NoteBlock[],
  includeEditDates = false
): string {
  const lines: string[] = [];
  if (title.trim()) {
    lines.push(title.trim(), '');
  }
  let numberedIndex = 0;
  let prevDateKey: string | null = null;

  for (const block of blocks) {
    const dateKey =
      typeof block.updatedAt === 'number' && block.updatedAt > 0
        ? toCalendarDateKey(block.updatedAt)
        : null;
    if (includeEditDates && block.updatedAt && dateKey && dateKey !== prevDateKey) {
      if (lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
      }
      lines.push(`[${formatExportDateTag(block.updatedAt)}]`);
    }
    if (block.type !== 'divider') {
      prevDateKey = dateKey;
    }

    if (block.type === 'numbered') {
      numberedIndex += 1;
    } else {
      numberedIndex = 0;
    }
    const text = htmlToText(block.content);

    switch (block.type) {
      case 'h1':
      case 'h2':
        lines.push(text);
        break;
      case 'bullet':
        lines.push(`• ${text}`);
        break;
      case 'numbered':
        lines.push(`${numberedIndex}. ${text}`);
        break;
      case 'checklist':
        lines.push(`[${block.checked ? 'x' : ' '}] ${text}`);
        break;
      case 'divider':
        lines.push('────────────────────');
        break;
      case 'callout':
        lines.push(`"${text}"`);
        break;
      default:
        lines.push(text);
        break;
    }
  }

  return lines.join('\n');
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function blocksToHtmlDocument(
  title: string,
  blocks: NoteBlock[],
  includeEditDates = false
): string {
  const safeTitle = escapeHtml(title.trim() || 'Untitled Note');
  const bodyParts: string[] = [];
  let inUl = false;
  let inOl = false;
  let prevDateKey: string | null = null;

  const closeLists = () => {
    if (inUl) { bodyParts.push('</ul>'); inUl = false; }
    if (inOl) { bodyParts.push('</ol>'); inOl = false; }
  };

  for (const block of blocks) {
    const dateKey =
      typeof block.updatedAt === 'number' && block.updatedAt > 0
        ? toCalendarDateKey(block.updatedAt)
        : null;
    const showDateTag =
      includeEditDates && block.updatedAt && dateKey && dateKey !== prevDateKey;
    const dateTagHtml = showDateTag && block.updatedAt
      ? `<div class="edit-date-tag">${escapeHtml(formatExportDateTag(block.updatedAt))}</div>`
      : '';
    if (block.type !== 'divider') {
      prevDateKey = dateKey;
    }

    // If content has HTML tags use it directly (already safe, from contentEditable)
    // Otherwise escape it (legacy plain-text notes)
    const hasHtml = /<[a-z][\s\S]*>/i.test(block.content);
    const safe = hasHtml
      ? block.content.replace(/\n/g, '<br />')
      : escapeHtml(block.content).replace(/\n/g, '<br />');

    if (block.type === 'bullet') {
      if (inOl) closeLists();
      if (!inUl) {
        if (dateTagHtml) bodyParts.push(dateTagHtml);
        bodyParts.push('<ul>');
        inUl = true;
      }
      bodyParts.push(`<li>${safe}</li>`);
      continue;
    }
    if (block.type === 'numbered') {
      if (inUl) closeLists();
      if (!inOl) {
        if (dateTagHtml) bodyParts.push(dateTagHtml);
        bodyParts.push('<ol>');
        inOl = true;
      }
      bodyParts.push(`<li>${safe}</li>`);
      continue;
    }

    closeLists();
    if (dateTagHtml) {
      bodyParts.push(dateTagHtml);
    }

    switch (block.type) {
      case 'h1':
        bodyParts.push(`<h1>${safe}</h1>`);
        break;
      case 'h2':
        bodyParts.push(`<h2>${safe}</h2>`);
        break;
      case 'checklist':
        bodyParts.push(
          `<p style="margin:0.45em 0;">${block.checked ? '&#9745;' : '&#9744;'} <span style="${
            block.checked ? 'text-decoration:line-through;color:#777;' : ''
          }">${safe}</span></p>`
        );
        break;
      case 'divider':
        bodyParts.push('<hr />');
        break;
      case 'callout':
        bodyParts.push(`<blockquote>${safe}</blockquote>`);
        break;
      case 'image':
        bodyParts.push(
          `<p><img src="${escapeHtml(block.content)}" alt="Embedded image" style="max-width:100%;border-radius:10px;margin:12px 0;" /></p>`
        );
        break;
      default:
        bodyParts.push(safe ? `<p>${safe}</p>` : '<p>&nbsp;</p>');
        break;
    }
  }

  closeLists();

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Manrope", sans-serif; color: #111111; background: #FFFFFF; max-width: 700px; margin: 56px auto; padding: 0 24px; line-height: 1.72; font-size: 16px; }
    h1 { font-size: 28px; line-height: 1.25; margin: 1.4em 0 0.5em; font-weight: 600; letter-spacing: -0.02em; }
    h2 { font-size: 20px; line-height: 1.35; margin: 1.2em 0 0.45em; font-weight: 600; letter-spacing: -0.015em; }
    p { margin: 0.65em 0; }
    blockquote { margin: 1.1em 0; padding: 14px 18px; background: #F5F4F0; border: 1px solid #E5E3DC; border-radius: 8px; font-style: italic; color: #363532; }
    hr { border: 0; border-top: 1px solid #E2E0D9; margin: 24px 0; }
    ul, ol { padding-left: 22px; margin: 0.7em 0; }
    li { margin: 0.35em 0; }
    .edit-date-tag { text-align: right; font-size: 11px; color: #848179; margin: 14px 0 4px; letter-spacing: 0.01em; }
  </style>
</head>
<body>
  <h1>${safeTitle}</h1>
  ${bodyParts.join('\n  ')}
</body>
</html>`;
}

export function parseTextToBlocks(rawText: string): {
  extractedTitle?: string;
  blocks: NoteBlock[];
} {
  const normalized = rawText.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const blocks: NoteBlock[] = [];
  let extractedTitle: string | undefined;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (i === 0 && trimmed.startsWith('# ') && trimmed.length > 2) {
      extractedTitle = trimmed.slice(2).trim();
      continue;
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push(createBlock('divider', ''));
    } else if (/^-\s+\[([ xX])\]\s*(.*)$/.test(trimmed)) {
      const match = trimmed.match(/^-\s+\[([ xX])\]\s*(.*)$/);
      blocks.push(
        createBlock('checklist', match ? match[2] : '', match ? match[1].toLowerCase() === 'x' : false)
      );
    } else if (/^\[([ xX])\]\s*(.*)$/.test(trimmed)) {
      const match = trimmed.match(/^\[([ xX])\]\s*(.*)$/);
      blocks.push(
        createBlock('checklist', match ? match[2] : '', match ? match[1].toLowerCase() === 'x' : false)
      );
    } else if (trimmed.startsWith('## ')) {
      blocks.push(createBlock('h2', trimmed.slice(3)));
    } else if (trimmed.startsWith('# ')) {
      blocks.push(createBlock('h1', trimmed.slice(2)));
    } else if (/^[-•*]\s+(.*)$/.test(trimmed)) {
      const match = trimmed.match(/^[-•*]\s+(.*)$/);
      blocks.push(createBlock('bullet', match ? match[1] : ''));
    } else if (/^\d+\.\s+(.*)$/.test(trimmed)) {
      const match = trimmed.match(/^\d+\.\s+(.*)$/);
      blocks.push(createBlock('numbered', match ? match[1] : ''));
    } else if (trimmed.startsWith('> ')) {
      blocks.push(createBlock('callout', trimmed.slice(2)));
    } else {
      if (trimmed === '' && blocks.length === 0 && extractedTitle) {
        continue;
      }
      blocks.push(createBlock('paragraph', line));
    }
  }

  if (blocks.length === 0) {
    blocks.push(createBlock('paragraph', ''));
  }

  return { extractedTitle, blocks };
}

export function slugifyFilename(title: string): string {
  const cleaned = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'untitled-note';
}

export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportNoteToFormat(
  note: Note,
  allNotes: Note[],
  format: ExportFormat,
  includeEditDates = false
): string {
  const baseName = slugifyFilename(note.title);

  switch (format) {
    case 'txt': {
      const filename = `${baseName}.txt`;
      triggerFileDownload(
        blocksToPlainText(note.title, note.blocks, includeEditDates),
        filename,
        'text/plain;charset=utf-8'
      );
      return filename;
    }
    case 'md': {
      const filename = `${baseName}.md`;
      triggerFileDownload(
        blocksToMarkdown(note.title, note.blocks, includeEditDates),
        filename,
        'text/markdown;charset=utf-8'
      );
      return filename;
    }
    case 'html': {
      const filename = `${baseName}.html`;
      triggerFileDownload(
        blocksToHtmlDocument(note.title, note.blocks, includeEditDates),
        filename,
        'text/html;charset=utf-8'
      );
      return filename;
    }
    case 'doc': {
      const filename = `${baseName}.doc`;
      const htmlDoc = blocksToHtmlDocument(note.title, note.blocks, includeEditDates);
      const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">${htmlDoc.slice(
        htmlDoc.indexOf('<head>')
      )}`;
      triggerFileDownload(wordHtml, filename, 'application/msword;charset=utf-8');
      return filename;
    }
    case 'json': {
      const dateStamp = new Date().toISOString().slice(0, 10);
      const filename = `folio-backup-${dateStamp}.json`;
      const payload = JSON.stringify(
        {
          app: 'Folio',
          exportedAt: new Date().toISOString(),
          notes: allNotes,
        },
        null,
        2
      );
      triggerFileDownload(payload, filename, 'application/json;charset=utf-8');
      return filename;
    }
    case 'pdf': {
      // PDF export is handled via window.print() in App.tsx;
      // return a placeholder filename for consistency.
      return `${baseName}.pdf`;
    }
    default:
      return '';
  }
}

export function formatRelativeDate(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}
