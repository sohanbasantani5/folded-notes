import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Eye, PanelLeftOpen } from 'lucide-react';
import {
  AppSettings,
  ExportFormat,
  Note,
  PaperTintId,
  ViewMode,
} from './types/note';
import {
  applySettingsToDocument,
  PAPER_TINT_ORDER,
} from './data/themes';
import {
  countNoteStats,
  createBlock,
  createId,
  exportNoteToFormat,
  parseTextToBlocks,
} from './utils/blocks';
import {
  deleteSingleNote,
  loadActiveNoteId,
  loadAllNotes,
  loadSettings,
  saveActiveNoteId,
  saveAllNotes,
  saveSettings,
  saveSingleNote,
} from './utils/storage';
import { InlineMascot, Sidebar } from './components/Sidebar';
import { BlockEditor } from './components/BlockEditor';
import { SplitScreenWorkspace } from './components/SplitScreenWorkspace';
import { NotesGrid } from './components/NotesGrid';
import { SettingsOverlay } from './components/SettingsOverlay';

const MEDIA_DB = 'folded_notes_media_db';
const MEDIA_STORE = 'assets';

function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(MEDIA_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(MEDIA_STORE)) {
        req.result.createObjectStore(MEDIA_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function putMedia(key: string, val: unknown): Promise<void> {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getMedia<T>(key: string): Promise<T | null> {
  try {
    const db = await openMediaDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(MEDIA_STORE, 'readonly');
      const req = tx.objectStore(MEDIA_STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function deleteMedia(key: string): Promise<void> {
  const db = await openMediaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    tx.objectStore(MEDIA_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function stripWhiteBg(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 512 / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas'));
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const minC = Math.min(d[i], d[i + 1], d[i + 2]);
          const sat = Math.max(d[i], d[i + 1], d[i + 2]) - minC;
          if (minC >= 246 && sat <= 14) d[i + 3] = 0;
          else if (minC >= 232 && sat <= 18) {
            d[i + 3] = Math.round(d[i + 3] * Math.max(0, Math.min(1, (246 - minC) / 14)));
          }
        }
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => ({
  ...loadSettings(),
  splitScreen: false,
}));
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [unfoldKey, setUnfoldKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [customMascotUrl, setCustomMascotUrl] = useState<string | null>(null);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [mascotCelebrating, setMascotCelebrating] = useState(false);
  const [introVisible, setIntroVisible] = useState<boolean>(() => {
    const saved = loadSettings();
    return saved.showIntroOnStartup ?? true;
  });

  const noticeTimerRef = useRef<number | null>(null);
  const celebrateTimerRef = useRef<number | null>(null);

  const triggerMascotBounce = useCallback(() => {
    setMascotCelebrating(true);
    if (celebrateTimerRef.current) window.clearTimeout(celebrateTimerRef.current);
    celebrateTimerRef.current = window.setTimeout(() => setMascotCelebrating(false), 900);
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 2400);
  }, []);

  useEffect(() => {
    applySettingsToDocument(settings);
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      loadAllNotes(),
      getMedia<string>('custom_mascot_png'),
      getMedia<Blob>('custom_intro_video'),
    ]).then(([loadedNotes, savedMascot, savedVideo]) => {
      if (!mounted) return;
      setNotes(loadedNotes);
      const savedActive = loadActiveNoteId();
      const matched = loadedNotes.find((n) => n.id === savedActive);
      setActiveNoteId(matched ? matched.id : loadedNotes[0]?.id ?? '');
      if (savedMascot) setCustomMascotUrl(savedMascot);
      if (savedVideo) setCustomVideoUrl(URL.createObjectURL(savedVideo));
      setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!introVisible || customVideoUrl) return;
    const timer = window.setTimeout(() => setIntroVisible(false), 2500);
    return () => window.clearTimeout(timer);
  }, [introVisible, customVideoUrl]);

  useEffect(() => {
    if (activeNoteId) saveActiveNoteId(activeNoteId);
  }, [activeNoteId]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const activeNote = useMemo(() => {
    return notes.find((n) => n.id === activeNoteId) ?? notes[0] ?? null;
  }, [notes, activeNoteId]);

  const stats = useMemo(() => {
    if (!activeNote) return { words: 0, characters: 0 };
    return countNoteStats(activeNote.title, activeNote.blocks);
  }, [activeNote]);

  const updateSettings = useCallback(
    (partial: Partial<AppSettings>) => {
      setSettings((prev) => ({ ...prev, ...partial }));
      if (partial.focusMode) {
        setViewMode('editor');
        triggerMascotBounce();
      }
    },
    [triggerMascotBounce]
  );

  const handleUpdateActiveNote = useCallback(
    (updater: (prev: Note) => Note) => {
      setNotes((prevNotes) => {
        const nextNotes = prevNotes.map((n) => {
          if (n.id !== activeNoteId) return n;
          const updated = updater(n);
          saveSingleNote(updated);
          return updated;
        });
        try {
          localStorage.setItem('folio_notes_v1', JSON.stringify(nextNotes));
        } catch {
          // Ignore quota errors
        }
        return nextNotes;
      });
    },
    [activeNoteId]
  );

  const handleCreateNote = useCallback(
    (preferredTint?: PaperTintId) => {
      const nextTint = preferredTint ?? PAPER_TINT_ORDER[notes.length % PAPER_TINT_ORDER.length];
      const now = Date.now();
      const fresh: Note = {
        id: createId(),
        title: '',
        blocks: [createBlock('paragraph', '')],
        tint: nextTint,
        referenceText: '',
        createdAt: now,
        updatedAt: now,
      };
      setNotes((prev) => {
        const next = [fresh, ...prev];
        saveAllNotes(next);
        return next;
      });
      setActiveNoteId(fresh.id);
      setViewMode('editor');
      setUnfoldKey((k) => k + 1);
    },
    [notes.length]
  );

  const handleSelectNote = useCallback((noteId: string) => {
    setActiveNoteId(noteId);
    setViewMode('editor');
    setUnfoldKey((k) => k + 1);
  }, []);
const handleMoveNote = useCallback((noteId: string, direction: 'up' | 'down') => {
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.id === noteId);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      saveAllNotes(copy);
      try {
        localStorage.setItem('folio_notes_v1', JSON.stringify(copy));
      } catch {
        // Ignore quota errors
      }
      return copy;
    });
  }, []);
  const handleDeleteNote = useCallback(
    (noteId: string) => {
      setNotes((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((n) => n.id !== noteId);
        deleteSingleNote(noteId);
        saveAllNotes(filtered);
        if (noteId === activeNoteId && filtered[0]) {
          setActiveNoteId(filtered[0].id);
        }
        return filtered;
      });
      showNotice('Note deleted');
    },
    [activeNoteId, showNotice]
  );

  const handleChangeTint = useCallback((noteId: string, tint: PaperTintId) => {
    setNotes((prev) => {
      const next = prev.map((n) => (n.id === noteId ? { ...n, tint } : n));
      saveAllNotes(next);
      return next;
    });
  }, []);

  const handleOpenFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        if (file.name.toLowerCase().endsWith('.json')) {
          try {
            const parsed = JSON.parse(text);
            const imported: Note[] = Array.isArray(parsed)
              ? parsed
              : Array.isArray(parsed?.notes)
              ? parsed.notes
              : [];
            if (imported.length > 0) {
              setNotes((prev) => {
                const existingIds = new Set(prev.map((n) => n.id));
                const deduped = imported.map((n) =>
                  existingIds.has(n.id) ? { ...n, id: createId() } : n
                );
                const merged = [...deduped, ...prev];
                saveAllNotes(merged);
                return merged;
              });
              setViewMode('grid');
              showNotice(`Imported ${imported.length} notes from backup`);
              return;
            }
          } catch {
            // Fall through
          }
        }

        const { extractedTitle, blocks } = parseTextToBlocks(text);
        const filenameTitle = file.name.replace(/\.[^.]+$/, '');
        const now = Date.now();
        const importedNote: Note = {
          id: createId(),
          title: extractedTitle || filenameTitle,
          blocks,
          tint: PAPER_TINT_ORDER[notes.length % PAPER_TINT_ORDER.length],
          referenceText: '',
          createdAt: now,
          updatedAt: now,
        };
        setNotes((prev) => {
          const next = [importedNote, ...prev];
          saveAllNotes(next);
          return next;
        });
        setActiveNoteId(importedNote.id);
        setViewMode('editor');
        setUnfoldKey((k) => k + 1);
        showNotice(`Opened ${file.name}`);
      };
      reader.readAsText(file);
    },
    [notes.length, showNotice]
  );

  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (!activeNote) return;
      if (format === 'pdf') {
        triggerMascotBounce();
        showNotice('Choose "Save as PDF" in the print dialog');
        if (viewMode === 'grid') {
          setViewMode('editor');
          setTimeout(() => window.print(), 180);
        } else {
          window.print();
        }
        return;
      }
      const filename = exportNoteToFormat(activeNote, notes, format);
      triggerMascotBounce();
      showNotice(`Saved ${filename}`);
    },
    [activeNote, notes, showNotice, triggerMascotBounce, viewMode]
  );

  const handleToggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      showNotice('Fullscreen unavailable in embedded preview');
    }
  }, [showNotice]);

  const handlePrint = useCallback(() => {
    if (viewMode === 'grid') {
      setViewMode('editor');
      setTimeout(() => window.print(), 160);
    } else {
      window.print();
    }
  }, [viewMode]);

  const handleDropFile = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file && /\.(txt|src|md|json)$/i.test(file.name)) {
        handleOpenFile(file);
      }
    },
    [handleOpenFile]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleExport('md');
        return;
      }
      if (mod && e.key === '\\') {
        e.preventDefault();
        setViewMode('editor');
        setSettings((prev) => ({ ...prev, splitScreen: !prev.splitScreen }));
        return;
      }
      if (e.key === 'Escape') {
        if (introVisible) {
          e.preventDefault();
          setIntroVisible(false);
          return;
        }
        if (settingsOpen) {
          e.preventDefault();
          setSettingsOpen(false);
          return;
        }
        if (settings.focusMode) {
          e.preventDefault();
          updateSettings({ focusMode: false });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExport, introVisible, settingsOpen, settings.focusMode, updateSettings]);

  const sidebarHidden = settings.focusMode || settings.sidebarCollapsed;

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDropFile}
      className="relative flex h-full w-full overflow-hidden"
      style={{ backgroundColor: 'var(--bg-canvas)', color: 'var(--ink-primary)' }}
    >
      <Sidebar
        notes={notes}
        activeNoteId={activeNote?.id ?? ''}
        wordCount={stats.words}
        charCount={stats.characters}
        viewMode={viewMode}
        splitScreen={settings.splitScreen}
        onMoveNote={handleMoveNote}
        isFullscreen={isFullscreen}
        collapsed={sidebarHidden}
        customMascotUrl={customMascotUrl}
        mascotCelebrating={mascotCelebrating}
        onCollapse={() => updateSettings({ sidebarCollapsed: true })}
        onNewNote={() => handleCreateNote()}
        onOpenFile={handleOpenFile}
        onExport={handleExport}
        onSelectNote={handleSelectNote}
        onDeleteNote={handleDeleteNote}
        onToggleNotesGrid={() => setViewMode((v) => (v === 'grid' ? 'editor' : 'grid'))}
        onToggleSplitScreen={() => {
          setViewMode('editor');
          updateSettings({ splitScreen: !settings.splitScreen });
        }}
        onToggleFullscreen={handleToggleFullscreen}
        onPrint={handlePrint}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {settings.sidebarCollapsed && !settings.focusMode && (
        <button
          type="button"
          onClick={() => updateSettings({ sidebarCollapsed: false })}
          aria-label="Expand sidebar"
          title="Show sidebar"
          className="no-print fixed top-4 left-4 z-30 flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-200 hover:scale-[1.03]"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-hairline)',
            color: 'var(--ink-secondary)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
          }}
        >
          <PanelLeftOpen className="h-4 w-4" strokeWidth={1.65} />
        </button>
      )}

      {settings.focusMode && (
        <div className="no-print group fixed top-0 right-0 z-40 p-5">
          <button
            type="button"
            onClick={() => updateSettings({ focusMode: false })}
            className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12.5px] font-medium opacity-20 transition-all duration-300 group-hover:opacity-100 focus-visible:opacity-100"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-strong)',
              color: 'var(--ink-primary)',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Eye className="h-3.5 w-3.5" strokeWidth={1.7} />
            <span>Exit Focus</span>
            <span className="font-mono text-[11px]" style={{ color: 'var(--ink-muted)' }}>
              Esc
            </span>
          </button>
        </div>
      )}

      <main className="relative h-full min-w-0 flex-1 overflow-hidden">
        {!loaded || !activeNote ? (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-[13px]" style={{ color: 'var(--ink-muted)' }}>
              Opening workspace…
            </span>
          </div>
        ) : viewMode === 'grid' ? (
          <NotesGrid
            notes={notes}
            activeNoteId={activeNote.id}
            onSelectNote={handleSelectNote}
            onCreateNote={handleCreateNote}
            onChangeTint={handleChangeTint}
            onDeleteNote={handleDeleteNote}
          />
        ) : settings.splitScreen ? (
          <SplitScreenWorkspace
            note={activeNote}
            focusMode={settings.focusMode}
            swapped={settings.swapSplitPanes}
            unfoldKey={unfoldKey}
            onSwapPanes={() => updateSettings({ swapSplitPanes: !settings.swapSplitPanes })}
            onUpdateNote={handleUpdateActiveNote}
          />
        ) : (
          <BlockEditor
            note={activeNote}
            focusMode={settings.focusMode}
            unfoldKey={unfoldKey}
            onUpdateNote={handleUpdateActiveNote}
          />
        )}
      </main>

      <AnimatePresence>
        {settingsOpen && (
          <SettingsOverlay
            settings={settings}
            customMascotUrl={customMascotUrl}
            hasCustomVideo={Boolean(customVideoUrl)}
            onUploadMascot={async (file) => {
              const transparentUrl = await stripWhiteBg(file);
              await putMedia('custom_mascot_png', transparentUrl);
              setCustomMascotUrl(transparentUrl);
              triggerMascotBounce();
              showNotice('Mascot updated (background removed)');
            }}
            onResetMascot={async () => {
              await deleteMedia('custom_mascot_png');
              setCustomMascotUrl(null);
              showNotice('Reset to default mascot');
            }}
            onUploadIntroVideo={async (file) => {
              await putMedia('custom_intro_video', file);
              setCustomVideoUrl(URL.createObjectURL(file));
              showNotice('Intro video saved');
            }}
            onResetIntroVideo={async () => {
              await deleteMedia('custom_intro_video');
              setCustomVideoUrl(null);
              showNotice('Removed custom intro video');
            }}
            onReplayIntro={() => setIntroVisible(true)}
            onUpdateSettings={updateSettings}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {introVisible && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="no-print fixed inset-0 z-[60] flex items-center justify-center p-6"
            style={{ backgroundColor: '#F6F5F2' }}
          >
            <div className="relative flex w-full max-w-[640px] flex-col items-center justify-center rounded-2xl p-8">
              {customVideoUrl ? (
                <video
                  src={customVideoUrl}
                  autoPlay
                  muted
                  playsInline
                  onEnded={() => setIntroVisible(false)}
                  className="w-full rounded-2xl object-contain"
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center text-center"
                >
                  <InlineMascot customMascotUrl={customMascotUrl} celebrating size={96} />
                  <div className="mt-5 text-[28px] font-semibold tracking-[-0.03em]" style={{ color: '#111111' }}>
                    folded notes.
                  </div>
                  <div className="mt-1.5 text-[13px]" style={{ color: '#848179' }}>
                    quiet space for clear thinking
                  </div>
                </motion.div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIntroVisible(false)}
              className="fixed right-7 bottom-7 rounded-full px-4 py-1.5 text-[12px] font-medium transition-opacity duration-200 hover:opacity-100 opacity-75"
              style={{ backgroundColor: 'rgba(17, 17, 17, 0.06)', color: '#111111' }}
            >
              Skip
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            role="status"
            aria-live="polite"
            className="no-print fixed bottom-5 right-6 z-50 rounded-lg px-4 py-2 text-[12.5px] font-medium"
            style={{
              backgroundColor: 'var(--ink-primary)',
              color: 'var(--bg-canvas)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.14)',
            }}
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}