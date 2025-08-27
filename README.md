# Image Reconstructor

A small interactive web tool that visualizes an image's colors in 3D RGB space and demonstrates color reconstruction using k-means clustering.

Features
- Interactive 3D scatter plot of image colors (Red, Green, Blue axes) rendered with Plotly.
- k-means color quantization / reconstruction: choose k and re-run clustering to see reconstructed images.
- Upload your own image or select from bundled sample images in the `images/` folder.
- Performance-friendly defaults: pixel sampling and a cap on displayed pixels to handle large images.

Repository layout
- `index.html` — simple gallery of sample images.
- `stats.html` — main interactive page with controls, 3D plot and reconstruction panels.
- `stats.js` — image processing, k-means implementation, plotting logic, and UI wiring.
- `style.css` — styling for the UI.
- `images.json` and `images/` — sample images shipped with the project.

Usage
- Select an image from the dropdown or upload a new image (click the upload control).
- Use the slider to choose k (number of clusters) between 1 and 20. The algorithm will automatically optimize the number of clusters by merging centroids that are sufficiently close together, and the UI will update to reflect the actual number of clusters used.
- Interact with the 3D plot: rotate, zoom, and pan. The app preserves your camera (rotation + zoom) when you re-run clustering.

Developer notes
- Plot updates: the app uses `Plotly.newPlot` and `Plotly.relayout` to update the plot, which helps preserve user interactions.
- k-means:
  - Centroids are initialized as uniformly random points in RGB space (independent of the dataset).
  - Empty-cluster handling: centroids with zero assigned points are reassigned to a random data point during iterations (a pragmatic fix).
  - The implementation runs multiple random restarts and keeps the run with lowest inertia.
  - Balanced k optimization: After clustering, centroids that are sufficiently close together are automatically and repeatedly merged until no more close pairs exist, allowing the algorithm to reduce k from 6 to 1 if all centroids are in the same area. The merging threshold is set to balance color preservation with optimization.
- Performance:
  - The script samples up to `PIXEL_LIMIT` pixels (default 200,000) to analyze large images, and limits the number of displayed pixels to `MAX_PLOT_POINTS` (default 1,000). See `stats.js` to tune these values.