<script lang="ts">
  let {
    id = undefined as string | undefined,
    name = undefined as string | undefined,
    label = undefined as string | undefined,
    error = undefined as string | undefined,
    describedby = undefined as string | undefined,
    value = $bindable('') as string | number,
    type = 'text' as string,
    placeholder = undefined as string | undefined,
    disabled = false,
    class: className = '',
    ...rest
  }: {
    id?: string;
    name?: string;
    label?: string;
    error?: string;
    describedby?: string;
    value?: string | number;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    class?: string;
    [key: string]: unknown;
  } = $props();

  // Id invariant: explicit id wins; otherwise derive from the name so the
  // label/error association stays deterministic and SSR-safe.
  const resolvedId = $derived(id ?? (name ? `ui-input-${name}` : undefined));
  const errorId = $derived(resolvedId && error ? `${resolvedId}-error` : undefined);
  const ariaDescribedBy = $derived([describedby, errorId].filter(Boolean).join(' ') || undefined);
</script>

{#if label && resolvedId}
  <label class="ui-text-input__label" for={resolvedId}>{label}</label>
{/if}
<input
  id={resolvedId}
  {name}
  {type}
  class="ui-text-input {className}"
  {value}
  {placeholder}
  {disabled}
  aria-invalid={error ? true : undefined}
  aria-describedby={ariaDescribedBy}
  oninput={(e) => {
    value = (e.currentTarget as HTMLInputElement).value;
  }}
  {...rest}
/>
{#if error && errorId}
  <p id={errorId} class="ui-text-input__error">{error}</p>
{/if}

<style>
  .ui-text-input {
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

  .ui-text-input:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: 1px;
  }

  .ui-text-input[aria-invalid='true'] {
    border-color: var(--state-error-border);
  }

  .ui-text-input:disabled {
    background: var(--state-disabled-bg);
    color: var(--state-disabled-text);
    cursor: not-allowed;
  }

  .ui-text-input::placeholder {
    color: var(--text-tertiary);
  }

  .ui-text-input__label {
    display: block;
    margin-bottom: var(--space-1);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .ui-text-input__error {
    margin-top: var(--space-1);
    font-size: var(--text-sm);
    color: var(--text-error);
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-text-input {
      transition: none;
    }
  }
</style>
