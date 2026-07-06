import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Called once when a descendant throws during render/commit. */
  onError?: (error: Error) => void;
  /** Rendered instead of children while in the error state. */
  fallback?: React.ReactNode;
  /** When any entry changes, the boundary clears its error state (e.g. drawer reopen). */
  resetKeys?: ReadonlyArray<unknown>;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Contains transient render throws from third-party inputs (oziko's field renderers
 * can throw `.map is not a function` on non-array values during the drawer's
 * outside-click close transition) so they can never white-screen the whole app.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {hasError: false};

  static getDerivedStateFromError(): ErrorBoundaryState {
    return {hasError: true};
  }

  componentDidCatch(error: Error): void {
    this.props.onError?.(error);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (!this.state.hasError) return;
    if (this.didResetKeysChange(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({hasError: false});
    }
  }

  private didResetKeysChange(
    prev?: ReadonlyArray<unknown>,
    next?: ReadonlyArray<unknown>
  ): boolean {
    if (!prev || !next) return prev !== next;
    if (prev.length !== next.length) return true;
    return prev.some((value, index) => value !== next[index]);
  }

  render(): React.ReactNode {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

export default ErrorBoundary;
