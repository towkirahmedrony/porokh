import { useState, useEffect, useCallback } from 'react';
import { StorageKey, LOCAL_STORAGE_SYNC_EVENT } from '../constants/storageKeys';

export function useLocalStorage<T>(key: StorageKey, initialValue: T) {
  
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    if (typeof window === 'undefined') return;
    
    setStoredValue(prev => {
      try {
        const newValue = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(newValue));
        // FIXED: Dispatch CustomEvent with specific key details
        window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_SYNC_EVENT, { detail: { key } }));
        return newValue;
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
        return prev;
      }
    });
  }, [key]);

  const removeValue = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
      setStoredValue(readValue());
      window.dispatchEvent(new CustomEvent(LOCAL_STORAGE_SYNC_EVENT, { detail: { key } }));
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, readValue]);

  useEffect(() => {
    setStoredValue(readValue());

    const handleStorageChange = (event: StorageEvent | CustomEvent) => {
      // FIXED: Only update state if the specific key matches
      if (event.type === 'storage') {
        if ((event as StorageEvent).key && (event as StorageEvent).key !== key) return;
      } else if (event.type === LOCAL_STORAGE_SYNC_EVENT) {
        if ((event as CustomEvent).detail?.key && (event as CustomEvent).detail.key !== key) return;
      }
      setStoredValue(readValue());
    };

    window.addEventListener('storage', handleStorageChange as EventListener); 
    window.addEventListener(LOCAL_STORAGE_SYNC_EVENT, handleStorageChange as EventListener); 

    return () => {
      window.removeEventListener('storage', handleStorageChange as EventListener);
      window.removeEventListener(LOCAL_STORAGE_SYNC_EVENT, handleStorageChange as EventListener);
    };
  }, [key, readValue]);

  return [storedValue, setValue, removeValue] as const;
}
