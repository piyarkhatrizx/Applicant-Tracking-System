import { notFound } from "next/navigation";
import DesignSystemDemo from "./design-system-demo";

export const metadata = {
  title: "Design system | Korosha",
  description: "Korosha component and token reference.",
};

/** An internal reference: reachable while developing, a 404 in production, and never in the nav. */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignSystemDemo />;
}
