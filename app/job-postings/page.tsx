import { redirect } from "next/navigation";

/** Job Postings became the Applicants view. Old links keep their job filter. */
export default async function JobPostingsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ job?: string | string[] }>;
}) {
  const { job } = await searchParams;
  const value = Array.isArray(job) ? job[0] : job;
  redirect(value ? `/applicants?job=${encodeURIComponent(value)}` : "/applicants");
}
