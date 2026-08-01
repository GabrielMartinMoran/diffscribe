<script lang="ts">
  type SelectOption = { value: string; label: string; disabled?: boolean };

  let {
    id = undefined as string | undefined,
    name = undefined as string | undefined,
    label = undefined as string | undefined,
    error = undefined as string | undefined,
    describedby = undefined as string | undefined,
    value = $bindable('') as string,
    options = undefined as SelectOption[] | undefined,
    disabled = false,
    class: className = '',
    children,
    ...rest
  }: {
    id?: string;
    name?: string;
    label?: string;
    error?: string;
    describedby?: string;
    value?: string;
    options?: SelectOption[];
    disabled?: boolean;
    class?: string;
    children?: import('svelte').Snippet;
    [key: string]: unknown;
  } = $props();

  const resolvedId = $derived(id ?? (name ? `ui-select-${name}` : undefined));
  const errorId = $derived(resolvedId && error ? `${resolvedId}-error` : undefined);
  const ariaDescribedBy = $derived([describedby, errorId].filter(Boolean).join(' ') || undefined);
</script>

{#if label && resolvedId}
  <label class="ui-select__label" for={resolvedId}>{label}</label>
{/if}
<select
  id={resolvedId}
  {name}
  class="ui-select {className}"
  {value}
  {disabled}
  aria-invalid={error ? true : undefined}
  aria-describedby={ariaDescribedBy}
  onchange={(e) => {
    value = (e.currentTarget as HTMLSelectElement).value;
  }}
  {...rest}
>
  {#if options}
    {#each options as option (option.value)}
      <option value={option.value} disabled={option.disabled}>{option.label}</option>
    {/each}
  {:else}
    {@render children?.()}
  {/if}
</select>
{#if error && errorId}
  <p id={errorId} class="ui-select__error">{error}</p>
{/if}

<style>
  .ui-select {
    display: block;
    width: 100%;
    box-sizing: border-box;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    background: var(--surface-primary);
    color: var(--text-primary);
    font-size: var(--text-base);
    font-family: inherit;
    transition: border-color var(--duration-fast) var(--ease-default);
  }

  .ui-select:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: 1px;
  }

  .ui-select[aria-invalid='true'] {
    border-color: var(--state-error-border);
  }

  .ui-select:disabled {
    background: var(--state-disabled-bg);
    color: var(--state-disabled-text);
    cursor: not-allowed;
  }

  .ui-select__label {
    display: block;
    margin-bottom: var(--space-1);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .ui-select__error {
    margin-top: var(--space-1);
    font-size: var(--text-sm);
    color: var(--text-error);
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-select {
      transition: none;
    }
  }
</style>
