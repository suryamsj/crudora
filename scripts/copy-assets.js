import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy templates
copyDir('templates', 'dist/templates');
copyDir('scripts', 'dist/scripts');

// Make sure bin directory exists
if (!fs.existsSync('dist/bin')) {
  fs.mkdirSync('dist/bin', { recursive: true });
}

// Ensure bin file is executable
if (fs.existsSync('bin/crudora.js')) {
  fs.copyFileSync('bin/crudora.js', 'dist/bin/crudora.js');
  try {
    // Make executable on Unix systems
    fs.chmodSync('dist/bin/crudora.js', '755');
  } catch (error) {
    // Ignore errors on Windows
  }
}

console.log('✅ Assets copied to dist/');
