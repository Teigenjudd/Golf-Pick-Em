// Ordinal: 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", 11 → "11th", etc.
export function ordinal(n) {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

// Whole-dollar money, with thousands separators: 1200 → "$1,200"
export function formatMoney(n) {
  return `$${Math.round(n).toLocaleString()}`
}
