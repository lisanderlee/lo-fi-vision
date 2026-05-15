import type { LucideIcon } from 'lucide-react';
import {
  Clapperboard,
  Palette,
  Frame,
  Music2,
  Feather,
  Glasses,
  Cpu,
} from 'lucide-react';

export interface AgentRosterEntry {
  id: string;
  agent: string;
  title: string;
  subtitle: string;
  about: string;
  Icon: LucideIcon;
  accent: string;
  retryable: boolean;
}

export const AGENT_ROSTER: AgentRosterEntry[] = [
  {
    id: 'director',
    agent: 'Director',
    title: 'Director',
    subtitle: 'Running the whole show',
    about:
      'Coordinates each vision shift: starts the specialists, waits for their outputs, then weaves everything into the scene. When the Critic asks for tweaks, the Director re-runs only the pieces that need another pass so the whole experience stays in sync.',
    Icon: Clapperboard,
    accent: '#7c3aed',
    retryable: true,
  },
  {
    id: 'themedesigner',
    agent: 'ThemeDesigner',
    title: 'Theme',
    subtitle: 'Vibes & palettes',
    about:
      'Designs the look and feel of the UI from your prompt—CSS variables, accent colors, typography requests, and motion flourishes like scanlines or text reveals. Those tokens flow straight into the multiverse so every card and control matches the mood you asked for.',
    Icon: Palette,
    accent: '#db2777',
    retryable: true,
  },
  {
    id: 'artdirector',
    agent: 'ArtDirector',
    title: 'Art Director',
    subtitle: 'Painting the backdrop',
    about:
      'Creates the wide background artwork that sets the stage. It turns your scene description into a single hero image (here in a soft watercolor-inspired style) so the weather and atmosphere read instantly behind the rest of the interface.',
    Icon: Frame,
    accent: '#ea580c',
    retryable: true,
  },
  {
    id: 'composer',
    agent: 'Composer',
    title: 'Composer',
    subtitle: 'Writing the score',
    about:
      'Writes an audio brief from your prompt—tempo, density, mood—and that brief drives the procedural music layer. You get a fresh loop that matches the shift instead of a random stock track.',
    Icon: Music2,
    accent: '#059669',
    retryable: true,
  },
  {
    id: 'scenepoet',
    agent: 'ScenePoet',
    title: 'Scene Poet',
    subtitle: 'Finding the words',
    about:
      'Crafts the short in-world line you see in the scene: a narrator-style announcement that sells the weather and moment. It is tuned to your tone so the copy feels like part of the same story as the art and music.',
    Icon: Feather,
    accent: '#0284c7',
    retryable: true,
  },
  {
    id: 'critic',
    agent: 'Critic',
    title: 'Critic',
    subtitle: 'Keeping it tight',
    about:
      'Reviews the bundle for cohesion—do the colors, image, copy, and audio feel like one place? It can approve the shift or call out specific fixes. When it revises, only the flagged pieces are regenerated so the rest of your scene stays stable.',
    Icon: Glasses,
    accent: '#d97706',
    retryable: false,
  },
  {
    id: 'system',
    agent: 'System',
    title: 'System',
    subtitle: 'Holding it together',
    about:
      'Covers plumbing around the specialists: applying theme CSS, loading fonts, wiring music URLs, timeouts, retries, and other glue so the Crew’s work reliably lands in the UI. You will see it when something infrastructural succeeds or needs attention.',
    Icon: Cpu,
    accent: '#64748b',
    retryable: false,
  },
];
