import { defineConfig } from 'tsup';

// Gera ESM (web) e CommonJS (api) com tipos.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
});
