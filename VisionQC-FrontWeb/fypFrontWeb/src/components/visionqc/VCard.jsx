export function VCard({ children, className = "", variant = "default", onClick, hover = false, ...props }) {
    const variants = {
        default: "bg-white border-2 border-[#0d4d3d]/10 shadow-lg",
        glass: "bg-white/60 backdrop-blur-md border border-white/40 shadow-xl",
        organic: "bg-gradient-to-br from-white to-[#f5f5f3] border-2 border-[#9ae66e]/20 shadow-2xl",
    };
    const hoverClassName = hover ? "transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.015]" : "";
    return (<div onClick={onClick} className={`rounded-[2rem] p-6 ${variants[variant]} ${hoverClassName} ${className} ${onClick ? "cursor-pointer" : ""}`} {...props}>
      {children}
    </div>);
}
