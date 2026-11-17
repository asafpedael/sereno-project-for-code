// Meeting-time formula: the single source of truth for the recommended meeting time.
// Used by the order form, the server functions and the seed script.
// Pure function, no dependencies.

const MINUTE_MS = 60 * 1000;

/**
 * Recommended meeting time for a flight.
 * minutes = 90 + 5 * (travelers - 1) + 3 * bags, then round down to a multiple of 5 minutes.
 * Escort scope has no effect.
 * @param {Date} departureAt flight departure time
 * @param {number} travelers 1-10
 * @param {number} bags 0-10
 * @returns {Date}
 */
export function meetingTime(departureAt, travelers, bags) {
  const leadMinutes = 90 + 5 * (travelers - 1) + 3 * bags;
  const totalMinutes = Math.floor(departureAt.getTime() / MINUTE_MS) - leadMinutes;
  const rounded = totalMinutes - (((totalMinutes % 5) + 5) % 5);
  return new Date(rounded * MINUTE_MS);
}
