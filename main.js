/* ============================================================
   david-choi-intro — scroll framework
   GSAP + ScrollTrigger + Lenis. No build step.
   ============================================================ */

gsap.registerPlugin(ScrollTrigger);

/* --- Custom easings tuned to match the design direction --- */
const easeEnter = 'expo.out';
const easeExit  = 'expo.in';

/* --- Lenis smooth scroll, synced to GSAP ticker --- */
const lenis = new Lenis({
  duration: 1.15,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
});

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* --- Background images: load lazily, fade in only if the file exists --- */
document.querySelectorAll('[data-bg]').forEach((el) => {
  const url = el.dataset.bg;
  if (!url) return;
  const img = new Image();
  img.onload = () => {
    el.style.backgroundImage = `url('${url}')`;
    // crossfade layers and split media handle their own visibility
    if (el.classList.contains('scene__bg')) {
      el.style.opacity = '0'; // revealed by scene 01 timeline or default fade
    }
  };
  img.src = url;
});

/* --- Default editorial fade for scenes without custom choreography --- */
document.querySelectorAll('.scene:not([data-choreographed])').forEach((scene) => {
  const targets = scene.querySelectorAll(
    '.mark, .display, .lede, .aside, .editorial-list > div, .obsessions li, .closer, .video-frame, .reveal-caption, .ticker'
  );
  if (!targets.length) return;
  gsap.from(targets, {
    y: 32,
    opacity: 0,
    duration: 1.1,
    stagger: 0.06,
    ease: easeEnter,
    scrollTrigger: {
      trigger: scene,
      start: 'top 72%',
      toggleActions: 'play none none reverse',
    },
  });
});

/* ============================================================
   PERSISTENT THROUGH-LINE
   Progress fill + head glide scales with overall scroll.
   Segments sit at y-positions matching their target scene.
   Hidden during scene 11 convergence; returns lit for scene 12.
   ============================================================ */

(function initThroughLine() {
  const thread = document.querySelector('.through-line');
  if (!thread) return;

  const segments = thread.querySelectorAll('.segment');
  const progress = thread.querySelector('.through-line__progress');
  const head     = thread.querySelector('.through-line__head');

  const threadTopPct = 10;    // matches top: 10vh
  const threadBotPct = 10;    // matches bottom: 10vh
  const threadRangePx = () =>
    window.innerHeight * (100 - threadTopPct - threadBotPct) / 100;

  // Position each segment at y matching its scene's scroll progress.
  const positionSegments = () => {
    const docScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (docScroll <= 0) return;
    segments.forEach((seg) => {
      const target = document.querySelector(seg.dataset.target);
      if (!target) return;
      const triggerScroll = Math.max(
        0,
        target.offsetTop - window.innerHeight * 0.6
      );
      const pct = Math.min(1, triggerScroll / docScroll);
      const y = pct * threadRangePx();
      seg.style.top = `calc(${threadTopPct}vh + ${y}px - 28px)`;
    });
  };

  positionSegments();
  window.addEventListener('resize', () => {
    positionSegments();
    ScrollTrigger.refresh();
  });
  // Re-run once all bg images settle (layout may shift slightly)
  window.addEventListener('load', positionSegments);

  // Progress + head follow scroll
  ScrollTrigger.create({
    trigger: document.documentElement,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => {
      const range = threadRangePx();
      const p = self.progress;
      progress.style.height = (p * range) + 'px';
      head.style.transform = `translateY(${p * range}px)`;
    },
  });

  // Light each segment as its scene enters
  segments.forEach((seg) => {
    const target = document.querySelector(seg.dataset.target);
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: 'top 60%',
      onEnter:     () => seg.classList.add('lit'),
      onLeaveBack: () => seg.classList.remove('lit'),
    });
  });

  // Hide the thread during scene 11 (the abstract convergence moment)
  const scene11 = document.getElementById('scene-11');
  if (scene11) {
    ScrollTrigger.create({
      trigger: scene11,
      start: 'top 60%',
      end: 'bottom 20%',
      onEnter:     () => thread.classList.add('is-hidden'),
      onLeave:     () => thread.classList.remove('is-hidden'),
      onEnterBack: () => thread.classList.add('is-hidden'),
      onLeaveBack: () => thread.classList.remove('is-hidden'),
    });
  }
})();

