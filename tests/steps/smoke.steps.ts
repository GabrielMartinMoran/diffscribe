import { Given, Then, When } from 'quickpickle';

interface SmokeWorld {
  a: number;
  b: number;
  result: number;
}

Given('tengo el numero {int}', (world: SmokeWorld, num: number) => {
  world.a = num;
});

When('le sumo {int}', (world: SmokeWorld, num: number) => {
  world.b = num;
  world.result = world.a + world.b;
});

Then('el resultado es {int}', (world: SmokeWorld, expected: number) => {
  if (world.result !== expected) {
    throw new Error(`Expected ${expected} but got ${world.result}`);
  }
});
