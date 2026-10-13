import { lazy, Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import HeroNavigation from './HeroNavigation.jsx'
import HeroActions from './HeroActions.jsx'
import PathSection from './PathSection.jsx'

gsap.registerPlugin(ScrollTrigger)
const HeroScene = lazy(() => import('./HeroScene.jsx')) // keep three.js out of the critical path

const LINES = [
  { text: "DON'T JUST", cls: 'text-ink' },
  { text: 'LEARN TO CODE.', cls: 'text-lavender' },
  { text: 'BECOME THE', cls: 'text-ink' },
  { text: 'DEVELOPER.', cls: 'text-lavender' },
]

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

export default function Hero() {
  const root = useRef(null)
  const intro = useRef({ v: 0, s: 0 }) // v: entrance 0→1, s: scroll progress 0→1; both read by the scene in useFrame
  const webgl = useMemo(hasWebGL, [])
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const gx0 = useMemo(() => (window.innerWidth >= 1024 ? '73%' : '50%'), [])

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (reduced) { intro.current.v = 1; return } // reduced motion: static hero, no camera travel, paths as a normal section
      intro.current.v = 0; intro.current.s = 0

      gsap.timeline({ defaults: { ease: 'power3.out' } })
        .from('.glow', { opacity: 0, duration: 0.9 }, 0)
        .from('.nav', { y: -14, opacity: 0, duration: 0.6 }, 0.1)
        .from('.eyebrow', { y: 12, opacity: 0, duration: 0.6 }, 0.3)
        .from('.h-line', { yPercent: 110, duration: 0.9, stagger: 0.12, ease: 'power4.out' }, 0.35)
        .to(intro.current, { v: 1, duration: 1.8 }, 0.5)
        .from('.sub, .cta', { y: 16, opacity: 0, duration: 0.7, stagger: 0.12 }, 1.0)
        .from('.scroll-ind', { opacity: 0, duration: 0.6 }, 1.6)

      // Master scroll timeline (length 1 = whole pinned stage), scrubbed so it reverses naturally.
      // The 3D camera/rings read intro.s; DOM beats are placed on the same 0–1 axis.
      gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom bottom', scrub: 0.8 } })
        .to(intro.current, { s: 1, duration: 1 }, 0)
        .to('.hero-copy', { y: -70, autoAlpha: 0, ease: 'power2.in', duration: 0.2 }, 0.06)
        .to('.scrim', { autoAlpha: 0, duration: 0.25 }, 0.1)
        .to('.scroll-ind', { autoAlpha: 0, duration: 0.06 }, 0)
        .to('.glow', { '--gx': '50%', duration: 0.5 }, 0)
        .fromTo('.paths', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1 }, 0.6)
        .fromTo('.path-card', { y: 48, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.03, duration: 0.14, ease: 'power2.out' }, 0.62)
    }, root)
    return () => ctx.revert() // kills both timelines and the ScrollTrigger (Strict Mode safe)
  }, [reduced])

  return (
    <div ref={root}>
      <section id="top" className={`relative ${reduced ? '' : 'h-[420svh]'}`}>
        {!reduced && <span id="paths" aria-hidden="true" className="absolute left-0 top-[270svh]" />}
        <div className={`${reduced ? 'min-h-svh' : 'sticky top-0 h-svh'} isolate overflow-hidden bg-void`}>
          <div className="glow pointer-events-none absolute inset-0 -z-10"
            style={{ '--gx': gx0, background:
              'radial-gradient(circle at var(--gx) 48%, rgba(167,139,250,.12), transparent 17%),' +
              'radial-gradient(ellipse 52% 60% at var(--gx) 48%, rgba(124,58,237,.26), transparent 70%),' +
              'radial-gradient(ellipse 30% 30% at calc(var(--gx) + 6%) 72%, rgba(34,211,238,.06), transparent 70%),' +
              'radial-gradient(ellipse 100% 90% at 50% 50%, transparent 55%, rgba(8,8,13,.9) 100%)' }} />

          {/* Full-viewport 3D world, click-through; all copy stays in HTML above it */}
          <div className="pointer-events-none absolute inset-0">
            {webgl ? (
              <Suspense fallback={null}><HeroScene intro={intro} reduced={reduced} /></Suspense>
            ) : (
              <div className="flex h-full items-center justify-center lg:justify-end lg:pr-[18%]" aria-hidden="true">
                <div className="relative h-40 w-40 lg:h-60 lg:w-60"><div className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle,#A78BFA,#7C3AED_55%,transparent_70%)] shadow-[0_0_80px_rgba(124,58,237,.5)]" /><div className="absolute inset-0 rotate-[60deg] scale-y-[.35] rounded-full border border-lavender/50" /><div className="absolute inset-[8%] -rotate-[30deg] scale-y-[.5] rounded-full border border-cyan/40" /></div>
              </div>
            )}
          </div>

          {/* Readability scrim: darkens behind the copy only, fades out with it */}
          <div className="scrim pointer-events-none absolute inset-0 z-[5] bg-[linear-gradient(0deg,rgba(8,8,13,.85),transparent_65%)] lg:bg-[linear-gradient(90deg,rgba(8,8,13,.82),rgba(8,8,13,.35)_45%,transparent_70%)]" />

          <HeroNavigation />

          <div className="hero-copy relative z-10 mx-auto flex min-h-svh max-w-[1440px] flex-col justify-center px-6 pb-24 pt-[calc(42svh+3.5rem)] md:px-12 lg:pt-20">
            <div className="max-w-[46rem]">
              <p className="eyebrow mb-5 text-xs font-medium tracking-[0.22em] text-lavender sm:text-[13px]">✦ YOUR NEXT LEVEL STARTS HERE</p>
              <h1 className="font-display text-[clamp(2.5rem,7.4vw,6.6rem)] font-bold leading-[0.94] tracking-[-0.04em]">
                {LINES.map((l) => (
                  <span key={l.text} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
                    <span className={`h-line block ${l.cls}`}>{l.text}</span>
                  </span>
                ))}
              </h1>
              <p className="sub mt-7 max-w-md text-base leading-relaxed text-muted sm:text-lg">
                Master JavaScript. Solve challenges. Build your skills. Every level brings you closer to mastery.
              </p>
              <div className="mt-9"><HeroActions /></div>
            </div>
          </div>

          {!reduced && <PathSection overlay />}

          <a href="#paths" aria-label="Scroll to learning paths"
            className="scroll-ind absolute bottom-6 left-6 z-10 hidden items-center gap-3 text-xs tracking-[0.2em] text-muted md:left-12 md:flex">
            <span className="relative h-10 w-px overflow-hidden bg-line"><span className="scrollcue absolute inset-0 bg-lavender" /></span>
            SCROLL
          </a>
        </div>
      </section>
      {reduced && <PathSection />}
    </div>
  )
}
