// src/generateSlideConfig.ts
import * as fs from 'fs/promises';
import * as path from 'path';

interface Slide {
    id: string;
    preview: string;
    ai_painting: string;
    ai_text: string;
}

async function readPromptFile(promptPath: string): Promise<string> {
    try {
        const content = await fs.readFile(promptPath, 'utf-8');
        return content.trim();
    } catch (error) {
        console.error(`Error reading prompt file ${promptPath}:`, error);
        return '';
    }
}

async function generateSlideConfig(
    inputDir: string,
    promptDir: string,
    aiPaintingsDir: string
): Promise<Slide[]> {
    try {
        // List all files in the input directory
        const files = await fs.readdir(inputDir);
        const imageFiles = files.filter(file => 
            ['.jpg', '.jpeg', '.png'].includes(path.extname(file).toLowerCase())
        );

        // Generate slides for each image
        const slides: Slide[] = [];
        for (const file of imageFiles) {
            const id = path.basename(file, path.extname(file));
            const promptPath = path.join(promptDir, `${id}.txt`);
            
            try {
                const ai_text = await readPromptFile(promptPath);
                slides.push({
                    id,
                    preview: path.join('./originals', file),
                    ai_painting: path.join('./ai_paintings', file),
                    ai_text
                });
                console.log(`Processed ${file} successfully`);
            } catch (error) {
                console.error(`Failed to process ${file}:`, error instanceof Error ? error.message : 'Unknown error');
            }
        }

        return slides;
    } catch (error) {
        console.error('Error processing directory:', error);
        throw error;
    }
}

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length !== 3) {
        console.log('Usage: ts-node src/generateSlideConfig.ts <input-dir> <prompt-dir> <ai-paintings-dir>');
        process.exit(1);
    }

    const [inputDir, promptDir, aiPaintingsDir] = args;

    try {
        const slides = await generateSlideConfig(inputDir, promptDir, aiPaintingsDir);
        const outputPath = 'slides.json';
        await fs.writeFile(outputPath, JSON.stringify(slides, null, 2));
        console.log(`Generated slides configuration in ${outputPath}`);
    } catch (error) {
        console.error('Error:', error);
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

export { generateSlideConfig, Slide };