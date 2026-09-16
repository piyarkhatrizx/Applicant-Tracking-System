import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHeader, TableLoadingRow } from "@/components/ui/table";

/** One root loading state covers every segment; nothing here needs a per-route copy. */
export default function Loading() {
  return (
    <main className="min-h-screen px-[var(--space-6)] py-[var(--space-8)] sm:px-[var(--space-10)] lg:px-[var(--space-12)]">
      <PageHeader title="Loading" />
      <div>
        <Table>
          <TableHeader>
            <tr>
              <TableCell header>Record</TableCell>
              <TableCell header>Status</TableCell>
            </tr>
          </TableHeader>
          <TableBody>
            <TableLoadingRow colSpan={2} label="Loading records" />
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
