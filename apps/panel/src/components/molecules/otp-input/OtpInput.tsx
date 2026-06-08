import { memo, useMemo, useRef } from "react";
import styles from "./OtpInput.module.scss";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Number of digits. Defaults to 6 (TOTP). */
  length?: number;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  /** Fired when the last digit is filled, with the completed code. */
  onComplete?: (value: string) => void;
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");

/**
 * Segmented one-time-password input: one box per digit with auto-advance,
 * backspace-to-previous, arrow navigation and full-code paste support. The
 * value is kept as a single string in the parent for easy submission.
 */
const OtpInput = ({
  value,
  onChange,
  length = 6,
  disabled = false,
  hasError = false,
  autoFocus = true,
  onComplete,
}: OtpInputProps) => {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const digits = useMemo(() => {
    const chars = value.split("").slice(0, length);
    return Array.from({ length }, (_, i) => chars[i] ?? "");
  }, [value, length]);

  const focusInput = (index: number) => {
    const clamped = Math.max(0, Math.min(length - 1, index));
    inputsRef.current[clamped]?.focus();
    inputsRef.current[clamped]?.select();
  };

  const commit = (next: string) => {
    const sanitized = onlyDigits(next).slice(0, length);
    onChange(sanitized);
    if (sanitized.length === length) onComplete?.(sanitized);
    return sanitized;
  };

  const handleChange = (index: number, raw: string) => {
    const typed = onlyDigits(raw);
    if (!typed) return;

    // Replace the current slot, then fill subsequent slots if multiple chars
    // were entered (e.g. autofill of the whole code into one box).
    const chars = digits.slice();
    let cursor = index;
    for (const ch of typed) {
      if (cursor >= length) break;
      chars[cursor] = ch;
      cursor++;
    }
    commit(chars.join(""));
    focusInput(cursor);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const chars = digits.slice();
      if (chars[index]) {
        chars[index] = "";
        commit(chars.join(""));
      } else if (index > 0) {
        chars[index - 1] = "";
        commit(chars.join(""));
        focusInput(index - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusInput(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = commit(e.clipboardData.getData("text"));
    focusInput(pasted.length);
  };

  return (
    <div className={styles.otpRow}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={el => { inputsRef.current[index] = el; }}
          className={`${styles.otpBox} ${hasError ? styles.otpBoxError : ""} ${digit ? styles.otpBoxFilled : ""}`}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`Digit ${index + 1}`}
          onChange={e => handleChange(index, e.target.value)}
          onKeyDown={e => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={e => e.target.select()}
        />
      ))}
    </div>
  );
};

export default memo(OtpInput);
