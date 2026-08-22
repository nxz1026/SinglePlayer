/**
 * 单身汉（DSH）播放器构建配置 —— 双产物：
 * 1. lib/index.js   宿主半（Node ESM，dsh Cordis loader 加载）
 * 2. lib/client.js  浏览器半（CJS 闭包工厂，window.__ModuleLoader__.load 包裹，
 *    基线模块表 react/react-dom/cordis/slots/primitives/runtime 走注入 require，其余内联）
 */
import type { UserConfig } from 'tsdown'

const PKG_ID = 'dsh-music-huazai'

/** dsh 平台基线模块表（packages/client/web/src/platform.ts），require 可解析。 */
const BASELINE = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-runtime/client',
])

const lib: UserConfig = {
  name: PKG_ID,
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
}

const client: UserConfig = {
  name: `${PKG_ID}/client`,
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: specifier => BASELINE.has(specifier),
    alwaysBundle: specifier => !BASELINE.has(specifier),
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PKG_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [lib, client]
