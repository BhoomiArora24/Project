import { Braces, Atom, Server, FileCode2, Terminal, Database } from 'lucide-react'

const PATHS = [
  { name: 'JavaScript', Icon: Braces, desc: 'Core language, DOM and async patterns.' },
  { name: 'React', Icon: Atom, desc: 'Components, state and real interfaces.' },
  { name: 'Node.js', Icon: Server, desc: 'APIs, servers and tooling.' },
  { name: 'TypeScript', Icon: FileCode2, desc: 'Types that scale with your code.' },
  { name: 'Python', Icon: Terminal, desc: 'Scripting, data and automation.' },
  { name: 'SQL', Icon: Database, desc: 'Query, join and model data.' },
]

// Real, focusable links (not textures). Overlay mode sits on top of the 3D world and is revealed by the scroll timeline;
// static mode (reduced motion) is a normal section. Desktop: three cards each side, centre left open for the core.
function Card({ name, Icon, desc }) {
  return (
    <a href="#challenges" className="path-card group flex items-start gap-3 rounded-2xl border border-line bg-surface/60 p-3 text-left backdrop-blur-md transition-colors hover:border-lavender/60 focus-visible:border-lavender md:p-4">
      <Icon size={20} className="mt-0.5 shrink-0 text-lavender" aria-hidden="true" />
      <span>
        <span className="block font-display text-[15px] font-semibold text-ink">{name}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted md:text-[13px]">{desc}</span>
      </span>
    </a>
  )
}

export default function PathSection({ overlay = false }) {
  return (
    <section id={overlay ? undefined : 'paths'} aria-labelledby="paths-title"
      className={overlay
        ? 'paths invisible pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-5 pb-6 pt-20 md:px-12'
        : 'relative bg-void px-5 py-24 md:px-12'}>
      <div className="mx-auto w-full max-w-6xl text-center">
        <h2 id="paths-title" className="font-display text-3xl font-bold tracking-tight text-ink md:text-5xl">
          Choose <span className="text-lavender">Your Path</span>
        </h2>
        <p className="mt-3 text-sm text-muted md:text-base">Pick a track. Every level builds on the last.</p>
        <div className="pointer-events-auto mt-6 grid grid-cols-2 gap-3 lg:mt-10 lg:grid-cols-[1fr_minmax(16rem,26rem)_1fr] lg:gap-6">
          <div className="contents lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:gap-4">{PATHS.slice(0, 3).map((p) => <Card key={p.name} {...p} />)}</div>
          <div className="contents lg:col-start-3 lg:row-start-1 lg:flex lg:flex-col lg:gap-4">{PATHS.slice(3).map((p) => <Card key={p.name} {...p} />)}</div>
        </div>
      </div>
    </section>
  )
}
