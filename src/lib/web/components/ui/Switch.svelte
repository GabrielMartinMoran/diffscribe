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

<label class="ui-switch {className}" class:ui-switch--disabled={disabled}>
  <input
    type="checkbox"
    role="switch"
    {id}
    {name}
    {checked}
    aria-checked={checked}
    {disabled}
    onchange={(e) => {
      checked = (e.currentTarget as HTMLInputElement).checked;
    }}
    {...rest}
  />
  <span class="ui-switch__track" aria-hidden="true"></span>
  {#if label}
    <span class="ui-switch__label">{label}</span>
  {/if}
</label>

<style>
  .ui-switch {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 24px;
    cursor: pointer;
    font-size: var(--text-sm);
    color: var(--text-primary);
  }

  .ui-switch input[role='switch'] {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    padding: 0;
    border: 0;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    overflow: hidden;
    white-space: nowrap;
  }

  .ui-switch input[role='switch']:focus-visible + .ui-switch__track {
    outline: var(--focus-ring-offset) solid var(--focus-ring);
    outline-offset: 2px;
  }

  .ui-switch__track {
    position: relative;
    width: 36px;
    height: 20px;
    border-radius: var(--radius-full);
    background: var(--state-disabled-bg);
    border: 1px solid var(--border-default);
    transition: background var(--duration-fast) var(--ease-default);
  }

  .ui-switch__track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: var(--radius-full);
    background: var(--text-secondary);
    transition: transform var(--duration-fast) var(--ease-default);
  }

  .ui-switch input[role='switch']:checked + .ui-switch__track {
    background: var(--accent);
    border-color: var(--accent);
  }

  .ui-switch input[role='switch']:checked + .ui-switch__track::after {
    transform: translateX(16px);
    background: var(--text-inverse);
  }

  .ui-switch--disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .ui-switch--disabled input[role='switch'] {
    cursor: not-allowed;
  }

  .ui-switch__label {
    line-height: var(--line-height-normal);
  }

  @media (prefers-reduced-motion: reduce) {
    .ui-switch__track,
    .ui-switch__track::after {
      transition: none;
    }
  }
</style>
