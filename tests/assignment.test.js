// Tests for agent assignment (M9): visibility filter, agent list, views and validation. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agentVisibility, agentsFromUsers, toAgentView, toManagerView, combineOrGroups,
} from '../lib/orders-view.js';
import { validateDecisionBody, validateArchiveQuery } from '../lib/validate.js';
import { roleMayDecide } from '../lib/auth.js';
import { approvedEmailPayload } from '../lib/notify.js';

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const ID = 'a1b2c3d4-0000-4000-8000-000000000001';

function row(overrides = {}) {
  return {
    id: ID, status: 'approved', contact_name: 'Daniel A.', contact_phone: '050-1110001',
    customer: { email: 'daniel@example.com' },
    flight: { flight_no: 'DM101', destination: 'London', departure_at: '2026-12-10T12:30:00+00:00' },
    flight_no_submitted: 'DM101', travelers: 2, bags: 3, services: [], escort_scope: 'full',
    final_time: '2026-12-10T10:45:00+00:00', manager_notes: null, ai_output: null,
    assigned_agent_id: null, ...overrides,
  };
}

test('agentVisibility: unassigned or mine; refuses anything that is not a uuid', () => {
  assert.equal(agentVisibility(ME), `assigned_agent_id.is.null,assigned_agent_id.eq.${ME}`);
  for (const bad of ['', 'x,status.eq.pending', null, undefined, 5]) assert.throws(() => agentVisibility(bad));
});

test('visibility combines with search and dates as one AND of ORs', () => {
  assert.equal(combineOrGroups(['a.eq.1,b.eq.2', null, agentVisibility(ME)]),
    `and(or(a.eq.1,b.eq.2),or(assigned_agent_id.is.null,assigned_agent_id.eq.${ME}))`);
});

test('agentsFromUsers: only agents, id and name only, sorted by name', () => {
  const users = [
    { id: 'u1', email: 'zed@example.com', app_metadata: { role: 'agent' }, user_metadata: {} },
    { id: 'u2', email: 'boss@example.com', app_metadata: { role: 'manager' } },
    { id: 'u3', email: 'none@example.com', app_metadata: {} },
    { id: 'u4', email: 'dana@example.com', app_metadata: { role: 'agent' }, user_metadata: { full_name: ' Dana K. ' } },
  ];
  assert.deepEqual(agentsFromUsers(users), [{ id: 'u4', name: 'Dana K.' }, { id: 'u1', name: 'zed@example.com' }]);
  assert.deepEqual(agentsFromUsers(undefined), []);
});

test('agent view: assigned_to_me only, never an agent id', () => {
  assert.equal(toAgentView(row({ assigned_agent_id: ME }), ME).assigned_to_me, true);
  assert.equal(toAgentView(row({ assigned_agent_id: OTHER }), ME).assigned_to_me, false);
  assert.equal(toAgentView(row(), ME).assigned_to_me, false);
  const text = JSON.stringify(toAgentView(row({ assigned_agent_id: OTHER }), ME));
  assert.ok(!text.includes(OTHER) && !('assigned_agent_id' in toAgentView(row(), ME)));
});

test('manager view carries assigned_agent_id', () => {
  assert.equal(toManagerView(row({ assigned_agent_id: ME })).assigned_agent_id, ME);
  assert.equal(toManagerView(row()).assigned_agent_id, null);
});

test('agent_id: allowed with approve and assign_agent only', () => {
  assert.equal(validateDecisionBody({ order_id: ID, action: 'approve', agent_id: ME.toUpperCase() }).value.agent_id, ME);
  assert.equal(validateDecisionBody({ order_id: ID, action: 'approve', agent_id: null }).value.agent_id, null);
  assert.equal(validateDecisionBody({ order_id: ID, action: 'approve', agent_id: 'nope' }).error, 'Field agent is not valid.');
  for (const action of ['reject', 'add_note', 'complete']) {
    const body = { order_id: ID, action, agent_id: ME };
    if (action === 'add_note') body.manager_notes = 'x';
    assert.equal(validateDecisionBody(body).error, 'A field agent can only be set when approving or assigning.', action);
  }
});

test('assign_agent: a uuid or null; the field is required', () => {
  assert.equal(validateDecisionBody({ order_id: ID, action: 'assign_agent', agent_id: ME }).value.agent_id, ME);
  assert.equal(validateDecisionBody({ order_id: ID, action: 'assign_agent', agent_id: null }).value.agent_id, null);
  assert.equal(validateDecisionBody({ order_id: ID, action: 'assign_agent' }).error, 'Field agent is required.');
});

test('archive "mine": 1 or empty only', () => {
  assert.equal(validateArchiveQuery({ mine: '1' }).value.mine, true);
  assert.equal(validateArchiveQuery({ mine: '' }).value.mine, false);
  assert.equal(validateArchiveQuery({ mine: 'yes' }).error, 'Unknown filter.');
});

test('assign_agent is manager only', () => {
  assert.equal(roleMayDecide('manager', 'assign_agent'), true);
  assert.equal(roleMayDecide('agent', 'assign_agent'), false);
});

test('the customer email never carries the agent', () => {
  const text = JSON.stringify(approvedEmailPayload(row({ assigned_agent_id: ME })));
  assert.ok(!text.includes(ME) && !text.includes('agent'));
});
