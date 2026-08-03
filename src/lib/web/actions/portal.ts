/**
 * Portal action: moves an element into the in-mount overlay host declared by
 * the root layout (`[data-overlay-host]`) and restores it to its original
 * position when the action is destroyed.
 *
 * Popups that stay inside their mount point can be clipped by ancestor
 * `overflow` containers or trapped under later siblings by an ancestor
 * stacking context (for example `opacity < 1` on an invalid workspace item).
 * Portaling to the in-mount host fixes both without appending to
 * `document.body`, so the popup stays inside the Svelte app root.
 *
 * The host must not apply `transform`, `filter`, or `contain`, which would
 * turn fixed-position descendants into absolute-positioned ones.
 */
export function portal(node: HTMLElement): { destroy(): void } {
  const host = document.querySelector('[data-overlay-host]');
  if (!host) return { destroy: () => undefined };

  const parent = node.parentNode;
  const nextSibling = node.nextSibling;

  host.appendChild(node);

  return {
    destroy() {
      // Restore the node to its original slot only when the host itself is
      // being torn down. During a normal Svelte teardown of the popup block,
      // Svelte removes the node itself; re-inserting it here would leak the
      // element back into the DOM (the overlay host never unmounts while the
      // app is alive, so the original slot is still the right one only when
      // the host is going away).
      if (!document.contains(host)) {
        parent?.insertBefore(node, nextSibling);
      }
    },
  };
}