/* ============================================================
   LIFE THREAD — continuous amber stroke through every scene
   One SVG path laid across the full document height. Per-scene
   lane anchors route it around the content block of each layout,
   so it weaves through negative space instead of over photos.
   Scroll-scrubbed via stroke-dashoffset. Four obsession nodes
   (HTML, for perfect circles) ignite when their scene enters.
   mix-blend-mode:screen is applied in CSS — thread glows over
   dark photos, disappears over light text.
   ============================================================ */

(function initLifeThread() {
  const wrap    = document.querySelector('.life-thread-wrap');
  if (!wrap) return;
  const svg     = wrap.querySelector('.life-thread-svg');
  const path    = wrap.querySelector('.life-thread-path');
  const headDot = document.querySelector('.life-thread-head-dot');
  const nodes   = Array.from(wrap.querySelectorAll('.life-thread-node'));
  const scenes  = Array.from(document.querySelectorAll('.scene'));

  // Flip debug on via URL hash (#ltdebug) or window.__LT_DEBUG=true in console.
  const DEBUG = () => window.__LT_DEBUG === true || location.hash.includes('ltdebug');
  let __lastLog = 0;

  // Per-scene X lane (0–100, % of viewport).
  // Default: ride the right side (80–84). Move only when content demands it —
  // two deliberate lateral moves (scene 03 + scene 08) register as motivated,
  // not random. Thread terminates at scene 11's TOP (hands off to the 3-arc
  // split). No waypoint for scene 12.
  const LANES = {
    'scene-01': 82,
    'scene-02': 80,
    'scene-03': 15,
    'scene-04': 82,
    'scene-05': 48,
    'scene-06': 80,
    'scene-07': 80,
    'scene-08': 88,
    'scene-09': 82,
    'scene-10': 82,
    'scene-11': 50,   // TERMINAL — y = scene.offsetTop, not midY
  };

  let pathLen = 0;
  const waypoints = [];
  let s11Top = 0;
  let s11Bottom = 0;

  // Monotonic (docY, x, arc) triplets sampled along the path. Lets us ask
  // "what path point corresponds to document-y Y?" in ~log(n). Required
  // because getPointAtLength()/path arc-length is ~33% longer than the
  // path's y-span (lateral beziers add arc with no scroll counterpart),
  // so driving the dot by `progress * pathLen` outpaces scroll.
  let samples = [];
  const SAMPLE_COUNT = 256;

  // Document-space top. Can't use .offsetTop on pinned scenes — GSAP
  // ScrollTrigger wraps them in a position:relative pin-spacer that
  // becomes the offsetParent, so offsetTop returns 0 (position inside
  // the spacer). getBoundingClientRect is reliable as long as we're
  // not measuring a scene that's currently in its pinned/fixed phase —
  // true at both build() call sites (init + window.load, scroll = 0).
  const docTopOf = (el) => el.getBoundingClientRect().top + window.scrollY;

  function build() {
    const totalH = document.body.scrollHeight;
    // Use documentElement.clientWidth (excludes scrollbar) — NOT innerWidth.
    // The SVG renders at clientWidth; if viewBox uses innerWidth, preserveAspectRatio
    // "meet" scales the viewBox uniformly to fit, applying the X scrollbar-ratio
    // (~0.98) to Y as well. That shrinks every SVG-y by ~1.8%, drifting the dot
    // ~80px above viewport middle at mid-page and visually "detaching" the line
    // from the dot during scene-03/08 lateral sweeps.
    const vw = document.documentElement.clientWidth;
    wrap.style.height = totalH + 'px';
    // viewBox matches rendered SVG width so preserveAspectRatio scale is 1:1 on
    // both axes — getPointAtLength's user-space arc and the browser's dashoffset
    // traversal agree exactly.
    svg.setAttribute('viewBox', `0 0 ${vw} ${totalH}`);

    const s11 = document.getElementById('scene-11');
    s11Top    = s11 ? docTopOf(s11) : totalH;
    s11Bottom = s11 ? docTopOf(s11) + s11.offsetHeight : totalH;

    // Compute waypoints. Every scene (including scene-11) uses its MIDDLE.
    // Why scene-11 middle and not top: the 3-arc threads are
    //   d="M 600 0 C ... 600 400"  viewBox="0 0 1200 800"  slice
    // — they emanate from top-center (M 600 0) and CONVERGE at (600, 400)
    // = scene-11 center. The visible handoff point is the convergence
    // (the .knot), not the emanation origin. Scene-11 is 100vh tall and
    // pins at its top — so when pinned, scene-11 middle sits at viewport
    // middle, which is exactly where the dot already lives. No ramp, no
    // special case. Scene 12 is skipped (no waypoint).
    waypoints.length = 0;
    scenes.forEach((scene) => {
      const id   = scene.id;
      if (!(id in LANES)) return;     // skips scene-12 and anything else
      const lane = LANES[id];
      const top  = docTopOf(scene);
      waypoints.push({ id, x: lane, y: top + scene.offsetHeight * 0.5 });
    });

    if (!waypoints.length) return;

    // Smooth cubic bezier chain. Control points at the vertical midpoint
    // between waypoints, on each segment's own lane, so transitions ease.
    // LANES are stored as 0..100 percentages (so obsession-node CSS `left: N%`
    // still works); path d needs pixel x-coords matching the pixel viewBox.
    const k = vw / 100;
    const first = waypoints[0];
    let d = `M ${(first.x * k).toFixed(2)} 0 L ${(first.x * k).toFixed(2)} ${first.y.toFixed(2)}`;
    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i - 1];
      const curr = waypoints[i];
      const midY = (prev.y + curr.y) / 2;
      const prevXpx = (prev.x * k).toFixed(2);
      const currXpx = (curr.x * k).toFixed(2);
      d += ` C ${prevXpx} ${midY.toFixed(2)}, ${currXpx} ${midY.toFixed(2)}, ${currXpx} ${curr.y.toFixed(2)}`;
    }
    // NO line extension past last waypoint — path ends at scene-11 top.

    path.setAttribute('d', d);
    pathLen = path.getTotalLength();

    // Sample the path at regular arc-length intervals. Each sample
    // captures (y, x, arc), letting us ask "at docY = targetY, what
    // path (x, arc) corresponds?". Path is monotonic in Y (all
    // cubic control points sit on midY between endpoints), so
    // samples are guaranteed sorted by y.
    samples = new Array(SAMPLE_COUNT + 1);
    for (let i = 0; i <= SAMPLE_COUNT; i++) {
      const arc = (i / SAMPLE_COUNT) * pathLen;
      const pt  = path.getPointAtLength(arc);
      samples[i] = { y: pt.y, x: pt.x, arc };
    }

    // Main path: scroll reveals it from 0 → pathLen
    path.style.strokeDasharray = pathLen;
    path.style.strokeDashoffset = pathLen;

    // Position each obsession node at its target scene's waypoint
    nodes.forEach((node) => {
      const targetId = (node.dataset.target || '').replace('#', '');
      const wp = waypoints.find((w) => w.id === targetId);
      if (!wp) { node.style.display = 'none'; return; }
      node.style.left = wp.x + '%';
      node.style.top  = wp.y + 'px';
    });

    if (DEBUG()) {
      console.log('[LT build]', {
        totalH,
        pathLen: Math.round(pathLen),
        scrollY: window.scrollY,
        wpShortlist: waypoints.map(w => `${w.id}: (${w.x}, ${Math.round(w.y)})`),
      });
    }
  }

  build();
  window.addEventListener('load',   () => { build(); ScrollTrigger.refresh(); });
  window.addEventListener('resize', () => { build(); ScrollTrigger.refresh(); });
  // Also rebuild after every ScrollTrigger refresh — this is the source-of-truth
  // moment at which pin-spacers are guaranteed to be in place and scene positions
  // are final. Prevents a race where we sampled scene getBoundingClientRect()
  // before ScrollTrigger had a chance to install pin-spacers.
  ScrollTrigger.addEventListener('refresh', build);

  // Convert SVG user-space point → screen px via the SVG's own rendering
  // matrix. Using getScreenCTM() instead of hand-rolled math means we
  // measure EXACTLY where the browser renders that point — accounting for
  // preserveAspectRatio, viewBox, parent transforms, everything. This is
  // what makes the HTML dot stay locked to the SVG path's drawn edge:
  // both now reference the same source of truth (the browser's CTM).
  // Reused SVGPoint to avoid per-frame allocation.
  const _svgPt = svg.createSVGPoint();
  function svgPointToScreen(pt) {
    _svgPt.x = pt.x;
    _svgPt.y = pt.y;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = _svgPt.matrixTransform(ctm);
    return { x: p.x, y: p.y };
  }

  // Given a document-space Y, find the path's (x, arc) at that Y via
  // binary search + linear interpolation on the sampled table.
  // Returns {y, x, arc}. Clamps to path endpoints if targetY is out of range.
  function lookupByY(targetY) {
    if (!samples.length) return null;
    if (targetY <= samples[0].y) return samples[0];
    const last = samples[samples.length - 1];
    if (targetY >= last.y) return last;

    let lo = 0, hi = samples.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].y <= targetY) lo = mid;
      else hi = mid;
    }
    const a = samples[lo];
    const b = samples[lo + 1];
    const span = b.y - a.y;
    const t = span > 0 ? (targetY - a.y) / span : 0;
    return {
      y: targetY,
      x:   a.x   + (b.x   - a.x)   * t,
      arc: a.arc + (b.arc - a.arc) * t,
    };
  }

  // Scroll scrub. Ends at scene-11 TOP (the moment scene-11 pins).
  //
  // Terminal geometry: the last waypoint is at scene-11 middle (y =
  // s11Top + vh/2). At the pin moment (scrollY = s11Top), targetY =
  // scrollY + vh/2 = s11Top + vh/2 = last waypoint. Line fills exactly.
  // In screen coords, that point sits at viewport middle — right where
  // the .knot lives (scene-11 threads converge at viewBox 600,400 =
  // scene-11 center). The dot fades out and the 3 arcs emerge from
  // top-center, converging on that same point.
  //
  // IMPLEMENTATION NOTE: we DO NOT drive the dot by self.progress * pathLen.
  // The path's arc length is ~33% longer than the scroll range because lateral
  // bezier sweeps (scene-02 → scene-03 swings x 80→15, back 15→82) add arc
  // length with no scroll counterpart. Driving by progress makes the dot
  // outpace scroll, drifting past viewport bottom around obsession 01.
  //
  // Instead, map directly from document-space Y (scrollY + vh/2, i.e. viewport
  // middle) to path (x, arc) via the sampled lookup. This decouples the dot's
  // speed from path arc length entirely — it always tracks viewport middle.
  ScrollTrigger.create({
    trigger: document.documentElement,
    start: 'top top',
    // Function-valued end + refreshPriority:-1 so this ST refreshes AFTER
    // the pinned scenes (03, 08) insert their pin-spacers. Without the low
    // priority, end resolves to scene-11's pre-spacer position (~8kpx) and
    // the dot freezes ~2-3kpx before scene-11 actually pins. With it, end
    // resolves to the true post-layout position (~11kpx).
    end: () => {
      const s11 = document.getElementById('scene-11');
      return s11 ? s11.getBoundingClientRect().top + window.scrollY : 'max';
    },
    invalidateOnRefresh: true,
    refreshPriority: -1,
    onUpdate: (self) => {
      if (!pathLen || !samples.length) return;
      const vh = window.innerHeight;
      const targetY = window.scrollY + vh * 0.5;   // dot rides viewport middle
      const hit = lookupByY(targetY);
      if (!hit) return;

      path.style.strokeDashoffset = Math.max(0, pathLen - hit.arc);
      // Position dot at the ACTUAL path point at hit.arc, not the linearly
      // interpolated (hit.x, hit.y). Linear interp between samples can drift
      // a few px off the real bezier — visible as the line "unsticking" from
      // the dot during lateral sweeps. getPointAtLength gives us the exact
      // point where strokeDashoffset ends, so dot and line align pixel-perfect.
      const endPt = path.getPointAtLength(hit.arc);
      const s = svgPointToScreen(endPt);
      headDot.style.transform = `translate3d(${s.x}px, ${s.y}px, 0) translate(-50%, -50%)`;

      if (DEBUG()) {
        const now = performance.now();
        if (now - __lastLog > 300) {
          __lastLog = now;
          const r = wrap.getBoundingClientRect();
          console.log('[LT update]', {
            p: +self.progress.toFixed(3),
            scrollY: window.scrollY,
            targetY: Math.round(targetY),
            hitY: Math.round(hit.y),
            endPtY: Math.round(endPt.y),          // real bezier y at hit.arc
            endPtX: +endPt.x.toFixed(1),
            hitArc: Math.round(hit.arc),
            pathLen: Math.round(pathLen),
            screenX: Math.round(s.x),
            screenY: Math.round(s.y),
            vh,
          });
        }
      }
    },
  });

  // Head dot visibility — visible once the user starts scrolling (past scene-01
  // intro beat), fades out as scene-11 pinned phase takes over.
  ScrollTrigger.create({
    trigger: '#scene-02',
    start: 'top 80%',
    onEnter:     () => headDot.classList.add('is-visible'),
    onLeaveBack: () => headDot.classList.remove('is-visible'),
  });
  ScrollTrigger.create({
    trigger: '#scene-11',
    start: 'top top',          // fade exactly when scene-11 pins — 3-arc takes over then
    onEnter:     () => headDot.classList.remove('is-visible'),
    onLeaveBack: () => headDot.classList.add('is-visible'),
  });

  // Ignite each node as its scene enters (Jaz node is hidden — no scene-10 waypoint lookup fails gracefully, handled in build())
  nodes.forEach((node) => {
    const target = document.querySelector(node.dataset.target);
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: 'top 60%',
      onEnter:     () => node.classList.add('lit'),
      onLeaveBack: () => node.classList.remove('lit'),
    });
  });
})();

