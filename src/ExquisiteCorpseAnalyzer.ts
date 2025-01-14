import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

class ExquisiteCorpseAnalyzer {
  private anthropic: Anthropic;
  private systemPrompt: string;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey
    });

    this.systemPrompt = `
      Please look at this exquisite corpse drawing. 
      Think about which famouse artist or illustrator you could see creating this.
      Please describe the most important features and then note "in the style of" and the artist's name.
    `;
  }

  private async readImageAsBase64(filepath: string): Promise<string> {
    const buffer = await fs.readFile(filepath);
    return buffer.toString('base64');
  }

  private getPromptFilePath(imagePath: string, promptDir: string): string {
    const basename = path.basename(imagePath);
    const nameWithoutExt = basename.substring(0, basename.lastIndexOf('.'));
    return path.join(promptDir, `${nameWithoutExt}.txt`);
  }

  async analyzeImage(imagePath: string, promptDir: string): Promise<string> {
    try {
      const base64Image = await this.readImageAsBase64(imagePath);

      const response = await this.anthropic.messages.create({
        model: "claude-3-opus-20240229",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this exquisite corpse drawing and create a detailed prompt for Flux image generation that captures its style and content. Describe each third of the image separately but maintain coherence."
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }],
        system: this.systemPrompt
      });

      if (response.content[0].type === 'text') {
        const prompt = response.content[0].text;
        
        // Ensure prompt directory exists
        await fs.mkdir(promptDir, { recursive: true });
        
        // Write prompt to file
        const promptFilePath = this.getPromptFilePath(imagePath, promptDir);
        await fs.writeFile(promptFilePath, prompt);
        console.log(`Wrote prompt to: ${promptFilePath}`);
        
        return prompt;
      }
      throw new Error('Unexpected response type from Claude');
    } catch (error) {
      console.error('Error analyzing image:', error);
      throw error;
    }
  }

  async processDirectory(inputDir: string, promptDir: string): Promise<void> {
    try {
      const files = await fs.readdir(inputDir);
      const imageFiles = files.filter(file => 
        ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase())
      );

      for (const file of imageFiles) {
        const imagePath = path.join(inputDir, file);
        try {
          await this.analyzeImage(imagePath, promptDir);
          console.log(`Processed ${file} successfully`);
        } catch (error) {
          console.error(`Failed to process ${file}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }

    } catch (error) {
      console.error('Error processing directory:', error);
      throw error;
    }
  }
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not found in environment variables');
  }

  const analyzer = new ExquisiteCorpseAnalyzer(apiKey);
  
  // Get command line arguments
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  npm run analyze-single -- <path-to-image>');
    console.log('  npm run analyze-dir -- <input-directory> <output-file>');
    process.exit(1);
  }

      const command = args[0];
    const promptDir = args[1];

    if (!promptDir) {
      console.error('Please provide the prompt output directory');
      console.log('Usage:');
      console.log('  npm run analyze-single -- <prompt-dir> <path-to-image>');
      console.log('  npm run analyze-dir -- <prompt-dir> <input-directory>');
      process.exit(1);
    }

    if (command === '--single') {
      if (args.length !== 3) {
        console.error('Please provide both prompt directory and image path');
        console.log('Usage: npm run analyze-single -- <prompt-dir> <path-to-image>');
        process.exit(1);
      }
      const imagePath = args[2];
      console.log(`Analyzing image: ${imagePath}`);
      await analyzer.analyzeImage(imagePath, promptDir);
    } else if (command === '--dir') {
      if (args.length !== 3) {
        console.error('Please provide both prompt directory and input directory');
        console.log('Usage: npm run analyze-dir -- <prompt-dir> <input-directory>');
        process.exit(1);
      }
      const inputDir = args[2];
      console.log(`Processing directory: ${inputDir}`);
      await analyzer.processDirectory(inputDir, promptDir);
  } else {
    console.error('Invalid command. Use --single or --dir');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export default ExquisiteCorpseAnalyzer;