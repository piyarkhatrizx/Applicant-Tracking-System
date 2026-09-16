import { redirect } from "next/navigation";

/**
 * Current Status (the kanban board) was retired 2026-09-16: Applicants with
 * its Status filter replaced it. Old links, including any job-scoped
 * ?job= links, land there with the same filter carried over.
 */
export default async function BoardRedirect({
  searchParams,
}: {
  searchParams: Promise<{ job?: string | string[] }>;
}) {
  const raw = (await searchParams).job;
  const job = Array.isArray(raw) ? raw[0] : raw;
  redirect(job ? `/applicants?job=${encodeURIComponent(job)}` : "/applicants");
}
