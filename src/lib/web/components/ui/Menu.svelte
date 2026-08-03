<script lang="ts">
  import type { Component } from 'svelte';

  import { portal } from '$lib/web/actions/portal';

  import { uid } from './ids';

  export type MenuItem = {
    value: string;
    label: string;
    disabled?: boolean;
    destructive?: boolean;
  };

  let {
    items = [] as MenuItem[],
    label,
    icon = undefined as Component | undefined,
    onselect = undefined as ((value: string) => void) | undefined,
    align = 'start' as 'start' | 'end',
    class: className = '',
    ...rest
  }: {
    items?: MenuItem[];
    /** Accessible name of the trigger button. */
    label: string;
    icon?: Component;
    onselect?: (value: string) => void;
    align?: 'start' | 'end';
    class?: string;
    [key: string]: unknown;
  } = $props();

  const menuId = uid('ui-menu');
  let open = $state(false);
  let triggerRef = $state<HTMLButtonElement>();
  let wrapperRef = $state<HTMLDivElement>();
  let listRef = $state<HTMLDivElement>();
  let itemRefs: (HTMLButtonElement | null)[] = [];

  // Dynamic icon tag: derived so the variable name is a valid component tag.
  const TriggerIcon = $derived(icon);

  /**
   * Position the popup in fixed coordinates relative to the viewport and
   * clamp it so the whole menu stays visible even when the trigger sits near
   * the bottom or right edge of a scrollable container. The position and
   * visibility are applied imperatively in the same frame so the first item
   * can be focused immediately: a class-based visibility toggle would not
   * be painted yet and focus() on a hidden element is a no-op.
   */
  function positionMenu(): void {
    if (!triggerRef || !listRef) return;
    const rect = triggerRef.getBoundingClientRect();
    const width = listRef.offsetWidth;
    const height = listRef.offsetHeight;
    const gap = 8; // var(--space-2)
    const margin = 4;

    let left = align === 'end' ? rect.right - width : rect.left;
    let top = rect.bottom + gap;

    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));

    listRef.style.left = `${Math.round(left)}px`;
    listRef.style.top = `${Math.round(top)}px`;
    listRef.style.visibility = 'visible';
  }

  function focusFirstItem(): void {
    const first = itemRefs.find((el) => el && !el.disabled);
    first?.focus({ preventScroll: true });
  }

  function openMenu(): void {
    open = true;
    // Position after the list is in the DOM, before paint. The list is
    // hidden (visibility: hidden) until this pass so it never flashes at
    // the origin; positionMenu() also reveals it.
    requestAnimationFrame(() => {
      positionMenu();
      focusFirstItem();
    });
  }

  function toggle() {
    if (open) {
      close();
    } else {
      openMenu();
    }
  }

  function close() {
    if (!open) return;
    open = false;
    triggerRef?.focus();
  }

  function handleTriggerKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (!open) {
        e.preventDefault();
        openMenu();
      }
    }
  }

  function handleMenuKeydown(e: KeyboardEvent) {
    const enabled = itemRefs.filter((el) => el && !el.disabled);
    if (enabled.length === 0) return;
    const currentIdx = enabled.indexOf(document.activeElement as HTMLButtonElement);
    let next: HTMLButtonElement | null;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        next = enabled[(currentIdx + 1) % enabled.length];
        break;
      case 'ArrowUp':
        e.preventDefault();
        next = enabled[(currentIdx - 1 + enabled.length) % enabled.length];
        break;
      case 'Home':
        e.preventDefault();
        next = enabled[0];
        break;
      case 'End':
        e.preventDefault();
        next = enabled[enabled.length - 1];
        break;
      case 'Escape':
        e.preventDefault();
        close();
        return;
      default:
        return;
    }
    next?.focus({ preventScroll: true });
  }

  function activate(item: MenuItem) {
    onselect?.(item.value);
    close();
  }

  // Light dismiss: a pointer down outside the trigger and the portaled popup
  // closes the menu. The popup lives in the overlay host (see use:portal
  // below), so the wrapper alone cannot contain it.
  $effect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (
        e.target instanceof Node &&
        wrapperRef &&
        listRef &&
        !wrapperRef.contains(e.target) &&
        !listRef.contains(e.target)
      ) {
        close();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  });

  // Reposition when the viewport resizes while open; close on scroll so the
  // popup never drifts away from its trigger inside scrollable containers.
  $effect(() => {
    if (!open) return;
    function onResize() {
      if (open) {
        requestAnimationFrame(() => positionMenu());
      }
    }
    function onScroll(e: Event) {
      // Only react to scrolling containers that are not the popup itself.
      if (e.target instanceof Node && listRef && listRef.contains(e.target)) return;
      close();
    }
    window.addEventListener('resize', onResize);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('scroll', onScroll, true);
    };
  });
</script>

<div bind:this={wrapperRef} class="ui-menu ui-menu--align-{align} {className}" {...rest}>
  <button
    bind:this={triggerRef}
    type="button"
    class="ui-menu__trigger"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls={menuId}
    aria-label={icon ? label : undefined}
    onclick={toggle}
    onkeydown={handleTriggerKeydown}
  >
    {#if TriggerIcon}
      <TriggerIcon size={16} strokeWidth={1.5} aria-hidden="true" />
    {:else}
      {label}
    {/if}
  </button>
  {#if open}
    <div
      bind:this={listRef}
      id={menuId}
      role="menu"
      class="ui-menu__list"
      tabindex="-1"
      use:portal
      onkeydown={handleMenuKeydown}
    >
      {#each items as item, i (item.value)}
        <button
          type="button"
          role="menuitem"
          class="ui-menu__item"
          class:ui-menu__item--destructive={item.destructive}
          class:ui-menu__item--disabled={item.disabled}
          tabindex="-1"
          data-value={item.value}
          bind:this={itemRefs[i]}
          disabled={item.disabled}
          onclick={() => activate(item)}
        >
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .ui-menu {
    position: relative;
    display: inline-block;
  }

  .ui-menu__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 0 var(--space-2);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-secondary);
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-family: inherit;
    cursor: pointer;
  }

  .ui-menu__trigger:hover {
    background: var(--surface-tertiary);
  }

  .ui-menu__trigger:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: 2px;
  }

  /* Fixed positioning: the popup is placed relative to the viewport and
     clamped inside it, so it stays fully visible even when the trigger sits
     near the bottom edge of a scrollable container. Hidden until the first
     position pass (imperative) to avoid a flash at the origin. */
  .ui-menu__list {
    position: fixed;
    z-index: var(--z-dropdown);
    display: flex;
    flex-direction: column;
    min-width: 160px;
    padding: var(--space-1);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-elevated);
    box-shadow: var(--shadow-md);
    visibility: hidden;
  }

  .ui-menu__item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-primary);
    font-size: var(--text-sm);
    font-family: inherit;
    text-align: left;
    cursor: pointer;
  }

  .ui-menu__item:hover:not(:disabled) {
    background: var(--state-hover);
  }

  .ui-menu__item:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: -2px;
  }

  .ui-menu__item--destructive {
    color: var(--color-error);
  }

  .ui-menu__item--disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
