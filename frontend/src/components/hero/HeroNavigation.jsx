const links = [
  { label: 'Explore', href: '#challenges' },
  { label: 'About', href: '#about' },
  { label: 'Sign in', href: '#learn' }, // temporary destination until auth exists
]

function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2.5" aria-label="DevQuest home">
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="8" stroke="#A78BFA" strokeOpacity=".5" />
        <path d="M9 11l6 5-6 5" stroke="#A78BFA" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17.5 21h6" stroke="#22D3EE" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span className="font-display text-[15px] font-bold tracking-[0.18em]">DEVQUEST</span>
    </a>
  )
}

export default function HeroNavigation() {
  return (
    <nav className="nav absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 py-5 md:px-12" aria-label="Primary">
      <Logo />
      <ul className="flex items-center gap-6 md:gap-10">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className="group relative py-1 text-sm text-muted transition-colors hover:text-ink">
              {l.label}
              <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-lavender transition-transform duration-300 group-hover:scale-x-100 group-focus-visible:scale-x-100" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
