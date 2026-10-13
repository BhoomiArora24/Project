import Hero from './components/hero/Hero.jsx'

// Temporary destinations so every hero link lands somewhere real.
// Replace with your router / real sections later.
const Section = ({ id, title, children }) => (
  <section id={id} className="scroll-mt-0 border-t border-line bg-void px-6 py-28 md:px-12">
    <div className="mx-auto max-w-5xl">
      <h2 className="font-display text-3xl font-bold tracking-tight md:text-5xl">{title}</h2>
      <p className="mt-4 max-w-xl text-muted">{children}</p>
    </div>
  </section>
)

export default function App() {
  return (
    <main>
      <Hero />
      <Section id="challenges" title="Challenges">The challenge library will live here.</Section>
      <Section id="about" title="About">What DevQuest is and why it exists.</Section>
      <Section id="learn" title="Your journey begins">Placeholder for the learning experience and sign-in.</Section>
    </main>
  )
}
