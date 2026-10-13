import { ArrowUpRight, ArrowDown } from 'lucide-react'

export default function HeroActions() {
  return (
    <div className="cta flex flex-col gap-3 sm:flex-row sm:items-center">
      <a href="#paths"
        className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-violet px-7 py-3 text-[15px] font-semibold text-white shadow-[0_8px_30px_-8px_rgba(124,58,237,.7)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#8b4cf5]">
        Start Your Journey
        <ArrowUpRight size={18} className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-1" />
      </a>
      <a href="#challenges"
        className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line px-7 py-3 text-[15px] font-medium text-ink transition-colors duration-300 hover:border-lavender hover:text-lavender">
        Explore Challenges
        <ArrowDown size={18} className="transition-transform duration-300 group-hover:translate-y-1" />
      </a>
    </div>
  )
}
