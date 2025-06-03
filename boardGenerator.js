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
}
