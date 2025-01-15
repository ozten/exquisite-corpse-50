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

async function processImage(inputImagePath: string, promptDir: string): Promise<void> {
  try {
    // Convert image to base64
    const imageDataUri = await readImageFile(inputImagePath);
    console.log(`Image loaded successfully: ${inputImagePath}`);

    // Read the prompt from the corresponding text file
    const prompt = await readPromptFile(promptDir, inputImagePath);
    console.log('Prompt loaded successfully', prompt);

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

    const imageData = images[0].url;
    if (!imageData) {
      throw new Error('No image data generated');
    }

    // Ensure ai_paintings directory exists
    const outputDir = path.join(process.cwd(), 'ai_paintings');
    await fs.mkdir(outputDir, { recursive: true });

    // Create filename using original name but in ai_paintings directory
    const originalFileName = path.basename(inputImagePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(outputDir, `${path.parse(originalFileName).name}-${timestamp}.jpg`);

    // Fetch and save the image
    const response = await fetch(imageData);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Save the image to ai_paintings directory
    await fs.writeFile(outputPath, buffer);
    console.log(`Image saved as: ${outputPath}`);

  } catch (error) {
    console.error(`Error processing ${inputImagePath}:`, error);
    // Don't exit process for batch processing
    if (process.argv[2] !== '--batch') {
      process.exit(1);
    }
  }
}

async function processDirectory(inputDir: string, promptDir: string): Promise<void> {
  try {
    const files = await fs.readdir(inputDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === '.jpg' || ext === '.jpeg' || ext === '.png';
    });

    if (imageFiles.length === 0) {
      console.log('No image files found in directory');
      return;
    }

    console.log(`Found ${imageFiles.length} images to process`);
    
    // Process images sequentially to avoid overwhelming the API
    for (const file of imageFiles) {
      const fullPath = path.join(inputDir, file);
      console.log(`\nProcessing ${file}...`);
      await processImage(fullPath, promptDir);
    }

    console.log('\nBatch processing complete!');

  } catch (error) {
    console.error('Error processing directory:', error);
    process.exit(1);
  }
}

async function main() {  
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Please provide required arguments');
    console.log('Usage:');
    console.log('  Single image: ts-node generatePaintedVersion.ts path/to/image.jpg path/to/prompt/directory');
    console.log('  Batch process: ts-node generatePaintedVersion.ts --batch path/to/image/directory path/to/prompt/directory');
    process.exit(1);
  }

  if (args[0] === '--batch') {
    // Batch mode: --batch <inputDir> <promptDir>
    if (args.length < 3) {
      console.error('Please provide both input directory and prompt directory for batch mode');
      process.exit(1);
    }
    const inputDir = args[1];
    const promptDir = args[2];
    await processDirectory(inputDir, promptDir);
  } else {
    // Single file mode: <inputPath> <promptDir>
    const inputPath = args[0];
    const promptDir = args[1];
    await processImage(inputPath, promptDir);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});