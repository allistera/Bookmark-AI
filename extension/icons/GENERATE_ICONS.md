# Generating Extension Icons

The extension needs PNG icons in the following sizes:
- 16x16 (icon16.png)
- 32x32 (icon32.png)
- 48x48 (icon48.png)
- 128x128 (icon128.png)

## Option 1: Use the SVG file

An SVG icon is provided in `icon.svg`. You can convert it to PNG using:

### Using ImageMagick:
```bash
convert -background none -resize 16x16 icon.svg icon16.png
convert -background none -resize 32x32 icon.svg icon32.png
convert -background none -resize 48x48 icon.svg icon48.png
convert -background none -resize 128x128 icon.svg icon128.png
```

### Using Inkscape:
```bash
inkscape icon.svg --export-filename=icon16.png --export-width=16 --export-height=16
inkscape icon.svg --export-filename=icon32.png --export-width=32 --export-height=32
inkscape icon.svg --export-filename=icon48.png --export-width=48 --export-height=48
inkscape icon.svg --export-filename=icon128.png --export-width=128 --export-height=128
```

### Using Online Tools:
1. Go to https://cloudconvert.com/svg-to-png
2. Upload `icon.svg`
3. Set the output dimensions
4. Download each size

## Option 2: Create Your Own Icons

You can replace `icon.svg` with your own design and follow the same conversion process.

## Option 3: Use Placeholder Icons (For Testing Only)

For quick testing, you can create simple colored squares:

```bash
# Create solid blue squares as placeholders
convert -size 16x16 xc:#0066cc icon16.png
convert -size 32x32 xc:#0066cc icon32.png
convert -size 48x48 xc:#0066cc icon48.png
convert -size 128x128 xc:#0066cc icon128.png
```

**Note:** The extension will not load properly without these PNG files. Make sure to generate them before loading the extension in Chrome.
