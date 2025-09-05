"use client";
import React from "react";
import { reportError, userMessageFromError } from "@/lib/errors";

type Props = {
  fallback?: React.ReactNode | ((err: Error) => React.ReactNode);
  area: string;
  children: React.ReactNode;
};

type State = { error: Error | null };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    reportError({ area: this.props.area }, error);
  }
  render() {
    if (this.state.error) {
      const msg = userMessageFromError(this.state.error, "Component crashed");
      if (typeof this.props.fallback === "function") return (this.props.fallback as (err: Error) => React.ReactNode)(this.state.error);
      return this.props.fallback ?? (
        <div className="border border-digital-blue rounded p-3 text-digital-blue bg-surface/10">{msg}</div>
      );
    }
    return this.props.children;
  }
}
