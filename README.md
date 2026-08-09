# K’NEX Studio

A browser-based three-dimensional viewer and builder for K’NEX-style rods, connectors, wheels, and gears.

**Live demo:** https://lutherfergus.github.io/curly-chainsaw/

The demo is published from this repo with GitHub Pages and redeploys automatically on every push to `main` (and the current builder branch).

## Features

- Sidebar catalog of rods, connectors, wheels, and gears
- Interactive 3D viewport with orbit / zoom
- Snap placement: rod ends lock into open connector sockets (and the reverse)
- Joints stay linked as you assemble structures
- Select, rotate free pieces, delete, and clear

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Controls

| Action | How |
| --- | --- |
| Place piece | Choose from sidebar, click the grid |
| Snap | Move near a highlighted open port |
| Orbit | Drag in the viewport |
| Select | Press **Select** or `V`, then click a piece |
| Rotate free piece | `R` or **Rotate** |
| Delete | `Delete` / `Backspace` |
