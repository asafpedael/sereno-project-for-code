// Archive paging helpers (M7, plan D9). Pure functions, used by archive.js and unit tests.

export const GAP = '…';

// "Showing 51–63 of 63"; "Showing 0 of 0" when there is nothing on this page.
export function showingText(page, pageSize, total) {
  const start = (page - 1) * pageSize + 1;
  if (total <= 0 || start > total) return `Showing 0 of ${Math.max(total, 0)}`;
  const end = Math.min(page * pageSize, total);
  return `Showing ${start}–${end} of ${total}`;
}

export function totalPages(pageSize, total) {
  return Math.max(1, Math.ceil(total / pageSize));
}

// Page buttons: every page when there are up to 7; otherwise the first, the last, the current
// one and its neighbours, with GAP where pages are left out. E.g. (10, 20) -> 1 … 9 10 11 … 20.
export function pageNumbers(current, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const wanted = new Set([1, pages, current - 1, current, current + 1]);
  const sorted = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const result = [];
  for (const n of sorted) {
    const last = result[result.length - 1];
    if (typeof last === 'number' && n - last > 1) result.push(GAP);
    result.push(n);
  }
  return result;
}
