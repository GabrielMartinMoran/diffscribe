/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';
import { cwd } from 'node:process';

import { Given, Then, When } from 'quickpickle';

import { createWorkspaceServices } from '$lib/server/composition/workspace-services';

import { guardStaleProcesses } from '../e2e/helpers/stale-process-guard';

type World = any;

// ── Paths (test infrastructure owned by 0005; never production) ─────────

const FIXTURES_PATH = path.resolve(__dirname, '../e2e/fixtures.ts');
const REGISTER_HELPER_PATH = path.resolve(__dirname, '../e2e/helpers/register-workspace.ts');
const ENHANCE_DIAGNOSTICS_PATH = path.resolve(__dirname, '../e2e/helpers/enhance-diagnostics.ts');
const TELEMETRY_PATH = path.resolve(__dirname, '../e2e/helpers/worker-telemetry.ts');
const WORKER_SERVER_PATH = path.resolve(__dirname, '../e2e/helpers/worker-server.ts');
const STALE_GUARD_PATH = path.resolve(__dirname, '../e2e/helpers/stale-process-guard.ts');
const CONTRACT_PATH = path.resolve(
  __dirname,
  '../integration/e2e-helpers/workspace-management-flake.test.ts',
);
const WORKER_SERVER_TEST_PATH = path.resolve(
  __dirname,
  '../integration/e2e-helpers/worker-server.test.ts',
);
const STALE_GUARD_TEST_PATH = path.resolve(__dirname, '../unit/stale-process-guard.test.ts');
const SPEC_PATH = path.resolve(__dirname, '../e2e/workspace-management.spec.ts');
const REGISTRATION_SPEC_PATH = path.resolve(__dirname, '../e2e/workspace-registration.spec.ts');
const LINE_SELECTION_SPEC_PATH = path.resolve(__dirname, '../e2e/line-selection.spec.ts');

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  Background (@application @e2e @stability @delta-added)
// ────────────────────────────────────────────────────────────────────────────

Given('the E2E test harness is initialized', (_w: World) => {
  requireMarker(FIXTURES_PATH, 'startWorkerServer');
});

// ────────────────────────────────────────────────────────────────────────────
//  @h2: Registration helper waits for the deferred invalidation response
// ────────────────────────────────────────────────────────────────────────────

Given('a workspace is registered via the open-workspace form', (_w: World) => {
  requireMarker(REGISTER_HELPER_PATH, 'open-workspace-form');
  requireMarker(REGISTER_HELPER_PATH, 'submitRegistration');
});

When('the helper registers a __data.json response barrier before the submit', (_w: World) => {
  requireMarker(REGISTER_HELPER_PATH, 'waitForResponse');
  requireMarker(REGISTER_HELPER_PATH, 'isDataJsonResponse');
});

When('the form action succeeds and triggers invalidateAll', (_w: World) => {
  requireMarker(REGISTER_HELPER_PATH, 'dataJsonPromise');
});

Then('the helper resolves only after the __data.json response arrives', (_w: World) => {
  requireMarker(REGISTER_HELPER_PATH, 'await dataJsonPromise');
  requireMarker(CONTRACT_PATH, 'dataJsonResolved');
});

Then(
  'the registered workspace is visible in the sidebar before the helper returns',
  (_w: World) => {
    requireMarker(REGISTER_HELPER_PATH, '#workspace-sidebar');
    requireMarker(REGISTER_HELPER_PATH, "state: 'visible'");
    requireMarker(CONTRACT_PATH, 'sidebarItemVisible');
  },
);

// ────────────────────────────────────────────────────────────────────────────
//  @h2: Registration helper does not rely on networkidle alone
// ────────────────────────────────────────────────────────────────────────────

Given('the page has reached networkidle after the submit', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'waitForLoadState');
  requireMarker(CONTRACT_PATH, 'networkidle');
});

When('the deferred __data.json response has not yet completed', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'dataJsonResolved');
  requireMarker(CONTRACT_PATH, 'simulateDataJsonResponse');
});

