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

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`); // Handle player joining queue
  socket.on("join-queue", async (playerData) => {
    console.log(`Player ${socket.id} joined queue`);

    // Remove player from any existing game first
    if (socket.gameId) {
      const oldGame = games.get(socket.gameId);
      if (oldGame) {
        // Notify other players in the old game
        socket.to(socket.gameId).emit("player-disconnected", {
          disconnectedPlayerId: socket.id,
        });

        // Remove this player from the old game
        delete oldGame.players[socket.id];

        // If no players left, delete the game
        if (Object.keys(oldGame.players).length === 0) {
          games.delete(socket.gameId);
        }
      }
      // Clear the game ID and leave the room
      const oldGameId = socket.gameId;
      socket.gameId = null;
      if (oldGameId) {
        socket.leave(oldGameId);
      }
    }

    // Remove from waiting players if already there
    const existingIndex = waitingPlayers.findIndex((p) => p.id === socket.id);
    if (existingIndex !== -1) {
      waitingPlayers.splice(existingIndex, 1);
    } // Add player to waiting list
    waitingPlayers.push({
      id: socket.id,
      name: playerData.name || `Player ${socket.id.substr(0, 6)}`,
      difficulty: playerData.difficulty || "moderate",
      joinedAt: new Date(),
    }); // If we have 2 or more players, start a game
    if (waitingPlayers.length >= 2) {
      const player1 = waitingPlayers.shift();
      const player2 = waitingPlayers.shift();

      // Use player1's difficulty preference (first in queue gets preference)
      const difficulty = player1.difficulty || "moderate";
      console.log(
        `🎯 Starting game with ${difficulty} difficulty (Player 1's preference)`
      );

      const game = await createGame(player1.id, player2.id, difficulty);

      // Join both players to the game room
      io.sockets.sockets.get(player1.id)?.join(game.id);
      io.sockets.sockets.get(player2.id)?.join(game.id);

      // Store game ID in socket data
      io.sockets.sockets.get(player1.id).gameId = game.id;
      io.sockets.sockets.get(player2.id).gameId = game.id; // Notify both players that game has started
      io.to(game.id).emit("game-started", {
        gameId: game.id,
        players: {
          [player1.id]: { ...game.players[player1.id], name: player1.name },
          [player2.id]: { ...game.players[player2.id], name: player2.name },
        },
        currentPlayer: game.currentPlayer,
        yourPlayerId: player1.id,
        difficulty: game.difficulty,
        board: game.board, // Include AI-generated board
      });

      io.to(player2.id).emit("game-started", {
        gameId: game.id,
        players: {
          [player1.id]: { ...game.players[player1.id], name: player1.name },
          [player2.id]: { ...game.players[player2.id], name: player2.name },
        },
        currentPlayer: game.currentPlayer,
        yourPlayerId: player2.id,
        difficulty: game.difficulty,
        board: game.board, // Include AI-generated board
      });

      console.log(
        `Game started: ${game.id} between ${player1.id} and ${player2.id}`
      );
    } else {
      socket.emit("waiting-for-opponent");
    }
  });

  // Handle dice roll
  socket.on("roll-dice", () => {
    const gameId = socket.gameId;
    const game = games.get(gameId);

    if (!game || game.gameStatus === "won") {
      return;
    }
    if (game.currentPlayer !== socket.id) {
      socket.emit("not-your-turn");
      return;
    }

    const diceValue = Math.floor(Math.random() * 6) + 1;
    game.lastDiceValue = diceValue;

    // Move player and get game result
    const gameResult = movePlayer(game, socket.id, diceValue);

    // Check if any player was sent back to position 1
    const playersAffected = [];
    Object.values(game.players).forEach((player) => {
      if (player.position === 1 && player.id !== socket.id) {
        playersAffected.push(player.id);
      }
    });

    // Emit game state to all players in the game
    io.to(gameId).emit("game-update", {
      players: game.players,
      currentPlayer: game.currentPlayer,
      diceValue: diceValue,
      gameStatus: game.gameStatus,
      winner: game.winner,
      extraTurn: gameResult.extraTurn,
      playersAffected: playersAffected,
      lastMove: {
        playerId: socket.id,
        diceValue: diceValue,
        newPosition: game.players[socket.id].position,
        extraTurn: gameResult.extraTurn,
      },
    });
  });
  // Handle game reset
  socket.on("reset-game", () => {
    const gameId = socket.gameId;
    const game = games.get(gameId);

    if (!game) return;

    // Reset all player positions
    Object.keys(game.players).forEach((playerId) => {
      game.players[playerId].position = 0;
    });

    // Reset game state
    game.gameStatus = "playing";
    game.winner = null;
    game.lastDiceValue = 1;

    // Set first player as current
    const playerIds = Object.keys(game.players);
    game.currentPlayer = playerIds[0];

    // Notify all players
    io.to(gameId).emit("game-reset", {
      players: game.players,
      currentPlayer: game.currentPlayer,
      gameStatus: game.gameStatus,
    });
  });

  // Handle player leaving game
  socket.on("leave-game", () => {
    const gameId = socket.gameId;
    if (gameId) {
      const game = games.get(gameId);
      if (game) {
        // Notify other players about leaving
        socket.to(gameId).emit("player-disconnected", {
          disconnectedPlayerId: socket.id,
        });

        // Remove player from game
        delete game.players[socket.id];

        // If no players left, delete the game
        if (Object.keys(game.players).length === 0) {
          games.delete(gameId);
        }
      }

      // Clear socket game data
      socket.gameId = null;
      socket.leave(gameId);
    }

    console.log(`Player ${socket.id} left the game`);
  });
  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);

    // Remove from waiting players
    const waitingIndex = waitingPlayers.findIndex((p) => p.id === socket.id);
    if (waitingIndex !== -1) {
      waitingPlayers.splice(waitingIndex, 1);
      console.log(`Removed ${socket.id} from waiting queue`);
    }

    // Handle game disconnection
    const gameId = socket.gameId;
    if (gameId) {
      const game = games.get(gameId);
      if (game) {
        // Notify other players about disconnection
        socket.to(gameId).emit("player-disconnected", {
          disconnectedPlayerId: socket.id,
        });

        // Remove player from game
        delete game.players[socket.id];

        // If no players left or only one player left, delete the game after delay
        if (Object.keys(game.players).length <= 1) {
          setTimeout(() => {
            games.delete(gameId);
            console.log(`Deleted game ${gameId} due to insufficient players`);
          }, 5000); // 5 seconds grace period for quick reconnections
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
if(process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

setInterval(() => {
  const now = new Date();
  for (const [gameId, game] of games) {
    const gameAge = now - game.createdAt;
    if (gameAge > 24 * 60 * 60 * 1000) {
      // 24 hours
      games.delete(gameId);
    }
  }
}, 60 * 60 * 1000); // Check every hour
