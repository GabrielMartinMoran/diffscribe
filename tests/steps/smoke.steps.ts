import { Given, Then, When } from 'quickpickle';

interface SmokeWorld {
  a: number;
  b: number;
  result: number;
}

Given('I have the number {int}', (world: SmokeWorld, num: number) => {
  world.a = num;
});

When('I add {int}', (world: SmokeWorld, num: number) => {
  world.b = num;
  world.result = world.a + world.b;
});

Then('the result is {int}', (world: SmokeWorld, expected: number) => {
  if (world.result !== expected) {
    throw new Error(`Expected ${expected} but got ${world.result}`);
  }
});
