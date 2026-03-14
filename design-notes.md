# Design Notes

## Design Philosophy

The goal of this project was to build a Battleship implementation that emphasizes atmosphere and player interpretation rather than visible mechanics.

Traditional Battleship games expose ship positions and use bright arcade visuals. This version instead frames the game as interpreting signals in fog.

The player never directly sees enemy ships — only the consequences of attacks.

This approach encourages pattern recognition and mirrors how engineers interpret signals in complex systems.

## Narrative Frame

The game is presented as a quiet encounter between two fleets in heavy ocean fog. All feedback is delivered through narrative language rather than generic game labels.

- Misses feel like uncertainty: *"The torpedo disappears beneath the waves."*
- Hits feel like discovery: *"A signal fractures the silence."*
- Sunk ships feel like loss: *"Something large slips beneath the water."*

This language creates emotional weight in what is otherwise a probability game.

## Memory of the Sea

Every strike leaves a trace on the ocean surface. Misses create ripples that fade over time but never fully disappear. Hits leave darker, persistent scars.

As the game progresses, the board becomes a visual history of every decision — a map of memory. This mechanic serves two purposes:

1. It helps the player visually identify patterns and clusters.
2. It creates an emotional arc: the empty ocean at the start contrasts with the scarred water at the end.

Each cell stores a memory intensity value that decays by 3% per turn, giving older marks a ghostly quality.

## AI Behavior Mirroring

The AI tracks where the player fires most often using a shot heatmap. After a threshold of turns, it begins biasing its own shots toward similar areas on the player's board.

This creates the illusion that the AI is studying the player's behavior. The player may notice the AI becoming "smarter" mid-game, but the underlying mechanism is a simple weighted probability adjustment — not machine learning.

The narrative reinforces this with messages like:
- *"The enemy seems to be studying your signals."*
- *"Your search pattern is no longer private."*

## Signal Archive

At the end of each game, the battle replays as signals appearing on a single grid. Player and enemy moves are distinguished by subtle visual differences. The replay transforms a win/loss moment into a reflective one.

This mirrors the concept of observability in software systems — looking at a system's history to understand what happened.

## Visual Design Decisions

- **Color palette**: Deep navy, muted ocean blues, soft white typography, subtle red bloom for hits. No bright arcade colors.
- **Typography**: Cormorant Garamond for narrative text (literary feel), IBM Plex Mono for system/UI text (engineering feel).
- **Animations**: Water ripples for misses, slow bloom for hits, ink bleed for sunk ships. No loud explosions.
- **Sonar sweep**: A faint horizontal line sweeps the enemy grid during the AI's turn, suggesting active scanning.

## Influence

The tone and design are inspired by the fictional game *Ichigo* from Gabrielle Zevin's *Tomorrow, and Tomorrow, and Tomorrow* — a game that values atmosphere, restraint, and emotional resonance over spectacle.
