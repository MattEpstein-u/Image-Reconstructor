// ...existing code...
const imageSelect = document.getElementById('imageSelect');
const plotDiv = document.getElementById('plot');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
let uploadedImageSrc = null;
let uploadedImageName = null;

let ignoreDropdownChange = false;
// Selected k for k-means (default 3)
// IMPORTANT: This value remains unchanged between trials to ensure independence
let selectedK = 3;

// Control for stray pixel removal (default enabled)
let removeStrayPixelsEnabled = true;

// Wire up the k slider control if present
const kSlider = document.getElementById('kSlider');
const kValueEl = document.getElementById('kValue');
if (kSlider && kValueEl) {
    kSlider.addEventListener('input', (e) => {
        selectedK = parseInt(e.target.value, 10) || 3;
        kValueEl.textContent = String(selectedK);
    });

}

// Wire up the stray pixel removal checkbox
const removeStrayPixelsCheckbox = document.getElementById('removeStrayPixels');
if (removeStrayPixelsCheckbox) {
    removeStrayPixelsCheckbox.addEventListener('change', (e) => {
        removeStrayPixelsEnabled = e.target.checked;
        console.log(`Stray pixel removal ${removeStrayPixelsEnabled ? 'enabled' : 'disabled'}`);
    });
}

function populateDropdown() {
    imageSelect.innerHTML = '';
    // Populate dropdown with image files from images.json
    if (!imageSelect) {
        return;
    }
    // Add uploaded image if present
    const uploadedImage = sessionStorage.getItem('uploadedImageName');
    let uploadedImageSrcLocal = sessionStorage.getItem('uploadedImageSrc');
    fetch('images.json')
        .then(response => {
            return response.json();
        })
        .then(imageFiles => {
            if (uploadedImage) {
                const option = document.createElement('option');
                option.value = '__uploaded__';
                option.textContent = uploadedImage + ' (uploaded)';
                imageSelect.appendChild(option);
            }
            imageFiles.forEach(file => {
                const option = document.createElement('option');
                option.value = file;
                option.textContent = file;
                imageSelect.appendChild(option);
            });

            // Select image from URL if present
            const params = new URLSearchParams(window.location.search);
            const selectedImage = params.get('image');
            if (uploadedImage && params.uploaded === '1') {
                imageSelect.value = '__uploaded__';
                processImageForPlot(uploadedImageSrcLocal, uploaded);
            } else if (selectedImage && imageFiles.includes(selectedImage)) {
                imageSelect.value = selectedImage;
                processImageForPlot('images/' + selectedImage, selectedImage);
            } else {
                const defaultImage = uploadedImage ? '__uploaded__' : imageFiles[0];
                imageSelect.value = defaultImage;
                if (uploadedImage) {
                    processImageForPlot(uploadedImageSrcLocal, uploadedImage);
                } else {
                    processImageForPlot('images/' + imageFiles[0], imageFiles[0]);
                }
            }
        })
        .catch(error => {
            console.error('Failed to load images.json:', error);
        });
}

function plotRGB(r, g, b, name) {
    // Accept optional size and color arrays
    let size = arguments[4];
    let color = arguments[5];
    // If there are very few points, make them larger
    let markerSize = size;
    if (!markerSize || markerSize.length === 0) {
        markerSize = Array(r.length).fill(10);
    } else if (r.length <= 3) {
        markerSize = markerSize.map(() => 20);
    } else {
        markerSize = markerSize.map(s => Math.max(s, 6));
    }

    const trace = {
        x: r, y: g, z: b,
        mode: 'markers',
        marker: {
            size: markerSize,
            color: color || r.map((r_val, i) => `rgb(${r_val * 255}, ${g[i] * 255}, ${b[i] * 255})`),
            opacity: 0.8
        },
        type: 'scatter3d'
    };

    // Always use [0,1] for axis range so all colors are visible
    const layout = {
        title: `Interactive RGB Plot — ${name}`,
        autosize: true,
        margin: { l: 40, r: 40, b: 60, t: 60, pad: 10 }, // Increased margins for better label visibility
        scene: {
            xaxis: {title: 'Red', range: [0, 1]},
            yaxis: {title: 'Green', range: [0, 1]},
            zaxis: {title: 'Blue', range: [0, 1]},
            aspectmode: 'cube',
            // rotate camera 45° to the right from the previous diagonal view
            camera: { eye: { x: 1.98, y: 0.0, z: 1.4 } }
        },
    };
    // Use plot container size when available to avoid overflowing the layout
    try {
        const container = document.getElementById('plot');
        const w = (container && container.clientWidth) ? container.clientWidth : Math.min(window.innerWidth, 800);
        const h = (container && container.clientHeight) ? container.clientHeight : Math.max(250, window.innerHeight - 250);
        layout.width = w;
        layout.height = h;
    } catch (e) {
        layout.width = Math.min(window.innerWidth, 800);
        layout.height = Math.max(250, window.innerHeight - 250);
    }

            // Use Plotly.newPlot to create/update the plot
            Plotly.newPlot('plot', [trace], layout).then(() => {
                try {
                    Plotly.relayout('plot', {width: layout.width, height: layout.height});
                } catch (e) {
                    console.warn('Failed to resize plot:', e);
                }
            });
}

