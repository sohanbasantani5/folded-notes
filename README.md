<img width="1919" height="943" alt="image" src="https://github.com/user-attachments/assets/a06373a1-8f1a-479e-8ef6-bc9f7f207cda" />
# folded notes.

A minimal, local-first editorial note-taking studio built for deep thinking, studying, and prompt drafting. Zero accounts, zero cloud lock-in, and 100% browser-native persistence via `IndexedDB` and `localStorage`.

**Live App:** [foldednotes.ai.studio](https://foldednotes.ai.studio)

---

## Features

- **Five Glare-Free Matte Palettes:** Very Static (`#F6F5F2`), Pure White, Pitch Black, Matte Charcoal, and Mint & Lavender Matte.
- **Editorial Typography & Measure:** Switch between SF Pro Display, Manrope, Synonym, Bonny, JetBrains Mono, and wide-tracked **Spaced Mode**, with Narrow, Medium, and Wide column widths.
- **3D Folded-Corner Note Cards:** Visual grid view with tactile folded paper corners and customizable paper tints.
- **Block Editor & Slash Commands (`/`):** Headings, checklists, callouts, dividers, and clean distraction-free **Focus Mode**.
- **Split-Screen Reference Mode:** Draft side-by-side against pasted study prompts, transcripts, or source text with instant pane swapping.
- **Local-First Import & Export:** Drag-and-drop `.txt`, `.src`, `.md`, or `.json` files, and export notes to **PDF (`.pdf`)**, Markdown (`.md`), Plain Text (`.txt`), HTML (`.html`), Word (`.doc`), or full `.json` backups.
- **Custom Mascot & Launch Intro:** Built-in mint-green folded-paper mascot with automatic HTML5 `<canvas>` white-background removal for custom PNG uploads and optional `.mp4` / `.webm` startup intro playback.

---

## Keyboard Shortcuts

| Action | Windows | macOS |
| :--- | :--- | :--- |
| Export active note (`.md`) | `Ctrl + S` | `⌘ + S` |
| Export / Save as PDF | `Ctrl + P` | `⌘ + P` |
| Toggle Split Screen | `Ctrl + \` | `⌘ + \` |
| Insert block command menu | `/` | `/` |
| Exit Settings or Focus Mode | `Esc` | `Esc` |

---

## Run Locally

```bash
npm install
npm run dev
