import { NextResponse } from "next/server";
import { resolveApplyJob } from "@/lib/apply-job";
import { getDefaultStatus } from "@/lib/application-status";
import { insertFieldValue, listJobFields, RESERVED_FIELD_KEYS } from "@/lib/data";
import { intakeApplication } from "@/lib/intake";

const RESERVED = new Set<string>(RESERVED_FIELD_KEYS);

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const target = resolveApplyJob(slug);
    if (!target.ok) {
      return NextResponse.json({ error: target.error }, { status: target.status });
    }

    const fields = listJobFields(target.job.id);
    if (fields.length === 0) {
      return NextResponse.json({ error: "This job's apply page is not configured." }, { status: 409 });
    }

    const body = await request.json();
    const raw = body?.values;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Validate every configured field against its type before writing anything.
    const answers: Record<string, string> = {};
    for (const field of fields) {
      const value = typeof raw[field.key] === "string" ? raw[field.key].trim() : "";
      if (field.required && !value) {
        return NextResponse.json({ error: `${field.label} is required.` }, { status: 400 });
      }
      if (value && field.type === "YES_NO" && value !== "yes" && value !== "no") {
        return NextResponse.json({ error: `${field.label} must be answered yes or no.` }, { status: 400 });
      }
      if (value && field.type === "SELECT" && !field.options.includes(value)) {
        return NextResponse.json({ error: `${field.label} is not one of the offered options.` }, { status: 400 });
      }
      answers[field.key] = value;
    }

    const email = answers.email || null;
    const phone = answers.phone || null;
    if (!email && !phone) {
      return NextResponse.json({ error: "An email or phone number is required to apply." }, { status: 400 });
    }

    const defaultStatus = getDefaultStatus();
    if (!defaultStatus) {
      console.error("No active open status configured; cannot accept applications");
      return NextResponse.json({ error: "Unable to submit application" }, { status: 500 });
    }

    const result = intakeApplication({
      jobId: target.job.id,
      statusId: defaultStatus.id,
      source: "APPLY_FORM",
      firstName: answers.first_name || null,
      email,
      phone,
    });

    // Custom, non-reserved fields land as their own rows against this application.
    for (const field of fields) {
      if (RESERVED.has(field.key)) continue;
      const value = answers[field.key];
      if (value) insertFieldValue({ applicationId: result.applicationId, jobFieldId: field.id, value });
    }

    return NextResponse.json({ accepted: true, id: result.applicationId }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error("Apply submission failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to submit application" }, { status: 500 });
  }
}