/* ============================================================
   SCENE 01 — Seoul → Atlanta pinned map zoom
   Phase A (0.0–0.33): camera on Seoul, label + halo
   Phase B (0.33–0.66): viewBox zooms out, route draws
   Phase C (0.66–1.0):  camera pans/zooms to Atlanta;
                        photo bg + title/lede fade in
   ============================================================ */

(function sceneOne() {
  const s01 = document.getElementById('scene-01');
  if (!s01) return;

  const svg     = s01.querySelector('.map-01 svg');
  const route   = s01.querySelector('.map-01__route');
  const sLabel  = s01.querySelector('.map-01__city--seoul .map-01__label');
  const sSub    = s01.querySelector('.map-01__city--seoul .map-01__sub');
  const sHalo   = s01.querySelector('.map-01__city--seoul .map-01__halo');
  const aLabel  = s01.querySelector('.map-01__city--atl .map-01__label');
  const aSub    = s01.querySelector('.map-01__city--atl .map-01__sub');
  const aHalo   = s01.querySelector('.map-01__city--atl .map-01__halo');
  const bg      = s01.querySelector('.scene__bg');
  const title   = s01.querySelector('.display');
  const lede    = s01.querySelector('.lede');
  const mark    = s01.querySelector('.mark');
  const layout  = s01.querySelector('.scene__layout');

  // Initial states
  gsap.set(layout, { opacity: 1 });
  gsap.set([mark, title, lede], { opacity: 0, y: 32 });
  if (bg) gsap.set(bg, { opacity: 0 });

  // ViewBox waypoints: (x, y, w, h)
  const seoulView = '1150 300 400 240';   // tight on Seoul
  const fullView  = '100 100 1400 700';   // both cities in frame
  const atlView   = '60 320 500 300';     // tight on Atlanta

  gsap.set(svg, { attr: { viewBox: seoulView } });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: s01,
      start: 'top top',
      end: '+=180%',
      pin: true,
      scrub: 1,
      anticipatePin: 1,
    },
  });

  // Phase A — Seoul
  tl.to(sLabel, { opacity: 1, duration: 0.3 }, 0)
    .to(sSub,   { opacity: 1, duration: 0.3 }, 0.05)
    .to(sHalo,  { opacity: 0.7, attr: { r: 70 }, duration: 0.5 }, 0.1)
    .to(sHalo,  { opacity: 0,   attr: { r: 48 }, duration: 0.4 }, 0.6);

  // Phase B — zoom out, route draws
  tl.to(svg,   { attr: { viewBox: fullView }, duration: 1.2, ease: 'power2.inOut' }, 1.0);
  tl.to(route, { strokeDashoffset: 0, duration: 1.5, ease: 'power1.inOut' }, 1.2);

  // Phase C — zoom to Atlanta, photo + title arrive
  tl.to(svg,    { attr: { viewBox: atlView }, duration: 1, ease: 'power2.inOut' }, 2.4);
  tl.to(aLabel, { opacity: 1, duration: 0.3 }, 2.8);
  tl.to(aSub,   { opacity: 1, duration: 0.3 }, 2.85);
  tl.to(aHalo,  { opacity: 0.7, attr: { r: 70 }, duration: 0.5 }, 2.9);
  tl.to(aHalo,  { opacity: 0,   attr: { r: 48 }, duration: 0.4 }, 3.4);

  if (bg) tl.to(bg, { opacity: 0.8, duration: 0.9 }, 2.9);
  tl.add(() => s01.classList.add('is-map-fading'), 3.0);
  tl.add(() => s01.classList.remove('is-map-fading'), '<-=0.01'); // no-op balance; class applied by timeline direction via callback

  tl.to(mark,  { opacity: 1, y: 0, duration: 0.8, ease: easeEnter }, 3.0);
  tl.to(title, { opacity: 1, y: 0, duration: 0.9, ease: easeEnter }, 3.15);
  tl.to(lede,  { opacity: 1, y: 0, duration: 0.9, ease: easeEnter }, 3.35);

  // Toggle the fading class via ScrollTrigger so it tracks direction cleanly
  ScrollTrigger.create({
    trigger: s01,
    start: 'top -60%',
    end: 'bottom top',
    onEnter:     () => s01.classList.add('is-map-fading'),
    onLeaveBack: () => s01.classList.remove('is-map-fading'),
  });
})();

