const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini AI (you'll need to set your API key)
const genAI = new GoogleGenerativeAI(
  process.env.GOOGLE_AI_API_KEY || "your-api-key-here"
);

class BoardGenerator {
  constructor() {
    this.model = genAI.getGenerativeModel({ model: "gemini-pro" });
  }

  /**
   * Generate a Snake and Ladders board with AI-powered positioning
   * @param {string} difficulty - 'easy', 'moderate', 'hard'
   * @returns {Promise<{snakes: Object, ladders: Object}>}
   */
  async generateBoard(difficulty = "moderate") {
    const difficultyConfig = this.getDifficultyConfig(difficulty);

    try {
      // Try AI generation first
      const aiBoard = await this.generateWithAI(difficultyConfig);
      if (aiBoard) {
        return aiBoard;
      } else {
        // Fallback to algorithmic generation
        return this.generateAlgorithmically(difficultyConfig);
      }
    } catch (error) {
      console.log(
        "AI generation failed, using algorithmic fallback:",
        error.message
      );
      return this.generateAlgorithmically(difficultyConfig);
    }
  }

  getDifficultyConfig(difficulty) {
    const configs = {
      easy: {
        ladders: 12,
        snakes: 5,
        description: "beginner-friendly with more ladders",
      },
      moderate: { ladders: 8, snakes: 8, description: "balanced gameplay" },
      hard: {
        ladders: 5,
        snakes: 12,
        description: "challenging with more snakes",
      },
    };
    return configs[difficulty] || configs.moderate;
  }

  async generateWithAI(config) {
    const prompt = `
Generate a Snake and Ladders board layout for ${config.description} difficulty.

Requirements:
- Board size: 10x10 (positions 1-100)
- ${config.ladders} ladders that help players climb up
- ${config.snakes} snakes that send players down
- Ladders should start from lower positions and end at higher positions
- Snakes should start from higher positions and end at lower positions
- No overlapping start/end positions
- Avoid positions 1 (start) and 100 (finish)
- Strategic placement for balanced gameplay

Return ONLY a valid JSON object in this exact format:
{
  "snakes": {
    "16": 6,
    "47": 26
  },
  "ladders": {
    "4": 14,
    "9": 21
  }
}

Make the positioning strategic and fun for ${config.description} gameplay.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const board = JSON.parse(jsonMatch[0]);

        // Validate the board
        if (this.validateBoard(board, config)) {
          console.log(`✅ AI-generated ${Object.keys(config)} board:`, board);
          return board;
        }
      }
      return null;
    } catch (error) {
      console.error("AI generation error:", error);
      return null;
    }
  }

  generateAlgorithmically(config) {
    console.log(
      `🎲 Generating ${config.ladders} ladders and ${config.snakes} snakes algorithmically...`
    );

    const usedPositions = new Set([1, 100]); // Reserve start and finish
    const snakes = {};
    const ladders = {};

    // Generate ladders first (they're more beneficial)
    for (let i = 0; i < config.ladders; i++) {
      let attempts = 0;
      while (attempts < 50) {
        const start = Math.floor(Math.random() * 70) + 2; // Positions 2-71
        const end = start + Math.floor(Math.random() * 25) + 10; // At least 10 positions up

        if (end <= 99 && !usedPositions.has(start) && !usedPositions.has(end)) {
          ladders[start] = end;
          usedPositions.add(start);
          usedPositions.add(end);
          break;
        }
        attempts++;
      }
    }

    // Generate snakes
    for (let i = 0; i < config.snakes; i++) {
      let attempts = 0;
      while (attempts < 50) {
        const start = Math.floor(Math.random() * 70) + 25; // Positions 25-94
        const end = Math.floor(Math.random() * (start - 10)) + 2; // At least 10 positions down

        if (end >= 2 && !usedPositions.has(start) && !usedPositions.has(end)) {
          snakes[start] = end;
          usedPositions.add(start);
          usedPositions.add(end);
          break;
        }
        attempts++;
      }
    }

    const board = { snakes, ladders };
    console.log(
      `✅ Generated board with ${Object.keys(ladders).length} ladders and ${
        Object.keys(snakes).length
      } snakes`
    );
    return board;
  }

  validateBoard(board, config) {
    if (!board.snakes || !board.ladders) return false;

    const snakeCount = Object.keys(board.snakes).length;
    const ladderCount = Object.keys(board.ladders).length;

    // Allow some flexibility in counts (±2)
    const snakeCountValid = Math.abs(snakeCount - config.snakes) <= 2;
    const ladderCountValid = Math.abs(ladderCount - config.ladders) <= 2;

    if (!snakeCountValid || !ladderCountValid) {
      console.log(
        `❌ Board validation failed: expected ${config.ladders} ladders, got ${ladderCount}; expected ${config.snakes} snakes, got ${snakeCount}`
      );
      return false;
    }

    // Check for valid positions and no overlaps
    const allPositions = new Set();

    for (const [start, end] of Object.entries(board.snakes)) {
      const startNum = parseInt(start);
      const endNum = parseInt(end);
      if (
        startNum <= endNum ||
        startNum < 2 ||
        startNum > 99 ||
        endNum < 2 ||
        endNum > 99
      ) {
        return false;
      }
      if (allPositions.has(startNum) || allPositions.has(endNum)) {
        return false;
      }
      allPositions.add(startNum);
      allPositions.add(endNum);
    }

    for (const [start, end] of Object.entries(board.ladders)) {
      const startNum = parseInt(start);
      const endNum = parseInt(end);
      if (
        startNum >= endNum ||
        startNum < 2 ||
        startNum > 99 ||
        endNum < 2 ||
        endNum > 99
      ) {
        return false;
      }
      if (allPositions.has(startNum) || allPositions.has(endNum)) {
        return false;
      }
      allPositions.add(startNum);
      allPositions.add(endNum);
    }

    return true;
  }

  // Generate a set of preset boards for immediate use
  getPresetBoards() {
    return {
      easy: {
        snakes: {
          23: 8,
          47: 15,
          72: 51,
          89: 67,
          98: 79,
        },
        ladders: {
          3: 22,
          8: 31,
          15: 44,
          21: 42,
          28: 56,
          36: 77,
          51: 67,
          62: 81,
          71: 91,
          78: 98,
          84: 95,
          87: 94,
        },
      },
      moderate: {
        snakes: {
          16: 6,
          47: 26,
          56: 34,
          62: 19,
          64: 39,
          87: 24,
          93: 55,
          98: 78,
        },
        ladders: {
          1: 38,
          4: 14,
          9: 31,
          21: 42,
          28: 84,
          36: 57,
          51: 67,
          71: 91,
        },
      },
      hard: {
        snakes: {
          17: 3,
          22: 5,
          34: 12,
          42: 18,
          48: 11,
          54: 31,
          67: 29,
          76: 25,
          89: 46,
          92: 73,
          95: 56,
          99: 68,
        },
        ladders: {
          7: 27,
          15: 35,
          24: 43,
          39: 58,
          65: 85,
        },
      },
    };
  }
}

module.exports = BoardGenerator;
