# Image Reconstructor

A small interactive web tool that visualizes an image's colors in 3D RGB space and demonstrates color reconstruction using k-means clustering.

Features
- Interactive 3D scatter plot of image colors (Red, Green, Blue axes) rendered with Plotly.
- k-means color quantization / reconstruction: choose k and re-run clustering to see reconstructed images.
- Upload your own image or select from bundled sample images in the `images/` folder.
- Performance-friendly defaults: pixel sampling and a cap on displayed unique colors to handle large images.

Repository layout
- `index.html` — simple gallery of sample images.
- `stats.html` — main interactive page with controls, 3D plot and reconstruction panels.
- `stats.js` — image processing, k-means implementation, plotting logic, and UI wiring.
- `style.css` — styling for the UI.
- `images.json` and `images/` — sample images shipped with the project.

Usage
- Select an image from the dropdown or upload a new image (click the upload control).
- Use the slider to choose k (number of clusters) between 2 and 10. After changing k, click "Re-run clustering".
- Interact with the 3D plot: rotate, zoom, and pan. The app preserves your camera (rotation + zoom) when you re-run clustering.

Developer notes
- Plot updates: the app uses `Plotly.react` to update the plot in place, which helps preserve user interactions.
- k-means:
  - Centroids are initialized as uniformly random points in RGB space (independent of the dataset).
  - Empty-cluster handling: centroids with zero assigned points are reassigned to a random data point during iterations (a pragmatic fix).
  - The implementation runs multiple random restarts and keeps the run with lowest inertia.
- Performance:
  - The script samples up to `PIXEL_LIMIT` pixels (default 100,000) to analyze large images, and limits the number of displayed unique colors to `MAX_COLORS` (default 1000). See `stats.js` to tune these values.