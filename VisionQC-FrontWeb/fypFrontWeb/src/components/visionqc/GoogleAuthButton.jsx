import { useEffect, useRef, useState } from "react";
import { authenticateWithGoogle, getGoogleClientId, loadGoogleIdentityScript } from "../../lib/auth";

export function GoogleAuthButton({
  mode = "login",
  onSuccess,
  onError,
  disabled = false,
}) {
  const containerRef = useRef(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onError, onSuccess]);

  useEffect(() => {
    let isMounted = true;

    async function renderGoogleButton() {
      try {
        const clientId = getGoogleClientId();
        if (!clientId) {
          throw new Error("Google sign-in is not configured yet. Add VITE_GOOGLE_CLIENT_ID to enable it.");
        }

        const google = await loadGoogleIdentityScript();
        if (!isMounted || !containerRef.current) return;

        containerRef.current.innerHTML = "";

        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              const payload = await authenticateWithGoogle({
                credential: response?.credential,
                mode,
              });
              onSuccessRef.current?.(payload);
            } catch (error) {
              onErrorRef.current?.(error instanceof Error ? error.message : "Google sign-in failed");
            }
          },
          context: mode === "register" ? "signup" : "signin",
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        google.accounts.id.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: mode === "register" ? "signup_with" : "signin_with",
          shape: "pill",
          width: 320,
          logo_alignment: "left",
        });

        setIsReady(true);
      } catch (error) {
        if (!isMounted) return;
        setIsReady(false);
        onErrorRef.current?.(error instanceof Error ? error.message : "Google sign-in failed");
      }
    }

    renderGoogleButton();

    return () => {
      isMounted = false;
    };
  }, [mode]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={`flex justify-center ${disabled ? "pointer-events-none opacity-60" : ""}`}
      />
      {!isReady && (
        <div className="rounded-full border border-[#0d4d3d]/10 bg-[#e8e3d8] px-5 py-4 text-center text-sm text-[#2a2d35]/60">
          {mode === "register" ? "Loading Google registration..." : "Loading Google sign-in..."}
        </div>
      )}
    </div>
  );
}
