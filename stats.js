// ...existing code...
const imageSelect = document.getElementById('imageSelect');
const plotDiv = document.getElementById('plot');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
let uploadedImageSrc = null;
let uploadedImageName = null;

let ignoreDropdownChange = false;
// Selected k for k-means (default 3)
let selectedK = 3;

// Wire up the k slider control if present
const kSlider = document.getElementById('kSlider');
const kValueEl = document.getElementById('kValue');
if (kSlider && kValueEl) {
    kSlider.addEventListener('input', (e) => {
        selectedK = parseInt(e.target.value, 10) || 3;
        kValueEl.textContent = String(selectedK);
    });

}

function populateDropdown() {
    imageSelect.innerHTML = '';
    // Populate dropdown with image files from images.json
    if (!imageSelect) return;
    imageSelect.innerHTML = '';
    // Add uploaded image if present
    const uploadedImage = sessionStorage.getItem('uploadedImageName');
    let uploadedImageSrcLocal = sessionStorage.getItem('uploadedImageSrc');
    fetch('images.json')
        .then(response => response.json())
        .then(imageFiles => {
            imageSelect.innerHTML = '';
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
                processImageForPlot(uploadedImageSrcLocal, uploadedImage);
            } else if (selectedImage && imageFiles.includes(selectedImage)) {
                imageSelect.value = selectedImage;
                processImageForPlot('images/' + selectedImage, selectedImage);
            } else {
                imageSelect.value = uploadedImage ? '__uploaded__' : imageFiles[0];
                if (uploadedImage) {
                    processImageForPlot(uploadedImageSrcLocal, uploadedImage);
                } else {
                    processImageForPlot('images/' + imageFiles[0], imageFiles[0]);
                }
            }
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
        title: `3D RGB Plot — ${name}`,
        autosize: true,
        margin: { l: 0, r: 0, b: 0, t: 40, pad: 0 },
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
        const h = (container && container.clientHeight) ? container.clientHeight : Math.max(300, window.innerHeight - 200);
        layout.width = w;
        layout.height = h;
    } catch (e) {
        layout.width = Math.min(window.innerWidth, 800);
        layout.height = Math.max(300, window.innerHeight - 200);
    }

            Plotly.newPlot('plot', [trace], layout).then(() => {
                // Ensure plot fully fits the container
                try {
                    Plotly.relayout('plot', {width: layout.width, height: layout.height});
                } catch (e) {
                    console.log('[DEBUG] relayout failed', e);
                }
            });
}

