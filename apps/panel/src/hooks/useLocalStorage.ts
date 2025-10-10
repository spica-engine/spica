import {useState, useEffect} from "react";

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void, () => void] {
  const readValue = (): T => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState<T>(readValue);

  const setValue = (value: T) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        window.dispatchEvent(new CustomEvent("local-storage-update", {detail: {key}}));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key) setStoredValue(readValue());
    };

    const handleCustomEvent = (event: CustomEvent) => {
      if (event.detail?.key === key) setStoredValue(readValue());
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("local-storage-update", handleCustomEvent as EventListener);

    setStoredValue(readValue());

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("local-storage-update", handleCustomEvent as EventListener);
    };
  }, [key]);

  const deleteValue = () => {
    window.localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent("local-storage-update", {detail: {key}}));
  };

  return [storedValue, setValue, deleteValue];
}

export default useLocalStorage;
