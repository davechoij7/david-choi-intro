# david-choi-intro

Scroll-animated presentation site. 10-minute personal intro for a SwordPoint all-hands.

**Through-line:** *Same obsessions, bigger stages.*

## Aesthetic direction

Editorial / documentary / filmic. Think NYT Magazine longform meets a nature-documentary cold open. Warm, literary, slightly raw.

- **Type** — Fraunces (display, variable serif) + DM Sans (body) + DM Mono (timestamps and marks)
- **Palette** — OKLCH, warm-amber tinted neutrals. No pure gray, no pure black, no pure white. Four obsession accents: forest green, warm gold, steel blue, oxblood red
- **Layout** — asymmetric and varied. Full-bleed covers, editorial columns, 2/3 splits. Nothing is a card
- **Texture** — fixed SVG grain overlay, soft vignettes on full-bleed scenes
- **Motion** — expo-out easing (cubic-bezier 0.16, 1, 0.3, 1). No bounce. 40-80ms staggers. `prefers-reduced-motion` honored

## Stack

Vanilla HTML / CSS / JS via CDN — no build step. GSAP + ScrollTrigger for animation, Lenis for smooth scroll. Deploy: Vercel via GitHub autodeploy.

## Run locally

```bash
cd ~/Projects/david-choi-intro
npx serve .
```

Or just open `index.html` in a browser.

## First deploy

1. Create a new empty repo on GitHub named `david-choi-intro`. Don't init with README/gitignore/license — we're pushing an existing project.
2. From this directory:
   ```bash
   git init
   git add .
   git commit -m "Initial scaffold"
   git branch -M main
   git remote add origin git@github.com:YOUR_USERNAME/david-choi-intro.git
   git push -u origin main
   ```
3. [vercel.com](https://vercel.com) → **Add New → Project** → import `david-choi-intro`.
4. Framework Preset: **Other**. Root directory: `.`. Build command: *(empty)*. Output directory: `.`.
5. **Deploy.** `git push origin main` autodeploys after that.

## Scene map + assets needed

| # | Scene | Layout | Asset |
|---|-------|--------|-------|
| 01 | Cold open — Korea → Atlanta | full-bleed cover | `images/01-korea-david.jpg` |
| 02 | The Chois (family) | editorial column | — |
| 03 | Obsession #1 — Soccer + Michael | 2/3 split | `images/03-young-mike-david.jpg` |
| 04 | Obsession #2 — Dumb videos | centered | `images/04-kid-videos.mp4` |
| 05 | UCLA + basketball joke | asymmetric | `images/05-ucla-team.jpg` |
| 06 | AI accident I | editorial column | — |
| 07 | AI accident II — ChatGPT drops | centered ticker | — |
| 08 | Creator life — @mikemcgovern + MrBeast | 2/3 split reverse | `images/08-mikemcgovern-reel.mp4` |
| 09 | Full circle — back to Atlanta | full-bleed cover | `images/09-david-mike-present.jpg` |
| 10 | Obsession #4 — Jazmin | full-bleed cover | `images/10-jaz.jpg` |
| 11 | Thread convergence → map → photo | pinned, scripted | `images/11-present-david.jpg` |
| 12 | Closer — four obsessions | left-aligned list | — |

## Asset conventions

- **Photos** — JPG, 2000px wide max, 80% quality, under 300 KB each
- **Video** — MP4 H.264, 1920×1080, 15-30 sec clips, under 5 MB each
- **Filenames** — match the table above exactly, or update refs in `index.html`

## Next build passes

1. Real choreography for scenes 01, 03, 04, 05, 08, 11 (beyond default editorial fade)
2. Particle burst canvas for scene 11 phase B
3. Map reveal + zoom-through for scene 11 phase C
4. Asset integration once images land
5. Speaker script aligned to scroll beats
6. Backup screen capture for live-presentation safety net
