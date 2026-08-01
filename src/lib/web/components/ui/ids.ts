/**
 * DiffScribe — Base UI kit id helpers.
 *
 * Deterministic id derivation (from consumer-provided ids) keeps SSR and
 * client hydration identical. `uid` uses a module counter: the render pass
 * order is identical between server and client for a hydrated tree, so the
 * generated ids match.
 */

let counter = 0;

/** Returns a unique id for the given prefix, e.g. `ui-tooltip-3`. */
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

/** Tab button element id derived from the consumer tab id. */
export function tabButtonId(tabId: string): string {
  return `ui-tab-${tabId}`;
}

/** Tab panel element id derived from the consumer tab id. */
export function tabPanelId(tabId: string): string {
  return `ui-tab-panel-${tabId}`;
}

/** Dialog title element id derived from the dialog id. */
export function dialogTitleId(dialogId: string): string {
  return `ui-dialog-title-${dialogId}`;
}
