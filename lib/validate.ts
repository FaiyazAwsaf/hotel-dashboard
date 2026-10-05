/** Loose checks for typed contact details and numbers — enough to catch a slip. */

const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯"

/** Bengali digits as Western ones, so `০১৭১১` reads as `01711`. */
export function westernDigits(value: string) {
  return value.replace(/[০-৯]/g, (digit) =>
    String(BENGALI_DIGITS.indexOf(digit))
  )
}

/** Digits with the usual separators and an optional leading +, 7+ digits. */
export function isPhone(value: string) {
  const digits = westernDigits(value)
  return /^[+\d\s()-]+$/.test(digits) && digits.replace(/\D/g, "").length >= 7
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * A typed number, in Western or Bengali digits, with grouping commas and
 * spaces allowed (`১২,৫০০` is 12500). Null when it isn't a plain number.
 */
export function parseNumber(value: string) {
  const ascii = westernDigits(value).replace(/[,\s]/g, "")
  return /^\d+(\.\d+)?$/.test(ascii) ? Number(ascii) : null
}

/**
 * Whether two phone numbers are the same line, compared by digits. A local
 * number matches its international form: `01711…` and `+8801711…`.
 */
export function samePhone(a: string, b: string) {
  const digits = (value: string) =>
    westernDigits(value).replace(/\D/g, "").replace(/^0+/, "")
  const left = digits(a)
  const right = digits(b)
  return (
    left.length >= 7 &&
    right.length >= 7 &&
    (left.endsWith(right) || right.endsWith(left))
  )
}
