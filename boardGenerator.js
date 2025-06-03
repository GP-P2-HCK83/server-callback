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
}
