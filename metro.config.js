// Keep Metro away from the large project-local folders (toolchain, caches, native builds), which
// otherwise make it crawl hundreds of thousands of files before bundling.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const ignored = ['.toolchain', '.g', '.localdb', '.npm-cache', 'android', 'ios', 'dist'].map(
  (dir) => new RegExp(`^${path.resolve(__dirname, dir).replace(/[\\/.^$*+?()[\]{}|-]/g, '\\$&')}[\\\\/].*`),
);
const existing = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(existing) ? existing : existing ? [existing] : []), ...ignored];

module.exports = config;
