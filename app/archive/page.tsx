import { redirect } from "next/navigation";

/** Archive was renamed History. Old links and bookmarks still land there. */
export default function ArchiveRedirect() {
  redirect("/history");
}