/* ============================================================
   SCENE 03 — Young Michael → Present Michael crossfade
   Pinned and scrubbed. Present layer opacity climbs with scroll.
   ============================================================ */

(function sceneThree() {
  const s03 = document.getElementById('scene-03');
  if (!s03) return;

  const mark    = s03.querySelector('.mark');
  const title   = s03.querySelector('.display');
  const caption = s03.querySelector('.reveal-caption');
  const present = s03.querySelector('.crossfade-layer--present');

  gsap.set([mark, title], { opacity: 0, y: 32 });
  gsap.set(caption, { opacity: 0, y: 16 });

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: s03,
      start: 'top top',
      end: '+=150%',
      pin: true,
      scrub: 1,
      anticipatePin: 1,
    },
  });

  tl.to(mark,  { opacity: 1, y: 0, duration: 0.5, ease: easeEnter }, 0)
    .to(title, { opacity: 1, y: 0, duration: 0.6, ease: easeEnter }, 0.15);

  // Hold on young Michael, then crossfade to present
  tl.to({}, { duration: 0.6 });
  if (present) tl.to(present, { opacity: 1, duration: 1, ease: 'power2.inOut' }, 1.2);
  tl.to(caption, { opacity: 1, y: 0, duration: 0.5, ease: easeEnter }, 1.4);
})();

