// Estimated price (Milestone 13, plan D1, D2): Asaf's price list and the one rule that uses it.
// Shared by the order form (live estimate) and the server (the stored value), like meeting-time.js
// (ADR-4). Pure, no dependencies. To change a price, change it here only.

export const PRICES = Object.freeze({
  currency: 'USD',
  full: 300, // full escort (to the gate), one traveller included
  partial: 200, // partial escort (through security), one traveller included
  extra_traveller: 40, // each traveller after the first
  extra_bag: 5, // each checked bag beyond one per traveller
  porter: 30, // once per order
  wheelchair: 0, // free, any number
});

const ESCORT_LINES = { full: 'Full escort', partial: 'Partial escort' };

function wholeIn(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * The estimate for an order, with the lines that make it up.
 * @param {{ travelers: number, bags: number, services?: string[], wheelchairs?: number|null,
 *           escort_scope: string }} order
 * @returns {{ total: number, lines: { label: string, amount: number }[] } | null}
 *   null when the escort is not chosen or the counts are not whole numbers in range.
 */
export function estimatePrice({ travelers, bags, services = [], wheelchairs = null, escort_scope: scope }) {
  if (!Object.hasOwn(ESCORT_LINES, scope || '')) return null;
  if (!wholeIn(travelers, 1, 10) || !wholeIn(bags, 0, 10)) return null;
  const chosen = Array.isArray(services) ? services : [];

  const lines = [{ label: ESCORT_LINES[scope], amount: PRICES[scope] }];
  const extraTravellers = travelers - 1;
  if (extraTravellers > 0) {
    lines.push({ label: `${extraTravellers} more ${extraTravellers === 1 ? 'traveller' : 'travellers'}`,
      amount: PRICES.extra_traveller * extraTravellers });
  }
  const extraBags = Math.max(0, bags - travelers);
  if (extraBags > 0) {
    lines.push({ label: `${plural(extraBags, 'extra bag')}`, amount: PRICES.extra_bag * extraBags });
  }
  if (chosen.includes('porter')) lines.push({ label: 'Porter / luggage help', amount: PRICES.porter });
  if (chosen.includes('wheelchair')) {
    const count = Number.isInteger(wheelchairs) && wheelchairs >= 1 ? wheelchairs : 1;
    lines.push({ label: count >= 2 ? `Wheelchair × ${count}` : 'Wheelchair', amount: PRICES.wheelchair * count });
  }
  return { total: lines.reduce((sum, line) => sum + line.amount, 0), lines };
}

// "$375", "$1,200"; 0 is "Free" only where the page asks for it (formatAmount).
export function formatPrice(amount) {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

// A line's amount as shown beside a choice or in the summary: "Free" for 0.
export function formatAmount(amount) {
  return amount === 0 ? 'Free' : formatPrice(amount);
}
