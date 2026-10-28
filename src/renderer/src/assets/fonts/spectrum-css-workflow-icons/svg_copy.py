import os
import re
import shutil

# --- CONFIGURATION ---
# ASSETS_ROOT = "./assets-test"                # Root folder that contains subdirectories like "Access Time", "Accessibility", etc.
ASSETS_ROOT = "./assets"                # Root folder that contains subdirectories like "Access Time", "Accessibility", etc.
# DESTINATION_DIR = "./svgs-test"    # Where all SVG files will be copied
DESTINATION_DIR = "./svg"    # Where all SVG files will be copied
# DESTINATION_DIR = "./svgs"    # Where all SVG files will be copied

# Create destination folder if it doesn't exist
os.makedirs(DESTINATION_DIR, exist_ok=True)

# Regex to match fill attributes
FILL_REGEX = re.compile(r'fill="[^"]*"')

# Walk through all direct children files recursively
for root, dirs, files in os.walk(ASSETS_ROOT):
    for file in files:
        if file.lower().endswith(".svg"):
            source_path = os.path.join(root, file)

            # Preserve relative folder structure inside DESTINATION_DIR
            # rel_path = os.path.relpath(root, ASSETS_ROOT)
            # dest_folder = os.path.join(DESTINATION_DIR, rel_path)
            # os.makedirs(dest_folder, exist_ok=True)

            # dest_path = os.path.join(dest_folder, file)
            dest_path = os.path.join(DESTINATION_DIR, file)

            # Read SVG content
            with open(source_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Replace all fill="..." with fill="currentColor"
            content = FILL_REGEX.sub('fill="currentColor"', content)

            # Write the modified content to the destination
            with open(dest_path, "w", encoding="utf-8") as f:
                f.write(content)

            print(f"Copied & updated: {source_path} → {dest_path}")

print("✅ All SVG files processed recursively!")
