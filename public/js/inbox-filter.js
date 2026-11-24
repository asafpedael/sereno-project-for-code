// The "Status" menu of the Approvals screen (M8, plan D14). The inbox is filtered in the
// browser: it already holds every order of the screen. Values match the <option>s in manager.html.
//   ''                    Status: All
//   'pending'             Pending
//   'needs_clarification' Needs clarification
//   'flight_change'       Flight time changed (an approved order whose flight moved)

export function matchesInboxFilter(order, filter) {
  switch (filter) {
    case 'pending':
    case 'needs_clarification':
      return order.status === filter && !order.flight_change_pending;
    case 'flight_change':
      return Boolean(order.flight_change_pending);
    default:
      return true; // "All", or an unknown value
  }
}

export function filterInbox(orders, filter) {
  return orders.filter((order) => matchesInboxFilter(order, filter));
}
