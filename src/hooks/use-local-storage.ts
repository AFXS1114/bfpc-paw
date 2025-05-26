"use client";

import type { Dispatch, SetStateAction } from 'react';
import { useState, useEffect, useCallback } from 'react';

type SetValue<T> = Dispatch<SetStateAction<T>>;

export function useLocalStorage<T>(key: string, initialValue: T): [T, SetValue<T>] {
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [initialValue, key]);

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue: SetValue<T> = useCallback(
    (value) => {
      if (typeof window === 'undefined') {
        console.warn(
          `Tried setting localStorage key "${key}" even though environment is not a client`
        );
        return;
      }
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        setStoredValue(valueToStore);
        // Dispatch a custom event to notify other tabs/windows
        window.dispatchEvent(new StorageEvent('local-storage-updated', { key }));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  useEffect(() => {
    setStoredValue(readValue());
  }, [readValue]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.storageArea === window.localStorage) {
         if (event.newValue) {
            setStoredValue(JSON.parse(event.newValue) as T);
         } else {
            setStoredValue(initialValue);
         }
      }
    };
    
    // For custom event from the same tab
    const handleLocalStorageUpdated = (event: Event) => {
        const customEvent = event as StorageEvent;
        if (customEvent.key === key) {
            setStoredValue(readValue());
        }
    };


    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-updated', handleLocalStorageUpdated);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-updated', handleLocalStorageUpdated);
    };
  }, [key, initialValue, readValue]);

  return [storedValue, setValue];
}
