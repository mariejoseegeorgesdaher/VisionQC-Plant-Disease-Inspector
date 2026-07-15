import { useState } from "react";
import { Leaf } from "lucide-react";

export function BrandLogo({ className = "w-8 h-8" }) {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        src="/brand-logo.png"
        alt="Vision QC logo"
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  return <Leaf className={`${className} text-[#6effc9]`} />;
}
