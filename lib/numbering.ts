/**
 * The next code in a series like `WO-3205`, `PO-2026-469` or `SR1710`: the
 * highest number found after `prefix`, plus `step`. Generated series count
 * in steps (work orders by 5, purchase orders by 3), and new records follow.
 */
export function nextSerial(
  codes: Iterable<string>,
  prefix: string,
  { step = 1, start = 1 }: { step?: number; start?: number } = {}
) {
  let highest = start - step
  for (const code of codes) {
    if (!code.startsWith(prefix)) continue
    const number = Number(code.slice(prefix.length))
    if (Number.isInteger(number) && number > highest) highest = number
  }
  return `${prefix}${highest + step}`
}
