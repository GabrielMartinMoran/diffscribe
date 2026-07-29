<script lang="ts">
  let {
    visible = false,
    onClose = undefined as (() => void) | undefined,
    label = 'Close panel',
  }: {
    visible?: boolean;
    onClose?: () => void;
    label?: string;
  } = $props();
</script>

{#if visible}
  <div
    data-testid="mobile-backdrop"
    class="mobile-backdrop"
    role="presentation"
    aria-label={label}
    onclick={onClose}
  ></div>
{/if}

<style>
  .mobile-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: var(--z-overlay, 300);
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mobile-backdrop {
      animation: none;
    }
  }
</style>
