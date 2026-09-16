import { redirect } from "next/navigation";

/** Old links to the applications list land on Applicants. */
export default function ApplicationsRedirect() {
  redirect("/applicants");
}
