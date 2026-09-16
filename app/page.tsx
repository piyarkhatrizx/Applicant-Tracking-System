import { redirect } from "next/navigation";

/** Analytics is the landing page. There is no sign-in, so this runs on app load. */
export default function Home() {
  redirect("/analytics");
}
