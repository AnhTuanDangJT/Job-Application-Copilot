export default function JobsLoading() {
  return (
    <section className="space-y-6">
      <div>
        <div className="h-9 w-64 animate-pulse rounded bg-gray-200"></div>
        <div className="mt-2 h-5 w-96 animate-pulse rounded bg-gray-200"></div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 h-10 animate-pulse rounded-lg bg-gray-200"></div>
        <div className="w-24 h-10 animate-pulse rounded-lg bg-gray-200"></div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-white p-6">
            <div className="h-7 w-48 animate-pulse rounded bg-gray-200"></div>
            <div className="mt-2 h-6 w-32 animate-pulse rounded bg-gray-200"></div>
            <div className="mt-3 h-4 w-full animate-pulse rounded bg-gray-200"></div>
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-gray-200"></div>
          </div>
        ))}
      </div>
    </section>
  );
}





