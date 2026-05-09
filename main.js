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

/* --- Background images: load lazily, fade in only if the file exists.
   For .scene__bg in non-choreographed scenes, set up a ScrollTrigger to
   fade the bg in on scene enter — otherwise it stays at the CSS-default
   opacity:0 forever. Choreographed scenes (data-choreographed="true")
   handle their own bg reveals via custom timelines. --- */
document.querySelectorAll('[data-bg]').forEach((el) => {
  const url = el.dataset.bg;
  if (!url) return;
  const img = new Image();
  img.onload = () => {
    el.style.backgroundImage = `url('${encodeURI(url)}')`;
    if (!el.classList.contains('scene__bg')) return;
    const scene = el.closest('.scene');
    if (scene && scene.dataset.choreographed) return;
    const target = el.dataset.targetOpacity || '0.9';
    ScrollTrigger.create({
      trigger: scene,
      start: 'top 75%',
      onEnter:     () => { el.style.opacity = target; },
      onLeaveBack: () => { el.style.opacity = '0'; },
    });
  };
  img.src = url;
});

/* --- Background videos: hydrate .scene__bg with [data-bg-video] into a
   muted/looped <video>. Mirrors the [data-bg] image loader, including the
   scroll-triggered fade-in for non-choreographed scenes. --- */
document.querySelectorAll('[data-bg-video]').forEach((el) => {
  const url = el.dataset.bgVideo;
  if (!url) return;
  const v = document.createElement('video');
  v.src = encodeURI(url);
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.autoplay = true;
  v.preload = 'auto';
  v.addEventListener('loadeddata', () => v.play().catch(() => {}));
  el.appendChild(v);
  if (!el.classList.contains('scene__bg')) return;
  const scene = el.closest('.scene');
  if (scene && scene.dataset.choreographed) return;
  const target = el.dataset.targetOpacity || '0.9';
  ScrollTrigger.create({
    trigger: scene,
    start: 'top 75%',
    onEnter:     () => { el.style.opacity = target; },
    onLeaveBack: () => { el.style.opacity = '0'; },
  });
});

/* --- Videos: hydrate [data-video] divs with autoplay-muted-loop <video>.
   Only attempts play when the file actually loads — keeps placeholder
   text visible if the asset is missing. --- */
document.querySelectorAll('[data-video]').forEach((el) => {
  const url = el.dataset.video;
  if (!url) return;
  const v = document.createElement('video');
  v.src = encodeURI(url);
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.autoplay = true;
  v.preload = 'auto';
  v.addEventListener('loadedmetadata', () => {
    // Match frame aspect-ratio to the video's native dimensions so portrait
    // clips don't get center-cropped by the 16/9 placeholder frame.
    if (v.videoWidth && v.videoHeight) {
      el.style.aspectRatio = `${v.videoWidth} / ${v.videoHeight}`;
    }
  });
  v.addEventListener('loadeddata', () => {
    el.classList.add('has-video');
    v.play().catch(() => {}); // some browsers reject autoplay; ignore
  });
  el.appendChild(v);
});

/* --- Default editorial fade for scenes without custom choreography --- */
document.querySelectorAll('.scene:not([data-choreographed])').forEach((scene) => {
  const targets = scene.querySelectorAll(
    '.mark, .display, .lede, .aside, .editorial-list > div, .obsessions li, .closer, .video-frame, .reveal-caption, .beat-arrow'
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
  // not random. Thread terminates at scene-12 (the closer list).
  const LANES = {
    'scene-01': 82,
    'scene-02': 80,
    'scene-03': 15,
    'scene-04': 82,
    'scene-05': 48,
    'scene-06': 80,
    'scene-08': 88,
    'scene-09': 82,
    'scene-10': 82,
    'scene-12': 50,   // TERMINAL
  };

  let pathLen = 0;
  const waypoints = [];

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

    // Compute waypoints. Every scene with a LANES entry uses its MIDDLE.
    // Scene-12 is the terminal — line ends at its center.
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
    // NO line extension past last waypoint — path ends at scene-12 center.

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

  // Scroll scrub. Ends at scene-12 middle (the closer list — the terminal).
  //
  // IMPLEMENTATION NOTE: we DO NOT drive the dot by self.progress * pathLen.
  // The path's arc length is ~33% longer than the scroll range because lateral
  // bezier sweeps (scene-02 → scene-03 swings x 80→15, back 15→82) add arc
  // length with no scroll counterpart. Driving by progress makes the dot
  // outpace scroll, drifting past viewport bottom around the soccer beat.
  //
  // Instead, map directly from document-space Y (scrollY + vh/2, i.e. viewport
  // middle) to path (x, arc) via the sampled lookup. This decouples the dot's
  // speed from path arc length entirely — it always tracks viewport middle.
  ScrollTrigger.create({
    trigger: document.documentElement,
    start: 'top top',
    end: () => {
      const s12 = document.getElementById('scene-12');
      if (!s12) return 'max';
      const r = s12.getBoundingClientRect();
      return r.top + window.scrollY + s12.offsetHeight * 0.5;
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
  // intro beat). Stays visible all the way to the closer.
  ScrollTrigger.create({
    trigger: '#scene-02',
    start: 'top 80%',
    onEnter:     () => headDot.classList.add('is-visible'),
    onLeaveBack: () => headDot.classList.remove('is-visible'),
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
  const bg1     = s01.querySelector('.scene__bg--first');   // Dad-Baby (Seoul beat)
  const bg2     = s01.querySelector('.scene__bg--second');  // korea-family (transition)
  const title   = s01.querySelector('.display');
  const lede    = s01.querySelector('.lede');
  const mark    = s01.querySelector('.mark');
  const layout  = s01.querySelector('.scene__layout');

  // Initial states
  gsap.set(layout, { opacity: 1 });
  gsap.set([mark, title, lede], { opacity: 0, y: 32 });
  if (bg1) gsap.set(bg1, { opacity: 0 });
  if (bg2) gsap.set(bg2, { opacity: 0 });

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

  // Phase A: Dad-Baby fades in alongside Seoul map
  if (bg1) tl.to(bg1, { opacity: 0.85, duration: 0.8 }, 0.4);
  // Phase C: crossfade Dad-Baby → korea-family as the route arrives in Atlanta
  if (bg1) tl.to(bg1, { opacity: 0,    duration: 0.9 }, 2.9);
  if (bg2) tl.to(bg2, { opacity: 0.85, duration: 0.9 }, 2.9);
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
   Next-pass TODOs:
   - Scene 04 / 08: video autoplay muted/loop on scroll-in
   - Scene 05: hand-written joke reveal with slight rotation jitter
   - Text-masked video moment on scene 10 (Jaz)
   ============================================================ */
