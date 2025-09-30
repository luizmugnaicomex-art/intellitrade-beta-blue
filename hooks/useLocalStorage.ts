import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            // Don't parse 'null' or 'undefined' strings from localStorage
            if (item && item !== 'null' && item !== 'undefined') {
                return JSON.parse(item);
            }
            return initialValue instanceof Function ? initialValue() : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue instanceof Function ? initialValue() : initialValue;
        }
    });

    useEffect(() => {
        try {
            const valueToStore = JSON.stringify(storedValue);
            window.localStorage.setItem(key, valueToStore);
        } catch (error) {
            console.error(`Error saving to localStorage key “${key}”:`, error);
        }
    }, [key, storedValue]);

    return [storedValue, setStoredValue];
}
