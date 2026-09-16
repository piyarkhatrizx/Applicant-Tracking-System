import { NextResponse } from "next/server";
import { resolveApplyJob } from "@/lib/apply-job";
import { getDefaultStatus } from "@/lib/application-status";
import { caregiverApplicationSchema } from "@/lib/caregiver-application";
import { intakeApplication } from "@/lib/intake";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = caregiverApplicationSchema.parse(body);

    const target = resolveApplyJob(input.job);
    if (!target.ok) {
      return NextResponse.json({ error: target.error }, { status: target.status });
    }

    // New leads start in the first open stage, resolved from the table rather
    // than a hardcoded name.
    const defaultStatus = getDefaultStatus();
    if (!defaultStatus) {
      console.error("No active open status configured; cannot accept applications");
      return NextResponse.json({ error: "Unable to submit application" }, { status: 500 });
    }

    const result = intakeApplication({
      jobId: target.job.id,
      statusId: defaultStatus.id,
      source: "APPLY_FORM",
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      screening: {
        isAtLeast18: input.isAtLeast18,
        isCpaCertified: input.isCpaCertified,
        patientUsesMedicare: input.patientUsesMedicare,
        caregivingInterest: input.caregivingInterest,
      },
    });

    return NextResponse.json({ accepted: true, id: result.applicationId }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json({ error: "Please review the form fields" }, { status: 400 });
    }

    console.error("Caregiver application submission failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to submit application" }, { status: 500 });
  }
}
