# Bug Report

Bugs discovered during development and how they were resolved.

---

## Bug 1: AI firing at duplicate coordinates

**Issue**
The AI occasionally targeted the same cell twice, wasting its turn and producing confusing feedback.

**Cause**
In hunt mode, adjacent cells were added to the target queue without checking whether they had already been fired upon. When multiple hits occurred near each other, the same neighbor could be queued multiple times.

**Fix**
A fired-coordinates object (`aiFired`) was added to track all AI shots. Before firing, the AI checks this object. The hunt queue also filters out already-fired cells before selecting a target, and duplicate entries are prevented when adding neighbors to the queue.

---

## Bug 2: Ripple animation stacking on re-rendered cells

**Issue**
When the AI board was re-rendered after a ship was sunk, miss cells would briefly replay their ripple animation, causing a visual flicker across the board.

**Cause**
Re-rendering a cell by reassigning its class list would re-trigger CSS animations. The `miss` class with an expanding ripple animation was being reapplied on every render cycle.

**Fix**
Two distinct visual states were introduced: a `fresh` modifier class applied only at the moment of impact (triggering the ripple animation), and the base `miss` class which displays a static faint ring. The `fresh` class is removed after the animation completes via `setTimeout`, so subsequent renders do not replay the animation.

---

## Bug 3: Signal Archive replay desynchronization

**Issue**
The Signal Archive replay sometimes skipped moves or rendered them out of order, especially in games with many turns.

**Cause**
All replay moves were scheduled using `setTimeout` with a fixed interval multiplied by index. In long games (60+ moves), the interval became very short, and browser timer coalescing caused some timeouts to fire simultaneously or out of order.

**Fix**
The replay interval was clamped to a minimum of 150ms per move, with the maximum calculated dynamically based on total move count. This ensures the replay never exceeds approximately 10 seconds regardless of game length while maintaining sequential ordering.

---

## Bug 4: Hunt mode persisting after ship was sunk

**Issue**
After sinking an enemy ship, the AI sometimes continued in hunt mode, firing at cells adjacent to the already-sunk ship instead of returning to search mode.

**Cause**
The hunt queue was not cleaned up when a ship was sunk. Stale entries from the sunk ship's neighbors remained in the queue.

**Fix**
When a ship is sunk, the hunt queue is filtered to remove any entries that have already been fired upon. If the queue is empty after filtering, the AI mode resets to `search`.

---

## Bug 5: Screen transition causing click-through

**Issue**
During the fade transition between screens, clicks on the incoming screen could register on the outgoing screen underneath, causing unintended actions.

**Cause**
Both screens were briefly visible during the crossfade, and pointer events were not disabled on the outgoing screen.

**Fix**
The screen transition was restructured so the outgoing screen is fully hidden (via `classList.remove('visible')`) before the incoming screen becomes active. A 700ms delay between hiding and showing prevents overlap.
