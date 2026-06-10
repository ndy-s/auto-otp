import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './extension/manifest.json';
import fs from 'fs';
import path from 'path';

const manifestFixer = () => {
  return {
    name: 'manifest-fixer',
    closeBundle() {
      const manifestPath = path.resolve(__dirname, 'dist/manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifestObj = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        if (manifestObj.background && manifestObj.background.service_worker) {
          manifestObj.background.scripts = [manifestObj.background.service_worker];
          fs.writeFileSync(manifestPath, JSON.stringify(manifestObj, null, 2));
        }
      }
    }
  };
};

export default defineConfig({
  plugins: [crx({ manifest }), manifestFixer()],
});
