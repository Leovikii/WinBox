const fs = require('fs');
const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const frontendIconDir = path.resolve(__dirname, '..', '..', '..', 'icon');
const repoDir = path.resolve(__dirname, '..', '..', '..', '..');
const tauriIconDir = path.join(repoDir, 'src-tauri', 'icons');

const icons = ['tray', 'tray_tun', 'tray_proxy', 'tray_mixed'];
const sizes = [256, 64, 32, 16];

async function main() {
    // Ensure directories exist
    if (!fs.existsSync(frontendIconDir)) fs.mkdirSync(frontendIconDir, { recursive: true });
    if (!fs.existsSync(tauriIconDir)) fs.mkdirSync(tauriIconDir, { recursive: true });

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
        
        // Keep the main icon in the Tauri bundle input directory.
        if (name === 'tray') {
            const mainIcoDest = path.join(tauriIconDir, 'icon.ico');
            
            fs.writeFileSync(mainIcoDest, icoBuffer);
            
            console.log(`Updated src-tauri/icons/icon.ico`);
        }

        console.log(`[OK] Successfully built ${name}.ico`);
    }
    console.log('\nAll icons compiled successfully! You can now run `cargo tauri build`.');
}

main().catch(console.error);
