import { Calendar, MapPin } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { SeverityBadge } from "./SeverityBadge";
export function PlantCard({ image, alias, disease, date, location, severityLevel, onClick, }) {
    return (<div onClick={onClick} className="bg-white rounded-3xl overflow-hidden shadow-lg border-2 border-[#0d4d3d]/10 cursor-pointer transition-transform duration-200 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98]">
      <div className="relative h-40 overflow-hidden">
        <ImageWithFallback src={image} alt={alias} className="w-full h-full object-cover"/>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"/>
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white text-lg mb-1">{alias}</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-block px-3 py-1 rounded-full bg-[#0d4d3d]/10 text-[#0d4d3d] text-sm">
            {disease}
          </span>
          <SeverityBadge level={severityLevel}/>
        </div>
        <div className="flex items-center gap-4 text-sm text-[#2a2d35]/60">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4"/>
            <span>{date}</span>
          </div>
          {location && (<div className="flex items-center gap-1">
              <MapPin className="w-4 h-4"/>
              <span>{location}</span>
            </div>)}
        </div>
      </div>
    </div>);
}
