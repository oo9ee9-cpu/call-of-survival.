const B = 'window document performance requestAnimationFrame cancelAnimationFrame localStorage sessionStorage navigator fetch Image HTMLCanvasElement HTMLImageElement URL Blob atob btoa setTimeout clearTimeout setInterval clearInterval console AudioContext webkitAudioContext OffscreenCanvas createImageBitmap TextDecoder TextEncoder location screen matchMedia getComputedStyle devicePixelRatio innerWidth innerHeight addEventListener removeEventListener structuredClone queueMicrotask PointerEvent KeyboardEvent ResizeObserver Worker Response crypto indexedDB alert confirm ImageData DOMMatrix Path2D Event CustomEvent requestIdleCallback visualViewport history THREE SkeletonUtils Promise DecompressionStream CompressionStream URLSearchParams BroadcastChannel File';
const globals = Object.fromEntries(B.split(/\s+/).map((k) => [k, 'readonly']));
export default [{
  files: ['**/*.js'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals },
  rules: { 'no-undef': 'error', 'no-redeclare': 'error', 'no-dupe-keys': 'error', 'no-const-assign': 'error', 'no-dupe-args': 'error', 'no-unreachable': 'warn', 'no-self-assign': 'warn', 'no-dupe-else-if': 'warn', 'no-duplicate-case': 'error', 'no-func-assign': 'error', 'no-import-assign': 'error', 'use-isnan': 'error', 'valid-typeof': 'error', 'no-unsafe-negation': 'error', 'getter-return': 'error' },
}];
