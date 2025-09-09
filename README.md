# Image Reconstructor

Interactive web tool that visualizes image colors in 3D RGB space and reconstructs images using k-means clustering.

## Features

- 3D visualization of image colors in RGB space
- K-means color quantization with adjustable k value
- Upload your own images or use sample images
- Download full-quality reconstructed images
- Remove stray pixels option for cleaner clustering

## Usage

1. Open `index.html` to browse sample images or `stats.html` directly
2. Select an image or upload your own
3. Adjust k (number of colors) using the slider
4. Click "Re-run clustering" to try different results
5. Click "Download full quality" to save the reconstructed image

## Files

- `index.html` - Image gallery
- `stats.html` - Main application
- `stats.js` - Core functionality
- `style.css` - Styling
- `images/` - Sample images