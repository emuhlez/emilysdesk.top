# Studio Shell

A modern game editor built with React and TypeScript. Features a professional-grade UI inspired by industry-standard game engines like Unity and Unreal, with a distinctive forge-inspired aesthetic.

## Features

- **Hierarchy Panel** - Scene object tree with visibility and lock controls
- **Viewport** - 2D/3D scene visualization with grid overlay
- **Inspector Panel** - Object properties and transform editing
- **Assets Panel** - Project asset browser with list/grid views
- **Console** - Debug output and logging
- **Toolbar** - Tool selection, playmode controls, and view options

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The editor will be available at [http://localhost:3000](http://localhost:3000)

### Build

```bash
npm run build
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Zustand** - State management
- **Lucide React** - Icons
- **CSS Modules** - Scoped styling

## Architecture

```
src/
├── components/       # React components
│   ├── shared/       # Reusable UI components
│   ├── Toolbar/      # Top toolbar
│   ├── Hierarchy/    # Scene tree
│   ├── Viewport/     # Game view
│   ├── Inspector/    # Properties panel
│   ├── Assets/       # Asset browser
│   └── Console/      # Debug console
├── store/            # Zustand state management
├── types/            # TypeScript definitions
└── styles/           # Global CSS
```

## License

MIT





