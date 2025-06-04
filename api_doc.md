# Snake and Ladders Game - API Documentation

## Project Overview

This is a real-time multiplayer Snake and Ladders game server built with Node.js, Express.js, and Socket.IO. The server features AI-powered board generation using Google's Gemini AI to create dynamic and strategic game boards.

## Base URL

```
http://localhost:3001
```

## Technology Stack

- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.IO
- **AI Integration**: Google Generative AI (Gemini 2.0 Flash)
- **Other Dependencies**: CORS, dotenv

## Game Features

- **Real-time Multiplayer**: Up to 2 players per game
- **AI-Generated Boards**: Dynamic board creation with adjustable difficulty
- **Multiple Difficulty Levels**: Easy, Moderate, Hard
- **Auto-matchmaking**: Queue system for finding opponents
- **Game State Management**: Persistent game sessions with cleanup

---

## Socket Events

### Client to Server Events

#### `join-queue`

Join the matchmaking queue to find an opponent.

**Parameters:**

```javascript
{
  "name": "string",           // Player display name
  "difficulty": "string"      // "easy" | "moderate" | "hard"
}
```

**Response Events:**

- `waiting-for-opponent` - Waiting for another player
- `game-started` - Game has been created and started

---

#### `roll-dice`

Roll the dice for your turn (only when it's your turn).

**Parameters:** None

**Response Events:**

- `game-update` - Updated game state after move
- `not-your-turn` - Error when trying to roll out of turn

---

#### `reset-game`

Reset the current game to initial state.

**Parameters:** None

**Response Events:**

- `game-reset` - Game has been reset successfully

---

#### `leave-game`

Leave the current game.

**Parameters:** None

**Response Events:**

- `player-disconnected` - Notification to other players

---

### Server to Client Events

#### `game-started`

Emitted when a game begins between two players.

**Data Structure:**

```javascript
{
  "gameId": "string",                    // Unique game identifier
  "players": {
    "playerId1": {
      "id": "string",
      "name": "string",
      "position": 0,
      "playerNumber": 1
    },
    "playerId2": {
      "id": "string",
      "name": "string",
      "position": 0,
      "playerNumber": 2
    }
  },
  "currentPlayer": "string",             // ID of player whose turn it is
  "yourPlayerId": "string",              // This client's player ID
  "difficulty": "string",                // Game difficulty level
  "board": {
    "snakes": {
      "position": "lowerPosition"        // Snake head -> tail mapping
    },
    "ladders": {
      "position": "higherPosition"       // Ladder bottom -> top mapping
    }
  }
}
```

---

#### `game-update`

Emitted after each dice roll with updated game state.

**Data Structure:**

```javascript
{
  "players": {
    "playerId": {
      "id": "string",
      "position": "number",              // Current board position (0-100)
      "playerNumber": "number"
    }
  },
  "currentPlayer": "string",             // Next player's turn
  "diceValue": "number",                 // Value rolled (1-6)
  "gameStatus": "string",                // "playing" | "won"
  "winner": "string|null",               // Winner's player ID if game ended
  "extraTurn": "boolean",                // True if player gets another turn (rolled 6)
  "playersAffected": ["string"],         // IDs of players sent back to position 1
  "lastMove": {
    "playerId": "string",
    "diceValue": "number",
    "newPosition": "number",
    "extraTurn": "boolean"
  }
}
```

---

#### `waiting-for-opponent`

Emitted when player joins queue but no opponent is available.

**Data Structure:** Empty object `{}`

---

#### `game-reset`

Emitted when game is reset to initial state.

**Data Structure:**

```javascript
{
  "players": {
    "playerId": {
      "id": "string",
      "position": 0,                     // All players back to start
      "playerNumber": "number"
    }
  },
  "currentPlayer": "string",             // First player starts
  "gameStatus": "playing"
}
```

---

#### `player-disconnected`

Emitted when a player leaves or disconnects.

**Data Structure:**

```javascript
{
  "disconnectedPlayerId": "string"       // ID of the player who left
}
```

---

#### `not-your-turn`

Error event when player tries to roll dice out of turn.

**Data Structure:** Empty object `{}`

---

## Game Rules & Logic

### Board Layout

- **Size**: 10x10 grid (positions 1-100)
- **Start**: Position 0 (before square 1)
- **Goal**: Reach position 100 exactly
- **Bounce Rule**: If roll exceeds 100, player bounces back

### Movement Rules

1. **Dice Roll**: Random value 1-6
2. **Extra Turn**: Rolling 6 grants another turn
3. **Snake Encounters**: Land on snake head → slide to tail
4. **Ladder Encounters**: Land on ladder bottom → climb to top
5. **Player Collision**: Landing on occupied square sends other player to position 1
6. **Winning**: First player to reach position 100 wins

### Difficulty Levels

#### Easy Mode

- **Ladders**: 12 (more help for players)
- **Snakes**: 5 (fewer obstacles)
- **Description**: Beginner-friendly gameplay

#### Moderate Mode

- **Ladders**: 8
- **Snakes**: 8
- **Description**: Balanced, strategic gameplay

#### Hard Mode

- **Ladders**: 5 (limited help)
- **Snakes**: 12 (more obstacles)
- **Description**: Challenging, skill-based gameplay

---

## AI Board Generation

### Google Gemini Integration

The server uses Google's Gemini 2.0 Flash model to generate strategic board layouts.

**Features:**

- Dynamic snake and ladder placement
- Difficulty-appropriate positioning
- Strategic balance for engaging gameplay
- Fallback to algorithmic generation if AI fails

### Board Generation Process

1. **AI Generation**: Attempt to create board using Gemini AI
2. **Validation**: Verify board meets difficulty requirements
3. **Fallback**: Use algorithmic generation if AI fails
4. **Preset Backup**: Use pre-configured boards as last resort

---

## Error Handling

### Connection Errors

- **Timeout**: 24-hour game expiration
- **Disconnection**: 5-second grace period for reconnection
- **Queue Management**: Automatic cleanup of waiting players

### Game State Errors

- **Invalid Moves**: Prevented by server-side validation
- **Turn Management**: Strict turn-based enforcement
- **Board Generation**: Multiple fallback mechanisms

---

## Environment Configuration

### Required Environment Variables

```bash
GOOGLE_AI_API_KEY=your_gemini_api_key_here
NODE_ENV=development|production
PORT=3001
```

### Development Setup

```bash
npm install
npm start
```

---

## Game Flow Example

### 1. Player Connection

```javascript
// Client connects to server
const socket = io("http://localhost:3001");

// Join matchmaking queue
socket.emit("join-queue", {
  name: "Player1",
  difficulty: "moderate",
});
```

### 2. Game Start

```javascript
// Server finds opponent and starts game
socket.on("game-started", (gameData) => {
  console.log("Game started!", gameData.gameId);
  console.log("Your turn:", gameData.currentPlayer === gameData.yourPlayerId);
  console.log("Board:", gameData.board);
});
```

### 3. Gameplay Loop

```javascript
// Roll dice when it's your turn
socket.emit("roll-dice");

// Receive game updates
socket.on("game-update", (update) => {
  console.log("Dice rolled:", update.diceValue);
  console.log("New positions:", update.players);
  console.log("Next player:", update.currentPlayer);
  console.log("Game status:", update.gameStatus);
});
```

### 4. Game End

```javascript
socket.on("game-update", (update) => {
  if (update.gameStatus === "won") {
    console.log("Winner:", update.winner);
  }
});
```

---

## Server Management

### Game Cleanup

- **Automatic**: Games older than 24 hours are deleted
- **Manual**: Players leaving triggers cleanup
- **Optimization**: Hourly cleanup process

### Connection Management

- **Queue System**: Automatic matchmaking
- **Room Management**: Socket.IO rooms for game isolation
- **State Persistence**: In-memory game state storage

---

## Testing the API

### Using Socket.IO Client

```javascript
const io = require("socket.io-client");
const socket = io("http://localhost:3001");

// Test matchmaking
socket.emit("join-queue", { name: "TestPlayer", difficulty: "easy" });

// Test dice rolling
socket.emit("roll-dice");

// Listen for events
socket.on("game-started", console.log);
socket.on("game-update", console.log);
```

### Browser Testing

```html
<script src="/socket.io/socket.io.js"></script>
<script>
  const socket = io();
  socket.emit("join-queue", { name: "WebPlayer", difficulty: "moderate" });
</script>
```

---

## Performance Considerations

### Scalability

- **Memory Usage**: In-memory game storage (consider Redis for production)
- **Connection Limits**: Default Socket.IO limits apply
- **AI Rate Limits**: Google AI API quotas and rate limits

### Optimization

- **Game Cleanup**: Prevents memory leaks
- **Efficient Updates**: Minimal data in socket events
- **Fallback Systems**: Ensures consistent gameplay experience

---

## Troubleshooting

### Common Issues

1. **AI Board Generation Fails**: Check GOOGLE_AI_API_KEY
2. **Players Can't Connect**: Verify CORS configuration
3. **Games Don't Start**: Check queue system and player count
4. **Dice Rolls Ignored**: Verify turn management logic

### Debug Information

The server logs include:

- Player connections/disconnections
- Game creation and cleanup
- Board generation status
- Turn management events

---

_This documentation covers the Snake and Ladders multiplayer game server. For client-side implementation details, refer to your frontend documentation._
