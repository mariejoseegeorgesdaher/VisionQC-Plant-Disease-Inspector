import { useState } from "react";
import { Mail, ArrowLeft, Send } from "lucide-react";
import { VButton } from "../../visionqc/VButton";
import { VInput } from "../../visionqc/VInput";
import { BlobBackground } from "../../visionqc/BlobBackground";
import { BrandLogo } from "../../visionqc/BrandLogo";
import { requestPasswordReset } from "../../../lib/auth";

export function WebForgotPassword({ onNavigate }) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const handleSendResetLink = async () => {
    try {
      setError("");
      setNotice("");
      setIsSending(true);

      const result = await requestPasswordReset({ email });
      setNotice(
        typeof result?.message === "string"
          ? result.message
          : "If the email exists, a reset link was sent."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request password reset");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#fafaf8]">
      <div className="relative bg-gradient-to-br from-[#083f33] via-[#0d4d3d] to-[#0a6b52] overflow-hidden">
        <BlobBackground />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/35" />

        <div className="relative z-10 flex flex-col items-center justify-center h-full p-8 lg:p-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-[2.5rem] bg-white/10 backdrop-blur-md mb-8 border border-white/20 shadow-2xl">
              <BrandLogo className="w-20 h-20 object-contain" />
            </div>
            <h1 className="text-5xl text-white mb-4">Vision QC</h1>
            <p className="text-xl text-white/90 mb-2">Reset your password</p>
            <p className="text-white/75 max-w-sm mx-auto">
              We’ll send a reset link to the email address linked to your account.
            </p>
          </div>
        </div>
      </div>

      <div className="relative bg-gradient-to-br from-[#fafaf8] via-[#e8e3d8] to-[#fafaf8] overflow-hidden">
        <BlobBackground />

        <div className="relative z-10 flex items-center justify-center min-h-screen p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div className="rounded-[2rem] border border-white/40 bg-white/60 backdrop-blur-md shadow-2xl p-6 lg:p-8">
              <h2 className="text-3xl text-[#0d4d3d] mb-2">Forgot Password</h2>
              <p className="text-[#2a2d35]/60 mb-8">
                Enter your email and we’ll send you a reset link.
              </p>

              <div className="space-y-5">
                <VInput
                  label="Email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="w-5 h-5" />}
                />

                <VButton
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleSendResetLink}
                  disabled={isSending}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Send className="w-5 h-5" />
                    <span>{isSending ? "Sending..." : "Send Reset Link"}</span>
                  </div>
                </VButton>

                {notice && (
                  <div className="rounded-2xl border border-emerald-400 bg-emerald-200 px-5 py-4 text-center shadow-sm">
                    <p className="text-sm font-semibold text-emerald-900">{notice}</p>
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-red-300 bg-red-100 px-5 py-4 text-center shadow-sm">
                    <p className="text-sm font-bold text-red-800">{error}</p>
                  </div>
                )}

                <div className="flex items-center justify-center pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigate("web-login")}
                    className="inline-flex items-center gap-2 text-sm text-[#0d4d3d] hover:text-[#9ae66e] transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Sign In
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
