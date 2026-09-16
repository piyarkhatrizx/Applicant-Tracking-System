import { PageHeader } from "@/components/ui/page-header";
import { getStatuses } from "@/lib/application-status";
import { listApplications } from "@/lib/data";
import { StatusesEditor } from "./statuses-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Statuses | Korosha",
  description: "Create, rename, recolor and reorder application statuses.",
};

export default function StatusesSettingsPage() {
  const inUse = new Map<number, number>();
  for (const application of listApplications()) {
    inUse.set(application.statusId, (inUse.get(application.statusId) ?? 0) + 1);
  }

  return (
    <main className="min-h-screen">
      <div className="k-shell">
        <PageHeader
          title="Statuses"
          subtitle="Analytics reads counts as, never the name — so renaming a status changes a label and nothing else."
        />
        <div>
          <StatusesEditor
            initial={getStatuses().map((status) => ({
              ...status,
              applicationCount: inUse.get(status.id) ?? 0,
            }))}
          />
        </div>
      </div>
    </main>
  );
}