/* ============================================================
   SCENE 07 — Year ticker with beat-drop emphasis
   Steps: 2020 → 2021 → 2022 → Nov 30 · 2022
   ============================================================ */

(function sceneSeven() {
  const ticker = document.querySelector('#scene-07 .ticker');
  if (!ticker) return;
  const years = (ticker.dataset.years || '').split(',').map((s) => s.trim());
  const value = ticker.querySelector('.ticker__value');
  if (!years.length || !value) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#scene-07',
      start: 'top 60%',
      end: 'bottom 40%',
      scrub: 1,
    },
  });

  years.forEach((y, i) => {
    const pos = i / Math.max(1, years.length - 1);
    tl.call(() => {
      if (value) value.textContent = y;
      // Light the beat on the final tick
      if (i === years.length - 1) ticker.classList.add('is-beat');
      else ticker.classList.remove('is-beat');
    }, null, pos);
  });
})();

/* ------------------------------------------------------------
   NeuralBlast — canvas-rendered node/edge graph for the finale.
   Seeds ~42 nodes across 3 radial shells with short-range edges.
   Scroll progress drives radial spread (nodes fan out from
   center); local time drives synaptic pulsing on nodes + edges.
   Must be declared before the scene 11 IIFE that instantiates it
   (class declarations are not hoisted like function declarations).
   ------------------------------------------------------------ */
