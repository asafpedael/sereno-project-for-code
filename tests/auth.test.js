// Tests for the pure parts of lib/auth.js. Run: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roleFromUser, bearerToken, roleMayDecide } from '../lib/auth.js';

test('role is read from app_metadata only', () => {
  assert.equal(roleFromUser({ app_metadata: { role: 'manager' } }), 'manager');
  assert.equal(roleFromUser({ app_metadata: { role: 'agent' } }), 'agent');
});

test('a role in user_metadata (editable by the user) is ignored', () => {
  assert.equal(roleFromUser({ app_metadata: {}, user_metadata: { role: 'manager' } }), null);
});

test('unknown, missing or malformed roles give null', () => {
  assert.equal(roleFromUser({ app_metadata: { role: 'admin' } }), null);
  assert.equal(roleFromUser({ app_metadata: { role: 'Manager' } }), null);
  assert.equal(roleFromUser({}), null);
  assert.equal(roleFromUser(null), null);
});

test('bearer token is read only from a well-formed Authorization header', () => {
  const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc_DEF-123';
  assert.equal(bearerToken({ headers: { authorization: `Bearer ${token}` } }), token);
  assert.equal(bearerToken({ headers: {} }), null);
  assert.equal(bearerToken({ headers: { authorization: token } }), null);
  assert.equal(bearerToken({ headers: { authorization: 'Bearer short' } }), null);
  assert.equal(bearerToken({ headers: { authorization: `Bearer ${token} extra` } }), null);
  assert.equal(bearerToken({ headers: { authorization: `Basic ${token}` } }), null);
});

test('order decisions: the agent may only complete, the manager everything but complete', () => {
  assert.equal(roleMayDecide('agent', 'complete'), true);
  for (const action of ['approve', 'reject', 'add_note', undefined, '']) {
    assert.equal(roleMayDecide('agent', action), false);
  }
  assert.equal(roleMayDecide('manager', 'complete'), false);
  assert.equal(roleMayDecide('manager', 'approve'), true);
  assert.equal(roleMayDecide('manager', 'reject'), true);
  assert.equal(roleMayDecide(null, 'approve'), false);
});
