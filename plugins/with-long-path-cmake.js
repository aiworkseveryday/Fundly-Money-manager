// Windows: the default CMake 3.22 bundles ninja 1.10, which cannot handle paths over 260 chars and breaks
// the C++ builds of react-native-screens / worklets in deeply nested folders. Point Gradle at a newer CMake
// (ninja 1.12+, long-path aware) when it is installed. Requires LongPathsEnabled=1 in the Windows registry.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const CMAKE_VERSION = '3.31.6';

module.exports = function withLongPathCmake(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
      if (process.platform !== 'win32' || !sdk) return cfg;
      const cmakeDir = path.join(sdk, 'cmake', CMAKE_VERSION);
      if (!fs.existsSync(cmakeDir)) return cfg;

      const file = path.join(cfg.modRequest.platformProjectRoot, 'local.properties');
      const esc = (p) => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
      const lines = (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
        .split(/\r?\n/)
        .filter((l) => l && !l.startsWith('cmake.dir=') && !l.startsWith('sdk.dir='));
      lines.push(`sdk.dir=${esc(sdk)}`, `cmake.dir=${esc(cmakeDir)}`);
      fs.writeFileSync(file, lines.join('\n') + '\n');
      return cfg;
    },
  ]);
};
