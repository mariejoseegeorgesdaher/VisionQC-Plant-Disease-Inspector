import { useState } from "react";
import { Mail, Lock, LogIn, Eye, EyeOff } from "lucide-react";
import { VButton } from "../../visionqc/VButton";
import { VInput } from "../../visionqc/VInput";
import { BlobBackground } from "../../visionqc/BlobBackground";
import { BrandLogo } from "../../visionqc/BrandLogo";
import { GoogleAuthButton } from "../../visionqc/GoogleAuthButton";
import { consumeAuthNotice, getLandingPageForRole, loginUser } from "../../../lib/auth";
export function WebLogin({ onNavigate }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice] = useState(() => consumeAuthNotice());
    const handleLogin = async () => {
        try {
            setError("");
            setIsLoading(true);
            const payload = await loginUser({ email, password });
            onNavigate(getLandingPageForRole(payload?.role));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        }
        finally {
            setIsLoading(false);
        }
    };
    return (<div className="min-h-screen grid lg:grid-cols-2 bg-[#fafaf8]">
      {/* Left Side - Hero */}
      <div className="relative bg-gradient-to-br from-[#083f33] via-[#0d4d3d] to-[#0a6b52] overflow-hidden">
        <BlobBackground />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/35"/>

        <div className="relative z-10 flex flex-col items-center justify-center h-full p-8 lg:p-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-[2.5rem] bg-white/10 backdrop-blur-md mb-8 border border-white/20 shadow-2xl">
              <BrandLogo className="w-20 h-20 object-contain"/>
            </div>
            <h1 className="text-5xl text-white mb-4">Vision QC</h1>
            <p className="text-xl text-white/90 mb-2">Plant Disease Inspector</p>
            <p className="text-white/75 max-w-sm mx-auto">Realtime diagnostics with AI-backed confidence and cleaner field reporting.</p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="relative bg-gradient-to-br from-[#fafaf8] via-[#e8e3d8] to-[#fafaf8] overflow-hidden">
        <BlobBackground />
        
        <div className="relative z-10 flex items-center justify-center min-h-screen p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div className="rounded-[2rem] border border-white/40 bg-white/60 backdrop-blur-md shadow-2xl p-6 lg:p-8">
              <h2 className="text-3xl text-[#0d4d3d] mb-2">Welcome Back</h2>
              <p className="text-[#2a2d35]/60 mb-8">Sign in to continue to Vision QC</p>

              <div className="space-y-5">
                <VInput label="Email" type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail className="w-5 h-5"/>}/>
                
                <VInput
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="w-5 h-5"/>}
                  rightIcon={showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}
                  onRightIconClick={() => setShowPassword(!showPassword)}
                  rightIconLabel={showPassword ? "Hide password" : "Show password"}
                />

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => onNavigate("web-forgot-password")}
                    className="text-sm text-[#0d4d3d] hover:text-[#9ae66e] transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>

                <VButton variant="primary" size="lg" className="w-full" onClick={handleLogin} disabled={isLoading}>
                  <div className="flex items-center justify-center gap-2">
                    <LogIn className="w-5 h-5"/>
                    <span>{isLoading ? "Signing in..." : "Sign In"}</span>
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

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#0d4d3d]/20"/>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-[#fafaf8] text-[#2a2d35]/60">or sign in with Google</span>
                  </div>
                </div>

                <GoogleAuthButton
                  mode="login"
                  onSuccess={(payload) => {
                    setError("");
                    onNavigate(getLandingPageForRole(payload?.role));
                  }}
                  onError={(message) => setError(message)}
                  disabled={isLoading}
                />

                <p className="text-center text-[#2a2d35]/60 mt-6">
                  Don't have an account?{" "}
                  <button onClick={() => onNavigate("web-register")} className="text-[#0d4d3d] hover:text-[#9ae66e] transition-colors">
                    Register first
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);
}