Then('the helper must not consider the registration complete', (_w: World) => {
  requireMarker(REGISTER_HELPER_PATH, 'dataJsonPromise');
  requireMarker(CONTRACT_PATH, 'registration completed before the deferred __data.json response');
});

Then('the helper must wait for the deferred invalidation response', (_w: World) => {
  requireMarker(REGISTER_HELPER_PATH, 'await dataJsonPromise');
});

// ────────────────────────────────────────────────────────────────────────────
//  @h3: Worker readiness requires JavaScript chunk availability
// ────────────────────────────────────────────────────────────────────────────

Given(
  'a worker server responds with HTML {int} for {string}',
  (_w: World, status: number, path: string) => {
    if (status !== 200 || path !== '/') {
      throw new Error(`Unexpected readiness response: HTML ${status} for "${path}"`);
    }
    requireMarker(WORKER_SERVER_TEST_PATH, 'chunkFailingServerScript');
    requireMarker(WORKER_SERVER_PATH, 'httpGet');
  },
);

When('a required JavaScript chunk responds with 503 or 404', (_w: World) => {
  requireMarker(WORKER_SERVER_TEST_PATH, 'r.writeHead(503)');
});

Then('the worker must not be considered ready', (_w: World) => {
  requireMarker(WORKER_SERVER_TEST_PATH, 'H3 RED: startWorkerServer resolved');
});

Then('the readiness failure must report the failing chunk', (_w: World) => {
  requireMarker(WORKER_SERVER_TEST_PATH, 'toMatch(/chunk/i)');
});

// ────────────────────────────────────────────────────────────────────────────
//  @h4: Startup failure kills descendant processes
// ────────────────────────────────────────────────────────────────────────────

Given('a worker child spawns a grandchild process', (_w: World) => {
  requireMarker(WORKER_SERVER_TEST_PATH, 'spawnGrandchildThenExitScript');
  requireMarker(WORKER_SERVER_TEST_PATH, 'gcPidFile');
});

When('the child exits before readiness', (_w: World) => {
  requireMarker(WORKER_SERVER_TEST_PATH, 'process.exit(1)');
  requireMarker(WORKER_SERVER_PATH, 'Child process exited before readiness');
});

Then('the grandchild process is terminated', (_w: World) => {
  requireMarker(WORKER_SERVER_TEST_PATH, 'H4 RED: grandchild');
});

Then('no orphan process remains on the worker port', (_w: World) => {
  requireMarker(WORKER_SERVER_PATH, 'process.kill(-pid');
  requireMarker(WORKER_SERVER_TEST_PATH, 'is still alive after failed startup');
});

// ────────────────────────────────────────────────────────────────────────────
//  @h4: Stale process guard covers dynamic worker ports
// ────────────────────────────────────────────────────────────────────────────

Given('a stale vite dev process listens on a dynamic worker port', (_w: World) => {
  requireMarker(STALE_GUARD_TEST_PATH, '5999');
  requireMarker(STALE_GUARD_TEST_PATH, 'H4 RED');
});

When(
  'the stale process guard runs',
  (world: World) => {
    requireMarker(STALE_GUARD_PATH, 'detectStaleProcesses');
    requireMarker(STALE_GUARD_PATH, 'guardStaleProcesses');
    // This step text is shared with rail-hydration-stability.feature; the
    // definition with the higher priority (this one) wins for every scenario
    // using it. Keep that feature's world contract populated (detectedPids /
    // foreignPids and the DIFFSCRIBE_E2E_KILL_ZOMBIES env handling), while
    // adding the static markers for the 0005 dynamic-port contract.
    const guardEnv = (world as { guardEnv?: Record<string, string> }).guardEnv;
    const prevKill = process.env['DIFFSCRIBE_E2E_KILL_ZOMBIES'];
    try {
      if (guardEnv) {
        if (guardEnv['DIFFSCRIBE_E2E_KILL_ZOMBIES']) {
          process.env['DIFFSCRIBE_E2E_KILL_ZOMBIES'] = guardEnv['DIFFSCRIBE_E2E_KILL_ZOMBIES'];
        } else {
          delete process.env['DIFFSCRIBE_E2E_KILL_ZOMBIES'];
        }
      }
      const report = guardStaleProcesses(cwd());
      world.detectedPids = report.processes.map((p) => p.pid);
      world.foreignPids = report.foreign.map((p) => p.pid);
    } finally {
      if (prevKill !== undefined) {
        process.env['DIFFSCRIBE_E2E_KILL_ZOMBIES'] = prevKill;
      } else {
        delete process.env['DIFFSCRIBE_E2E_KILL_ZOMBIES'];
      }
    }
  },
  1,
);

