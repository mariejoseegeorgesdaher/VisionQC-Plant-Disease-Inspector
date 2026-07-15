import { motion } from "motion/react";
import { Scan } from "lucide-react";
export function AIScanner({ isScanning }) {
    return (<div className="relative flex items-center justify-center w-64 h-64">
      {isScanning && (<>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="absolute w-full h-full">
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#9ae66e] border-r-[#6effc9]"/>
          </motion.div>
          <motion.div animate={{ rotate: -360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="absolute w-5/6 h-5/6">
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-b-[#9ae66e] border-l-[#6effc9]"/>
          </motion.div>
          <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute w-2/3 h-2/3 rounded-full bg-gradient-to-br from-[#6effc9]/20 to-[#9ae66e]/20 blur-xl"/>
        </>)}
      <motion.div animate={isScanning ? { scale: [1, 1.1, 1] } : {}} transition={{ duration: 1.5, repeat: Infinity }} className="relative z-10">
        <Scan className="w-16 h-16 text-[#0d4d3d]"/>
      </motion.div>
    </div>);
}
