import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// NOTE: unlike Mapbox GL JS, MapLibre GL JS must NOT be excluded from dep
// optimization. Excluding it makes Vite serve the raw dist, which doesn't expose
// a `default` export — `import maplibregl from 'maplibre-gl'` then throws and the
// whole app fails to mount (blank screen). Let Vite pre-bundle it normally.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
})
