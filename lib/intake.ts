import { writeActivity } from "@/lib/activity/write";
import type { ApplicationSource } from "@/lib/application-source";
import {
  findCandidate,
  insertApplication,
  listApplications,
  listCandidates,
  patchApplication,
  patchCandidate,
  type Candidate,
  type PersonFields,
  type Screening,
} from "@/lib/data";
import { normalizeEmail, normalizePhone } from "@/lib/normalize";

export type IntakeInput = Partial<PersonFields> & {
  jobId: number;
  source: ApplicationSource;
  screening?: Screening | null;
  /** Status the application starts in. Resolved by the caller from the table. */
  statusId: number;
  /** Preserve an original submission time. Defaults to now. */
  appliedAt?: Date;
};

export type IntakeResult = {
  candidateId: number;
  applicationId: number;
  isNewCandidate: boolean;
  isNewApplication: boolean;
};

/** Drop null/undefined keys so a sparse intake never blanks richer existing data. */
function definedOnly<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== null && value !== undefined),
  ) as Partial<T>;
}

function personOf(candidate: Candidate): PersonFields {
  return {
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    email: candidate.email,
    phone: candidate.phone,
    location: candidate.location,
    currentTitle: candidate.currentTitle,
    currentEmployer: candidate.currentEmployer,
    linkedinUrl: candidate.linkedinUrl,
  };
}

/**
 * The only code path that creates an application, and therefore the only one
 * that creates a candidate. /apply calls it; scripts/seed.py follows the same
 * rules when it generates data.
 *
 * ponytail: store calls are synchronous, so two submissions inside one server
 * process cannot interleave and dedupe needs no lock. Two processes writing the
 * same files could still double-insert; a database unique index is the upgrade
 * path, which is what production used.
 */
export function intakeApplication(input: IntakeInput): IntakeResult {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!email && !phone) {
    throw new Error("Intake requires an email or a phone number to dedupe on");
  }

  const person: PersonFields = {
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    email,
    phone,
    location: input.location ?? null,
    currentTitle: input.currentTitle ?? null,
    currentEmployer: input.currentEmployer ?? null,
    linkedinUrl: input.linkedinUrl ?? null,
  };

  // Email first, then phone. Never name.
  const candidates = listCandidates();
  const existing =
    (email ? candidates.find((candidate) => normalizeEmail(candidate.email) === email) : undefined) ??
    (phone ? candidates.find((candidate) => normalizePhone(candidate.phone) === phone) : undefined);

  if (existing) patchCandidate(existing.id, definedOnly(person));

  const prior = existing
    ? listApplications().find((application) => application.candidateId === existing.id && application.jobId === input.jobId)
    : undefined;

  const appliedAt = input.appliedAt ?? new Date();
  let applicationId: number;
  if (prior) {
    // Never reset status, never overwrite source. Screening answers merge.
    applicationId = prior.id;
    if (input.screening) {
      patchApplication(prior.id, { screening: { ...prior.screening, ...input.screening } });
    }
  } else {
    applicationId = insertApplication({
      jobId: input.jobId,
      statusId: input.statusId,
      source: input.source,
      screening: input.screening ?? null,
      // A known person's new row carries their merged record, so every row in
      // the group agrees.
      person: existing ? personOf(findCandidate(existing.id)!) : person,
      appliedAt,
    });
  }

  // A system write: nobody chose this, so the actor is null.
  writeActivity({
    applicationId,
    type: prior ? "REAPPLIED" : "APPLICATION_CREATED",
    payload: { source: input.source },
    actor: null,
    createdAt: prior ? new Date() : appliedAt,
  });

  return {
    // A new person's candidate id is the id of their first application row.
    candidateId: existing?.id ?? applicationId,
    applicationId,
    isNewCandidate: !existing,
    isNewApplication: !prior,
  };
}
