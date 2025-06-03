const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const BoardGenerator = require("./boardGenerator");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Initialize AI Board Generator
const boardGenerator = new BoardGenerator();

// Game state
const games = new Map();
const waitingPlayers = [];

// Default board (fallback) - will be replaced by AI-generated boards
const defaultSnakes = {
  16: 6,
  47: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78,
};

const defaultLadders = {
  1: 38,
  4: 14,
  9: 21,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100,
};

async function createGame(player1Id, player2Id, difficulty = "moderate") {
  const gameId = `game_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  // Generate AI-powered board
  let board;
  try {
    console.log(`🤖 Generating ${difficulty} difficulty board with AI...`);
    board = await boardGenerator.generateBoard(difficulty);
  } catch (error) {
    console.error("Board generation failed, using preset:", error);
    const presets = boardGenerator.getPresetBoards();
    board = presets[difficulty] || presets.moderate;
  }

  const game = {
    id: gameId,
    players: {
      [player1Id]: { id: player1Id, position: 0, playerNumber: 1 },
      [player2Id]: { id: player2Id, position: 0, playerNumber: 2 },
    },
    currentPlayer: player1Id,
    gameStatus: "playing",
    winner: null,
    lastDiceValue: 1,
    createdAt: new Date(),
    difficulty: difficulty,
    board: board, // Store the AI-generated board
    snakes: board.snakes,
    ladders: board.ladders,
  };

  games.set(gameId, game);
  console.log(`✅ Game ${gameId} created with ${difficulty} difficulty:`, {
    ladders: Object.keys(board.ladders).length,
    snakes: Object.keys(board.snakes).length,
  });
  return game;
}

function movePlayer(game, playerId, diceRoll) {
  const player = game.players[playerId];
  let newPosition = player.position + diceRoll;

  // Check if the move would exceed 100 - bounce back logic
  if (newPosition > 100) {
    const overflow = newPosition - 100;
    newPosition = 100 - overflow; // Bounce back from 100
  }

  // Use game-specific board (AI-generated) instead of global board
  const gameSnakes = game.snakes || defaultSnakes;
  const gameLadders = game.ladders || defaultLadders;

  // Check for snakes and ladders
  if (gameSnakes[newPosition]) {
    newPosition = gameSnakes[newPosition];
  } else if (gameLadders[newPosition]) {
    newPosition = gameLadders[newPosition];
  }

  // Check if another player is already on this position
  const otherPlayers = Object.values(game.players).filter(
    (p) => p.id !== playerId
  );
  const playerOnSamePosition = otherPlayers.find(
    (p) => p.position === newPosition
  );

  if (playerOnSamePosition && newPosition !== 0) {
    // Send the other player back to position 1
    playerOnSamePosition.position = 1;
  }

  // Update player position
  player.position = newPosition;
  // Check for winner
  if (newPosition === 100) {
    game.gameStatus = "won";
    game.winner = playerId;
    return { ...game, extraTurn: false }; // No extra turn when winning
  }

  // Check if player rolled a 6 for extra turn
  const extraTurn = diceRoll === 6;

  if (!extraTurn) {
    // Switch to next player only if no extra turn
    const playerIds = Object.keys(game.players);
    const currentIndex = playerIds.indexOf(playerId);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    game.currentPlayer = playerIds[nextIndex];
  }

  return { ...game, extraTurn };
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
