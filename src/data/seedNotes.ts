import { Note } from '../types/note';
import { createBlock, createId } from '../utils/blocks';

export function createSeedNotes(): Note[] {
  const now = Date.now();
  const hour = 3600 * 1000;

  return [
    {
      id: createId(),
      title: 'Notes on Quiet Interfaces',
      tint: 'warm-paper',
      createdAt: now - hour * 3,
      updatedAt: now - 1000 * 60 * 12,
      referenceText:
        'Prompt / Source Excerpt:\n"Good tools disappear while you think. How does typography, line measure, and paper warmth influence sustained reading and drafting?"\n\nKey angles to address:\n1. Optical measure (60–75 characters per line)\n2. Matte surfaces vs harsh specular contrast\n3. Keyboard-first cadence without visual clutter',
      blocks: [
        createBlock(
          'paragraph',
          'The best writing environments feel less like software and more like a clean sheet of heavy cotton stock on an uncluttered desk. When chrome recedes, attention naturally returns to the rhythm of sentences.'
        ),
        createBlock('h2', 'Three Principles for Deep Work'),
        createBlock(
          'numbered',
          'Hold a deliberate line measure so the eye travels effortlessly from line end to line start.'
        ),
        createBlock(
          'numbered',
          'Keep live metrics quiet and peripheral—present when you glance left, invisible while composing.'
        ),
        createBlock(
          'numbered',
          'Separate configuration from composition. Typography and theme choices belong in a dedicated room, never crowding the margin.'
        ),
        createBlock(
          'callout',
          'Type "/" anywhere on a line to insert headings, lists, checklists, dividers, or callout quotes without lifting your hands from the keyboard.'
        ),
        createBlock('divider'),
        createBlock('h2', 'Session Checklist'),
        createBlock('checklist', 'Draft core thesis in narrow or medium width', true),
        createBlock('checklist', 'Open Split Screen (⌘\\ or Ctrl+\\) to review reference questions', false),
        createBlock('checklist', 'Switch to Focus Mode for final line-by-line editing', false),
      ],
    },
    {
      id: createId(),
      title: 'Cognitive Load & Spaced Recall',
      tint: 'soft-lavender',
      createdAt: now - hour * 26,
      updatedAt: now - hour * 5,
      referenceText:
        'Reading Questions — Chapter 4:\nQ1: Why does retrieval practice outperform passive re-reading over a 14-day retention window?\nQ2: What distinguishes intrinsic cognitive load from extraneous interface load?\nQ3: How should synthesis notes be structured to encourage active recall?',
      blocks: [
        createBlock(
          'paragraph',
          'Passive highlighting creates an illusion of fluency. Real retention happens when the brain reconstructs an argument from sparse cues rather than scanning familiar phrasing.'
        ),
        createBlock('h2', 'Synthesis Notes'),
        createBlock(
          'bullet',
          'Intrinsic load scales with conceptual complexity and cannot be removed—only sequenced.'
        ),
        createBlock(
          'bullet',
          'Extraneous load comes from fragmented tools, notifications, and poor visual hierarchy.'
        ),
        createBlock(
          'bullet',
          'Framing each section as a question forces active reconstruction before reading the answer.'
        ),
        createBlock(
          'callout',
          'A note is only finished when you can explain the underlying mechanism in three plain sentences without looking at the source.'
        ),
      ],
    },
    {
      id: createId(),
      title: 'Essay Film Script — Opening Sequence',
      tint: 'pale-butter',
      createdAt: now - hour * 52,
      updatedAt: now - hour * 18,
      referenceText:
        'Script Brief:\nRuntime: 00:00 – 01:30\nTone: Calm, observational, unhurried narration.\nVisual motifs: Morning window light on paper, mechanical typewriter keystroke, rain against glass.',
      blocks: [
        createBlock('h1', 'Scene 01 — Before the Noise'),
        createBlock(
          'paragraph',
          'Open on a still frame of morning light moving across a matte desk. Three seconds of room tone before the voice enters.'
        ),
        createBlock(
          'callout',
          'VOICEOVER: "Most modern tools ask for your attention before you have decided what you want to say. This essay is about the opposite: rooms built for finishing a thought."'
        ),
        createBlock('h2', 'Shot Progression'),
        createBlock('numbered', 'Wide static frame — desk, notebook, subtle shadow shift (6s)'),
        createBlock('numbered', 'Close detail — pen nib and paper grain, natural ambient audio (4s)'),
        createBlock('numbered', 'Cut to clean title card set in Bonny serif over warm paper (3s)'),
      ],
    },
    {
      id: createId(),
      title: 'Prompt Architecture Reference',
      tint: 'stone-gray',
      createdAt: now - hour * 90,
      updatedAt: now - hour * 40,
      referenceText: '',
      blocks: [
        createBlock(
          'paragraph',
          'Structured prompt templates benefit from monospace alignment and explicit separation between context, constraints, and desired output shape.'
        ),
        createBlock('h2', 'Reusable Skeleton'),
        createBlock('bullet', 'Role & Perspective: Define the exact editorial stance and domain depth.'),
        createBlock('bullet', 'Constraints: List what must be excluded before specifying tone.'),
        createBlock('bullet', 'Evaluation Rubric: State three objective criteria for a strong draft.'),
        createBlock('divider'),
        createBlock('checklist', 'Verify edge cases in Split Screen side-by-side view', true),
        createBlock('checklist', 'Export final prompt set as clean Markdown (.md)', false),
      ],
    },
  ];
}
