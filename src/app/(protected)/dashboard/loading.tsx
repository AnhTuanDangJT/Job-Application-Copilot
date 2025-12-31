export default function DashboardLoading() {
  return (
    <section className="space-y-6">
      <div>
        <div className="h-9 w-64 animate-pulse rounded bg-gray-200"></div>
        <div className="mt-2 h-5 w-96 animate-pulse rounded bg-gray-200"></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-white p-6">
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200"></div>
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-300"></div>
          </div>
        ))}
      </div>
    </section>
  );
}





