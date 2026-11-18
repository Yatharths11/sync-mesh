// Minimal stand-in for lib0's "react-native" webcrypto export (lib0/dist/webcrypto.react-native.cjs),
// which otherwise pulls in isomorphic-webcrypto's expo-random/expo-modules-core chain that Metro
// can't resolve in a bare RN CLI app. lib0/random (used by yjs for client IDs) only needs getRandomValues.
// Requires 'react-native-get-random-values' to be imported once at app entry before any yjs usage.
export const getRandomValues = (array) => global.crypto.getRandomValues(array);
export const subtle = global.crypto ? global.crypto.subtle : undefined;
// lib0/dist/webcrypto.react-native.cjs calls .ensureSecure() unconditionally on this
// default export (a no-op in the real isomorphic-webcrypto module too, once a native
// RNG is present) -- must exist or that call throws "undefined is not a function".
export const ensureSecure = () => {};
export default { getRandomValues, subtle, ensureSecure };
