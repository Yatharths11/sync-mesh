const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const path = require('path');

const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'isomorphic-webcrypto/src/react-native') {
        return {
          type: 'sourceFile',
          filePath: path.resolve(__dirname, 'src/polyfills/webcrypto-react-native.js'),
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
