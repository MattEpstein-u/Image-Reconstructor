// List of image filenames in the images folder

const gallery = document.getElementById('gallery');

fetch('images.json')
    .then(response => response.json())
    .then(imageFiles => {
        imageFiles.forEach(file => {
            const container = document.createElement('div');
            container.className = 'image-container';
            const img = document.createElement('img');
            img.src = `images/${file}`;
            img.alt = file;
            const label = document.createElement('div');
            label.className = 'image-label';
            label.textContent = file;
            container.appendChild(img);
            container.appendChild(label);
            gallery.appendChild(container);
            // Add click event to redirect to stats.html with image info
            img.addEventListener('click', () => {
                let url = 'stats.html?image=' + encodeURIComponent(file);
                window.location.href = url;
            });
        });
        // Only append the upload box after all images
        gallery.appendChild(uploadBox);
    });

// Add a final box for 'upload image' with upload functionality
const uploadBox = document.createElement('div');
uploadBox.className = 'image-container upload-image-box';
uploadBox.style.cursor = 'pointer';
const uploadLabel = document.createElement('div');
uploadLabel.className = 'upload-label';
uploadLabel.textContent = 'upload image';
uploadBox.appendChild(uploadLabel);

// Create a hidden file input
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/*';
fileInput.style.display = 'none';
uploadBox.appendChild(fileInput);

uploadBox.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const container = document.createElement('div');
            container.className = 'image-container';
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = file.name;
            const label = document.createElement('div');
            label.className = 'image-label';
            label.textContent = file.name;
            container.appendChild(img);
            container.appendChild(label);
            // Insert before the upload box
            gallery.insertBefore(container, uploadBox);
            // Add click event to select uploaded image and show RGB stats
            img.addEventListener('click', () => {
                sessionStorage.setItem('uploadedImageSrc', img.src);
                sessionStorage.setItem('uploadedImageName', file.name);
                window.location.href = 'stats.html?uploaded=1';
            });
        };
        reader.readAsDataURL(file);
    }
});

gallery.appendChild(uploadBox);
