import { z } from "zod";

export const CAREGIVING_INTERESTS = ["GENERAL_CAREGIVER", "CURRENTLY_CARING_FOR_PATIENT"] as const;

export const caregiverApplicationSchema = z.object({
  isAtLeast18: z.boolean(),
  isCpaCertified: z.boolean().nullable(),
  patientUsesMedicare: z.boolean(),
  caregivingInterest: z.enum(CAREGIVING_INTERESTS),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(30),
  email: z.string().trim().email("Enter a valid email address").max(254),
  /** A job code or id. Omitted means the newest open requisition. */
  job: z.string().trim().max(40).optional(),
});

export type CaregiverApplicationInput = z.infer<typeof caregiverApplicationSchema>;