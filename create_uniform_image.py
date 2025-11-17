
import numpy as np
from PIL import Image

def create_uniform_rgb_image(width=256, height=256, filename='uniform_rgb_image.png'):
    """
    Generates a PNG image with pixels uniformly distributed throughout the RGB space.

    Args:
        width (int): The width of the image.
        height (int): The height of the image.
        filename (str): The name of the output image file.
    """
    num_pixels = width * height
    
    # We want to distribute the pixels as evenly as possible in the 256x256x256 RGB cube.
    # We can determine the number of steps for each color channel.
    steps = int(np.ceil(num_pixels**(1/3)))
    
    # Create linearly spaced values for R, G, B
    r_vals = np.linspace(0, 255, steps)
    g_vals = np.linspace(0, 255, steps)
    b_vals = np.linspace(0, 255, steps)
    
    # Create a grid of colors using meshgrid
    r, g, b = np.meshgrid(r_vals, g_vals, b_vals)
    
    # Flatten the arrays and stack them to get a list of colors
    colors = np.stack([r.flatten(), g.flatten(), b.flatten()], axis=1)
    
    # We'll have steps^3 colors. This might be more than num_pixels.
    # We'll take the first num_pixels colors.
    # Shuffle to make the image look random.
    np.random.shuffle(colors)
    pixel_colors = colors[:num_pixels]
    
    # Create the image
    image_array = np.zeros((height, width, 3), dtype=np.uint8)
    
    # Fill the image array with the generated colors
    image_array.reshape(-1, 3)[:] = pixel_colors.astype(np.uint8)
    
    # Create an image from the array
    img = Image.fromarray(image_array, 'RGB')
    
    # Save the image
    img.save(filename)
    print(f"Image '{filename}' created successfully with {num_pixels} uniformly distributed colors.")

if __name__ == '__main__':
    create_uniform_rgb_image()
