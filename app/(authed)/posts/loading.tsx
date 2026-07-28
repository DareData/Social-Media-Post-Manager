export default function PostsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl animate-pulse flex-col gap-6">
      <div className="h-4 w-24 rounded bg-muted" />
      <div className="h-6 w-32 rounded bg-muted" />
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="h-32 w-full rounded bg-muted" />
      <div className="h-20 w-full rounded bg-muted" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-8 w-full rounded bg-muted" />
        <div className="h-8 w-full rounded bg-muted" />
      </div>
    </div>
  );
}
