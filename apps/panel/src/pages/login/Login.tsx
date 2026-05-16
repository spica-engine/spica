import { memo, useEffect, useRef, useState } from "react";
import { useFormik } from "formik";
import {
  Button,
  FlexElement,
  Icon,
  InputWithIcon,
} from "oziko-ui-kit";
import styles from "./Login.module.scss";
import useAuthService from "../../hooks/useAuthService";
import useLocalStorage from "../../hooks/useLocalStorage";
import { Navigate } from "react-router-dom";
import logo from "../../assets/images/logo.svg";

const Login = () => {
  const [token] = useLocalStorage("token", undefined);
  const { fetchStrategies, strategies, login, loginLoading, loginError } = useAuthService();
  const [showPassword, setShowPassword] = useState(false);
  const starsRef = useRef<HTMLDivElement>(null);

  const formik = useFormik({
    initialValues: { identifier: "", password: "" },
    validate: values => {
      const errors: { identifier?: string; password?: string } = {};
      if (!values.identifier) errors.identifier = "Please enter your username";
      if (!values.password) errors.password = "Please enter your password";
      return errors;
    },
    onSubmit: values => login(values.identifier, values.password),
    validateOnChange: false,
    validateOnBlur: false,
  });

  const getErrorMessage = (error: any): string => {
    if (typeof error === "string") return error;
    if (!error || typeof error !== "object") return "Login failed";
    return error.data?.message || error.error || error.message || "Login failed";
  };

  useEffect(() => {
    fetchStrategies();
  }, []);

  useEffect(() => {
    const container = starsRef.current;
    if (!container) return;
    for (let i = 0; i < 80; i++) {
      const s = document.createElement("div");
      s.className = styles.star;
      const size = Math.random() * 2 + 0.8;
      s.style.cssText = `
        width:${size}px; height:${size}px;
        left:${(Math.random() * 58).toFixed(1)}%;
        top:${(Math.random() * 100).toFixed(1)}%;
        --d:${(Math.random() * 3 + 2).toFixed(1)}s;
        --delay:-${(Math.random() * 4).toFixed(1)}s;
        --min-op:${(Math.random() * 0.2 + 0.05).toFixed(2)};
        --max-op:${(Math.random() * 0.5 + 0.4).toFixed(2)};
      `;
      container.appendChild(s);
    }
    return () => { container.innerHTML = ""; };
  }, []);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  const identifierError = formik.submitCount > 0 && formik.errors.identifier;
  const passwordError = formik.submitCount > 0 && formik.errors.password;

  return (
    <div className={styles.container}>

      {/* Background */}
      <div className={styles.bg}>
        <div className={styles.bgLeft} />
        <div className={styles.bgRight} />
        <div className={styles.gridOverlay} />
        <div className={`${styles.glow} ${styles.glow1}`} />
        <div className={`${styles.glow} ${styles.glow2}`} />
        <div className={`${styles.glow} ${styles.glow3}`} />
        <div className={styles.diagonalGlow} />
        <div className={styles.stars} ref={starsRef} />
      </div>

      {/* Brand mark */}
      <div className={styles.brandMark}>
        <img src={logo} alt="Spica" width={28} height={28} style={{ objectFit: "contain" }} />
        <div className={styles.brandName}>Spica</div>
      </div>

      {/* Card */}
      <div className={styles.cardWrap}>
        <FlexElement direction="vertical" alignment="center" className={styles.card} gap={0}>

          {/* Head */}
          <div className={styles.cardHead}>
            <img src={logo} alt="Spica" width={90} height={90}/>
          </div>


          {/* Body */}
          <form
            className={styles.cardBody}
            onSubmit={e => { e.preventDefault(); formik.handleSubmit(); }}
          >
            {loginError && (
              <div className={styles.errorBox}>
                <div className={styles.errorText}>{getErrorMessage(loginError)}</div>
              </div>
            )}

            {/* Username */}


              <InputWithIcon
                dimensionY={38}
                dimensionX="fill"
                className={`${styles.inputField} ${identifierError ? styles.inputError : ""}`}
                prefix={{
                  children: (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  ),
                }}
                inputProps={{
                  id: "identifier",
                  name: "identifier",
                  placeholder: "Spica",
                  autoComplete: "username",
                  value: formik.values.identifier,
                  onChange: (e) => formik.setFieldValue("identifier", e.target.value),
                  onBlur: () => formik.setFieldTouched("identifier", true),
                }}
              />
              {identifierError && <div className={styles.fieldError}>{identifierError}</div>}

              <InputWithIcon
                dimensionY={38}
                dimensionX="fill"
                className={`${styles.inputField} ${passwordError ? styles.inputError : ""}`}
                prefix={{
                  children: (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  ),
                }}
                suffix={{
                  children: (
                    <button
                      type="button"
                      className={styles.pwToggle}
                      onClick={() => setShowPassword(p => !p)}
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  ),
                  className: styles.fieldSuffix,
                }}
                inputProps={{
                  id: "password",
                  name: "password",
                  placeholder: "Password",
                  autoComplete: "current-password",
                  type: showPassword ? "text" : "password",
                  value: formik.values.password,
                  onChange: (e) => formik.setFieldValue("password", e.target.value),
                  onBlur: () => formik.setFieldTouched("password", true),
                }}
              />
              {passwordError && <div className={styles.fieldError}>{passwordError}</div>}

            <Button
              dimensionX="fill"
              type="submit"
              loading={loginLoading}
              disabled={
                formik.values.identifier.length < 3 ||
                formik.values.password.length < 3 ||
                loginLoading
              }
              style={{ height: 38 }}
            >
              <Icon name="login" size="xs" />
              Login
            </Button>

            <div className={styles.formDivider}>
              <span>or</span>
            </div>

            <Button
              fullWidth
              type="button"
              color="default"
              variant="outlined"
              disabled={loginLoading}
              onClick={() => {}}
              style={{ height: 36 }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Login With Spica Account
            </Button>

            {strategies?.map(strategy => (
              <Button
                key={strategy._id}
                fullWidth
                type="button"
                color="default"
                variant="outlined"
                disabled={loginLoading}
                style={{ height: 36 }}
              >
                <Icon size="sm" name="help" />
                {strategy.title}
              </Button>
            ))}
          </form>

          {/* Foot */}
          <div className={styles.cardFoot}>
            <a
              className={styles.footLink}
              href="https://spicaengine.com/docs/start/getting-started"
              target="_blank"
              rel="noreferrer"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Documentation
            </a>
            <div className={styles.footSep} />
            <a
              className={styles.footLink}
              href="https://github.com/spica-engine/spica"
              target="_blank"
              rel="noreferrer"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              Github
            </a>
          </div>

        </FlexElement>
      </div>


    </div>
  );
};

export default memo(Login);

