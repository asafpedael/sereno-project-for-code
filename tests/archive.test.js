// Archive (M7): query checks, role limits and the PostgREST filter text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateArchiveQuery } from '../lib/validate.js';
import {
  archiveStatuses, archiveSearchConditions, archiveDateConditions, combineOrGroups, toAgentView,
} from '../lib/orders-view.js';

const ok = (query) => {
  const r = validateArchiveQuery(query);
  assert.equal(r.error, undefined, `unexpected error: ${r.error}`);
  return r.value;
};
const err = (query) => {
  const r = validateArchiveQuery(query);
  assert.ok(r.error, 'expected an error');
  return r.error;
};

test('empty archive query gives defaults', () => {
  assert.deepEqual(ok({}), { q: '', flightQ: '', status: null, from: null, to: null, page: 1, mine: false });
  assert.deepEqual(ok({ q: '', status: '', from: '', to: '', page: '' }), { q: '', flightQ: '', status: null, from: null, to: null, page: 1, mine: false });
});

test('search text is cleaned and the flight form is compact upper case', () => {
  const v = ok({ q: '  dm 1-01 ' });
  assert.equal(v.q, 'dm 1-01');
  assert.equal(v.flightQ, 'DM101');
  assert.equal(ok({ q: "Daniel A." }).q, 'Daniel A');
  assert.equal(ok({ q: 'a,b(c)%d"e*' }).q, 'abcde');
  assert.equal(ok({ q: 'אסף  פדאל' }).q, 'אסף פדאל');
  assert.equal(ok({ q: "O'Brien" }).q, 'OBrien');
  assert.equal(ok({ q: 'maya+z' }).q, 'maya z');
  assert.match(err({ q: 'x'.repeat(41) }), /40 characters/);
  assert.ok(err({ q: ['a', 'b'] }));
});

test('status must be a known code', () => {
  for (const s of ['pending', 'approved', 'rejected', 'needs_clarification', 'completed']) {
    assert.equal(ok({ status: s }).status, s);
  }
  assert.equal(err({ status: 'Approved' }), 'Unknown status.');
  assert.equal(err({ status: 'all' }), 'Unknown status.');
  assert.equal(err({ status: ['approved'] }), 'Unknown status.');
});

test('dates must be real and in order; one side may be open', () => {
  assert.deepEqual([ok({ from: '2026-11-01' }).from, ok({ from: '2026-11-01' }).to], ['2026-11-01', null]);
  assert.equal(ok({ to: '2026-11-30' }).to, '2026-11-30');
  assert.equal(ok({ from: '2026-11-05', to: '2026-11-05' }).from, '2026-11-05');
  assert.match(err({ from: '2026-02-31' }), /YYYY-MM-DD/);
  assert.match(err({ to: '23/11/2026' }), /YYYY-MM-DD/);
  assert.equal(err({ from: '2026-11-06', to: '2026-11-05' }), 'The From date must not be after the To date.');
});

test('page is a whole number from 1 to 1000', () => {
  assert.equal(ok({ page: '1' }).page, 1);
  assert.equal(ok({ page: '1000' }).page, 1000);
  for (const p of ['0', '-1', '1.5', 'abc', '1001', '1e2', ' 2']) {
    assert.equal(err({ page: p }), 'Page is not valid.', `page ${p}`);
  }
});

test('archive statuses per role', () => {
  assert.deepEqual(archiveStatuses('manager'), ['pending', 'approved', 'rejected', 'needs_clarification', 'completed']);
  assert.deepEqual(archiveStatuses('agent'), ['approved', 'completed']);
  assert.deepEqual(archiveStatuses('customer'), []);
  assert.deepEqual(archiveStatuses(undefined), []);
});

test('search conditions: name or flight number', () => {
  assert.equal(archiveSearchConditions('', ''), null);
  assert.equal(archiveSearchConditions('Daniel A', 'DANIELA'),
    'contact_name.ilike.*Daniel*A*,flight_no_submitted.ilike.*DANIELA*');
  assert.equal(archiveSearchConditions('-', ''), 'contact_name.ilike.*-*');
  assert.ok(!archiveSearchConditions('a b  c', 'ABC').includes(' '));
});

test('date conditions: flight in range, or typed flight date in range', () => {
  assert.equal(archiveDateConditions([], null, null), null);
  assert.equal(archiveDateConditions(['f1', 'f2'], '2026-11-01', '2026-11-30'),
    'flight_id.in.(f1,f2),and(flight_id.is.null,flight_date_submitted.gte.2026-11-01,flight_date_submitted.lte.2026-11-30)');
  assert.equal(archiveDateConditions([], '2026-11-01', null),
    'and(flight_id.is.null,flight_date_submitted.gte.2026-11-01)');
});

test('groups combine as AND', () => {
  assert.equal(combineOrGroups([null, null]), null);
  assert.equal(combineOrGroups(['a.eq.1,b.eq.2', null]), 'a.eq.1,b.eq.2');
  assert.equal(combineOrGroups(['a.eq.1,b.eq.2', 'c.eq.3']), 'and(or(a.eq.1,b.eq.2),or(c.eq.3))');
});

test('agent archive rows have no email, AI output, notes or history', () => {
  const row = {
    id: '00000005-0000-4000-8000-000000000005', status: 'completed', customer_id: 'c1',
    contact_name: 'Noa B.', contact_phone: '053', customer: { email: 'noa.b@example.com' },
    flight: { flight_no: 'DM202', destination: 'Paris', departure_at: '2026-11-16T16:45:00Z' },
    travelers: 2, bags: 1, services: ['porter'], escort_scope: 'partial', customer_notes: 'x',
    final_time: '2026-11-16T15:05:00Z', manager_notes: null, ai_output: { status: 'ok' },
  };
  const view = toAgentView(row);
  const text = JSON.stringify(view);
  assert.ok(!text.includes('example.com'));
  for (const key of ['ai_output', 'customer_notes', 'is_returning_customer', 'previous_orders']) {
    assert.ok(!(key in view), key);
  }
  assert.ok(!('email' in view.customer));
});

// ---------- Paging helpers (public/js/paging.js) ----------
import { showingText, totalPages, pageNumbers, GAP } from '../public/js/paging.js';

test('showing text', () => {
  assert.equal(showingText(1, 50, 63), 'Showing 1–50 of 63');
  assert.equal(showingText(2, 50, 63), 'Showing 51–63 of 63');
  assert.equal(showingText(1, 50, 0), 'Showing 0 of 0');
  assert.equal(showingText(3, 50, 63), 'Showing 0 of 63');
  assert.equal(showingText(1, 50, 50), 'Showing 1–50 of 50');
});

test('total pages', () => {
  assert.equal(totalPages(50, 0), 1);
  assert.equal(totalPages(50, 50), 1);
  assert.equal(totalPages(50, 51), 2);
  assert.equal(totalPages(50, 75), 2);
});

test('page numbers', () => {
  assert.deepEqual(pageNumbers(1, 1), [1]);
  assert.deepEqual(pageNumbers(2, 2), [1, 2]);
  assert.deepEqual(pageNumbers(4, 7), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(pageNumbers(1, 8), [1, 2, GAP, 8]);
  assert.deepEqual(pageNumbers(8, 8), [1, GAP, 7, 8]);
  assert.deepEqual(pageNumbers(10, 20), [1, GAP, 9, 10, 11, GAP, 20]);
  assert.deepEqual(pageNumbers(3, 20), [1, 2, 3, 4, GAP, 20]);
  assert.deepEqual(pageNumbers(19, 20), [1, GAP, 18, 19, 20]);
});
