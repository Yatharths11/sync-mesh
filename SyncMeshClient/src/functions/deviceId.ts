import Keychain from 'react-native-keychain';
import { v4 as uuidv4 } from 'uuid';

// deviceId.js

export async function getOrCreateDeviceId() {
  try {
    const stored = await Keychain.getGenericPassword({ service: 'deviceId' });

    if (stored) {
      return stored.password;
    }

    const newId = uuidv4();

    await Keychain.setGenericPassword('deviceId', newId, {
      service: 'deviceId',
    });

    return newId;
  } catch (error) {
    console.log('logging the error in deviceId:', error);
		
		return null;
  }
}
