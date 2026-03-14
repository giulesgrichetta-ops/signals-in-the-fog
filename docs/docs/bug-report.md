Bug Report
Bugs discovered during development and how they were resolved.

Bug 1: AI firing at duplicate coordinates
Issue The AI occasionally targeted the same cell twice, wasting its turn and producing confusing feedback.

Cause In hunt mode, adjacent cells were added to the target queue without checking whether they had already been fired upon. When multiple hits occurred near each other, the same neighbor could be queued multiple times.

Fix A Set of fired coordinates (aiFiredSet) was added to track all AI shots. Before firing, the AI checks this set. The hunt queue also filters out already-fired cells before selecting a target, and duplicate entries are prevented when adding neighbors to the queue.

Bug 2: Ripple animation stacking on re-rendered cells
Issue When the enemy board was re-rendered after memory decay, miss cells would briefly replay their ripple animation, causing a visual flicker across the board.

Cause Re-rendering a cell by reassigning its class list would re-trigger CSS animations. The initial miss class with an expanding ripple animation was being reapplied on every render cycle.

Fix Two distinct visual states were introduced: miss (with the initial ripple animation) applied only at the moment of impact, and miss-memory (with a static, fading ring) applied during subsequent renders. The memory state uses a CSS custom property (--memory-intensity) to control opacity without triggering animations.

Bug 3: Signal Archive replay desynchronization
Issue The Signal Archive replay sometimes skipped moves or rendered them out of order, especially in games with many turns.

Cause All replay moves were scheduled using setTimeout with a fixed interval multiplied by index. In long games (60+ moves), the interval became very short, and browser timer coalescing caused some timeouts to fire simultaneously or out of order.

Fix The replay interval was clamped to a minimum of 150ms per move, with the maximum calculated dynamically based on total move count. This ensures the replay never exceeds approximately 10 seconds regardless of game length while maintaining sequential ordering.

Bug 4: Hunt mode persisting after ship was sunk
Issue After sinking an enemy ship, the AI sometimes continued in hunt mode, firing at cells adjacent to the already-sunk ship instead of returning to search mode.

Cause The hunt queue was not cleaned up when a ship was sunk. Stale entries from the sunk ship's neighbors remained in the queue.

Fix When a ship is sunk, the hunt queue is filtered to remove any entries that have already been fired upon. If the queue is empty after filtering, the AI mode resets to search.

Bug 5: Ship placement preview not clearing on grid exit
Issue When the mouse left the placement grid, the preview highlight (green cells showing where a ship would be placed) remained visible.

Cause The mouseleave event was not bound to the placement grid, so preview cells were only cleared when hovering over a different cell.

Fix A mouseleave event listener was added to the placement grid element that explicitly removes preview and preview-invalid classes from all cells when the cursor exits the grid area.
