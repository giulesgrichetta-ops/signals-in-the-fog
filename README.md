# Signals in the Fog

A narrative reinterpretation of the classic Battleship game.

Instead of visible ships, players search for signals beneath the ocean surface, engaging in a quiet battle against an AI fleet hidden in the fog.

Inspired by minimalist narrative game design such as the fictional game *Ichigo* from *Tomorrow, and Tomorrow, and Tomorrow*.

## Live Game

[Play Signals in the Fog](https://yourusername.github.io/signals-in-the-fog)

## Core Mechanics

The game uses traditional Battleship rules:

- 10x10 grid
- Five ships (Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2)
- Turn-based attacks
- AI opponent

### Additional Design Layers

- **Memory of the Sea** — past moves leave faint visual traces that slowly fade but never fully disappear. The board becomes a map of every decision.
- **Signal Interpretation** — players infer ship positions from subtle patterns in the water rather than seeing ships directly.
- **AI Behavior Mirroring** — the AI quietly observes the player's shot distribution and biases its own attacks toward mirrored areas, creating the illusion of adaptation.
- **Signal Archive** — at the end of each match, the entire battle replays as signals appearing across the ocean, transforming the game into a reflective experience.

## AI Behavior

The AI uses two core strategies:

### Search Mode

Randomized targeting across the grid with a slight checkerboard preference for efficiency.

### Hunt Mode

When a hit occurs, adjacent cells are prioritized. The AI continues hunting until the ship is sunk, then returns to search mode.

### Mirror Bias

After a threshold of turns, the AI begins to slightly bias its targeting toward areas where the player frequently fires. This creates the feeling that the AI is learning without implementing real machine learning.

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript

No frameworks were used in order to keep the implementation transparent and readable.

## Running Locally

Clone the repository and open `index.html` in any modern browser:

```bash
git clone https://github.com/yourusername/signals-in-the-fog.git
cd signals-in-the-fog
open index.html
```

No build step or server required.

## Project Structure

```
signals-in-the-fog/
├── index.html          # Game markup and screens
├── style.css           # Atmospheric styling and animations
├── script.js           # Game logic, AI, and replay system
├── docs/
│   ├── design-notes.md # Design philosophy and decisions
│   └── bug-report.md   # Bugs discovered and fixes applied
└── README.md
```

## Design Philosophy

The goal was to build a Battleship implementation that emphasizes atmosphere and player interpretation rather than visible mechanics. The player never directly sees enemy ships — only the consequences of attacks. For more detail, see [docs/design-notes.md](docs/design-notes.md).
