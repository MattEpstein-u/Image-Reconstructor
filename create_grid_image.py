
import numpy as np
from PIL import Image

def create_rgb_grid_image(steps=128, filename='rgb_grid_128.png'):
    """
    Generates a PNG image with pixels forming a perfect grid in the RGB space.

    Args:
        steps (int): The number of points for each color channel (R, G, B).
        filename (str): The name of the output image file.
    """
    num_colors = steps * steps * steps
    
    # Determine image dimensions that can hold all the colors
    # We'll aim for a roughly square image
    width = int(np.ceil(np.sqrt(num_colors)))
    height = int(np.ceil(num_colors / width))
    num_pixels = width * height

    print(f"Creating an image of size {width}x{height} to hold {num_colors} colors.")

    # Create linearly spaced values for R, G, B from 0 to 255
    r_vals = np.linspace(0, 255, steps, dtype=np.uint8)
    g_vals = np.linspace(0, 255, steps, dtype=np.uint8)
    b_vals = np.linspace(0, 255, steps, dtype=np.uint8)
    
    # Create a grid of colors using meshgrid
    r, g, b = np.meshgrid(r_vals, g_vals, b_vals)
    
    # Flatten the arrays and stack them to get a list of colors
    # This creates the colors in a structured order
    colors = np.stack([r.flatten(), g.flatten(), b.flatten()], axis=1)
    
    # Create the image array
    image_array = np.zeros((height, width, 3), dtype=np.uint8)
    
    # Fill the image array with the generated colors
    # We'll have a small number of black pixels at the end if num_pixels > num_colors
    image_array.reshape(-1, 3)[:num_colors] = colors
    
    # Create an image from the array
    img = Image.fromarray(image_array, 'RGB')
    
    # Save the image
    img.save(filename)
    print(f"Image '{filename}' created successfully with a {steps}x{steps}x{steps} grid of colors.")

if __name__ == '__main__':
    # Using 128 steps as requested for a 128x128x128 grid
    create_rgb_grid_image(steps=128)
