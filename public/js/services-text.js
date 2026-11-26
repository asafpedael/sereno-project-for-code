// How the chosen services are written, the same way on every screen and in every email
// (Milestone 11, plan D7, D8). Shared by the browser and the server functions (like meeting-time.js, ADR-4).
//
// codes: the order's services, e.g. ["porter", "wheelchair"].
// wheelchairs: the quantity, or null (orders saved before Milestone 11 have none).
// labelMap: { code: label } from data/lists.json; an unknown code keeps its code.
// One wheelchair (or no quantity) -> "Wheelchair"; 2 or more -> "Wheelchair × 2".
export function servicesLabels(codes, wheelchairs, labelMap) {
  const list = Array.isArray(codes) ? codes : [];
  const labels = labelMap || {};
  return list.map((code) => {
    const label = labels[code] || code;
    if (code === 'wheelchair' && Number.isInteger(wheelchairs) && wheelchairs >= 2) {
      return `${label} × ${wheelchairs}`;
    }
    return label;
  });
}
