/** Contact normalization shared by dedupe, intake and calling. */

export function normalizeEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

/** The last ten digits, or null when there are too few to dial. */
export function normalizePhone(phone: string | null | undefined) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits.length >= 10 ? digits.slice(-10) : null;
}
