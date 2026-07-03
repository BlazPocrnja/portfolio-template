export interface Project {
  slug: string;
  title: string;
  date: string; // "MM YYYY", shown in the list + preview card
  year: string;
  cover: string; // placeholder path, swap for real images in /public
  description: string;
  tags: string[];
  gallery: string[];
}

// Swap `cover`/`gallery` for real assets under /public/images/projects/*
// Using a placeholder image service so the template runs with zero assets.
const ph = (seed: string, w = 1200, h = 900) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

export const projects: Project[] = [
  {
    slug: 'project-one',
    title: 'Project One',
    date: '01 2025',
    year: '2025',
    cover: ph('project-one'),
    description:
      'A short one or two sentence summary of what this project is, who it was for, and what you were responsible for.',
    tags: ['Web Design', 'Development', 'Animation'],
    gallery: [ph('project-one-a'), ph('project-one-b'), ph('project-one-c')],
  },
  {
    slug: 'project-two',
    title: 'Project Two',
    date: '06 2025',
    year: '2025',
    cover: ph('project-two'),
    description:
      'Replace this with real project copy. Keep it tight — one idea, one outcome.',
    tags: ['Branding', 'Interactive'],
    gallery: [ph('project-two-a'), ph('project-two-b')],
  },
  {
    slug: 'project-three',
    title: 'Project Three',
    date: '09 2025',
    year: '2025',
    cover: ph('project-three'),
    description: 'Another placeholder entry — duplicate this shape for each real project.',
    tags: ['Mobile App', 'UI/UX'],
    gallery: [ph('project-three-a'), ph('project-three-b'), ph('project-three-c')],
  },
  {
    slug: 'project-four',
    title: 'Project Four',
    date: '11 2025',
    year: '2025',
    cover: ph('project-four'),
    description: 'Placeholder description text for the fourth project entry.',
    tags: ['Three.js', 'WebGL'],
    gallery: [ph('project-four-a'), ph('project-four-b')],
  },
  {
    slug: 'project-five',
    title: 'Project Five',
    date: '02 2026',
    year: '2026',
    cover: ph('project-five'),
    description: 'Placeholder description text for the fifth project entry.',
    tags: ['Full-Stack', 'Database'],
    gallery: [ph('project-five-a'), ph('project-five-b')],
  },
];
