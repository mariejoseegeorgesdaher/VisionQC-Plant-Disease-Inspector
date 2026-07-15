import { useState } from "react";
import { User, Mail, Lock, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { VButton } from "../../visionqc/VButton";
import { VInput } from "../../visionqc/VInput";
import { BlobBackground } from "../../visionqc/BlobBackground";
import { BrandLogo } from "../../visionqc/BrandLogo";
import { GoogleAuthButton } from "../../visionqc/GoogleAuthButton";
import {
  clearAuthToken,
  registerUser,
  setAuthNotice,
} from "../../../lib/auth";

export function WebRegister({ onNavigate }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setError("");
      setIsLoading(true);
      await registerUser({ fullName, email, password });
      clearAuthToken();
      setAuthNotice("Account created successfully. Please sign in with your new account.");
      onNavigate("web-login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
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
            <h1 className="text-5xl text-white mb-4">Create Your Account</h1>
            <p className="text-xl text-white/90 mb-2">Vision QC</p>
            <p className="text-white/75 max-w-sm mx-auto">
              Join the platform, create your credentials, then sign in to start
              scanning and tracking plant health.
            </p>
          </div>
        </div>
      </div>

      <div className="relative bg-gradient-to-br from-[#fafaf8] via-[#e8e3d8] to-[#fafaf8] overflow-hidden">
        <BlobBackground />

        <div className="relative z-10 flex items-center justify-center min-h-screen p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div className="rounded-[2rem] border border-white/40 bg-white/60 backdrop-blur-md shadow-2xl p-6 lg:p-8">
              <button
                onClick={() => onNavigate("web-login")}
                className="inline-flex items-center gap-2 text-sm text-[#0d4d3d] hover:text-[#9ae66e] transition-colors mb-6"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to login</span>
              </button>

              <h2 className="text-3xl text-[#0d4d3d] mb-2">Register</h2>
              <p className="text-[#2a2d35]/60 mb-8">
                Create a new account, then sign in with your new credentials.
              </p>

              <div className="space-y-5">
                <VInput
                  label="Full Name"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  icon={<User className="w-5 h-5" />}
                />

                <VInput
                  label="Email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="w-5 h-5" />}
                />

                <VInput
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="w-5 h-5" />}
                  rightIcon={showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  onRightIconClick={() => setShowPassword(!showPassword)}
                  rightIconLabel={showPassword ? "Hide password" : "Show password"}
                />

                <VInput
                  label="Confirm Password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  icon={<Lock className="w-5 h-5" />}
                  rightIcon={
                    showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />
                  }
                  onRightIconClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  rightIconLabel={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                />

                <VButton
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleRegister}
                  disabled={isLoading}
                >
                  {isLoading ? "Creating account..." : "Create Account"}
                </VButton>

                {error && (
                  <div className="rounded-2xl border border-red-300 bg-red-100 px-5 py-4 text-center shadow-sm">
                    <p className="text-sm font-bold text-red-800">{error}</p>
                  </div>
                )}

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#0d4d3d]/20" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-[#fafaf8] text-[#2a2d35]/60">or register with Google</span>
                  </div>
                </div>

                <GoogleAuthButton
                  mode="register"
                  onSuccess={() => {
                    clearAuthToken();
                    setError("");
                    setAuthNotice("Google account created successfully. Please sign in with Google.");
                    onNavigate("web-login");
                  }}
                  onError={(message) => setError(message)}
                  disabled={isLoading}
                />

                <p className="text-center text-[#2a2d35]/60 mt-6">
                  Already have an account?{" "}
                  <button
                    onClick={() => onNavigate("web-login")}
                    className="text-[#0d4d3d] hover:text-[#9ae66e] transition-colors"
                  >
                    Sign in here
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