class NeuralBlast {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.nodes  = [];
    this.edges  = [];
    this.progress = 0;
    this.time   = 0;
    this.lastT  = 0;

    this._resize = this._resize.bind(this);
    this._loop   = this._loop.bind(this);
    window.addEventListener('resize', this._resize);
    this._resize();
    this._seed();
    requestAnimationFrame(this._loop);
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr  = window.devicePixelRatio || 1;
    this.canvas.width  = Math.max(1, rect.width  * dpr);
    this.canvas.height = Math.max(1, rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w  = rect.width;
    this.h  = rect.height;
    this.cx = this.w / 2;
    this.cy = this.h / 2;
  }

  _seed() {
    // Store radii as a fraction of the viewport (0..1) so resize scales
    // the net automatically. Multiplied by rScale at draw time.
    const NUM = 260;
    const SHELLS = 7;
    const per = NUM / SHELLS;
    for (let i = 0; i < NUM; i++) {
      const shell   = Math.floor(i / per);             // 0..SHELLS-1
      const shellT  = shell / (SHELLS - 1);            // 0..1 across shells
      const angle   = (i / NUM) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
      // baseR fraction: inner shell ~0.08, outer shell ~1.05, with jitter.
      const baseR   = 0.08 + shellT * 0.95 + Math.random() * 0.1;
      const isAI    = Math.random() < 0.22;            // ~22% blue accents
      this.nodes.push({
        angle,
        baseR,                                         // fraction of rScale
        color: isAI ? 'ai' : 'amber',
        firePhase: Math.random() * Math.PI * 2,
        fireSpeed: 1.8 + Math.random() * 1.8,
      });
    }
    // Connect each node to its 5–8 nearest neighbours — a proper mesh.
    for (let i = 0; i < this.nodes.length; i++) {
      const candidates = [];
      for (let j = 0; j < this.nodes.length; j++) {
        if (i === j) continue;
        const a = this.nodes[i], b = this.nodes[j];
        let da = Math.abs(a.angle - b.angle);
        if (da > Math.PI) da = Math.PI * 2 - da;
        const dr = Math.abs(a.baseR - b.baseR);
        const dist = da * 1.0 + dr * 0.9;              // weighted
        candidates.push({ j, dist });
      }
      candidates.sort((a, b) => a.dist - b.dist);
      const count = 5 + Math.floor(Math.random() * 4); // 5..8
      for (let k = 0; k < count; k++) {
        const j = candidates[k].j;
        if (j > i) {
          this.edges.push({ a: i, b: j, phase: Math.random() * Math.PI * 2 });
        }
      }
    }
    // Plus a sprinkle of long-range "backbone" edges that cross the graph.
    // Picks ~10% of nodes at random and wires them to something roughly
    // opposite — gives the net big visible spanning signal paths.
    const backboneCount = Math.floor(NUM * 0.12);
    for (let k = 0; k < backboneCount; k++) {
      const i = Math.floor(Math.random() * NUM);
      const jCandidate = (i + NUM / 2 + Math.floor((Math.random() - 0.5) * NUM * 0.35)) % NUM;
      const j = Math.max(0, Math.min(NUM - 1, Math.floor(jCandidate)));
      if (i !== j) {
        const lo = Math.min(i, j), hi = Math.max(i, j);
        this.edges.push({ a: lo, b: hi, phase: Math.random() * Math.PI * 2 });
      }
    }
  }

