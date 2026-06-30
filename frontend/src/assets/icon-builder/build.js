const fs = require('fs');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const frontendIconDir = path.resolve(__dirname, '..', '..', '..', 'icon');
const buildDir = path.resolve(__dirname, '..', '..', '..', '..', 'build');
const buildWindowsDir = path.join(buildDir, 'windows');

const icons = ['tray', 'tray_tun', 'tray_proxy', 'tray_mixed'];
const sizes = [256, 64, 32, 16];

async function main() {
    // Ensure directories exist
    if (!fs.existsSync(frontendIconDir)) fs.mkdirSync(frontendIconDir, { recursive: true });
    if (!fs.existsSync(buildWindowsDir)) fs.mkdirSync(buildWindowsDir, { recursive: true });

    for (const name of icons) {
        const svgPath = path.join(srcDir, `${name}.svg`);
        const icoPathDest = path.join(frontendIconDir, `${name}.ico`);

        if (!fs.existsSync(svgPath)) {
            console.warn(`[SKIP] SVG not found: ${svgPath}`);
            continue;
        }

        const svgBuffer = fs.readFileSync(svgPath);
        const buffers = [];
        
        for (const size of sizes) {
            let img = sharp(svgBuffer, { density: 300 }).resize(size, size, {
                kernel: sharp.kernel.lanczos3
            });
            if (size === 16) {
                img = img.sharpen();
            }
            buffers.push(await img.png().toBuffer());
        }

        // Create the ICO and save to frontend directory
        const icoBuffer = await pngToIco(buffers);
        fs.writeFileSync(icoPathDest, icoBuffer);
        
        // If this is the main tray icon, also copy it to Wails build folders
        if (name === 'tray') {
            const mainIcoDest = path.join(buildWindowsDir, 'icon.ico');
            const mainPngDest = path.join(buildDir, 'appicon.png');
            
            fs.writeFileSync(mainIcoDest, icoBuffer);
            // Wails uses 1024x1024 for appicon.png for Mac/Linux usually, but 256x256 is fine for Windows
            await sharp(svgBuffer, { density: 300 }).resize(1024, 1024, {
                kernel: sharp.kernel.lanczos3
            }).png().toFile(mainPngDest);
            
            console.log(`Updated build/windows/icon.ico and build/appicon.png`);
        }

        console.log(`[OK] Successfully built ${name}.ico`);
    }
    console.log('\nAll icons compiled successfully! You can now run `wails build`.');
}

main().catch(console.error);
