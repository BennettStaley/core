import type { MetadataRoute } from 'next'

/**
 * Web app manifest so "Add to Home Screen" installs sleepypod as a standalone,
 * full-screen app (no Safari chrome) with the proper icon and dark splash.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'sleepypod',
    short_name: 'sleepypod',
    description: 'Local control for your Pod',
    start_url: '/en',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
