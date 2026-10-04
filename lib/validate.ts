/** Loose checks for typed contact details — enough to catch a slip. */

/** Digits with the usual separators and an optional leading +, 7+ digits. */
export function isPhone(value: string) {
  return /^[+\d\s()-]+$/.test(value) && value.replace(/\D/g, "").length >= 7
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
