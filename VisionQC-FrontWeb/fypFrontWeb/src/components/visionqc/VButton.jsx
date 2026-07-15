export function VButton({ children, onClick, variant = "primary", size = "md", className = "", type = "button", disabled = false, style, ...props }) {
    const baseStyles = "relative overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-gradient-to-br from-[#0d4d3d] to-[#0a6b52] text-white shadow-lg hover:shadow-xl",
        secondary: "bg-[#e8e3d8] text-[#2a2d35] border border-[#0d4d3d]/10 hover:bg-[#d8d3c8]",
        accent: "bg-gradient-to-r from-[#6effc9] to-[#9ae66e] text-[#0d4d3d] shadow-md hover:shadow-lg",
        ghost: "bg-transparent border-2 border-[#0d4d3d] text-[#0d4d3d] hover:bg-[#0d4d3d] hover:text-white",
    };
    const sizes = {
        sm: "px-4 py-2 rounded-2xl text-sm",
        md: "px-6 py-3 rounded-3xl",
        lg: "px-8 py-4 rounded-full text-base",
    };
    return (<button className={`${baseStyles} ${disabled ? "" : "hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.97]"} ${variants[variant]} ${sizes[size]} ${className}`} onClick={onClick} type={type} disabled={disabled} style={style} {...props}>
      <span className="relative z-10">{children}</span>
    </button>);
}
