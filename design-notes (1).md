# Design Notes

## Design Philosophy

The goal of this project was to build a Battleship implementation that emphasizes atmosphere and player interpretation rather than visible mechanics, inspired by the fictional game *Ichigo* from Gabrielle Zevin's *Tomorrow, and Tomorrow, and Tomorrow*.

Traditional Battleship games expose ship positions and use bright arcade visuals. This version frames the game as a contemplative journey — Ichigo, a child departing Japan by boat, searching for signals beneath the waves.

The player never directly sees enemy ships — only the consequences of attacks.

## Ichigo as Player Character

The game opens with a cinematic scene: Ichigo standing at the bow of a small boat, departing Japan's shores. Behind him, mountains and a torii gate dissolve into mist. Ahead, only fog and water.

This framing transforms a simple grid game into a narrative experience. The player is not clicking cells — they are searching for meaning in an ocean of uncertainty.

## Visual Aesthetic: Ukiyo-e and Hokusai

The visual design draws directly from Japanese woodblock print traditions:

- **Color palette**: Deep indigo (sumi ink), muted ocean blues, washi paper whites, muted coral/vermillion for hits
- **Opening scene**: SVG illustration with Hokusai-style curling wave crests, moonlit sky, cherry blossom petals
- **Board cells**: Subtle ink-wash texture gradients, as if looking into water through an old print
- **Typography**: Cormorant Garamond for narrative text (literary feel), IBM Plex Mono for system/UI text

## Narrative Frame

All feedback uses literary language rather than generic game labels:

- Misses: *"The torpedo vanishes into the deep, finding nothing."*
- Hits: *"The ocean shudders. Ichigo has found something."*
- Sunk ships: *"A vessel breaks apart in the deep. The sea claims it."*
- AI attacks: *"Impact. The enemy has drawn blood from Ichigo's fleet."*

## Memory of the Sea

Every strike leaves a trace on the ocean surface. Misses create ink ripples that settle into faint rings. Hits leave deeper coral scars.

As the game progresses, the board becomes a visual history of every decision — a map of memory.

## AI Behavior Mirroring

The AI tracks where the player fires most often using a shot heatmap. After a threshold of turns, it begins biasing its own shots toward similar areas on the player's board.

The narrative reinforces this:
- *"The enemy seems to be studying Ichigo's patterns."*
- *"Your search pattern is no longer private. They are learning."*

## Signal Archive

At the end of each game, the battle replays as signals appearing on a single grid. The replay transforms a win/loss moment into a reflective one — like watching the memory of a battle from above.

## Influence

The tone, character, and aesthetic are inspired by *Ichigo: A Child of the Sea* from *Tomorrow, and Tomorrow, and Tomorrow* — a game about a child swept out to sea, navigating a world rendered in Hokusai's wave aesthetic, where death means nothing more than a chance to restart and play again.
