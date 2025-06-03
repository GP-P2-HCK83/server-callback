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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
