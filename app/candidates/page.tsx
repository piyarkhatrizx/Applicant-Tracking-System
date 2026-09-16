import { redirect } from "next/navigation";

/**
 * There is no candidate list in the UI. /candidates/[id] stays: it is the
 * person's record and holds the activity timeline. Old links land on Applicants.
 */
export default function CandidatesRedirect() {
  redirect("/applicants");
}
