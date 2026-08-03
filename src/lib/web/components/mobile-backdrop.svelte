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
    /* Below the overlays (sheet 300, drawer 301): the backdrop dims the page
       without intercepting clicks aimed at overlay controls. */
    z-index: var(--z-backdrop, 299);
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
