/**
 * Converts public/logo.png to assets/icons/icon.ico using sharp
 * Creates ICO with embedded 16x16, 32x32, 48x48, 256x256 PNG images
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'public', 'logo.png');
const outputDir = path.join(__dirname, '..', 'assets', 'icons');
const outputPath = path.join(outputDir, 'icon.ico');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const sizes = [16, 32, 48, 256];

async function createIco() {
    console.log('🎨 Converting PNG to ICO...');
    console.log(`   Input:  ${inputPath}`);
    console.log(`   Output: ${outputPath}`);

    // Generate PNG buffers for each size
    const images = [];
    for (const size of sizes) {
        const buf = await sharp(inputPath)
            .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();
        images.push({ size, data: buf });
        console.log(`   ✓ Generated ${size}x${size} (${buf.length} bytes)`);
    }

    // Build ICO file manually
    // ICO format: Header (6 bytes) + Directory entries (16 bytes each) + Image data
    const numImages = images.length;
    const headerSize = 6;
    const dirEntrySize = 16;
    const dirSize = dirEntrySize * numImages;
    let dataOffset = headerSize + dirSize;

    // Calculate total size
    let totalSize = dataOffset;
    for (const img of images) {
        totalSize += img.data.length;
    }

    const ico = Buffer.alloc(totalSize);

    // ICO Header
    ico.writeUInt16LE(0, 0);        // Reserved
    ico.writeUInt16LE(1, 2);        // Type: 1 = ICO
    ico.writeUInt16LE(numImages, 4); // Number of images

    // Directory entries + image data
    let currentOffset = dataOffset;
    for (let i = 0; i < numImages; i++) {
        const img = images[i];
        const entryOffset = headerSize + (i * dirEntrySize);

        ico.writeUInt8(img.size === 256 ? 0 : img.size, entryOffset);      // Width (0 = 256)
        ico.writeUInt8(img.size === 256 ? 0 : img.size, entryOffset + 1);  // Height (0 = 256)
        ico.writeUInt8(0, entryOffset + 2);                                  // Color palette
        ico.writeUInt8(0, entryOffset + 3);                                  // Reserved
        ico.writeUInt16LE(1, entryOffset + 4);                               // Color planes
        ico.writeUInt16LE(32, entryOffset + 6);                              // Bits per pixel
        ico.writeUInt32LE(img.data.length, entryOffset + 8);                 // Image size
        ico.writeUInt32LE(currentOffset, entryOffset + 12);                  // Image offset

        // Copy image data
        img.data.copy(ico, currentOffset);
        currentOffset += img.data.length;
    }

    fs.writeFileSync(outputPath, ico);
    console.log(`✅ Icon created successfully! (${(totalSize / 1024).toFixed(1)} KB)`);
}

createIco().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
