export function SectionStub({ title, prompt }: { title: string; prompt: string }) {
  return (
    <div>
      <h1 className="font-serif text-[28px] font-medium tracking-tight">{title}</h1>
      <p className="mt-2 text-ink-3">
        Built in <b className="font-mono text-ink-2">{prompt}</b> of the build plan.
      </p>
      <div className="mt-6 rounded-4 border border-dashed border-line bg-surface p-8 text-center text-ink-3">
        <p className="text-[14px]">Placeholder.</p>
      </div>
    </div>
  );
}
