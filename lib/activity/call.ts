import { normalizePhone } from "@/lib/normalize";

/**
 * Whether the Call button is disabled, as a pure function so it can be tested
 * without a DOM. A candidate with an unusable number is the same as one with no
 * number: there is nothing to dial.
 */
export function isCallDisabled(phone: string | null | undefined) {
  return normalizePhone(phone) === null;
}

/** Digits for `tel:`, formatted for the label. Never mix the two. */
export function formatPhoneLabel(digits: string) {
  return digits.length === 10
    ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : digits;
}
