import { motion } from "motion/react";
export function BlobBackground() {
    return (<div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
      <motion.div animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.2, 1],
        }} transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
        }} className="absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-[#9ae66e] to-[#6effc9] rounded-[60%_40%_30%_70%/60%_30%_70%_40%] blur-3xl"/>
      <motion.div animate={{
            x: [0, -80, 0],
            y: [0, 100, 0],
            scale: [1, 1.1, 1],
        }} transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
        }} className="absolute top-1/2 right-0 w-80 h-80 bg-gradient-to-br from-[#0d4d3d] to-[#0a6b52] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] blur-3xl"/>
      <motion.div animate={{
            x: [0, 50, 0],
            y: [0, -80, 0],
            scale: [1, 1.3, 1],
        }} transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
        }} className="absolute bottom-0 left-1/3 w-72 h-72 bg-gradient-to-br from-[#6effc9] to-[#9ae66e] rounded-[70%_30%_30%_70%/60%_40%_60%_40%] blur-3xl"/>
    </div>);
}
