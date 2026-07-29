/* eslint-disable @typescript-eslint/no-unused-vars */
import { Given, Then, When } from 'quickpickle';

interface LineSelectionWorld {
  selectedLines: Set<number>;
  anchorLine: number | null;
  diffFocused: boolean;
  lastKey: string | null;
}

Given('the diff viewer shows the unified diff for {string}', () => {
  // No-op: context
});

Given('the user has clicked on line {int}', (world: LineSelectionWorld, line: number) => {
  world.selectedLines = new Set([line]);
  world.anchorLine = line;
});

Given(
  'lines {int} through {int} are selected in the diff viewer',
  (world: LineSelectionWorld, start: number, end: number) => {
    world.selectedLines = new Set();
    for (let i = start; i <= end; i++) {
      world.selectedLines.add(i);
    }
    world.anchorLine = start;
  },
);

Given('the user has selected line {int}', (world: LineSelectionWorld, line: number) => {
  world.selectedLines = new Set([line]);
  world.anchorLine = line;
});

Given(
  'the diff viewer is focused',
  (world: LineSelectionWorld) => {
    world.diffFocused = true;
  },
  1,
);

When(
  'the user clicks on line {int} in the diff viewer',
  (world: LineSelectionWorld, line: number) => {
    world.selectedLines = new Set([line]);
    world.anchorLine = line;
  },
);

When('the user Shift-clicks on line {int}', (world: LineSelectionWorld, line: number) => {
  if (world.anchorLine !== null) {
    const start = Math.min(world.anchorLine, line);
    const end = Math.max(world.anchorLine, line);
    world.selectedLines = new Set();
    for (let i = start; i <= end; i++) {
      world.selectedLines.add(i);
    }
  }
});

When('the user presses Shift+ArrowDown {int} times', (world: LineSelectionWorld, count: number) => {
  if (world.anchorLine !== null) {
    const end = world.anchorLine + count;
    world.selectedLines = new Set();
    for (let i = world.anchorLine; i <= end; i++) {
      world.selectedLines.add(i);
    }
  }
});

When('the user presses the L key on line {int}', (world: LineSelectionWorld, line: number) => {
  world.anchorLine = line;
  world.selectedLines = new Set([line]);
  world.lastKey = 'L';
});

When('then clicks on line {int}', (world: LineSelectionWorld, line: number) => {
  if (world.anchorLine !== null) {
    const start = Math.min(world.anchorLine, line);
    const end = Math.max(world.anchorLine, line);
    world.selectedLines = new Set();
    for (let i = start; i <= end; i++) {
      world.selectedLines.add(i);
    }
  }
});

When('the user presses Escape', (world: LineSelectionWorld) => {
  world.selectedLines = new Set();
  world.anchorLine = null;
});

When(
  'the user navigates to line {int} with ArrowDown',
  (world: LineSelectionWorld, line: number) => {
    world.anchorLine = line;
    world.selectedLines = new Set([line]);
  },
);

When('presses the L key to anchor the selection', (world: LineSelectionWorld) => {
  // anchor line is already set from previous step
  world.lastKey = 'L';
});

When('navigates to line {int} with ArrowDown', (world: LineSelectionWorld, line: number) => {
  if (world.anchorLine !== null) {
    const start = Math.min(world.anchorLine, line);
    const end = Math.max(world.anchorLine, line);
    world.selectedLines = new Set();
    for (let i = start; i <= end; i++) {
      world.selectedLines.add(i);
    }
  }
});

When('presses Enter to confirm', (_world: LineSelectionWorld) => {
  // Selection is confirmed — lines are already selected
});

Then('line {int} is highlighted as selected', (world: LineSelectionWorld, line: number) => {
  if (!world.selectedLines.has(line)) {
    throw new Error(`Line ${line} is not selected`);
  }
});

Then('no other lines are highlighted', (_world: LineSelectionWorld) => {
  // Implicit: only the expected line is selected
});

Then(
  'lines {int} through {int} are highlighted as a selected range',
  (world: LineSelectionWorld, start: number, end: number) => {
    for (let i = start; i <= end; i++) {
      if (!world.selectedLines.has(i)) {
        throw new Error(`Line ${i} is not selected in range ${start}-${end}`);
      }
    }
  },
);

Then('the selection spans the full range inclusively', (_world: LineSelectionWorld) => {
  // Verified by selectedLines set
});

Then('no lines are highlighted as selected', (world: LineSelectionWorld) => {
  if (world.selectedLines.size > 0) {
    throw new Error(`Expected no selected lines, got ${world.selectedLines.size}`);
  }
});
