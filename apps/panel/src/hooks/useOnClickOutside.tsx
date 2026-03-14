import { useEffect, RefObject } from "react";

type TypeUseOnClickOutside = {
  refs: RefObject<HTMLElement | null>[];
  onClickOutside: () => void;
};

export const useOnClickOutside = ({ refs, onClickOutside }: TypeUseOnClickOutside) => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (refs.every((ref) => ref.current && !ref.current.contains(event.target as Node))) {
        onClickOutside();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [refs, onClickOutside]);
};
