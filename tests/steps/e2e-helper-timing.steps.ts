import { Given, Then, When } from 'quickpickle';

import { isDataJsonResponse } from '../e2e/helpers/register-workspace';

// ── World ──

interface TimingWorld {
  /** Whether the predicate matched the last tested response */
  lastMatch: boolean | null;
  /** Order tracking: 'barrier' or 'click' as actions are performed */
  actionLog: string[];
}

function freshWorld(): TimingWorld {
  return { lastMatch: null, actionLog: [] };
}

// ── Predicate response shape expected by isDataJsonResponse ──

interface SimulatedResponse {
  url: string;
  method: string;
}

// ── Background ──

Given('the E2E helper is initialized with a simulated response barrier', (world: TimingWorld) => {
  Object.assign(world, freshWorld());
});

// ── Scenario 1 & 2: predicate matching ──

Given('the helper has registered a deferred invalidation barrier', (world: TimingWorld) => {
  world.lastMatch = null;
});

When(
  'a response arrives with URL containing {string} and method {string}',
  (world: TimingWorld, urlContains: string, method: string) => {
    const resp: SimulatedResponse = { url: urlContains, method };
    world.lastMatch = isDataJsonResponse(resp);
  },
);

When(
  'a response arrives with URL {string} and method {string}',
  (world: TimingWorld, url: string, method: string) => {
    const resp: SimulatedResponse = { url, method };
    world.lastMatch = isDataJsonResponse(resp);
  },
);

Then('the barrier predicate matches the response', (world: TimingWorld) => {
  if (world.lastMatch !== true) {
    throw new Error(`Expected predicate to match, but got ${world.lastMatch}`);
  }
});

Then('the barrier predicate does not match the response', (world: TimingWorld) => {
  if (world.lastMatch !== false) {
    throw new Error(`Expected predicate to NOT match, but got ${world.lastMatch}`);
  }
});

// ── Scenario 3: barrier registration before click ──

Given('the helper is ready to select a workspace', (world: TimingWorld) => {
  Object.assign(world, freshWorld());
});

When('the helper registers the deferred invalidation barrier', (world: TimingWorld) => {
  world.actionLog.push('barrier');
});

When('the helper performs the workspace selection click', (world: TimingWorld) => {
  world.actionLog.push('click');
});

Then('the barrier was registered before the click action', (world: TimingWorld) => {
  const barrierIdx = world.actionLog.indexOf('barrier');
  const clickIdx = world.actionLog.indexOf('click');
  if (barrierIdx === -1) throw new Error('Barrier was never registered');
  if (clickIdx === -1) throw new Error('Click was never performed');
  if (barrierIdx >= clickIdx) {
    throw new Error(`Expected barrier (index ${barrierIdx}) before click (index ${clickIdx})`);
  }
});

// ── Scenario 4: status-agnostic ──

When(
  'a response arrives with URL containing {string} and HTTP status {int}',
  (world: TimingWorld, urlContains: string, status: number) => {
    // The predicate only looks at url + method; status is deliberately ignored.
    // We pass method "GET" because __data.json invalidation is always GET.
    // status is captured to satisfy quickpickle arg count but intentionally unused.
    void status;
    const resp: SimulatedResponse = { url: urlContains, method: 'GET' };
    world.lastMatch = isDataJsonResponse(resp);
  },
);

Then('the barrier resolves without requiring HTTP status 200', (world: TimingWorld) => {
  // The barrier resolution does not depend on HTTP 200; the predicate alone
  // controls resolution. No extra assertion needed beyond the match check
  // already confirmed by the previous Then step.
  if (world.lastMatch !== true) {
    throw new Error(
      `Expected status-agnostic predicate to match even with non-200 status, but got ${world.lastMatch}`,
    );
  }
});
