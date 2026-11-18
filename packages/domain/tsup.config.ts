import { defineConfig } from 'tsup';

// Gera ESM e CommonJS com tipos.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
});
