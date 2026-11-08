import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  publicDir: '../public',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Phantom Audit — Haunted Mansion Accessibility Auditor',
    description:
      'Privacy-first accessibility auditor disguised as an interactive haunted Victorian mansion.',
    version: '0.1.0',
    permissions: ['activeTab', 'scripting', 'storage'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'none';",
    },
    action: {
      default_title: 'Open Phantom Audit Mansion',
      default_icon: {
        16: '/icons/icon-16.png',
        32: '/icons/icon-32.png',
        48: '/icons/icon-48.png',
        128: '/icons/icon-128.png',
      },
    },
    icons: {
      16: '/icons/icon-16.png',
      32: '/icons/icon-32.png',
      48: '/icons/icon-48.png',
      128: '/icons/icon-128.png',
    },
  },
  vite: () => ({
    resolve: {
      alias: {
        '@': `${__dirname}/src`,
      },
    },
  }),
});