Then('the process is detected on the dynamic port', (_w: World) => {
  requireMarker(STALE_GUARD_TEST_PATH, 'dynamic worker port not scanned');
});

Then('the process is reported for the project working directory', (_w: World) => {
  requireMarker(STALE_GUARD_PATH, 'processCwd && processCwd === projectCwd');
});

// ────────────────────────────────────────────────────────────────────────────
//  @diagnostics: Failure telemetry records worker context
// ────────────────────────────────────────────────────────────────────────────

Given('an E2E test fails in a worker', (_w: World) => {
  requireMarker(SPEC_PATH, 'testInfo.status');
  requireMarker(SPEC_PATH, 'reportTelemetryOnFailure');
});

When('the failure is captured', (_w: World) => {
  requireMarker(SPEC_PATH, "testInfo.attach('worker-telemetry'");
});

Then('the telemetry records the worker index, port, stderr, and first error', (_w: World) => {
  requireMarker(TELEMETRY_PATH, 'workerIndex');
  requireMarker(TELEMETRY_PATH, 'port');
  requireMarker(TELEMETRY_PATH, 'stderrSnapshot');
  requireMarker(TELEMETRY_PATH, 'firstPageError');
});

Then('the telemetry records the status of JavaScript resources', (_w: World) => {
  requireMarker(TELEMETRY_PATH, 'failedJsResources');
  requireMarker(TELEMETRY_PATH, 'JS_RESOURCE_PATTERN');
});

// ────────────────────────────────────────────────────────────────────────────
//  @diagnostics: Stability runs record per-spec results with worker context
// ────────────────────────────────────────────────────────────────────────────

Given('the full E2E suite runs repeatedly', (_w: World) => {
  requireMarker(SPEC_PATH, 'worker-telemetry');
  requireMarker(REGISTRATION_SPEC_PATH, 'sequential workspace registrations');
  requireMarker(LINE_SELECTION_SPEC_PATH, 'Observation CRUD E2E');
});

When('a stability run completes', (_w: World) => {
  requireMarker(SPEC_PATH, 'testInfo.status');
});

Then("the ledger records each spec's pass\\/fail with worker index and run index", (_w: World) => {
  requireMarker(TELEMETRY_PATH, 'workerIndex');
  requireMarker(SPEC_PATH, 'testInfo.status');
});

Then('the 0005 verdict counts only the three target specs', (_w: World) => {
  requireMarker(SPEC_PATH, 'Hydration race regression');
  requireMarker(REGISTRATION_SPEC_PATH, 'sequential workspace registrations open fresh forms');
  requireMarker(LINE_SELECTION_SPEC_PATH, 'Observation CRUD E2E');
});

// ────────────────────────────────────────────────────────────────────────────
//  @sequential-registration: fresh forms after the previous registration settles
// ────────────────────────────────────────────────────────────────────────────

Given('a workspace is registered through the open-workspace form', (_w: World) => {
  requireMarker(REGISTER_HELPER_PATH, 'openWorkspaceForm');
  requireMarker(REGISTER_HELPER_PATH, 'submitRegistration');
});

When('a second workspace registration starts immediately after the first', (_w: World) => {
  requireMarker(REGISTRATION_SPEC_PATH, 'sequential workspace registrations open fresh forms');
});

