import { Tone, type ToneColor } from "@/components/ui/tone";
import { Avatar } from "@/components/ui/avatar";
import { RefChip } from "@/components/ui/ref-chip";
import { Kbd } from "@/components/ui/kbd";
import { Button } from "@/components/ui/button";

const tones: ToneColor[] = ["yellow", "red", "green", "blue", "purple", "orange", "pink", "grey"];

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") {
    return <div className="p-12 text-ink-3">Styleguide is dev-only.</div>;
  }
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-8 py-10">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">
          Design system
        </p>
        <h1 className="font-serif text-4xl font-medium tracking-tight">NoteTrack styleguide</h1>
      </header>

      <Section title="Type">
        <h1 className="font-serif text-[36px] font-medium leading-[1.1] tracking-tight">
          Display — Source Serif 4
        </h1>
        <h2 className="font-serif text-[28px] font-medium tracking-tight">H1 — Source Serif 4</h2>
        <h3 className="text-[15px] font-semibold">H3 — Inter semibold</h3>
        <p className="text-[13px] text-ink-2">Body — Inter 13px / 1.55.</p>
        <p className="font-mono text-[11.5px]">Mono — JetBrains Mono</p>
      </Section>

      <Section title="Tone chips">
        <div className="flex flex-wrap gap-2">
          {tones.map((c) => (
            <Tone key={c} color={c}>
              {c}
            </Tone>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tones.map((c) => (
            <Tone key={c} color={c} square>
              {c}
            </Tone>
          ))}
        </div>
      </Section>

      <Section title="Avatars">
        <div className="flex flex-wrap items-center gap-2">
          {tones.map((c) => (
            <Avatar key={c} initials="JT" color={c} title={c} />
          ))}
          <Avatar initials="SK" color="purple" size="sm" />
          <Avatar initials="SK" color="purple" size="lg" />
          <Avatar initials="SK" color="purple" size="xl" />
        </div>
      </Section>

      <Section title="Refs &amp; keys">
        <div className="flex flex-wrap items-center gap-2">
          <RefChip refId="SAG-mill" />
          <RefChip refId="CV-203" />
          <RefChip refId="PMP-101" />
          <Kbd>⌘K</Kbd>
          <Kbd>↵</Kbd>
          <Kbd>⌘↵</Kbd>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          <Button>Default</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="sm">Small</Button>
          <Button size="lg" variant="primary">
            Large primary
          </Button>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3">{title}</h2>
      {children}
    </section>
  );
}
