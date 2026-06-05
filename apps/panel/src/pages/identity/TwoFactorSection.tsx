import { useState } from "react";
import { Button, Icon } from "oziko-ui-kit";
import {
  useStartFactorVerificationMutation,
  useCompleteFactorVerificationMutation,
  useDeleteAuthFactorMutation,
  type Identity,
} from "../../store/api/identityApi";
import OtpInput from "../../components/molecules/otp-input/OtpInput";
import styles from "./TwoFactorSection.module.scss";

const OTP_LENGTH = 6;

const getErrorMessage = (error: any, fallback: string): string => {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  return error.data?.message || error.data?.error || error.error || error.message || fallback;
};

type TwoFactorSectionProps = {
  identity: Identity;
};

/**
 * Enable/disable TOTP two-factor auth for a single identity. Self-contained:
 * it drives the start → confirm → persist flow against the passport factor
 * endpoints and manages its own state, independent of the drawer's Save button.
 */
const TwoFactorSection = ({ identity }: TwoFactorSectionProps) => {
  const id = identity._id ?? "";

  const [startVerification, { isLoading: isStarting }] = useStartFactorVerificationMutation();
  const [completeVerification, { isLoading: isVerifying }] = useCompleteFactorVerificationMutation();
  const [disableFactor, { isLoading: isDisabling }] = useDeleteAuthFactorMutation();

  // QR challenge while enrolling; null when not in the setup flow.
  const [challenge, setChallenge] = useState<string | null>(null);
  // Reveal the code input only after the user confirms they've scanned the QR.
  const [scanned, setScanned] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDisable, setConfirmingDisable] = useState(false);

  // Optimistic overrides so the UI flips immediately, before the identity list
  // refetch (triggered by tag invalidation) propagates a fresh `authFactor`.
  const [justEnabled, setJustEnabled] = useState(false);
  const [justDisabled, setJustDisabled] = useState(false);

  const enabled = justEnabled || (!!identity.authFactor && !justDisabled);

  const resetSetup = () => {
    setChallenge(null);
    setScanned(false);
    setOtp("");
    setError(null);
  };

  // Begin (or restart) enrollment: fetch a fresh secret + QR. `keepError` lets a
  // failed verification re-arm the flow without wiping the message explaining why.
  const handleEnable = async (keepError = false) => {
    if (!keepError) setError(null);
    setScanned(false);
    setOtp("");
    try {
      const res = await startVerification({ id, meta: { type: "totp", config: {} } }).unwrap();
      setChallenge(res.challenge);
    } catch (e) {
      setChallenge(null);
      setError(getErrorMessage(e, "Could not start 2FA setup."));
    }
  };

  const handleVerify = async (code: string) => {
    if (code.length < OTP_LENGTH || isVerifying) return;
    setError(null);
    try {
      await completeVerification({ id, answer: code }).unwrap();
      setJustDisabled(false);
      setJustEnabled(true);
      resetSetup();
    } catch (e) {
      // The server discards the pending factor on a failed attempt, so a retry
      // needs a brand-new secret/QR. Re-arm enrollment and keep the error shown.
      setError(getErrorMessage(e, "Invalid or expired code. Scan the new QR code and try again."));
      handleEnable(true);
    }
  };

  const handleDisable = async () => {
    setError(null);
    try {
      await disableFactor(id).unwrap();
      setJustEnabled(false);
      setJustDisabled(true);
      setConfirmingDisable(false);
    } catch (e) {
      setError(getErrorMessage(e, "Could not disable 2FA."));
    }
  };

  const isEnrolling = challenge !== null;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <div className={styles.title}>
            <Icon name="lock" size="xs" />
            Two-factor authentication
          </div>
          <div className={styles.subtitle}>
            Require a time-based one-time code (Google Authenticator, Authy, …) at login.
          </div>
        </div>
        <span className={`${styles.badge} ${enabled ? styles.badgeOn : styles.badgeOff}`}>
          <span className={styles.dot} />
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      <div className={styles.body}>
        {/* Enrollment — step 1: scan the QR */}
        {isEnrolling && !scanned && (
          <>
            <div className={styles.qrWrap}>
              <img className={styles.qr} src={challenge!} alt="Authenticator QR code" />
            </div>
            <div className={styles.hint}>
              Scan this QR code with your authenticator app (Google Authenticator, Authy, …).
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.actions}>
              <Button
                color="default"
                variant="outlined"
                dimensionX="fill"
                disabled={isStarting}
                onClick={resetSetup}
                style={{ height: 34 }}
              >
                Cancel
              </Button>
              <Button
                dimensionX="fill"
                loading={isStarting}
                disabled={isStarting}
                onClick={() => { setError(null); setScanned(true); }}
                style={{ height: 34 }}
              >
                <Icon name="check" size="xs" />
                I've scanned it
              </Button>
            </div>
          </>
        )}

        {/* Enrollment — step 2: enter the code */}
        {isEnrolling && scanned && (
          <>
            <div className={styles.hint}>
              Enter the 6 digit code shown in your authenticator app.
            </div>
            <OtpInput
              value={otp}
              onChange={setOtp}
              length={OTP_LENGTH}
              disabled={isVerifying}
              hasError={!!error}
              onComplete={handleVerify}
            />
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.actions}>
              <Button
                color="default"
                variant="outlined"
                dimensionX="fill"
                disabled={isVerifying}
                onClick={() => { setError(null); setOtp(""); setScanned(false); }}
                style={{ height: 34 }}
              >
                Back
              </Button>
              <Button
                dimensionX="fill"
                loading={isVerifying}
                disabled={otp.length < OTP_LENGTH || isVerifying}
                onClick={() => handleVerify(otp)}
                style={{ height: 34 }}
              >
                <Icon name="check" size="xs" />
                Verify &amp; enable
              </Button>
            </div>
          </>
        )}

        {/* Enabled, with disable confirmation */}
        {!isEnrolling && enabled && (
          confirmingDisable ? (
            <>
              <div className={styles.confirmText}>
                Disable two-factor authentication for this identity? They will sign in with
                only their password.
              </div>
              {error && <div className={styles.error}>{error}</div>}
              <div className={styles.actions}>
                <Button
                  color="default"
                  variant="outlined"
                  dimensionX="fill"
                  disabled={isDisabling}
                  onClick={() => setConfirmingDisable(false)}
                  style={{ height: 34 }}
                >
                  Cancel
                </Button>
                <Button
                  color="danger"
                  dimensionX="fill"
                  loading={isDisabling}
                  onClick={handleDisable}
                  style={{ height: 34 }}
                >
                  <Icon name="delete" size="xs" />
                  Disable 2FA
                </Button>
              </div>
            </>
          ) : (
            <Button
              color="danger"
              variant="outlined"
              dimensionX="fill"
              onClick={() => { setError(null); setConfirmingDisable(true); }}
              style={{ height: 34 }}
            >
              <Icon name="delete" size="xs" />
              Disable 2FA
            </Button>
          )
        )}

        {/* Disabled, idle */}
        {!isEnrolling && !enabled && (
          <>
            {error && <div className={styles.error}>{error}</div>}
            <Button
              dimensionX="fill"
              loading={isStarting}
              disabled={isStarting || !id}
              onClick={() => handleEnable()}
              style={{ height: 34 }}
            >
              <Icon name="lock" size="xs" />
              Enable 2FA
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default TwoFactorSection;