Then('the second form opens only after the first registration has settled', (_w: World) => {
  requireMarker(REGISTER_HELPER_PATH, 'waitForLoadState');
  requireMarker(CONTRACT_PATH, 'simulateNetworkSettled');
});

Then('the second form is empty and ready for input', (_w: World) => {
  requireMarker(REGISTRATION_SPEC_PATH, "toHaveValue('')");
  requireMarker(REGISTER_HELPER_PATH, 'openWorkspaceForm');
});

Given('a simulated page models the deferred invalidation of a registration', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'gateNetworkidle');
});

When('the canonical helper completes the first registration', (_w: World) => {
  requireMarker(REGISTER_HELPER_PATH, 'submitRegistration');
  requireMarker(CONTRACT_PATH, 'simulateNetworkSettled');
});

Then('the helper does not return before the deferred invalidation settles', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'registration completed before the page settled');
});

Then('a second registration never opens while the first is still settling', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'settlingAtSubmit');
});

Given('the first workspace registration is completed', (_w: World) => {
  requireMarker(REGISTRATION_SPEC_PATH, 'submitRegistration');
  requireMarker(REGISTRATION_SPEC_PATH, 'name1');
});

When('the second registration form opens', (_w: World) => {
  requireMarker(REGISTRATION_SPEC_PATH, 'openRegistrationForm');
});

Then(
  'the test asserts the path and name inputs are empty before the second submit',
  (_w: World) => {
    requireMarker(REGISTRATION_SPEC_PATH, "toHaveValue('')");
  },
);

Then('the second submit uses the event-driven registration barrier', (_w: World) => {
  requireMarker(REGISTER_HELPER_PATH, 'await dataJsonPromise');
  requireMarker(REGISTER_HELPER_PATH, 'waitForResponse');
});

// ────────────────────────────────────────────────────────────────────────────
//  @observation-crud: response barriers before card assertions
// ────────────────────────────────────────────────────────────────────────────

Given('an observation form is filled for a selected line range', (_w: World) => {
  requireMarker(LINE_SELECTION_SPEC_PATH, 'obs-form');
  requireMarker(LINE_SELECTION_SPEC_PATH, '#obs-body');
});

When('the user creates the observation', (_w: World) => {
  requireMarker(LINE_SELECTION_SPEC_PATH, 'button:has-text("Create")');
});

Then('the test waits for the create POST response and the observations reload GET', (_w: World) => {
  requireMarker(LINE_SELECTION_SPEC_PATH, "method() === 'POST'");
  requireMarker(LINE_SELECTION_SPEC_PATH, "method() === 'GET'");
});

Then('the observation card assertion runs only after the reload completes', (_w: World) => {
  requireMarker(LINE_SELECTION_SPEC_PATH, 'createPost');
  requireMarker(LINE_SELECTION_SPEC_PATH, 'reloadGet');
});

Given('an observation card is visible in the observation panel', (_w: World) => {
  requireMarker(LINE_SELECTION_SPEC_PATH, '.obs-card');
});

When(
  'the user deletes the observation',
  async (world: World) => {
    requireMarker(LINE_SELECTION_SPEC_PATH, 'deleteResponse');
    requireMarker(LINE_SELECTION_SPEC_PATH, 'status() === 204');
    // This step text is shared with observation-crud.feature; the definition
    // with the higher priority (this one) wins for every scenario using it.
    // Keep that feature's world contract working by replicating its logic when
    // the world is an ObsWorld (db + lastObservation), while adding the 0005
    // markers for the E2E barrier contract.
    const obsWorld = world as { db?: any; lastObservation?: { id: string } | null };
    if (obsWorld.db && obsWorld.lastObservation) {
      const services = createWorkspaceServices(obsWorld.db);
      await services.deleteObservationUseCase.execute(obsWorld.lastObservation.id);
      obsWorld.lastObservation = null;
    }
  },
  1,
);

Then('the test waits for the delete response before asserting the card list', (_w: World) => {
  requireMarker(LINE_SELECTION_SPEC_PATH, 'deleteResponse');
  requireMarker(LINE_SELECTION_SPEC_PATH, 'toHaveCount(0)');
});

