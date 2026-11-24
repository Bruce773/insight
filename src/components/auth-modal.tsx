"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import "./auth-modal.css";

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type AuthStep = "initial" | "email-sent" | "error";

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<AuthStep>("initial");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("nodemailer", { email, redirect: false });
      if (result?.error) {
        setError(result.error || "Failed to send sign-in email");
        setStep("error");
      } else {
        setStep("email-sent");
        setEmail("");
      }
    } catch {
      setError("An unexpected error occurred");
      setStep("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setStep("initial");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="auth-modal-backdrop" onClick={handleClose} />
      <div className="auth-modal">
        <button className="auth-modal-close" onClick={handleClose} aria-label="Close">
          ✕
        </button>

        {step === "initial" && (
          <div className="auth-modal-content">
            <h2>Sign in to InSight</h2>
            <p className="auth-modal-subtitle">
              Save your plans and access them anytime.
            </p>
            <form onSubmit={handleSubmit}>
              <label htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={isLoading}
                autoFocus
              />
              <button type="submit" className="primary" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send sign-in link"}
              </button>
            </form>
            <p className="auth-modal-hint">
              We&rsquo;ll send you a link to sign in. No password needed.
            </p>
          </div>
        )}

        {step === "email-sent" && (
          <div className="auth-modal-content">
            <div className="auth-modal-success">✓</div>
            <h2>Check your email</h2>
            <p className="auth-modal-subtitle">
              We&rsquo;ve sent a sign-in link to <strong>{email}</strong>
            </p>
            <p className="auth-modal-hint">
              Click the link in the email to sign in. The link expires in 24 hours.
            </p>
            <button type="button" className="text-button" onClick={handleClose}>
              Close
            </button>
          </div>
        )}

        {step === "error" && (
          <div className="auth-modal-content">
            <div className="auth-modal-error">!</div>
            <h2>Couldn&rsquo;t send email</h2>
            <p className="auth-modal-subtitle">{error}</p>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setStep("initial");
                setError("");
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </>
  );
}
