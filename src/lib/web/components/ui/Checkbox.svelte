<script lang="ts">
  let {
    checked = $bindable(false) as boolean,
    label = '',
    id = undefined as string | undefined,
    name = undefined as string | undefined,
    disabled = false,
    class: className = '',
    ...rest
  }: {
    checked?: boolean;
    label?: string;
    id?: string;
    name?: string;
    disabled?: boolean;
    class?: string;
    [key: string]: unknown;
  } = $props();
</script>

<label class="ui-checkbox {className}" class:ui-checkbox--disabled={disabled}>
  <input
    type="checkbox"
    {id}
    {name}
    {checked}
    {disabled}
    onchange={(e) => {
      checked = (e.currentTarget as HTMLInputElement).checked;
    }}
    {...rest}
  />
  {#if label}
    <span class="ui-checkbox__label">{label}</span>
  {/if}
</label>

<style>
  .ui-checkbox {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 24px;
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--text-primary);
  }

  .ui-checkbox input[type='checkbox'] {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .ui-checkbox input[type='checkbox']:focus-visible {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: 1px;
  }

  .ui-checkbox--disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ui-checkbox--disabled input[type='checkbox'] {
    cursor: not-allowed;
  }

  .ui-checkbox__label {
    line-height: var(--line-height-normal);
  }
</style>
