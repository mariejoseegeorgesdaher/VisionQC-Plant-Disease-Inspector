import { useState } from "react";
export function VInput({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  disabled = false,
  icon,
  rightIcon,
  onRightIconClick,
  rightIconLabel = "Input action",
  list,
  id,
  ...props
}) {
    const [isFocused, setIsFocused] = useState(false);
    return (<div className="w-full">
      {label && (<label className="block mb-2 text-[#2a2d35] opacity-80">
          {label}
        </label>)}
      <div className={`relative rounded-3xl overflow-hidden transition-shadow duration-200 ${isFocused ? "shadow-[0_0_0_4px_rgba(154,230,110,0.18)]" : ""}`}>
        {icon && (<div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0d4d3d] opacity-60 z-10">
            {icon}
          </div>)}
        {rightIcon && (<button
            type="button"
            aria-label={rightIconLabel}
            onClick={onRightIconClick}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0d4d3d] opacity-70 hover:opacity-100 z-10"
          >
            {rightIcon}
          </button>)}
        <input id={id} list={list} type={type} placeholder={placeholder} value={value} onChange={onChange} disabled={disabled} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} className={`w-full px-5 py-3 bg-white/80 backdrop-blur-sm border-2 border-[#0d4d3d]/10 rounded-3xl
            focus:outline-none focus:border-[#9ae66e] focus:bg-white transition-all duration-300
            placeholder:text-[#2a2d35]/40 disabled:opacity-50 disabled:cursor-not-allowed
            ${icon ? "pl-12" : ""}
            ${rightIcon ? "pr-12" : ""}`} {...props}/>
      </div>
    </div>);
}
