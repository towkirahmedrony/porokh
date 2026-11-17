import { STORAGE_KEYS } from '../constants/storageKeys';
import { StorageUtils } from './storage';

const createDeviceId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `device_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
};

export const getDeviceId = (): string => {
  const existingDeviceId = StorageUtils.get<string>(STORAGE_KEYS.DEVICE_ID);
  
  if (existingDeviceId) {
    return existingDeviceId;
  }
  
  const deviceId = createDeviceId();
  // StorageUtils ব্যবহার করে সেভ করা হলো
  StorageUtils.set(STORAGE_KEYS.DEVICE_ID, deviceId);
  return deviceId;
};