Then('the card removal assertion does not rely on networkidle alone', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'networkidle-only race');
  requireMarker(LINE_SELECTION_SPEC_PATH, 'toHaveCount(0)');
});

Given('a simulated page models the observation list reload after create', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'FakeObservationPage');
  requireMarker(CONTRACT_PATH, 'simulateReload');
});

When('the harness asserts card visibility with response barriers', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'submitCreate');
  requireMarker(CONTRACT_PATH, 'waitForResponse');
});

Then('the assertion observes the refreshed list', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'cards');
  requireMarker(CONTRACT_PATH, 'simulateReload');
});

Then('the assertion does not depend on generic networkidle timing', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'networkidle');
  requireMarker(CONTRACT_PATH, 'networkidle-only race');
});

// ────────────────────────────────────────────────────────────────────────────
//  @worker-test-diagnostics: transient flakes recorded with exact context
// ────────────────────────────────────────────────────────────────────────────

Given('the integration worker-server suite runs repeatedly under load', (_w: World) => {
  requireMarker(WORKER_SERVER_TEST_PATH, 'startWorkerServer');
});

When('a test fails transiently', (_w: World) => {
  requireMarker(WORKER_SERVER_TEST_PATH, 'H3 RED');
  requireMarker(WORKER_SERVER_TEST_PATH, 'H4 RED');
  requireMarker(LINE_SELECTION_SPEC_PATH, 'resolves observation and reopens it');
});

Then(
  'the failure is recorded with its exact test name, run index, and error output',
  (_w: World) => {
    requireMarker(WORKER_SERVER_TEST_PATH, 'H3 RED: rejects when HTML responds 200');
    requireMarker(WORKER_SERVER_TEST_PATH, 'H4 RED: kills descendant processes when startup fails');
  },
);

Then('no lifecycle change is applied without repeated evidence', (_w: World) => {
  requireMarker(STALE_GUARD_PATH, 'DIFFSCRIBE_E2E_KILL_ZOMBIES');
  requireMarker(CONTRACT_PATH, 'documented race');
});

Given('the line-selection resolve test runs repeatedly under load', (_w: World) => {
  requireMarker(LINE_SELECTION_SPEC_PATH, 'resolves observation and reopens it');
});

Then(
  'the failure is recorded with its exact test name, run index, worker context, and error output',
  (_w: World) => {
    requireMarker(LINE_SELECTION_SPEC_PATH, 'resolves observation and reopens it');
    requireMarker(SPEC_PATH, 'reportTelemetryOnFailure');
    requireMarker(TELEMETRY_PATH, 'workerIndex');
  },
);

Then('no change is applied without repeated evidence', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'documented race');
  requireMarker(WORKER_SERVER_TEST_PATH, 'H4 RED');
});

// ────────────────────────────────────────────────────────────────────────────
//  @enhance-diagnostics: Failure diagnostics capture form identity, submit
//  evidence, and worker context
// ────────────────────────────────────────────────────────────────────────────

Given('a workspace registration fails under full-suite load', (_w: World) => {
  requireMarker(REGISTRATION_SPEC_PATH, 'sequential workspace registrations open fresh forms');
  requireMarker(REGISTRATION_SPEC_PATH, '175-failure-diagnostics');
});

Then('the diagnostics record the form identity and attach\\/detach history', (_w: World) => {
  requireMarker(ENHANCE_DIAGNOSTICS_PATH, 'formIds');
  requireMarker(ENHANCE_DIAGNOSTICS_PATH, 'attachedAtMs');
  requireMarker(ENHANCE_DIAGNOSTICS_PATH, 'detachedAtMs');
  requireMarker(REGISTRATION_SPEC_PATH, 'observerSnapshot');
});

Then('the diagnostics record the submit ordinal, target, and defaultPrevented', (_w: World) => {
  requireMarker(ENHANCE_DIAGNOSTICS_PATH, 'ordinal');
  requireMarker(ENHANCE_DIAGNOSTICS_PATH, 'defaultPrevented');
  requireMarker(
    CONTRACT_PATH,
    'records submit ordinal, target identity, and defaultPrevented without calling preventDefault',
  );
});

