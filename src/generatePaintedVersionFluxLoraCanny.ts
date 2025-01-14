// src/generatePaintedVersion.ts
import { fal } from "@fal-ai/client";
import type { QueueStatus } from "@fal-ai/client";
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';

const FAL_MODEL = `fal-ai/flux-lora-canny`; // `fal-ai/flux-pro/v1.1-ultra/redux`;

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

async function generateAndSaveImage(inputImagePath?: string): Promise<void> {
  try {
    // Check if image path is provided
    if (!inputImagePath) {
      console.error('Please provide an input image path as an argument');
      console.log('Usage: npm run generate-art -- path/to/your/image.jpg');
      process.exit(1);
    }

    // Convert image to base64
    const imageDataUri = await readImageFile(inputImagePath);
    console.log('Image loaded successfully');

    const result = await fal.subscribe(FAL_MODEL, {
      input: {
        prompt: `A whimsical oil painting of an otherworldly creature with an oversized head in the style of Tim Burton. The top third shows wide, expressive eyes with long lashes and thin, arched eyebrows. The middle section depicts a mouth stretched into an impish grin, revealing teeth. The bottom portion consists of a plump, rounded body with thin, stick-like limbs ending in pointed claws, standing on a patch of grass with stylized sailboats in the background.
        `,
        num_inference_steps: 28,
    guidance_scale: 30,
    num_images: 1,
    enable_safety_checker: false,
    output_format: "jpeg",
    image_size: "portrait_4_3",
    image_url: imageDataUri,  // Use the base64 data URI        
        
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

    // Ensure ai_paintings directory exists
    const outputDir = path.join(__dirname, '..', 'ai_paintings');
    await fs.mkdir(outputDir, { recursive: true });

    // Get the image data from the result
    const images = result.data.images;
    if (!images || images.length === 0) {
      throw new Error('No images generated');
    }

    // Save each generated image
    for (let i = 0; i < images.length; i++) {
      const imageData = images[i].url;
      if (!imageData) {
        console.warn(`No image data for image ${i + 1}`);
        continue;
      }

      // Create filename with timestamp and index
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = path.join(outputDir, `burton-alien-${timestamp}-${i + 1}.jpg`);

      // For URLs, we need to fetch the image first
      const response = await fetch(imageData);
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Save the image
      await fs.writeFile(filename, buffer);
      console.log(`Image saved as: ${filename}`);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Get the image path from command line arguments
const inputImagePath = process.argv[2];

// Run the function with the provided image path
generateAndSaveImage(inputImagePath);