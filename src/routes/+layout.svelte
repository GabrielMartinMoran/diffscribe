<script>
  import '../app.css';

  let { children } = $props();
</script>

<svelte:head>
  <title>DiffScribe</title>
</svelte:head>

<!-- In-mount overlay host: popups (menus) are portaled here so they escape
     ancestor stacking contexts and overflow clipping without using
     document.body (see src/lib/web/actions/portal.ts). -->
<div data-overlay-host></div>

{@render children()}
