import { BlockType, ExportFormat, Note, NoteBlock } from '../types/note';

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createBlock(
  type: BlockType = 'paragraph',
  content = '',
  checked = false
): NoteBlock {
  return {
    id: createId(),
    type,
    content,
    ...(type === 'checklist' ? { checked } : {}),
  };
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
      parts.push(b.content);
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
    const text = b.content.trim();
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

export function blocksToMarkdown(title: string, blocks: NoteBlock[]): string {
  const lines: string[] = [];
  if (title.trim()) {
    lines.push(`# ${title.trim()}`, '');
  }
  let numberedIndex = 0;

  for (const block of blocks) {
    if (block.type === 'numbered') {
      numberedIndex += 1;
    } else {
      numberedIndex = 0;
    }

    switch (block.type) {
      case 'h1':
        lines.push(`# ${block.content}`);
        break;
      case 'h2':
        lines.push(`## ${block.content}`);
        break;
      case 'bullet':
        lines.push(`- ${block.content}`);
        break;
      case 'numbered':
        lines.push(`${numberedIndex}. ${block.content}`);
        break;
      case 'checklist':
        lines.push(`- [${block.checked ? 'x' : ' '}] ${block.content}`);
        break;
      case 'divider':
        lines.push('---');
        break;
      case 'callout':
        lines.push(`> ${block.content}`);
        break;
      default:
        lines.push(block.content);
        break;
    }
  }

  return lines.join('\n');
}

export function blocksToPlainText(title: string, blocks: NoteBlock[]): string {
  const lines: string[] = [];
  if (title.trim()) {
    lines.push(title.trim(), '');
  }
  let numberedIndex = 0;

  for (const block of blocks) {
    if (block.type === 'numbered') {
      numberedIndex += 1;
    } else {
      numberedIndex = 0;
    }

    switch (block.type) {
      case 'h1':
      case 'h2':
        lines.push(block.content);
        break;
      case 'bullet':
        lines.push(`• ${block.content}`);
        break;
      case 'numbered':
        lines.push(`${numberedIndex}. ${block.content}`);
        break;
      case 'checklist':
        lines.push(`[${block.checked ? 'x' : ' '}] ${block.content}`);
        break;
      case 'divider':
        lines.push('────────────────────');
        break;
      case 'callout':
        lines.push(`"${block.content}"`);
        break;
      default:
        lines.push(block.content);
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

export function blocksToHtmlDocument(title: string, blocks: NoteBlock[]): string {
  const safeTitle = escapeHtml(title.trim() || 'Untitled Note');
  const bodyParts: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      bodyParts.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      bodyParts.push('</ol>');
      inOl = false;
    }
  };

  for (const block of blocks) {
    const safe = escapeHtml(block.content).replace(/\n/g, '<br />');
    if (block.type === 'bullet') {
      if (inOl) closeLists();
      if (!inUl) {
        bodyParts.push('<ul>');
        inUl = true;
      }
      bodyParts.push(`<li>${safe}</li>`);
      continue;
    }
    if (block.type === 'numbered') {
      if (inUl) closeLists();
      if (!inOl) {
        bodyParts.push('<ol>');
        inOl = true;
      }
      bodyParts.push(`<li>${safe}</li>`);
      continue;
    }

    closeLists();

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
  format: ExportFormat
): string {
  const baseName = slugifyFilename(note.title);

  switch (format) {
    case 'txt': {
      const filename = `${baseName}.txt`;
      triggerFileDownload(
        blocksToPlainText(note.title, note.blocks),
        filename,
        'text/plain;charset=utf-8'
      );
      return filename;
    }
    case 'md': {
      const filename = `${baseName}.md`;
      triggerFileDownload(
        blocksToMarkdown(note.title, note.blocks),
        filename,
        'text/markdown;charset=utf-8'
      );
      return filename;
    }
    case 'html': {
      const filename = `${baseName}.html`;
      triggerFileDownload(
        blocksToHtmlDocument(note.title, note.blocks),
        filename,
        'text/html;charset=utf-8'
      );
      return filename;
    }
    case 'doc': {
      const filename = `${baseName}.doc`;
      const htmlDoc = blocksToHtmlDocument(note.title, note.blocks);
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