  setProgress(p) { this.progress = p; }

  _loop(t) {
    if (!this.lastT) this.lastT = t;
    this.time += (t - this.lastT) / 1000;
    this.lastT = t;
    this._draw();
    requestAnimationFrame(this._loop);
  }

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    // Blast is active between scroll progress ~0.55 and ~0.80 of the pinned
    // section (timeline 2.2–3.2 on a ~3.6 total). Map to local 0→1.
    const bp = Math.max(0, Math.min(1, (this.progress - 0.55) / 0.25));
    if (bp <= 0) return;

    const spread = 1 - Math.pow(1 - bp, 3);            // easeOutCubic

    // Scale outer shell to roughly reach the corners — feels like the net
    // fills (and overflows) the viewport. Using max(w,h) * 0.62 so the
    // farthest nodes extend slightly beyond the short edge, giving the
    // graph an "explodes past the frame" sensation.
    const rScale = Math.max(this.w, this.h) * 0.62;

    // Pre-compute node positions so edges can reference them.
    const pos = this.nodes.map(n => {
      const r = n.baseR * rScale * spread;
      return {
        x: this.cx + Math.cos(n.angle) * r,
        y: this.cy + Math.sin(n.angle) * r,
      };
    });

    // Edges — thin pulsing lines between connected nodes.
    ctx.lineWidth = 1.25;
    for (const e of this.edges) {
      const a = pos[e.a], b = pos[e.b];
      const pulse = 0.25 + 0.25 * Math.sin(this.time * 2.2 + e.phase);
      ctx.strokeStyle = `oklch(0.78 0.09 75 / ${(pulse * spread).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    // Nodes — pulsing dots, with AI-blue accents scattered in.
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i], p = pos[i];
      const pulse = 0.55 + 0.45 * Math.sin(this.time * n.fireSpeed + n.firePhase);
      const r = (2.8 + pulse * 3.2) * (0.6 + 0.4 * spread);
      const alpha = (0.55 + 0.45 * pulse) * (0.5 + 0.5 * spread);
      const color = n.color === 'ai'
        ? `oklch(0.78 0.14 240 / ${alpha.toFixed(3)})`
        : `oklch(0.86 0.15 75 / ${alpha.toFixed(3)})`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/* ============================================================
   SCENE 11 — 3-thread split → converge → neural blast → map
   The pinned finale. Life thread hands off to 3 obsession arcs
   (soccer / edit / AI) that split from top-center, curve out to
   their apex, then converge into a single knot. The knot detonates
   into a neural net (canvas), which collapses into a world map
   tracing Seoul → ATL → LA → NY → SD.
   ============================================================ */

(function sceneEleven() {
  const scene11 = document.getElementById('scene-11');
  if (!scene11) return;

  const threads   = scene11.querySelectorAll('.thread');
  const labels    = scene11.querySelectorAll('.thread-label');
  const knot      = scene11.querySelector('.knot');
  const canvas    = scene11.querySelector('.neural-blast');
  const mapLayer  = scene11.querySelector('.map-layer');
  const mapRoute  = scene11.querySelector('.map-route');
  const mapCities = scene11.querySelectorAll('.map-city');

  // Seed each thread's dasharray to its own path length so the draw
  // progresses cleanly from start→apex→knot as dashoffset decreases.
  threads.forEach(path => {
    const len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.strokeDashoffset = len;
  });

  // Map route dashed length (for the dotted path to draw in sequence).
  if (mapRoute) {
    const len = mapRoute.getTotalLength();
    mapRoute.style.strokeDasharray = `${len}`;
    mapRoute.style.strokeDashoffset = len;
  }

  // Boot the neural blast; it'll read progress from ScrollTrigger.
  const blast = new NeuralBlast(canvas);

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: scene11,
      start: 'top top',
      end: '+=400%',
      scrub: 1,
      pin: true,
      anticipatePin: 1,
      onUpdate: (self) => blast.setProgress(self.progress),
    },
  });

  // ---- Phase A (0.0–1.8): split + draw ----
  // Threads draw fully from top-center out to apex and back to the knot.
  tl.to(threads, {
    strokeDashoffset: 0,
    duration: 1.8,
    ease: 'power2.inOut',
    stagger: 0.12,
  }, 0);
  // Labels flash at apex (mid-draw).
  tl.to(labels, { opacity: 1, duration: 0.35, stagger: 0.08 }, 0.75)
    .to(labels, { opacity: 0, duration: 0.35 }, 1.75);

  // ---- Phase B (1.8–2.2): knot lights up ----
  tl.to(knot, { scale: 1, duration: 0.35, ease: easeEnter }, 1.85);

  // ---- Phase C (2.2–3.2): neural blast ----
  // Threads dim so the blast dominates; knot fades into the blast.
  tl.to(canvas,  { opacity: 1, duration: 0.4 }, 2.15);
  tl.to(threads, { opacity: 0.12, duration: 0.5 }, 2.2);
  tl.to(knot,    { opacity: 0, duration: 0.4 }, 2.35);

  // ---- Phase D (3.2–4.0): map reveal ----
  tl.to(canvas,   { opacity: 0, duration: 0.5 }, 3.1);
  tl.to(mapLayer, { opacity: 1, duration: 0.4 }, 3.2);
  tl.to(mapRoute, { strokeDashoffset: 0, duration: 1.0, ease: 'power1.inOut' }, 3.3);
  tl.to(mapCities, { opacity: 1, duration: 0.25, stagger: 0.12 }, 3.35);
})();

/* ============================================================
   Next-pass TODOs:
   - Scene 04 / 08: video autoplay muted/loop on scroll-in
   - Scene 05: hand-written joke reveal with slight rotation jitter
   - Text-masked video moment on scene 10 (Jaz)
   ============================================================ */