function processImageForPlot(src, name) {
    const img = new window.Image();
    img.src = src;
    img.onload = function() {
        // Ensure image is fully loaded before drawing
        // Note: Don't clear plotDiv here as it's the container we're rendering into
        // Plotly.newPlot will replace the contents automatically
        const canvas = document.createElement('canvas');
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        let imageData;
        try {
            imageData = ctx.getImageData(0, 0, img.width, img.height);
        } catch (e) {
            plotDiv.innerHTML = `<span style='color:red;'>Failed to get image data: ${e.message}</span>`;
            return;
        }
        const data = imageData.data;
        // Sample pixels based on total count, not uniqueness
        const PIXEL_LIMIT = 200000;
        const totalPixels = Math.floor(data.length / 4);
        let sampledPixels = [];
        
        if (totalPixels <= PIXEL_LIMIT) {
            // Use all pixels
            for (let i = 0; i < data.length; i += 4) {
                if (data[i+3] !== 0) { // Only non-transparent pixels
                    sampledPixels.push([
                        data[i] / 255,
                        data[i+1] / 255, 
                        data[i+2] / 255
                    ]);
                }
            }
        } else {
            // Randomly sample PIXEL_LIMIT pixels
            const indices = new Set();
            while (indices.size < PIXEL_LIMIT) {
                indices.add(Math.floor(Math.random() * totalPixels));
            }
            for (const idx of indices) {
                const i = idx * 4;
                if (data[i+3] !== 0) { // Only non-transparent pixels
                    sampledPixels.push([
                        data[i] / 255,
                        data[i+1] / 255,
                        data[i+2] / 255
                    ]);
                }
            }
        }
        
        if (sampledPixels.length === 0) {
            plotDiv.innerHTML = `<span style='color:red;'>No non-transparent pixels found in image.</span>`;
            return;
        }
        
        // Function to remove stray pixels (outliers with few neighbors)
        function removeStrayPixels(pixels, neighborThreshold = 0.05, minNeighbors = 3) {
            console.log(`Removing stray pixels: checking ${pixels.length} pixels for local density...`);
            
            if (pixels.length <= minNeighbors) {
                console.log('Not enough pixels to filter stray ones');
                return pixels;
            }
            
            const cleanedPixels = [];
            const totalPixels = pixels.length;
            
            // For performance with large datasets, limit neighbor search space
            const maxSearchNeighbors = Math.min(1000, Math.floor(pixels.length / 10));
            
            // For each pixel, count neighbors within threshold distance
            for (let i = 0; i < pixels.length; i++) {
                const pixel = pixels[i];
                let neighborCount = 0;
                
                // Count neighbors (excluding self) - limit search for performance
                const searchLimit = Math.min(pixels.length, i + maxSearchNeighbors);
                for (let j = Math.max(0, i - maxSearchNeighbors); j < searchLimit; j++) {
                    if (i === j) continue; // Skip self
                    
                    const otherPixel = pixels[j];
                    
                    // Calculate Euclidean distance in RGB space
                    const distance = Math.sqrt(
                        Math.pow(pixel[0] - otherPixel[0], 2) +
                        Math.pow(pixel[1] - otherPixel[1], 2) +
                        Math.pow(pixel[2] - otherPixel[2], 2)
                    );
                    
                    // Count as neighbor if within threshold
                    if (distance <= neighborThreshold) {
                        neighborCount++;
                        
                        // Early exit if we already have enough neighbors
                        if (neighborCount >= minNeighbors) {
                            break;
                        }
                    }
                }
                
                // Keep pixel if it has enough neighbors
                if (neighborCount >= minNeighbors) {
                    cleanedPixels.push(pixel);
                }
            }
            
            const removedCount = totalPixels - cleanedPixels.length;
            const removedPercentage = ((removedCount / totalPixels) * 100).toFixed(1);
            
            console.log(`Removed ${removedCount} stray pixels (${removedPercentage}%) - kept ${cleanedPixels.length} pixels`);
            console.log(`Neighbor threshold: ${neighborThreshold}, minimum neighbors required: ${minNeighbors}`);
            
            return cleanedPixels;
        }
        
        // Clean the data by removing stray pixels (if enabled)
        if (removeStrayPixelsEnabled) {
            sampledPixels = removeStrayPixels(sampledPixels, 0.05, 3); // 5% RGB distance, minimum 3 neighbors
        } else {
            console.log('Stray pixel removal disabled - using all pixels');
        }
        
        if (sampledPixels.length === 0) {
            plotDiv.innerHTML = `<span style='color:red;'>No pixels remained after removing stray pixels.</span>`;
            return;
        }
        
        // Prepare arrays for Plotly - sample for visualization if too many points
        const MAX_PLOT_POINTS = 1000;
        let plotPixels = sampledPixels;
        if (sampledPixels.length > MAX_PLOT_POINTS) {
            // Sample evenly for plotting
            const step = Math.floor(sampledPixels.length / MAX_PLOT_POINTS);
            plotPixels = sampledPixels.filter((_, i) => i % step === 0);
        }
        
        const rArr = plotPixels.map(p => p[0]);
        const gArr = plotPixels.map(p => p[1]);
        const bArr = plotPixels.map(p => p[2]);
        const sizeArr = Array(plotPixels.length).fill(8);
        const colorArr = plotPixels.map(p => `rgb(${Math.round(p[0]*255)},${Math.round(p[1]*255)},${Math.round(p[2]*255)})`);


        // --- K-means clustering robust to few unique colors ---
        function kmeans(data, k, runs=8) {
            if (data.length === 0) return {centroids: [], assignments: [], inertia: 0};
            if (k === 1) {
                // Only one unique color
                return {centroids: [data[0]], assignments: Array(data.length).fill(0), inertia: 0};
            }
            function randomCentroids(data, k) {
                // Produce k random centroids independent of the dataset.
                // Each centroid is a point in RGB space with components in [0,1].
                const centroids = [];
                for (let i = 0; i < k; i++) {
                    centroids.push([Math.random(), Math.random(), Math.random()]);
                }
                return centroids;
            }
            function distance(a, b) {
                return Math.pow(a[0]-b[0],2) + Math.pow(a[1]-b[1],2) + Math.pow(a[2]-b[2],2);
            }
            let best = null;
            let lowestInertia = Infinity;
            for (let run=0; run<runs; run++) {
                let centroids = randomCentroids(data, k);
                let assignments = new Array(data.length).fill(0);
                let changed = true;
                let iter = 0;
                while (changed && iter < 50) {
                    changed = false;
                    // Assign points
                    for (let i=0; i<data.length; i++) {
                        let minDist = Infinity, minIdx = 0;
                        for (let j=0; j<k; j++) {
                            let d = distance(data[i], centroids[j]);
                            if (d < minDist) { minDist = d; minIdx = j; }
                        }
                        if (assignments[i] !== minIdx) changed = true;
                        assignments[i] = minIdx;
                    }
                    // Update centroids
                    let sums = Array.from({length:k},()=>[0,0,0]);
                    let counts = Array(k).fill(0);
                    for (let i=0; i<data.length; i++) {
                        let c = assignments[i];
                        sums[c][0] += data[i][0];
                        sums[c][1] += data[i][1];
                        sums[c][2] += data[i][2];
                        counts[c]++;
                    }
                    for (let j=0; j<k; j++) {
                        if (counts[j] >= 8) {
                            centroids[j] = [sums[j][0]/counts[j], sums[j][1]/counts[j], sums[j][2]/counts[j]];
                        } else {
                            // Small cluster (< 8 pixels): reassign centroid to a random data point
                            // This prevents clusters from becoming too small during iterations
                            const idx = Math.floor(Math.random() * data.length);
                            centroids[j] = [...data[idx]];
                        }
                    }
                    iter++;
                }
                // Compute inertia
                let inertia = 0;
                for (let i=0; i<data.length; i++) {
                    inertia += distance(data[i], centroids[assignments[i]]);
                }
                if (inertia < lowestInertia) {
                    lowestInertia = inertia;
                    best = {centroids, assignments, inertia};
                }
            }
            return best;
        }

        // Prepare pixel data for kmeans
        const pixelData = sampledPixels;
    // Use the user's selected k value directly
    let k = selectedK || 3;
    console.log(`Starting k-means with user selected k=${k}`);
    // Use more runs for smaller images to get better clustering quality
    const numRuns = sampledPixels.length < 200000 ? 32 : 8;
    const kmeansResult = kmeans(pixelData, k, numRuns);
    let centroids = kmeansResult.centroids;
    let assignments = kmeansResult.assignments;

    // Function to merge identical centroids and update assignments
    function mergeIdenticalCentroids(centroids, assignments) {
        const tolerance = 0.001; // Very small tolerance for floating point comparison
        
        // Create a map to track which centroids are identical
        const centroidMap = new Map();
        const mergedCentroids = [];
        const centroidIndexMap = new Map(); // Maps old index to new index
        
        centroids.forEach((centroid, index) => {
            // Create a key for this centroid (rounded to handle floating point precision)
            const key = centroid.map(c => Math.round(c / tolerance) * tolerance).join(',');
            
            if (centroidMap.has(key)) {
                // This centroid is identical to an existing one
                const existingIndex = centroidMap.get(key);
                centroidIndexMap.set(index, existingIndex);
            } else {
                // This is a new unique centroid
                const newIndex = mergedCentroids.length;
                centroidMap.set(key, newIndex);
                mergedCentroids.push([...centroid]);
                centroidIndexMap.set(index, newIndex);
            }
        });
        
        // Update assignments to use the new centroid indices
        const updatedAssignments = assignments.map(assignment => centroidIndexMap.get(assignment));
        
        console.log(`Merged identical centroids: ${centroids.length} → ${mergedCentroids.length}`);
        
        return {
            centroids: mergedCentroids,
            assignments: updatedAssignments
        };
    }

    // Merge identical centroids and update assignments
    const mergedResult = mergeIdenticalCentroids(centroids, assignments);
    centroids = mergedResult.centroids;
    assignments = mergedResult.assignments;
    
    // Update k to reflect the actual number of unique centroids
    k = centroids.length;
    console.log(`Final k after merging identical centroids: ${k}`);

    // FINAL OPTIMIZATION: Split large clusters to better capture color variations
    function splitLargeClusters(centroids, assignments, data) {
        // Removed automatic k adjustment - user controls k directly
        return centroids;
    }

    // Apply cluster splitting to improve color representation
    centroids = splitLargeClusters(centroids, assignments, pixelData);

        // Function to merge clusters that are too close together
        // IMPORTANT: This is called ONLY after k-means has fully converged
        function mergeCloseClusters(centroids, data, distanceThreshold = 0.15) {
            // Removed automatic k adjustment - user controls k directly
            return centroids;
        }

        // Apply cluster merging to avoid redundant clusters
        // More aggressive merging - apply whenever there are multiple centroids
        function shouldApplyMerging(centroids, data) {
            // Removed automatic merging - user controls k directly
            return false;
        }

        if (shouldApplyMerging(centroids, pixelData)) {
            centroids = mergeCloseClusters(centroids, pixelData);
        }

        // CLEANUP: Remove clusters with fewer pixels than the proportional threshold
        function cleanupSmallClusters(centroids, assignments, data) {
            // Removed automatic k adjustment - user controls k directly
            return { centroids, assignments };
        }

        // Apply cleanup to remove clusters below the proportional threshold
        const cleanupResult = cleanupSmallClusters(centroids, assignments, pixelData);
        centroids = cleanupResult.centroids;
        assignments = cleanupResult.assignments;
        function countPixelsPerCentroid(centroids, assignments, data) {
            const pixelCounts = new Array(centroids.length).fill(0);
            const clusterPixels = Array.from({length: centroids.length}, () => []);

            for (let i = 0; i < assignments.length; i++) {
                const clusterIdx = assignments[i];
                if (clusterIdx < centroids.length) { // Safety check
                    const pixel = data[i];
                    const centroid = centroids[clusterIdx];

                    // Skip if data element is undefined or pixel data is invalid - ultra-safe validation
                    if (!data[i] || !pixel) {
                        continue; // Skip undefined data elements
                    }

                    let isValidPixel = false;
                    try {
                        isValidPixel = pixel &&
                                       Array.isArray(pixel) &&
                                       pixel.length >= 3 &&
                                       typeof pixel[0] === 'number' &&
                                       typeof pixel[1] === 'number' &&
                                       typeof pixel[2] === 'number' &&
                                       !isNaN(pixel[0]) &&
                                       !isNaN(pixel[1]) &&
                                       !isNaN(pixel[2]);
                    } catch (e) {
                        // If any error occurs during validation, consider pixel invalid
                        isValidPixel = false;
                    }

                    if (!isValidPixel) {
                        continue;
                    }

                    // Calculate Euclidean distance in RGB space
                    const distance = Math.sqrt(
                        Math.pow(pixel[0] - centroid[0], 2) +
                        Math.pow(pixel[1] - centroid[1], 2) +
                        Math.pow(pixel[2] - centroid[2], 2)
                    );

                    // Only count pixels within a reasonable distance (0.2 in normalized RGB space)
                    const maxReasonableDistance = 0.2;
                    if (distance <= maxReasonableDistance) {
                        pixelCounts[clusterIdx]++;
                        clusterPixels[clusterIdx].push(pixel);
                    }
                }
            }

            console.log('=== FINAL CLUSTER ANALYSIS ===');
            console.log(`Total centroids: ${centroids.length}`);
            console.log(`Total pixels: ${assignments.length}`);
            console.log('Pixels per centroid:');

            centroids.forEach((centroid, i) => {
                const count = pixelCounts[i] || 0;
                const percentage = ((count / assignments.length) * 100).toFixed(1);
                console.log(`C${i+1}: ${count} pixels (${percentage}%) - RGB(${centroid.map(c => (c * 255).toFixed(0)).join(', ')})`);
            });

            // Also log to UI if possible
            const debugInfo = centroids.map((centroid, i) => {
                const count = pixelCounts[i] || 0;
                const percentage = ((count / assignments.length) * 100).toFixed(1);
                return `C${i+1}: ${count} pixels (${percentage}%)`;
            }).join('\n');

            // Debug display removed - details no longer shown in top right

            return pixelCounts;
        }

        // Run the debugging analysis
        const finalPixelCounts = countPixelsPerCentroid(centroids, assignments, pixelData);

        // Update the k value and UI to reflect the actual number of centroids after merging
        const actualK = centroids.length;
        // Update UI to show the final k value after merging identical centroids
        if (kValueEl) {
            kValueEl.textContent = String(k);
        }

        // Plot points and centroids
    function plotRGBWithCentroids(r, g, b, name, size, color, centroids, camera) {
            const plotContainer = document.getElementById('plot');
            if (!plotContainer) {
                return;
            }
            
            let markerSize = size;
            if (!markerSize || markerSize.length === 0) {
                markerSize = Array(r.length).fill(10);
            } else if (r.length <= 3) {
                markerSize = markerSize.map(() => 20);
            } else {
                markerSize = markerSize.map(s => Math.max(s, 6));
            }
            const trace = {
                x: r, y: g, z: b,
                mode: 'markers',
                marker: {
                    size: markerSize,
                    color: color || r.map((r_val, i) => `rgb(${r_val * 255}, ${g[i] * 255}, ${b[i] * 255})`),
                    opacity: 0.8
                },
                type: 'scatter3d',
                name: 'Pixels'
            };
            // Centroid trace
            const centroidTrace = {
                x: centroids.map(c=>c[0]),
                y: centroids.map(c=>c[1]),
                z: centroids.map(c=>c[2]),
                mode: 'markers+text',
                marker: {
                    size: 30,
                    color: centroids.map(c=>`rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)})`),
                    symbol: 'diamond',
                    opacity: 1,
                    line: {width:2, color:'#000'}
                },
                text: centroids.map((c,i)=>`C${i+1}`),
                textposition: 'top center',
                type: 'scatter3d',
                name: 'Centroids'
            };
            const layout = {
                title: `Interactive RGB Plot — ${name} (k=${k})`,
                autosize: true,
                margin: { l: 40, r: 40, b: 60, t: 60, pad: 10 }, // Increased margins for better label visibility
                scene: {
                    xaxis: {title: 'Red', range: [0, 1]},
                    yaxis: {title: 'Green', range: [0, 1]},
                    zaxis: {title: 'Blue', range: [0, 1]},
                    aspectmode: 'cube',
                    // use provided camera (preserve view) or fall back to default
                    camera: camera || { eye: { x: 1.98, y: 0.0, z: 1.4 } }
                },
            };
            // Use plot container size when available to avoid overflowing the layout
            try {
                const container = document.getElementById('plot');
                const w = (container && container.clientWidth) ? container.clientWidth : Math.min(window.innerWidth, 800);
                const h = (container && container.clientHeight) ? container.clientHeight : Math.max(300, window.innerHeight - 200);
                layout.width = w;
                layout.height = h;
            } catch (e) {
                layout.width = Math.min(window.innerWidth, 800);
                layout.height = Math.max(300, window.innerHeight - 200);
            }
            // Use Plotly.newPlot to create/update the plot
            Plotly.newPlot('plot', [trace, centroidTrace], layout, {responsive: true}).then(() => {
                // Check if plot was actually rendered
                const plotContainer = document.getElementById('plot');
                if (plotContainer) {
                    // Force a relayout to ensure proper sizing
                    setTimeout(() => {
                        try {
                            Plotly.relayout('plot', {width: layout.width, height: layout.height});
                        } catch (e) {
                            console.warn('Failed to resize plot:', e);
                        }
                    }, 100);
                }
            }).catch((error) => {
                console.error('Failed to create plot:', error);
                // Fallback: try to create a simple 2D plot to test if Plotly works at all
                const fallbackTrace = {
                    x: r.slice(0, 100),
                    y: g.slice(0, 100),
                    mode: 'markers',
                    type: 'scatter'
                };
                const fallbackLayout = {
                    title: 'Fallback 2D Plot',
                    xaxis: {title: 'Red'},
                    yaxis: {title: 'Green'}
                };

                Plotly.newPlot('plot', [fallbackTrace], fallbackLayout).then(() => {
                    console.log('Fallback 2D plot created successfully');
                }).catch((fallbackError) => {
                    console.error('Fallback plot also failed:', fallbackError);
                });
            });
        }

        plotRGBWithCentroids(rArr, gArr, bArr, name, sizeArr, colorArr, centroids);

        // Display centroid RGB values below the plot
        let centroidHtml = '<div style="margin-top:10px;font-size:1.1em"><b>K-means Centroids (k=' + k + '):</b><br>';
        centroids.forEach((c,i)=>{
            centroidHtml += `C${i+1}: <span style="color:rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)});font-weight:bold;">rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)})</span><br>`;
        });
        centroidHtml += '</div>';
        const summaryEl = document.getElementById('centroidSummary');
        if (summaryEl) {
            summaryEl.innerHTML = centroidHtml;
        } else {
            plotDiv.insertAdjacentHTML('beforeend', centroidHtml);
        }

        // --- Reconstruct image using only centroid colors ---
        if (centroids.length > 0 && imageData) {
            // Factor reconstruction into a reusable function so we can re-run clustering with different random starts
            const MAX_RECON_DIM = 800; // keep reconstruction reasonable for large images
            const srcW = canvas.width;
            const srcH = canvas.height;
            const scale = Math.min(1, MAX_RECON_DIM / Math.max(srcW, srcH));
            const reconW = Math.max(1, Math.round(srcW * scale));
            const reconH = Math.max(1, Math.round(srcH * scale));

            // helper to actually render a reconstruction for a given set of centroids
            function renderReconstruction(centroidsToUse) {
                const reconCanvas = document.createElement('canvas');
                reconCanvas.width = reconW;
                reconCanvas.height = reconH;
                reconCanvas.style.marginTop = '12px';
                reconCanvas.style.border = '1px solid #ddd';
                reconCanvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                reconCanvas.style.background = 'transparent';
                const rCtx = reconCanvas.getContext('2d');
                const reconImgData = rCtx.createImageData(reconW, reconH);

                function nearestCentroidLocal(rgb) {
                    let bestIdx = 0;
                    let bestDist = Infinity;
                    for (let i = 0; i < centroidsToUse.length; i++) {
                        const c = centroidsToUse[i];
                        const dr = rgb[0] - c[0];
                        const dg = rgb[1] - c[1];
                        const db = rgb[2] - c[2];
                        const d = dr*dr + dg*dg + db*db;
                        if (d < bestDist) { bestDist = d; bestIdx = i; }
                    }
                    return bestIdx;
                }

                for (let y = 0; y < reconH; y++) {
                    for (let x = 0; x < reconW; x++) {
                        const srcX = Math.min(srcW - 1, Math.floor(x / scale));
                        const srcY = Math.min(srcH - 1, Math.floor(y / scale));
                        const srcIdx = (srcY * srcW + srcX) * 4;
                        const sr = imageData.data[srcIdx] / 255;
                        const sg = imageData.data[srcIdx + 1] / 255;
                        const sb = imageData.data[srcIdx + 2] / 255;
                        const cIdx = nearestCentroidLocal([sr, sg, sb]);
                        const cc = centroidsToUse[cIdx];
                        const outIdx = (y * reconW + x) * 4;
                        reconImgData.data[outIdx] = Math.round(cc[0] * 255);
                        reconImgData.data[outIdx + 1] = Math.round(cc[1] * 255);
                        reconImgData.data[outIdx + 2] = Math.round(cc[2] * 255);
                        const srcAlpha = imageData.data[srcIdx + 3];
                        reconImgData.data[outIdx + 3] = srcAlpha;
                    }
                }
                rCtx.putImageData(reconImgData, 0, 0);

                // Insert/update DOM areas
                const originalAreaEl = document.getElementById('originalArea');
                const reconstructedAreaEl = document.getElementById('reconstructedArea');
                const reconSwatchesEl = document.getElementById('reconSwatches');

                if (reconstructedAreaEl) reconstructedAreaEl.innerHTML = '';
                if (originalAreaEl) originalAreaEl.innerHTML = '';

                // Build recon row
                let reconRowEl = null;
                if (reconstructedAreaEl) {
                    reconRowEl = document.createElement('div');
                    reconRowEl.className = 'recon-row';
                    const rlabel = document.createElement('div');
                    rlabel.className = 'recon-label';
                    rlabel.textContent = 'Reconstructed image';
                    const reconDisplayHolder = document.createElement('div');
                    reconDisplayHolder.style.flex = '1 1 0';
                    reconDisplayHolder.style.minWidth = '0';
                    reconRowEl.appendChild(rlabel);
                    reconRowEl.appendChild(reconDisplayHolder);
                    reconstructedAreaEl.appendChild(reconRowEl);
                }

                // Build original row
                let origRowEl = null;
                let origImg = null;
                if (originalAreaEl) {
                    origRowEl = document.createElement('div');
                    origRowEl.className = 'recon-row';
                    const olabel = document.createElement('div');
                    olabel.className = 'recon-label';
                    olabel.textContent = 'Original image';
                    origImg = new Image();
                    origImg.src = src;
                    origImg.alt = name || 'Original image';
                    origImg.className = 'recon-media';
                    origRowEl.appendChild(olabel);
                    origRowEl.appendChild(origImg);
                    originalAreaEl.appendChild(origRowEl);
                }

                // Layout sizing and create displayCanvas
                try {
                    // Calculate maximum available space within the container
                    const containerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--recon-display-height')) || 260;
                    const containerWidth = (reconstructedAreaEl && reconstructedAreaEl.clientWidth) || 400;
                    
                    // Account for padding, margins, and borders
                    const availableHeight = containerHeight - 48; // 24px padding + 24px margin/border
                    const availableWidth = containerWidth - 140; // 120px for label + 20px for gaps/borders
                    
                    // Calculate size that fits within container while maintaining aspect ratio
                    const originalAspectRatio = w / h;
                    let finalWidth, finalHeight;
                    
                    // Try fitting to available width first
                    finalWidth = Math.min(availableWidth, w);
                    finalHeight = Math.round(finalWidth / originalAspectRatio);
                    
                    // If height exceeds available space, fit to height instead
                    if (finalHeight > availableHeight) {
                        finalHeight = availableHeight;
                        finalWidth = Math.round(finalHeight * originalAspectRatio);
                    }
                    
                    // Ensure minimum reasonable size
                    finalWidth = Math.max(finalWidth, 100);
                    finalHeight = Math.max(finalHeight, 75);
                    
                    // Create canvas with calculated dimensions
                    const displayCanvas = document.createElement('canvas');
                    displayCanvas.className = 'recon-media';
                    displayCanvas.width = finalWidth;
                    displayCanvas.height = finalHeight;
                    displayCanvas.style.width = finalWidth + 'px';
                    displayCanvas.style.height = finalHeight + 'px';
                    
                    const dctx = displayCanvas.getContext('2d');
                    dctx.imageSmoothingEnabled = true;
                    dctx.imageSmoothingQuality = 'high';
                    
                    // Draw the reconstructed image at calculated size
                    dctx.drawImage(reconCanvas, 0, 0, reconCanvas.width, reconCanvas.height, 0, 0, finalWidth, finalHeight);

                    if (reconRowEl) {
                        const holder = reconRowEl.querySelector('div:last-child');
                        holder.innerHTML = '';
                        holder.appendChild(displayCanvas);
                    }
                    if (origImg) {
                        // Set the original image to exactly the same constrained size
                        origImg.style.width = finalWidth + 'px';
                        origImg.style.height = finalHeight + 'px';
                        origImg.style.objectFit = 'fill'; // Fill exactly to avoid white padding
                        origImg.removeAttribute('width');
                        origImg.removeAttribute('height');
                    }
                } catch (e) {
                    if (reconstructedAreaEl) {
                        reconstructedAreaEl.innerHTML = '';
                        const fallbackRow = document.createElement('div');
                        fallbackRow.className = 'recon-row';
                        const flabel = document.createElement('div');
                        flabel.className = 'recon-label';
                        flabel.textContent = 'Reconstructed image';
                        reconCanvas.className = 'recon-media';
                        fallbackRow.appendChild(flabel);
                        fallbackRow.appendChild(reconCanvas);
                        reconstructedAreaEl.appendChild(fallbackRow);
                    }
                    if (originalAreaEl && !origRowEl) {
                        const orow = document.createElement('div');
                        orow.className = 'recon-row';
                        const olabel = document.createElement('div');
                        olabel.className = 'recon-label';
                        olabel.textContent = 'Original image';
                        const origImg2 = new Image();
                        origImg2.src = src;
                        origImg2.className = 'recon-media';
                        orow.appendChild(olabel);
                        orow.appendChild(origImg2);
                        originalAreaEl.appendChild(orow);
                    }
                }

                // Show centroid color swatches for quick verification
                if (reconSwatchesEl) {
                    reconSwatchesEl.innerHTML = '';
                    centroidsToUse.forEach((c, i) => {
                        const sw = document.createElement('div');
                        sw.style.width = '36px';
                        sw.style.height = '36px';
                        sw.style.border = '1px solid #ddd';
                        sw.style.borderRadius = '4px';
                        sw.style.background = `rgb(${Math.round(c[0]*255)}, ${Math.round(c[1]*255)}, ${Math.round(c[2]*255)})`;
                        sw.title = `C${i+1}`;
                        reconSwatchesEl.appendChild(sw);
                    });
                }
            }

            // initial render
            renderReconstruction(centroids);

            // expose a rerun handler that re-initializes centroids randomly and re-renders everything
            window.rerunClustering = function() {
                try {
                    // Clean the data by removing stray pixels before clustering (if enabled)
                    const cleanedPixels = removeStrayPixelsEnabled ? 
                        removeStrayPixels(sampledPixels, 0.05, 3) : 
                        sampledPixels;
                    
                    if (cleanedPixels.length === 0) {
                        console.error('No pixels remained after removing stray pixels in rerun');
                        return;
                    }
                    
                    const useK = selectedK || 3;
                    console.log(`Rerun: Starting k-means with user selected k=${useK}`);
                    // Use more runs for smaller images to get better clustering quality
                    const numRuns = cleanedPixels.length < 200000 ? 32 : 8;
                    const newKmeans = kmeans(cleanedPixels, useK, numRuns);
                    let newCentroids = newKmeans.centroids;
                    let newAssignments = newKmeans.assignments;

                    // Function to merge identical centroids and update assignments for rerun
                    function mergeIdenticalCentroidsRerun(centroids, assignments) {
                        const tolerance = 0.001; // Very small tolerance for floating point comparison
                        
                        // Create a map to track which centroids are identical
                        const centroidMap = new Map();
                        const mergedCentroids = [];
                        const centroidIndexMap = new Map(); // Maps old index to new index
                        
                        centroids.forEach((centroid, index) => {
                            // Create a key for this centroid (rounded to handle floating point precision)
                            const key = centroid.map(c => Math.round(c / tolerance) * tolerance).join(',');
                            
                            if (centroidMap.has(key)) {
                                // This centroid is identical to an existing one
                                const existingIndex = centroidMap.get(key);
                                centroidIndexMap.set(index, existingIndex);
                            } else {
                                // This is a new unique centroid
                                const newIndex = mergedCentroids.length;
                                centroidMap.set(key, newIndex);
                                mergedCentroids.push([...centroid]);
                                centroidIndexMap.set(index, newIndex);
                            }
                        });
                        
                        // Update assignments to use the new centroid indices
                        const updatedAssignments = assignments.map(assignment => centroidIndexMap.get(assignment));
                        
                        console.log(`Rerun: Merged identical centroids: ${centroids.length} → ${mergedCentroids.length}`);
                        
                        return {
                            centroids: mergedCentroids,
                            assignments: updatedAssignments
                        };
                    }

                    // Merge identical centroids and update assignments for rerun
                    const mergedResultRerun = mergeIdenticalCentroidsRerun(newCentroids, newAssignments);
                    newCentroids = mergedResultRerun.centroids;
                    newAssignments = mergedResultRerun.assignments;
                    
                    // Update k to reflect the actual number of unique centroids for rerun
                    const finalKRerun = newCentroids.length;
                    
                    // Update the global k variable to reflect the merged result
                    k = finalKRerun;
                    console.log(`Rerun final k after merging identical centroids: ${k}`);

                    // Apply cluster splitting to improve color representation
                    newCentroids = splitLargeClusters(newCentroids, newAssignments, cleanedPixels);

                    // Apply cluster merging to the new centroids (using same logic)
                    if (shouldApplyMerging(newCentroids, cleanedPixels)) {
                        newCentroids = mergeCloseClusters(newCentroids, cleanedPixels);
                    }

                    // CLEANUP: Remove clusters with fewer pixels than the proportional threshold
                    function cleanupSmallClustersRerun(centroids, assignments, data) {
                        // Removed automatic k adjustment - user controls k directly
                        return { centroids, assignments };
                    }

                    // Apply cleanup to remove clusters below the proportional threshold
                    const cleanupResultRerun = cleanupSmallClustersRerun(newCentroids, newAssignments, cleanedPixels);
                    newCentroids = cleanupResultRerun.centroids;
                    newAssignments = cleanupResultRerun.assignments;
                    function countPixelsPerCentroidRerun(centroids, assignments, data) {
                        const pixelCounts = new Array(centroids.length).fill(0);
                        const clusterPixels = Array.from({length: centroids.length}, () => []);

                        for (let i = 0; i < assignments.length; i++) {
                            const clusterIdx = assignments[i];
                            if (clusterIdx < centroids.length) { // Safety check
                                const pixel = data[i];
                                const centroid = centroids[clusterIdx];

                                // Skip if data element is undefined or pixel data is invalid - ultra-safe validation
                                if (!data[i] || !pixel) {
                                    continue; // Skip undefined data elements
                                }

                                let isValidPixel = false;
                                try {
                                    isValidPixel = pixel &&
                                                   Array.isArray(pixel) &&
                                                   pixel.length >= 3 &&
                                                   typeof pixel[0] === 'number' &&
                                                   typeof pixel[1] === 'number' &&
                                                   typeof pixel[2] === 'number' &&
                                                   !isNaN(pixel[0]) &&
                                                   !isNaN(pixel[1]) &&
                                                   !isNaN(pixel[2]);
                                } catch (e) {
                                    // If any error occurs during validation, consider pixel invalid
                                    isValidPixel = false;
                                }

                                if (!isValidPixel) {
                                    continue;
                                }

                                // Calculate Euclidean distance in RGB space
                                const distance = Math.sqrt(
                                    Math.pow(pixel[0] - centroid[0], 2) +
                                    Math.pow(pixel[1] - centroid[1], 2) +
                                    Math.pow(pixel[2] - centroid[2], 2)
                                );

                                // Only count pixels within a reasonable distance (0.2 in normalized RGB space)
                                const maxReasonableDistance = 0.2;
                                if (distance <= maxReasonableDistance) {
                                    pixelCounts[clusterIdx]++;
                                    clusterPixels[clusterIdx].push(pixel);
                                }
                            }
                        }

                        console.log('=== RERUN CLUSTER ANALYSIS ===');
                        console.log(`Total centroids: ${centroids.length}`);
                        console.log(`Total pixels: ${assignments.length}`);
                        console.log('Pixels per centroid:');

                        centroids.forEach((centroid, i) => {
                            const count = pixelCounts[i] || 0;
                            const percentage = ((count / assignments.length) * 100).toFixed(1);
                            console.log(`C${i+1}: ${count} pixels (${percentage}%) - RGB(${centroid.map(c => (c * 255).toFixed(0)).join(', ')})`);
                        });

                        // Update debug display
                        const debugInfo = centroids.map((centroid, i) => {
                            const count = pixelCounts[i] || 0;
                            const percentage = ((count / assignments.length) * 100).toFixed(1);
                            return `C${i+1}: ${count} pixels (${percentage}%)`;
                        }).join('\n');

                        // Debug display removed - details no longer shown in top right

                        return pixelCounts;
                    }

                    // Run the debugging analysis for rerun
                    const rerunPixelCounts = countPixelsPerCentroidRerun(newCentroids, newAssignments, cleanedPixels);
                    
                    // Update the k value and UI to reflect the actual number of centroids after merging
                    const actualK = newCentroids.length;
                    // Update UI to show the final k value after merging identical centroids
                    if (kValueEl) {
                        kValueEl.textContent = String(finalKRerun);
                    }
                    // update plot and summary
                    // try to preserve current camera view if user has rotated/zoomed
                    let currentCamera = null;
                    try {
                        const gd = document.getElementById('plot');
                        if (gd && gd._fullLayout && gd._fullLayout.scene && gd._fullLayout.scene.camera) {
                            currentCamera = gd._fullLayout.scene.camera;
                        }
                    } catch (err) {
                        console.warn('Failed to preserve camera view:', err);
                    }
                    plotRGBWithCentroids(rArr, gArr, bArr, name, sizeArr, colorArr, newCentroids, currentCamera);
                    let centroidHtml = '<div style="margin-top:10px;font-size:1.1em"><b>K-means Centroids (k=' + finalKRerun + '):</b><br>';
                    newCentroids.forEach((c,i)=>{
                        centroidHtml += `C${i+1}: <span style="color:rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)});font-weight:bold;">rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)})</span><br>`;
                    });
                    centroidHtml += '</div>';
                    const summaryEl2 = document.getElementById('centroidSummary');
                    if (summaryEl2) summaryEl2.innerHTML = centroidHtml;
                    // re-render reconstruction
                    renderReconstruction(newCentroids);
                } catch (e) {
                    console.error('Failed to rerun clustering:', e);
                }
            };

            // expose a download handler that creates full quality reconstruction and downloads it
            window.downloadFullQuality = function() {
                try {
                    console.log('Creating full quality reconstruction for download...');
                    
                    // Run a fresh k-means clustering specifically for download with exact user k
                    const downloadK = selectedK || 3;
                    console.log(`Download: Running fresh k-means with exact k=${downloadK}`);
                    
                    // Apply stray pixel removal based on checkbox state (consistent with display)
                    const cleanedPixelsForDownload = removeStrayPixelsEnabled ? 
                        removeStrayPixels(sampledPixels, 0.05, 3) : 
                        sampledPixels;
                    
                    if (cleanedPixelsForDownload.length === 0) {
                        console.error('No pixels available for download reconstruction');
                        alert('No pixels available for reconstruction');
                        return;
                    }
                    
                    // Use the same number of runs as the main program
                    const numRuns = cleanedPixelsForDownload.length < 200000 ? 32 : 8;
                    console.log(`Download: Using ${numRuns} clustering runs for optimal quality`);
                    
                    // Run k-means with the same parameters as main program
                    const downloadKmeans = kmeans(cleanedPixelsForDownload, downloadK, numRuns);
                    let downloadCentroids = downloadKmeans.centroids;
                    
                    // Do NOT merge identical centroids for download - preserve exact k colors
                    console.log(`Download: Using ${downloadCentroids.length} centroids (preserving exact k=${downloadK})`);
                    
                    // If we somehow got fewer centroids than requested, pad with random colors
                    while (downloadCentroids.length < downloadK) {
                        // Add a random color centroid
                        downloadCentroids.push([Math.random(), Math.random(), Math.random()]);
                        console.log(`Download: Added random centroid to reach k=${downloadK}`);
                    }
                    
                    // If we got more centroids than requested (shouldn't happen), trim to exact k
                    if (downloadCentroids.length > downloadK) {
                        downloadCentroids = downloadCentroids.slice(0, downloadK);
                        console.log(`Download: Trimmed to exact k=${downloadK} centroids`);
                    }

                    // Use original full-size image data for reconstruction
                    const fullCanvas = document.createElement('canvas');
                    fullCanvas.width = canvas.width;
                    fullCanvas.height = canvas.height;
                    const fullCtx = fullCanvas.getContext('2d');
                    const fullImageData = fullCtx.createImageData(canvas.width, canvas.height);

                    function nearestCentroidForDownload(rgb) {
                        let bestIdx = 0;
                        let bestDist = Infinity;
                        for (let i = 0; i < downloadCentroids.length; i++) {
                            const c = downloadCentroids[i];
                            const dr = rgb[0] - c[0];
                            const dg = rgb[1] - c[1];
                            const db = rgb[2] - c[2];
                            const d = dr*dr + dg*dg + db*db;
                            if (d < bestDist) { bestDist = d; bestIdx = i; }
                        }
                        return bestIdx;
                    }

                    // Reconstruct every pixel at full resolution
                    for (let i = 0; i < imageData.data.length; i += 4) {
                        const sr = imageData.data[i] / 255;
                        const sg = imageData.data[i + 1] / 255;
                        const sb = imageData.data[i + 2] / 255;
                        const sa = imageData.data[i + 3]; // preserve alpha
                        
                        const cIdx = nearestCentroidForDownload([sr, sg, sb]);
                        const cc = downloadCentroids[cIdx];
                        
                        fullImageData.data[i] = Math.round(cc[0] * 255);
                        fullImageData.data[i + 1] = Math.round(cc[1] * 255);
                        fullImageData.data[i + 2] = Math.round(cc[2] * 255);
                        fullImageData.data[i + 3] = sa; // preserve original alpha
                    }

                    fullCtx.putImageData(fullImageData, 0, 0);

                    // Determine the file format and name
                    let fileName = name || 'reconstructed_image';
                    let mimeType = 'image/png'; // default to PNG
                    let fileExtension = '.png';

                    // Try to preserve original format if uploaded image
                    if (imageSelect.value === '__uploaded__' && uploadedImageName) {
                        const originalExt = uploadedImageName.toLowerCase().split('.').pop();
                        if (originalExt === 'jpg' || originalExt === 'jpeg') {
                            mimeType = 'image/jpeg';
                            fileExtension = '.jpg';
                        } else if (originalExt === 'png') {
                            mimeType = 'image/png';
                            fileExtension = '.png';
                        } else if (originalExt === 'webp') {
                            mimeType = 'image/webp';
                            fileExtension = '.webp';
                        }
                        // Remove original extension from filename
                        fileName = uploadedImageName.replace(/\.[^/.]+$/, '');
                    } else if (fileName.includes('.')) {
                        // For gallery images, preserve format
                        const originalExt = fileName.toLowerCase().split('.').pop();
                        if (originalExt === 'jpg' || originalExt === 'jpeg') {
                            mimeType = 'image/jpeg';
                            fileExtension = '.jpg';
                        }
                        fileName = fileName.replace(/\.[^/.]+$/, '');
                    }

                    // Add reconstruction suffix with exact k value used
                    fileName += '_reconstructed_k' + downloadK + fileExtension;

                    // Convert canvas to blob and download
                    fullCanvas.toBlob(function(blob) {
                        if (!blob) {
                            console.error('Failed to create blob from canvas');
                            alert('Failed to create download file');
                            return;
                        }

                        // Create download link
                        const url = URL.createObjectURL(blob);
                        const downloadLink = document.createElement('a');
                        downloadLink.href = url;
                        downloadLink.download = fileName;
                        downloadLink.style.display = 'none';
                        
                        document.body.appendChild(downloadLink);
                        downloadLink.click();
                        document.body.removeChild(downloadLink);
                        
                        // Clean up the URL object
                        setTimeout(() => URL.revokeObjectURL(url), 100);
                        
                        console.log(`Downloaded full quality reconstruction: ${fileName} with exactly ${downloadK} colors`);
                        
                        // Log the colors used for verification
                        console.log('Download centroids used:');
                        downloadCentroids.forEach((c, i) => {
                            console.log(`C${i+1}: rgb(${Math.round(c[0]*255)}, ${Math.round(c[1]*255)}, ${Math.round(c[2]*255)})`);
                        });
                        
                    }, mimeType, mimeType === 'image/jpeg' ? 0.95 : undefined); // High quality for JPEG
                    
                } catch (e) {
                    console.error('Failed to download full quality reconstruction:', e);
                    alert('Failed to create download. Please try again.');
                }
            };
        }
    };
    img.onerror = function() {
        plotDiv.innerHTML = `<span style='color:red;'>Failed to load image for plotting.</span>`;
    };
}

