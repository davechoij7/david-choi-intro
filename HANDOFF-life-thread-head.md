# Handoff: life-thread head dot drifts off-screen past scene-03

## Context

`david-choi-intro` is a 10-minute scroll-animated personal intro site for a SwordPoint all-hands (titled "Same obsessions, bigger stages"). Deployed to Vercel at https://david-choi-intro.vercel.app/ via GitHub autodeploy.

Vanilla HTML/CSS/JS, no build step. GSAP 3.12.5 + ScrollTrigger + Lenis 1.1.13.

## What the "life thread" is

One continuous amber SVG path that runs through the entire document. It lives in a `position: absolute; top:0; left:0; width:100%; height: documentHeight` wrap, spanning the full doc. Per-scene "lanes" (x as a 0–100 percent) steer the path around each scene's content block. Four obsession nodes light up on their scenes. Scene 11 is the convergence moment where three new arcs split off and explode into a neural blast — the life thread should **end at the top of scene 11**, handing off visually to the 3-arc split.

There's also a "bright traveling head" — a glowing gold dot that should ride the leading edge of the drawn path as the user scrolls.

## What was tried, what broke

Earlier, the head was a second SVG path overlay (`.life-thread-head`) inside the same SVG as the dim trail, scrubbed via `stroke-dashoffset`. It had a `filter: drop-shadow` animation (`lt-head-breathe` keyframes). User reported it lagged behind the scroll.

Hypothesis: the animated `filter` forced a full repaint per frame, causing the head to lag the trail. Refactor: replace the SVG head path with a `position: fixed` `<div class="life-thread-head-dot">` driven every frame by JS via `translate3d`. In `onUpdate`, compute `path.getPointAtLength(p * pathLen)` to get a point in SVG coords, then convert to screen coords using `wrap.getBoundingClientRect()` and apply `translate3d`.

**Current bug:** the dot follows correctly through scene-01 and scene-02, but **once the scroll hits obsession 01 (scene-03), the dot goes off-screen** and never comes back. User feedback verbatim: "its good for the first bit but goes off screen once i hit obsession 1". The dim trail draws correctly — only the head dot is broken.

## Key diagnostic clue

Scene-03 is where the life-thread lane does a dramatic lateral swing: `scene-01: 82 → scene-02: 80 → scene-03: 15` (far left). This is the first scene where `pt.x` in SVG coords drops dramatically. The bug likely lives in either:

1. **Coordinate conversion** — `wrap.getBoundingClientRect()` returning unexpected values once the user scrolls past a certain point. Worth logging `rect.left`, `rect.width`, `pt.x`, `pt.y`, and the resulting `xScreen`/`yScreen` in `onUpdate` to see where the numbers go rogue.
2. **`mix-blend-mode: screen` stacking context** — `.life-thread-wrap` has `mix-blend-mode: screen`, which creates a stacking context. The head dot is fixed-positioned OUTSIDE that wrap (now a sibling in `<body>`), so it shouldn't be affected, but worth double-checking the DOM order and whether any ancestor transform/filter is creating an unexpected containing block.
3. **`pt` coords when path has sharp curves** — at scene-03 the bezier has a big horizontal sweep; possible that `path.getPointAtLength` + the linear x-mapping (`(pt.x/100) * rect.width`) is correct but the `pt.y` value falls outside expected range due to how scene 03 is laid out. Log it.
4. **Document height vs. viewport** — the wrap height is set to `document.body.scrollHeight`, which can change when fonts load, images load, or scenes 11+ render. If the path was built before those changes and `rect.width`/`rect.top` assumed the old layout, the mapping fails after scene-03. Worth triggering a `build()` + re-bind after all images load.

## Goals

1. **Head dot tracks the line with zero drift** through every scene, all the way to scene-11's top.
2. **Line terminates at scene-11 top** (the start of the 3-arc split). Dot fades out as scene-11 pinned phase takes over.
3. Scene-12 has no life thread — it gets its own closer.

## Files and the exact regions that matter

- `index.html` — lines ~46–70. Wrap contains the SVG with one path, four nodes. Sibling `<div class="life-thread-head-dot">` lives right below the wrap.
- `style.css` — `.life-thread-wrap`, `.life-thread-path`, `.life-thread-head-dot`. Search for those selectors.
- `main.js` — `(function initLifeThread() {...})()`, roughly lines 154–300. Contains:
  - `LANES` object (per-scene x lane, 0–100). Scene-11 is terminal.
  - `build()` constructs waypoints + path `d`, sets `strokeDasharray`.
  - Main `ScrollTrigger.create` with `onUpdate` that drives `strokeDashoffset` AND `translate3d` on the head dot.
  - Two visibility triggers: fade dot in at scene-02, fade out at scene-11.

## Suggested next moves

- **Step 1**: Add `console.log` in `onUpdate` for: `self.progress`, `pt.x`, `pt.y`, `rect.left`, `rect.top`, `rect.width`, `xScreen`, `yScreen`. Scroll slowly through scene-01 → scene-03. Pinpoint the exact progress value where `xScreen` or `yScreen` goes out of viewport bounds.
- **Step 2**: If the bug is coordinate-related, consider dropping `wrap.getBoundingClientRect()` entirely and using `path.getBoundingClientRect()` + path-space math, OR using `getScreenCTM()` on the SVG to transform the point via matrix multiplication. Both are more robust than the manual viewport-width trick.
- **Alternative approach to consider**: abandon the fixed-position dot and put the head back inside the SVG as a `<path>` overlay (same geometry as `.life-thread-path` but with dashed pattern `${headLen} ${pathLen}` so only a short bright segment shows). The original lag was the animated `filter` keyframe — a STATIC SVG `<filter id="lt-head-glow"><feGaussianBlur stdDeviation="2.5"/></filter>` set once on the head path gives the glow without the per-frame repaint cost. Both line and head live in the same SVG, move as one unit via compositor, and `stroke-dashoffset` updates stay in lockstep. This may be simpler than debugging the screen-coord conversion.
- **Don't break**: the life thread's terminal point at scene-11 top (the 3-arc split handoff) must stay. Scene-12 must stay OUT of `LANES`. The `L last.x totalH` extension past the last waypoint must stay removed.

## What "done" looks like

Load the page, scroll from top to scene-11 at normal pace. The gold dot sits exactly on the leading edge of the drawn path through all 10 scenes, including the scene-03 lateral swing and the scene-08 reverse swing. At scene-11 top the dot reaches the terminal point and fades out as the neural blast takes over. No lag, no drift, no jumps.
