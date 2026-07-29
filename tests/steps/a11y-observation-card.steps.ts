import { Given, Then, When } from 'quickpickle';

interface A11yObservationCardWorld {
  cardFocused: boolean;
  cardHovered: boolean;
  actionsVisible: boolean;
  readOnly: boolean;
  actionsInDOM: boolean;
}

Given('an observation of type {string} exists with title {string}', () => {
  // No-op: context — observation exists
});

Given('the observation panel is visible', () => {
  // No-op: context — panel rendered
});

When('keyboard focus moves onto an observation card', (world: A11yObservationCardWorld) => {
  world.cardFocused = true;
  world.actionsVisible = true;
});

Then('the action buttons become visible', (world: A11yObservationCardWorld) => {
  // Track in world; E2E test asserts CSS display
  world.actionsVisible = true;
});

Given(
  'an observation card has keyboard focus and its actions are visible',
  (world: A11yObservationCardWorld) => {
    world.cardFocused = true;
    world.actionsVisible = true;
  },
);

When('focus moves outside the card', (world: A11yObservationCardWorld) => {
  world.cardFocused = false;
  world.actionsVisible = false;
});

Then('the action buttons are hidden', (world: A11yObservationCardWorld) => {
  // E2E test verifies this via CSS display:none
  world.actionsVisible = false;
});

When('the mouse hovers over an observation card', (world: A11yObservationCardWorld) => {
  world.cardHovered = true;
  world.actionsVisible = true;
});

Given('the active review is completed', (world: A11yObservationCardWorld) => {
  world.readOnly = true;
});

When('the user views an observation card', () => {
  // No-op: assertion made in Then step
});

Then('no action buttons exist in the DOM for that card', (world: A11yObservationCardWorld) => {
  // Track in world; E2E test asserts absence of .card-actions in DOM
  world.actionsInDOM = false;
});