imageSelect.addEventListener('change', () => {
    if (ignoreDropdownChange) {
        return;
    }
    if (imageSelect.value === '__uploaded__' && uploadedImageSrc && uploadedImageName) {
        processImageForPlot(uploadedImageSrc, uploadedImageName);
    } else if (imageSelect.value) {
        processImageForPlot('images/' + imageSelect.value, imageSelect.value);
    }
});

if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
        if (fileInput) fileInput.click();
    });
}

// Wire the Re-run clustering button (if present)
const rerunBtn = document.getElementById('rerunBtn');
if (rerunBtn) {
    rerunBtn.addEventListener('click', () => {
        if (typeof window.rerunClustering === 'function') window.rerunClustering();
    });
}

// Wire the Download full quality button (if present)
const downloadBtn = document.getElementById('downloadBtn');
if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
        if (typeof window.downloadFullQuality === 'function') window.downloadFullQuality();
    });
}

if (fileInput) {
    fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            uploadedImageSrc = e.target.result;
            uploadedImageName = file.name;
            populateDropdown();
            imageSelect.value = '__uploaded__';
            processImageForPlot(uploadedImageSrc, uploadedImageName);
        };
        reader.readAsDataURL(file);
    }
    });
}

// Helper to parse query parameters
function getQueryParams() {
    const params = {};
    window.location.search.substring(1).split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key) params[key] = decodeURIComponent(value || '');
    });
    return params;
}

const params = getQueryParams();
populateDropdown();
