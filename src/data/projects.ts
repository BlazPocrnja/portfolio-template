export interface GalleryImage {
  src: string;
  // Real content, not decoration — describe what's actually in the shot
  // ("dashboard filter panel in the open state"), not a generic label.
  alt: string;
}

export interface Project {
  slug: string;
  title: string;
  date: string; // "MM YYYY", shown in the list + preview card
  year: string;
  cover: string; // placeholder path, swap for real images in /public
  description: string;
  tags: string[];
  gallery: GalleryImage[];
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
    gallery: [
      { src: ph('project-one-a'), alt: 'Replace with a specific description of this shot — e.g. "homepage hero on desktop".' },
      { src: ph('project-one-b'), alt: 'Replace with a specific description of this shot — e.g. "mobile navigation, open state".' },
      { src: ph('project-one-c'), alt: 'Replace with a specific description of this shot — e.g. "detail view of the interaction pattern".' },
    ],
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
    gallery: [
      { src: ph('project-two-a'), alt: 'Replace with a specific description of this shot.' },
      { src: ph('project-two-b'), alt: 'Replace with a specific description of this shot.' },
    ],
  },
  {
    slug: 'project-three',
    title: 'Project Three',
    date: '09 2025',
    year: '2025',
    cover: ph('project-three'),
    description: 'Another placeholder entry — duplicate this shape for each real project.',
    tags: ['Mobile App', 'UI/UX'],
    gallery: [
      { src: ph('project-three-a'), alt: 'Replace with a specific description of this shot.' },
      { src: ph('project-three-b'), alt: 'Replace with a specific description of this shot.' },
      { src: ph('project-three-c'), alt: 'Replace with a specific description of this shot.' },
    ],
  },
  {
    slug: 'project-four',
    title: 'Project Four',
    date: '11 2025',
    year: '2025',
    cover: ph('project-four'),
    description: 'Placeholder description text for the fourth project entry.',
    tags: ['Three.js', 'WebGL'],
    gallery: [
      { src: ph('project-four-a'), alt: 'Replace with a specific description of this shot.' },
      { src: ph('project-four-b'), alt: 'Replace with a specific description of this shot.' },
    ],
  },
  {
    slug: 'project-five',
    title: 'Project Five',
    date: '02 2026',
    year: '2026',
    cover: ph('project-five'),
    description: 'Placeholder description text for the fifth project entry.',
    tags: ['Full-Stack', 'Database'],
    gallery: [
      { src: ph('project-five-a'), alt: 'Replace with a specific description of this shot.' },
      { src: ph('project-five-b'), alt: 'Replace with a specific description of this shot.' },
    ],
  },
];
