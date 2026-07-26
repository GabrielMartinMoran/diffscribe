<script>
  import '../app.css';

  let { children } = $props();
</script>

<svelte:head>
  <title>DiffScribe</title>
</svelte:head>

{@render children()}