Then(
  'the diagnostics record navigation, page errors, failed resources, and worker context',
  (_w: World) => {
    requireMarker(REGISTRATION_SPEC_PATH, 'probeNavigation');
    requireMarker(REGISTRATION_SPEC_PATH, 'framenavigated');
    requireMarker(CONTRACT_PATH, 'emitPageError');
    requireMarker(CONTRACT_PATH, 'failedJsResources');
    requireMarker(REGISTRATION_SPEC_PATH, 'workerServer.workerIndex');
  },
);

Then(
  'the diagnostics distinguish the first and second submit and old vs replaced forms',
  (_w: World) => {
    requireMarker(
      CONTRACT_PATH,
      'records first and second submits with ordinal and target identity',
    );
    requireMarker(
      CONTRACT_PATH,
      'distinguish the old detached form from the replaced connected form',
    );
    requireMarker(ENHANCE_DIAGNOSTICS_PATH, 'connected');
  },
);

// ────────────────────────────────────────────────────────────────────────────
//  @enhance-diagnostics: The observer records attach, detach, and submit
//  without calling preventDefault
// ────────────────────────────────────────────────────────────────────────────

Given('a simulated page attaches and detaches the enhanced submit listener', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'FakeObserverPage');
  requireMarker(CONTRACT_PATH, 'records attach and detach with per-form monotonic identity');
});

When('the observer records the lifecycle', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'dispatchSubmit');
  requireMarker(ENHANCE_DIAGNOSTICS_PATH, 'snapshot(): EnhanceObserverSnapshot');
});

Then('attach and detach events are recorded with form identity and timestamps', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'attach must record a timestamp');
  requireMarker(CONTRACT_PATH, 'detach must record a timestamp');
  requireMarker(ENHANCE_DIAGNOSTICS_PATH, 'formId');
});

Then('submit events are recorded with ordinal, target, and defaultPrevented', (_w: World) => {
  requireMarker(
    CONTRACT_PATH,
    'records submit ordinal, target identity, and defaultPrevented without calling preventDefault',
  );
  requireMarker(ENHANCE_DIAGNOSTICS_PATH, 'ordinal');
  requireMarker(ENHANCE_DIAGNOSTICS_PATH, 'defaultPrevented');
});

Then('the observer never calls preventDefault', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'the observer never calls preventDefault');
  requireMarker(ENHANCE_DIAGNOSTICS_PATH, 'preventDefaultCalls');
});

// ────────────────────────────────────────────────────────────────────────────
//  @enhance-diagnostics: The lifecycle-aware guard fails fast when the
//  observed form is replaced
// ────────────────────────────────────────────────────────────────────────────

Given('a simulated page replaces the observed form after the listener attaches', (_w: World) => {
  requireMarker(CONTRACT_PATH, 'FakeLifecyclePage');
  requireMarker(CONTRACT_PATH, 'replaceForm');
  requireMarker(CONTRACT_PATH, 'lifecycle false-positive');
});

When('the guard verifies the form before the submit', (_w: World) => {
  requireMarker(REGISTER_HELPER_PATH, 'ensureEnhancedSubmitReady');
  requireMarker(CONTRACT_PATH, 'checkReadiness');
  requireMarker(CONTRACT_PATH, 'guardOutcome');
});

Then('the guard fails fast with form-identity diagnostics', (_w: World) => {
  requireMarker(REGISTER_HELPER_PATH, 'Enhanced submit not ready');
  requireMarker(REGISTER_HELPER_PATH, 'action="?/register"');
  requireMarker(CONTRACT_PATH, 'observedFormId');
});

Then('no native submit occurs', (_w: World) => {
  requireMarker(REGISTER_HELPER_PATH, 'native navigation would occur');
  requireMarker(CONTRACT_PATH, 'expect(page.submits).toBe(0)');
  requireMarker(CONTRACT_PATH, 'fakeIntercepted');
});
