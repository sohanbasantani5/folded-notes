import { AppSettings, Note } from '../types/note';
import { DEFAULT_SETTINGS } from '../data/themes';
import { createSeedNotes } from '../data/seedNotes';

const DB_NAME = 'FolioEditorialNotesDB';
const DB_VERSION = 1;
const NOTES_STORE = 'notes';
const LS_NOTES_KEY = 'folio_notes_v1';
const LS_SETTINGS_KEY = 'folio_settings_v1';
const LS_ACTIVE_NOTE_KEY = 'folio_active_note_v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

function readNotesFromLocalStorage(): Note[] | null {
  try {
    const raw = localStorage.getItem(LS_NOTES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeNotesToLocalStorage(notes: Note[]): void {
  try {
    localStorage.setItem(LS_NOTES_KEY, JSON.stringify(notes));
  } catch {
    // Ignore storage quota errors
  }
}

export async function loadAllNotes(): Promise<Note[]> {
  try {
    const db = await openDatabase();
    const notes = await new Promise<Note[]>((resolve, reject) => {
      const tx = db.transaction(NOTES_STORE, 'readonly');
      const store = tx.objectStore(NOTES_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as Note[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();

    if (notes.length > 0) {
      return notes.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    const lsNotes = readNotesFromLocalStorage();
    if (lsNotes && lsNotes.length > 0) {
      await saveAllNotes(lsNotes);
      return lsNotes.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    const seed = createSeedNotes();
    await saveAllNotes(seed);
    return seed;
  } catch {
    const lsNotes = readNotesFromLocalStorage();
    if (lsNotes && lsNotes.length > 0) {
      return lsNotes.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    const seed = createSeedNotes();
    writeNotesToLocalStorage(seed);
    return seed;
  }
}

export async function saveAllNotes(notes: Note[]): Promise<void> {
  writeNotesToLocalStorage(notes);
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(NOTES_STORE, 'readwrite');
      const store = tx.objectStore(NOTES_STORE);
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        for (const note of notes) {
          store.put(note);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // LocalStorage backup already updated
  }
}

export async function saveSingleNote(note: Note): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(NOTES_STORE, 'readwrite');
      tx.objectStore(NOTES_STORE).put(note);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Fallback handled by full mirror
  }
}

export async function deleteSingleNote(noteId: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(NOTES_STORE, 'readwrite');
      tx.objectStore(NOTES_STORE).delete(noteId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Fallback handled by full mirror
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota errors
  }
}

export function loadActiveNoteId(): string | null {
  try {
    return localStorage.getItem(LS_ACTIVE_NOTE_KEY);
  } catch {
    return null;
  }
}

export function saveActiveNoteId(noteId: string): void {
  try {
    localStorage.setItem(LS_ACTIVE_NOTE_KEY, noteId);
  } catch {
    // Ignore quota errors
  }
}
