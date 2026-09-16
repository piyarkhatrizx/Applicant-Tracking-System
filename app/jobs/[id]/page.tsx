import { redirect } from "next/navigation";

/**
 * /jobs/[id] is Applicants filtered to one job posting.
 * Redirecting rather than deleting keeps existing links and bookmarks working.
 */
export default async function JobRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/applicants?job=${encodeURIComponent(id)}`);
}
