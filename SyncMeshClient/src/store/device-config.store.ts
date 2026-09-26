import { create } from 'zustand';

type DeviceState = {
  deviceId: string | null;
  setDeviceId: (deviceId: string) => void;
};

const useDeviceId = create<DeviceState>(set => ({
  deviceId: null,

  setDeviceId: deviceId => {
    set({ deviceId });
  },
}));

export { useDeviceId };
