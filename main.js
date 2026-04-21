/* ============================================================
   david-choi-intro — scroll framework
   GSAP + ScrollTrigger + Lenis. No build step.
   ============================================================ */

gsap.registerPlugin(ScrollTrigger);

/* --- Custom easings tuned to match the design direction --- */
const easeEnter = 'expo.out';      // cubic-bezier(0.16, 1, 0.3, 1) feel
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
    el.style.opacity = el.classList.contains('scene__bg') ? '0.85' : '1';
  };
  img.src = url;
});

/* --- Default editorial fade for every scene --- */
document.querySelectorAll('.scene').forEach((scene) => {
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
   SCENE 07 — year ticker
   Steps through: 2020 → 2021 → 2022 → Nov 30 · 2022
   ============================================================ */
const ticker = document.querySelector('.ticker');
if (ticker) {
  const years = (ticker.dataset.years || '').split(',').map((s) => s.trim());
  const value = ticker.querySelector('.ticker__value');
  const tickerTl = gsap.timeline({
    scrollTrigger: {
      trigger: '#scene-07',
      start: 'top 60%',
      end: 'bottom 40%',
      scrub: 1,
    },
  });
  years.forEach((y, i) => {
    tickerTl.call(() => { if (value) value.textContent = y; }, null, i / (years.length - 1 || 1));
  });
}

/* ============================================================
   SCENE 11 — Thread convergence (pinned, 3-phase)
   Phase A: threads draw in + labels flash
   Phase B: convergence flash + fade (particle canvas TODO)
   Phase C: map reveal + zoom-through (TODO next pass)
   ============================================================ */
const scene11 = document.getElementById('scene-11');
if (scene11) {
  const threads = scene11.querySelectorAll('.thread');
  const labels  = scene11.querySelectorAll('.thread-label');

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: scene11,
      start: 'top top',
      end: '+=220%',
      scrub: 1,
      pin: true,
      anticipatePin: 1,
    },
  });

  /* A — threads draw in */
  tl.to(threads, { strokeDashoffset: 0, duration: 2, ease: 'power2.inOut', stagger: 0.15 }, 0);
  tl.to(labels,  { opacity: 1, duration: 0.4, stagger: 0.1 }, 0.3);
  tl.to(labels,  { opacity: 0, duration: 0.5 }, 1.6);

  /* B — convergence flash */
  tl.to(threads, { strokeWidth: 4, duration: 0.3, ease: easeEnter }, 2.1);
  tl.to(threads, { opacity: 0, duration: 0.5 }, 2.4);

  /* C — map + zoom-through (stubbed, wired next pass) */
  /* tl.to('.map-layer', { opacity: 1, duration: 1 }, 2.9); */
  /* TODO: animate SVG map lines Seoul → ATL → LA → Greenville → ATL → SD */
  /* TODO: camera zoom through central node into present-day photo */
}

/* ============================================================
   Next-pass TODOs:
   - Scene 01: Seoul→ATL map zoom (SVG path + scroll-scrubbed scale)
   - Scene 03: young→present Michael crossfade on hover/reveal
   - Scene 04: video autoplay muted/loop on scroll-in
   - Scene 05: hand-written joke reveal with slight rotation jitter
   - Scene 08: video autoplay on scroll-in
   - Scene 11: particle burst canvas (phase B) + map reveal (phase C)
   ============================================================ */
