import ApplicationsClient from "./ApplicationsClient";

export default function ApplicationsPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1F2937]">Application History</h1>
        <p className="mt-2 text-[#6B7280]">
          Track all your job applications and their current status.
        </p>
      </div>

      <ApplicationsClient />
    </section>
  );
}
