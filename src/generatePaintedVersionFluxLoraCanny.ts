// src/generatePaintedVersion.ts
import { fal } from "@fal-ai/client";
import type { QueueStatus } from "@fal-ai/client";
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

const FAL_MODEL = `fal-ai/flux-lora-canny`;

// Load environment variables
dotenv.config();

// Configure fal client with API key from .env
fal.config({
  credentials: process.env.FAL_API_KEY
});

async function readImageFile(imagePath: string): Promise<string> {
  try {
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mimeType};base64,${base64Image}`;
  } catch (error) {
    console.error('Error reading image file:', error);
    throw error;
  }
}

async function readPromptFile(promptDir: string, imagePath: string): Promise<string> {
  try {
    // Get the filename without extension and add .txt
    const baseFileName = path.basename(imagePath, path.extname(imagePath));
    const promptPath = path.join(promptDir, `${baseFileName}.txt`);
    
    // Read and return the prompt
    const prompt = await fs.readFile(promptPath, 'utf-8');
    return prompt.trim();
  } catch (error) {
    console.error('Error reading prompt file:', error);
    throw error;
  }
}

async function generateAndSaveImage(inputImagePath?: string, promptDir?: string): Promise<void> {
  try {
    // Check if required arguments are provided
    if (!inputImagePath || !promptDir) {
      console.error('Please provide both input image path and prompt directory as arguments');
      console.log('Usage: npm run generate-art -- path/to/your/image.jpg path/to/prompt/directory');
      process.exit(1);
    }

    // Convert image to base64
    const imageDataUri = await readImageFile(inputImagePath);
    console.log('Image loaded successfully');

    // Read the prompt from the corresponding text file
    const prompt = await readPromptFile(promptDir, inputImagePath);
    console.log('Prompt loaded successfully');

    const result = await fal.subscribe(FAL_MODEL, {
      input: {
        prompt,
        num_inference_steps: 28,
        guidance_scale: 30,
        num_images: 1,
        enable_safety_checker: false,
        output_format: "jpeg",
        image_size: "portrait_4_3",
        image_url: imageDataUri,
      },
      logs: true,
      onQueueUpdate: (status: QueueStatus) => {
        if (status.status === "IN_PROGRESS" && 'logs' in status) {
          status.logs.forEach(log => {
            if ('message' in log) {
              console.log(log.message);
            }
          });
        }
      },
    });

    // Log the request ID
    console.log('Request ID:', result.requestId);

    // Get the image data from the result
    const images = result.data.images;
    if (!images || images.length === 0) {
      throw new Error('No images generated');
    }

    // Save the generated image back to the input location
    const imageData = images[0].url;
    if (!imageData) {
      throw new Error('No image data generated');
    }

    // Fetch and save the image
    const response = await fetch(imageData);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Ensure ai_paintings directory exists
    const outputDir = path.join(process.cwd(), 'ai_paintings');
    await fs.mkdir(outputDir, { recursive: true });

    // Create filename using original name but in ai_paintings directory
    const originalFileName = path.basename(inputImagePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(outputDir, `${path.parse(originalFileName).name}-${timestamp}.jpg`);

    // Save the image to ai_paintings directory
    await fs.writeFile(outputPath, buffer);
    console.log(`Image saved as: ${outputPath}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Get the arguments from command line
const [inputImagePath, promptDir] = process.argv.slice(2);

// Run the function with the provided arguments
generateAndSaveImage(inputImagePath, promptDir);