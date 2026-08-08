# Feature: 0005-workspace-management-e2e-flake

**Status**: done — QA PASS
**Created**: 2026-08-06
**Gherkin**: specs/features/application/workspace-management-e2e-flake.feature
**Summary**: Diagnosticar y estabilizar el flaky de E2E en workspace-management bajo carga completa de la suite.

**Result**: Target 175 passed 175/175 isolated repetitions and all five full-suite runs; 18/18 BDD scenarios pinned and passing; final QA PASS. D11 npm audit and unrelated line-113 flake remain separately documented.

**Observed magnitude**: Phase 9 added one diagnostics helper and modified three test files; Phase 10 added 238 lines to lifecycle fakes; final Gherkin delta was 3 scenarios / 26 lines; Phase 14 added 14 BDD pins in one step file. Active duration was not instrumented.
