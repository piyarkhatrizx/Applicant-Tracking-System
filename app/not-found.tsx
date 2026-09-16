import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = {
  title: "Not found | Korosha",
};

/**
 * Every dead end needs a way back, and nothing more. Same shell, header and gap
 * as every other page, under the normal nav. The way back is Analytics, which
 * is where the home route lands.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen">
      <div className="k-shell">
        <PageHeader
          title="Page not found"
          subtitle="The link may be out of date, or the record it pointed to was removed."
        />
        <Button variant="secondary" asChild>
          <Link href="/analytics">Back to Analytics</Link>
        </Button>
      </div>
    </main>
  );
}
