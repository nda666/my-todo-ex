import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
} from 'react';

import { useLocation } from 'react-router-dom';

const scrollPositions = new Map<string, number>();

interface ScrollRestorationContextValue {
  restoreScroll: () => void;
}

const ScrollRestorationContext =
  createContext<ScrollRestorationContextValue | null>(null);

export function ScrollRestorationProvider({
  children,
}: PropsWithChildren) {
  const { pathname } = useLocation();

  const restoreScroll = useCallback(() => {
    const saved = scrollPositions.get(pathname);

    window.scrollTo({
      top: saved ?? 0,
      behavior: "instant" as ScrollBehavior,
    });
  }, [pathname]);

  // simpan posisi scroll secara kontinu
  useEffect(() => {
    const handleScroll = () => {
      scrollPositions.set(pathname, window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  // otomatis restore saat route berubah
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      restoreScroll();
    }, 500);

    return () => clearTimeout(timer);
  }, [pathname, restoreScroll]);

  return (
    <ScrollRestorationContext.Provider value={{ restoreScroll }}>
      {children}
    </ScrollRestorationContext.Provider>
  );
}

export function useScrollRestoration() {
  const ctx = useContext(ScrollRestorationContext);

  if (!ctx) {
    throw new Error(
      "useScrollRestoration must be used inside ScrollRestorationProvider"
    );
  }

  return ctx;
}