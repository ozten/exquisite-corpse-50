# Exquisite Corpse played during my 50th birthday

## Plan

1. Scan 8.5 x 11 images
2. Resize so that 11 inch side is 1568
3. Use Vision enabeld model to view and create a creative prompt for an image generation model
4. Use Image generation model with prompt + image to guide generation
5. Create website UI that

   5.1 Allows navigation between drawings

   5.2 Allows easy switching between original and AI painting

6. Deploy for public access

## AI

This code was written with Claude 3.5 Sonnet. 
Claude vision was used to look at each drawing and to write an image generation prompt for Flux.
The ai paintings were generated with fal.ai flux-lora-canny model.

## Resize

    for file in *.jpeg; do sips -z 1568 1200 "$file" --out "../preview/${file}"; done

## Create Prompts

    ts-node src/ExquisiteCorpseAnalyzer.ts --dir ./prompts2/ ./preview/

## Let AI paint our drawings

    ts-node src/generatePaintedVersionFluxLoraCanny.ts --batch ./preview ./prompts2

## Generate web UI config

    ts-node src/generateSlideConfig.ts ./preview/ ./prompts2 ./ai_paintings
