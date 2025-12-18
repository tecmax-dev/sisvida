import { cn } from "@/lib/utils";
import { ODONTOGRAM_CONDITIONS } from "./Odontogram";

interface ToothDiagramProps {
  toothNumber: number;
  condition: string;
  isUpper: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  disabled?: boolean;
}

export function ToothDiagram({
  toothNumber,
  condition,
  isUpper,
  onClick,
  onDoubleClick,
  disabled = false,
}: ToothDiagramProps) {
  const conditionConfig = ODONTOGRAM_CONDITIONS.find((c) => c.id === condition);
  const color = conditionConfig?.color || "#22c55e";
  
  // Determine tooth type based on number
  const getToothType = (num: number): "molar" | "premolar" | "canine" | "incisor" => {
    const position = num % 10;
    if (position >= 6) return "molar";
    if (position >= 4) return "premolar";
    if (position === 3) return "canine";
    return "incisor";
  };

  const toothType = getToothType(toothNumber);
  const isMissing = condition === "missing" || condition === "extraction";

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 cursor-pointer transition-all group",
        disabled && "cursor-default"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Tooth Number */}
      {isUpper && (
        <span className="text-[10px] text-muted-foreground font-mono">{toothNumber}</span>
      )}

      {/* Tooth Shape */}
      <div
        className={cn(
          "relative transition-all border-2 flex items-center justify-center",
          !disabled && "hover:scale-110 hover:shadow-md",
          isMissing && "opacity-40"
        )}
        style={{
          width: toothType === "molar" ? 28 : toothType === "premolar" ? 24 : toothType === "canine" ? 20 : 18,
          height: toothType === "molar" ? 32 : toothType === "premolar" ? 28 : toothType === "canine" ? 30 : 26,
          borderRadius: isUpper 
            ? `${toothType === "incisor" ? "6px 6px" : "4px 4px"} 2px 2px`
            : `2px 2px ${toothType === "incisor" ? "6px 6px" : "4px 4px"}`,
          borderColor: color,
          backgroundColor: condition === "healthy" ? "transparent" : `${color}20`,
        }}
      >
        {/* Crown indicator */}
        {condition === "crown" && (
          <div 
            className="absolute inset-1 border-2 rounded-sm"
            style={{ borderColor: color }}
          />
        )}

        {/* Implant indicator */}
        {condition === "implant" && (
          <div className="flex flex-col items-center justify-center">
            <div 
              className="w-1.5 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <div 
              className="w-3 h-1 mt-0.5"
              style={{ backgroundColor: color }}
            />
          </div>
        )}

        {/* Extraction X mark */}
        {condition === "extraction" && (
          <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ color }}>
            <path
              fill="currentColor"
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        )}

        {/* Root canal indicator */}
        {condition === "root_canal" && (
          <div 
            className="w-1 h-full absolute"
            style={{ backgroundColor: color }}
          />
        )}

        {/* Caries dot */}
        {condition === "caries" && (
          <div 
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}

        {/* Restoration fill */}
        {condition === "restoration" && (
          <div 
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: color }}
          />
        )}

        {/* Sealant line */}
        {condition === "sealant" && (
          <div 
            className="w-full h-0.5 absolute top-1/2 -translate-y-1/2"
            style={{ backgroundColor: color }}
          />
        )}

        {/* Fracture line */}
        {condition === "fracture" && (
          <svg viewBox="0 0 24 24" className="w-4 h-4" style={{ color }}>
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              d="M4 4l4 8-4 8M20 4l-4 8 4 8"
            />
          </svg>
        )}
      </div>

      {/* Tooth Number (bottom for lower teeth) */}
      {!isUpper && (
        <span className="text-[10px] text-muted-foreground font-mono">{toothNumber}</span>
      )}
    </div>
  );
}
