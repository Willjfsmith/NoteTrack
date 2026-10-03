export default function Loading() {
  return (
    <div className="space-y-2 pt-2">
      <div className="h-5 w-40 animate-pulse rounded-2 bg-bg-3" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-2 bg-bg-2" />
      ))}
    </div>
  );
}