function processImageForPlot(src, name) {
    const img = new window.Image();
    img.src = src;
    img.onload = function() {
        // Debug logs for troubleshooting
    console.log('[DEBUG] Image loaded:', { width: img.width, height: img.height });
        console.log('Image loaded:', { width: img.width, height: img.height });
    // Ensure image is fully loaded before drawing
    plotDiv.innerHTML = '';
    const canvas = document.createElement('canvas');
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
        console.log('[DEBUG] Canvas dimensions:', canvas.width, canvas.height);
        let imageData;
        try {
            imageData = ctx.getImageData(0, 0, img.width, img.height);
        } catch (e) {
            plotDiv.innerHTML = `<span style='color:red;'>Failed to get image data: ${e.message}</span>`;
            return;
        }
        const data = imageData.data;
        // Log the actual RGB values of the first 10 non-transparent pixels
        let firstNonTransparent = [];
        for (let i = 0, found = 0; i < data.length && found < 10; i += 4) {
            if (data[i+3] !== 0) {
                firstNonTransparent.push([data[i], data[i+1], data[i+2], data[i+3]]);
                found++;
            }
        }
        console.log('[DEBUG] First 10 non-transparent RGBA pixels:', firstNonTransparent);
        console.log('First 40 RGBA values:', Array.from(data).slice(0, 160));
        // Count unique RGB values and their frequencies
        const colorCounts = new Map();
        const PIXEL_LIMIT = 100000;
        const totalPixels = data.length / 4;
        let indices;
        if (totalPixels > PIXEL_LIMIT) {
            // Randomly sample PIXEL_LIMIT indices
            indices = new Set();
            while (indices.size < PIXEL_LIMIT) {
                indices.add(Math.floor(Math.random() * totalPixels));
            }
        } else {
            // Use all pixel indices
            indices = Array.from({length: totalPixels}, (_, i) => i);
        }
        let pixelCount = 0;
        for (const idx of indices) {
            const i = idx * 4;
            if (data[i+3] !== 0) {
                const r = data[i] / 255;
                const g = data[i+1] / 255;
                const b = data[i+2] / 255;
                // Use raw normalized values for color grouping
                const key = `${r},${g},${b}`;
                colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
                pixelCount++;
            }
        }
        console.log('[DEBUG] Non-transparent pixels processed:', pixelCount);
        console.log('[DEBUG] Total unique colors found:', colorCounts.size);
        if (colorCounts.size > 1) {
            console.log('[DEBUG] First 10 unique color keys:', Array.from(colorCounts.keys()).slice(0, 10));
        }
        console.log('Unique color counts:', Array.from(colorCounts.entries()).slice(0, 10));
        if (colorCounts.size === 0) {
            plotDiv.innerHTML = `<span style='color:red;'>No non-transparent pixels found in image.</span>`;
            return;
        }
        // Prepare arrays for Plotly
        let keys = Array.from(colorCounts.keys());
        // If too many unique colors, sample evenly
        const MAX_COLORS = 1000;
        if (keys.length > MAX_COLORS) {
            const step = Math.floor(keys.length / MAX_COLORS);
            keys = keys.filter((_, i) => i % step === 0);
        }
        const rArr = [];
        const gArr = [];
        const bArr = [];
        const sizeArr = [];
        const colorArr = [];
        for (const key of keys) {
            const [r, g, b] = key.split(',').map(Number);
            rArr.push(r);
            gArr.push(g);
            bArr.push(b);
            sizeArr.push(8); // All points same size
            colorArr.push(`rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`);
        }


        // --- K-means clustering robust to few unique colors ---
        function kmeans(data, k, runs=8) {
            if (data.length === 0) return {centroids: [], assignments: [], inertia: 0};
            if (k === 1) {
                // Only one unique color
                return {centroids: [data[0]], assignments: Array(data.length).fill(0), inertia: 0};
            }
            if (k === 2) {
                // Two unique colors
                return {centroids: [data[0], data[1]], assignments: data.map((_,i)=>i), inertia: 0};
            }
            function randomCentroids(data, k) {
                const centroids = [];
                const used = new Set();
                while (centroids.length < k) {
                    const idx = Math.floor(Math.random() * data.length);
                    if (!used.has(idx)) {
                        centroids.push([...data[idx]]);
                        used.add(idx);
                    }
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
                        if (counts[j] > 0) {
                            centroids[j] = [sums[j][0]/counts[j], sums[j][1]/counts[j], sums[j][2]/counts[j]];
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
        const pixelData = keys.map(key => key.split(',').map(Number));
    // choose k from selectedK but don't exceed available unique colors
    let k = Math.max(1, Math.min(selectedK || 3, keys.length));
    const kmeansResult = kmeans(pixelData, k, 8);
        const centroids = kmeansResult.centroids;

        // Plot points and centroids
        function plotRGBWithCentroids(r, g, b, name, size, color, centroids) {
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
                title: `3D RGB Plot — ${name} (k=${centroids.length})`,
                autosize: true,
                margin: { l: 0, r: 0, b: 0, t: 40, pad: 0 },
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
                const h = (container && container.clientHeight) ? container.clientHeight : Math.max(300, window.innerHeight - 200);
                layout.width = w;
                layout.height = h;
            } catch (e) {
                layout.width = Math.min(window.innerWidth, 800);
                layout.height = Math.max(300, window.innerHeight - 200);
            }
            Plotly.newPlot('plot', [trace, centroidTrace], layout);
        }

        plotRGBWithCentroids(rArr, gArr, bArr, name, sizeArr, colorArr, centroids);

        // Display centroid RGB values below the plot
        let centroidHtml = '<div style="margin-top:10px;font-size:1.1em"><b>K-means Centroids (k=' + centroids.length + '):</b><br>';
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
                console.log('[DEBUG] Reconstruction created', { reconW, reconH });

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
                    const sampleReconLabel = reconRowEl && reconRowEl.querySelector('.recon-label');
                    const sampleOrigLabel = origRowEl && origRowEl.querySelector('.recon-label');
                    const labelWidth = Math.max((sampleReconLabel && sampleReconLabel.clientWidth) || 92, (sampleOrigLabel && sampleOrigLabel.clientWidth) || 92);
                    const rowWidth = Math.min((reconRowEl && reconRowEl.clientWidth) || Infinity, (origRowEl && origRowEl.clientWidth) || Infinity);
                    const gap = 12;
                    const availableWidth = Math.max(64, Math.floor((isFinite(rowWidth) ? rowWidth : Math.max(reconstructedAreaEl.clientWidth, originalAreaEl.clientWidth)) - labelWidth - gap - 4));
                    const targetHeight = Math.max(64, Math.floor(Math.min((reconstructedAreaEl && reconstructedAreaEl.clientHeight) || Infinity, (originalAreaEl && originalAreaEl.clientHeight) || Infinity)));
                    const finalTargetHeight = (!isFinite(targetHeight) || targetHeight <= 0) ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--recon-display-height')) || 260 : targetHeight;
                    const dpr = window.devicePixelRatio || 1;
                    const displayW = availableWidth;
                    const displayH = finalTargetHeight;

                    const displayCanvas = document.createElement('canvas');
                    displayCanvas.className = 'recon-media';
                    displayCanvas.style.width = displayW + 'px';
                    displayCanvas.style.height = displayH + 'px';
                    displayCanvas.width = Math.max(1, Math.floor(displayW * dpr));
                    displayCanvas.height = Math.max(1, Math.floor(displayH * dpr));
                    displayCanvas.style.marginTop = '12px';
                    displayCanvas.style.background = 'transparent';
                    const dctx = displayCanvas.getContext('2d');
                    dctx.imageSmoothingEnabled = true;
                    dctx.imageSmoothingQuality = 'high';
                    dctx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
                    const scaleX = displayCanvas.width / reconCanvas.width;
                    const scaleY = displayCanvas.height / reconCanvas.height;
                    const scaleLocal = Math.min(scaleX, scaleY);
                    const destW = Math.max(1, Math.round(reconCanvas.width * scaleLocal));
                    const destH = Math.max(1, Math.round(reconCanvas.height * scaleLocal));
                    const offsetX = Math.round((displayCanvas.width - destW) / 2);
                    const offsetY = Math.round((displayCanvas.height - destH) / 2);
                    dctx.drawImage(reconCanvas, 0, 0, reconCanvas.width, reconCanvas.height, offsetX, offsetY, destW, destH);

                    if (reconRowEl) {
                        const holder = reconRowEl.querySelector('div:last-child');
                        holder.innerHTML = '';
                        holder.appendChild(displayCanvas);
                    }
                    if (origImg) {
                        origImg.width = displayW;
                        origImg.height = displayH;
                        origImg.style.width = displayW + 'px';
                        origImg.style.height = displayH + 'px';
                    }
                } catch (e) {
                    console.log('[DEBUG] renderReconstruction sizing/scale failed', e);
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
                    const useK = Math.max(1, Math.min(selectedK || 3, pixelData.length));
                    const newKmeans = kmeans(pixelData, useK, 8);
                    const newCentroids = newKmeans.centroids;
                    // update plot and summary
                    plotRGBWithCentroids(rArr, gArr, bArr, name, sizeArr, colorArr, newCentroids);
                    let centroidHtml = '<div style="margin-top:10px;font-size:1.1em"><b>K-means Centroids (k=' + newCentroids.length + '):</b><br>';
                    newCentroids.forEach((c,i)=>{
                        centroidHtml += `C${i+1}: <span style="color:rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)});font-weight:bold;">rgb(${Math.round(c[0]*255)},${Math.round(c[1]*255)},${Math.round(c[2]*255)})</span><br>`;
                    });
                    centroidHtml += '</div>';
                    const summaryEl2 = document.getElementById('centroidSummary');
                    if (summaryEl2) summaryEl2.innerHTML = centroidHtml;
                    // re-render reconstruction
                    renderReconstruction(newCentroids);
                } catch (e) {
                    console.log('[DEBUG] rerunClustering failed', e);
                }
            };
        }
    };
    img.onerror = function() {
        plotDiv.innerHTML = `<span style='color:red;'>Failed to load image for plotting.</span>`;
    };
}

imageSelect.addEventListener('change', () => {
    if (ignoreDropdownChange) return;
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
