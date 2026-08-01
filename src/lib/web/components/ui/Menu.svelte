<script lang="ts">
  import type { Component } from 'svelte';

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
  let itemRefs: (HTMLButtonElement | null)[] = [];

  // Dynamic icon tag: derived so the variable name is a valid component tag.
  const TriggerIcon = $derived(icon);

  function toggle() {
    if (open) {
      close();
    } else {
      open = true;
      requestAnimationFrame(() => {
        const first = itemRefs.find((el) => el && !el.disabled);
        first?.focus();
      });
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
        open = true;
        requestAnimationFrame(() => {
          itemRefs.find((el) => el && !el.disabled)?.focus();
        });
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
    next?.focus();
  }

  function activate(item: MenuItem) {
    onselect?.(item.value);
    close();
  }

  // Light dismiss: click outside the wrapper closes the menu.
  $effect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapperRef && e.target instanceof Node && !wrapperRef.contains(e.target)) {
        close();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
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
    <div id={menuId} role="menu" class="ui-menu__list" tabindex="-1" onkeydown={handleMenuKeydown}>
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

  .ui-menu__list {
    position: absolute;
    top: calc(100% + var(--space-2));
    z-index: var(--z-dropdown);
    display: flex;
    flex-direction: column;
    min-width: 160px;
    padding: var(--space-1);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-elevated);
    box-shadow: var(--shadow-md);
  }

  .ui-menu--align-start .ui-menu__list {
    left: 0;
  }

  .ui-menu--align-end .ui-menu__list {
    right: 0;
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
