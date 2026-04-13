// Declare CSS files as side-effect modules so TypeScript doesn't error on
// `import './globals.css'` style imports (TS2882 with moduleResolution: bundler).
declare module "*.css" {}
