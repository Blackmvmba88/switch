# BlackMamba 3D Interface System

A visual system for making BCR feel less like a utility and more like a cybernetic control deck.

The goal is not decoration. The goal is spatial clarity: depth, layers, motion, focus, and proof.

## Core Direction

BCR interfaces should feel like:

- A tactical control room.
- A 3D dashboard floating over dark glass.
- A cybernetic instrument panel for controller input, network health, and runtime state.
- A visual bridge between hardware, human intent, and game output.

## Visual Language

### 1. Depth-First UI

Every screen should have clear depth levels:

```text
Z-0  Background atmosphere / wallpaper
Z-1  Large blurred panels / glass surfaces
Z-2  Main cards / runtime modules
Z-3  Active controls / buttons / meters
Z-4  Floating alerts / command overlays
Z-5  Critical operator actions
```

Use depth to explain priority. Critical information comes forward. Background information recedes.

### 2. 3D Cropped Photo Layers

Use cutout images as interface objects:

- Controller cutout floating above the panel.
- Hand/controller photo masked into a glass card.
- Xbox Cloud/game screenshot blurred behind telemetry.
- Device silhouettes as semi-transparent background layers.
- Button glyphs floating above their mapped semantic action.

Suggested asset folders:

```text
docs/media/wallpapers/
docs/media/cutouts/
docs/media/ui-mockups/
docs/media/gifs/
app/assets/3d/
app/assets/textures/
app/assets/cutouts/
```

### 3. Wallpapers as Product Identity

Create wallpaper-grade backgrounds for:

- README hero image.
- Control Room empty state.
- Loading/splash screen.
- Release banners.
- GitHub social preview.

Wallpaper directions:

| Name | Description |
| --- | --- |
| Obsidian Deck | black glass, subtle grid, deep reflections |
| Neon Serpent Bus | flowing green/blue input signal trails |
| XCloud Bridge | controller silhouette connected to cloud nodes |
| Tactical Runtime | panels, gauges, terminal glow, depth haze |
| BlackMamba Core | snake-scale texture, carbon fiber, red/green pulse |

### 4. Motion System

Motion should communicate state:

| State | Motion |
| --- | --- |
| Idle | slow breathing glow |
| Controller connected | snap-in highlight + pulse |
| Input detected | ripple from physical button to semantic output |
| Network warning | subtle jitter / amber pulse |
| Runtime active | rotating ring / heartbeat line |
| Critical error | red depth flash, not full-screen chaos |

Avoid random animation. Motion must explain what changed.

## Interface Components

### Control Room Hero

Top-level cockpit:

```text
┌──────────────────────────────────────────────┐
│  BCR / BLACKMAMBA CYBERNETIC RUNTIME         │
│  Controller: Rock Candy Switch  Status: LIVE │
├──────────────────────────────────────────────┤
│                                              │
│     [3D Controller Cutout / Input Map]        │
│                                              │
│  HID IN  ->  SEMANTIC BUS  ->  XBOX OUT      │
│                                              │
├───────────────┬───────────────┬──────────────┤
│ Latency       │ Network       │ Runtime      │
│ Jitter        │ Packet Loss   │ Session      │
└───────────────┴───────────────┴──────────────┘
```

### Semantic Button Map

Show physical and semantic meaning at the same time:

```text
Physical Bottom Button
Printed: B
Semantic: Xbox A
State: pressed / released
```

Visual idea:

- Physical button glows on the controller cutout.
- A line travels into the semantic bus.
- Xbox output button glows in a separate output cluster.

### Runtime Health Cards

Cards should be dimensional:

```text
Card surface: glass / translucent
Inner glow: state color
Shadow: soft depth
Border: thin neon edge only when active
```

Useful cards:

- Controller Source
- Semantic Profile
- CDP Bridge
- xCloud Target
- Network Path
- Session Timer
- Memory / Process Health
- Logs / Recent Events

## 3D Implementation Options

### CSS-Only Depth

Use first because it is fast and maintainable:

- `transform: perspective(...) rotateX(...) rotateY(...)`
- `filter: blur(...)`
- `backdrop-filter: blur(...)`
- layered gradients
- radial highlights
- SVG lines for signal flow

### React + Three.js Layer

Use when real 3D is needed:

- Controller model or floating panels.
- Particle input trails.
- Runtime core animation.
- 3D wallpaper export.

Suggested stack:

```text
three
@react-three/fiber
@react-three/drei
framer-motion
```

### Static 3D Assets

For README, releases, and social previews:

- Blender renders.
- Figma/Photoshop cutouts.
- AI-generated concept wallpapers.
- Screenshots composited into 3D frames.

## Design Tokens

```css
:root {
  --bcr-bg: #050607;
  --bcr-panel: rgba(12, 18, 22, 0.72);
  --bcr-glass: rgba(255, 255, 255, 0.06);
  --bcr-line: rgba(87, 255, 193, 0.48);
  --bcr-live: #57ffc1;
  --bcr-warn: #ffd166;
  --bcr-danger: #ff3b5c;
  --bcr-muted: #8b98a5;
  --bcr-text: #f2f7f8;
  --bcr-depth-shadow: 0 24px 80px rgba(0, 0, 0, 0.55);
}
```

## First Visual Milestones

### Milestone A — README Proof Pack

Create:

- `docs/media/hero-bcr-control-room.png`
- `docs/media/control-room.gif`
- `docs/media/fortnite-map.gif`
- `docs/media/live-monitor.gif`

README placement:

```markdown
![BlackMamba Cybernetic Runtime Control Room](docs/media/hero-bcr-control-room.png)
```

### Milestone B — Control Room Depth Pass

Add:

- Glass cards.
- Perspective hero panel.
- Controller cutout.
- Runtime signal lines.
- Live pulse states.

### Milestone C — 3D Wallpaper Generator

Create a small script that exports branded wallpapers:

```text
scripts/render-wallpaper.mjs
```

Targets:

```text
1920x1080
2560x1440
3840x2160
1600x900 GitHub hero
1280x640 social preview
```

### Milestone D — Motion Proof

Create one polished animation:

```text
Physical input -> Semantic bus -> Xbox output
```

This becomes the product identity.

## Prompt Bank For Concept Art

### Control Room Hero

```text
BlackMamba Cybernetic Runtime control room interface, dark obsidian glass panels, floating 3D controller cutout, neon green and cyan signal paths, Xbox cloud gaming telemetry, depth of field, tactical dashboard, cybernetic UI, high contrast, premium software product hero image, 16:9, no text, no logos, clean composition
```

### Wallpaper

```text
abstract cybernetic input signal wallpaper, black obsidian background, green and cyan neon trails, subtle snake-scale texture, glass depth layers, volumetric haze, premium dark interface aesthetic, 4k, no text, no watermark
```

### Runtime Core

```text
futuristic semantic bus core, floating translucent panels, controller input nodes, glowing data streams, black glass, neon green pulse, cinematic depth, software cockpit interface, 16:9, no text, no watermark
```

## Acceptance Criteria

A visual pass is accepted when:

- The interface still works without motion.
- The most important status is readable in under 3 seconds.
- Depth improves hierarchy instead of hiding information.
- Screenshots look good enough to use as README proof.
- The theme is consistent across README, Control Room, release banners, and wallpapers.

## Rule

No random sci-fi noise.

Every glow, layer, shadow, particle, and cutout must explain one thing:

```text
human input -> semantic runtime -> game output
```
