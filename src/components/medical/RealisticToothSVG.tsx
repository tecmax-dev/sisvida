import { cn } from "@/lib/utils";

interface RealisticToothSVGProps {
  toothNumber: number;
  isUpper: boolean;
  condition?: string;
  onClick?: () => void;
  onDoubleClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

// Condition colors
const CONDITION_COLORS: Record<string, string> = {
  healthy: "#4ade80",
  caries: "#ef4444",
  restoration: "#3b82f6",
  extraction: "#6b7280",
  missing: "#d1d5db",
  crown: "#f59e0b",
  implant: "#8b5cf6",
  root_canal: "#ec4899",
  fracture: "#f97316",
  sealant: "#06b6d4",
};

export function RealisticToothSVG({
  toothNumber,
  isUpper,
  condition = "healthy",
  onClick,
  onDoubleClick,
  disabled = false,
  size = "md",
}: RealisticToothSVGProps) {
  const position = toothNumber % 10;
  const isMissing = condition === "missing" || condition === "extraction";
  const conditionColor = CONDITION_COLORS[condition] || CONDITION_COLORS.healthy;
  
  // Sizes
  const sizeConfig = {
    sm: { width: 28, height: 48 },
    md: { width: 36, height: 60 },
    lg: { width: 44, height: 72 },
  };
  
  const { width, height } = sizeConfig[size];
  
  // Determine tooth type for SVG
  const getToothType = (): "molar" | "premolar" | "canine" | "incisor" => {
    if (position >= 6) return "molar";
    if (position >= 4) return "premolar";
    if (position === 3) return "canine";
    return "incisor";
  };
  
  const toothType = getToothType();
  
  // SVG paths for realistic teeth
  const renderToothSVG = () => {
    const strokeColor = condition === "healthy" ? "#a3a3a3" : conditionColor;
    const fillColor = isMissing ? "#f5f5f5" : "#ffffff";
    const rootColor = "#e0d5c9";
    
    if (toothType === "molar") {
      return (
        <svg viewBox="0 0 40 70" width={width} height={height}>
          {/* Roots */}
          <path
            d={isUpper 
              ? "M10 45 L8 65 M20 45 L20 68 M30 45 L32 65"
              : "M10 25 L8 5 M20 25 L20 2 M30 25 L32 5"
            }
            stroke={rootColor}
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          {/* Crown */}
          <ellipse
            cx="20"
            cy={isUpper ? "30" : "40"}
            rx="16"
            ry="14"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          {/* Crown surface details */}
          <path
            d={isUpper 
              ? "M12 28 Q16 24 20 28 Q24 24 28 28"
              : "M12 42 Q16 38 20 42 Q24 38 28 42"
            }
            stroke={strokeColor}
            strokeWidth="1"
            fill="none"
            opacity="0.5"
          />
          {/* Condition indicator */}
          {condition !== "healthy" && !isMissing && (
            <circle
              cx="20"
              cy={isUpper ? "30" : "40"}
              r="6"
              fill={conditionColor}
              opacity="0.7"
            />
          )}
          {/* Missing X mark */}
          {isMissing && (
            <>
              <line x1="10" y1={isUpper ? "20" : "30"} x2="30" y2={isUpper ? "40" : "50"} stroke="#9ca3af" strokeWidth="2" />
              <line x1="30" y1={isUpper ? "20" : "30"} x2="10" y2={isUpper ? "40" : "50"} stroke="#9ca3af" strokeWidth="2" />
            </>
          )}
        </svg>
      );
    }
    
    if (toothType === "premolar") {
      return (
        <svg viewBox="0 0 36 70" width={width * 0.9} height={height}>
          {/* Root */}
          <path
            d={isUpper 
              ? "M18 48 L16 66 M18 48 L20 66"
              : "M18 22 L16 4 M18 22 L20 4"
            }
            stroke={rootColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Crown */}
          <ellipse
            cx="18"
            cy={isUpper ? "32" : "38"}
            rx="12"
            ry="14"
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          {/* Bicuspid detail */}
          <path
            d={isUpper 
              ? "M12 30 Q18 24 24 30"
              : "M12 40 Q18 34 24 40"
            }
            stroke={strokeColor}
            strokeWidth="1"
            fill="none"
            opacity="0.5"
          />
          {/* Condition indicator */}
          {condition !== "healthy" && !isMissing && (
            <circle
              cx="18"
              cy={isUpper ? "32" : "38"}
              r="5"
              fill={conditionColor}
              opacity="0.7"
            />
          )}
          {isMissing && (
            <>
              <line x1="8" y1={isUpper ? "22" : "28"} x2="28" y2={isUpper ? "42" : "48"} stroke="#9ca3af" strokeWidth="2" />
              <line x1="28" y1={isUpper ? "22" : "28"} x2="8" y2={isUpper ? "42" : "48"} stroke="#9ca3af" strokeWidth="2" />
            </>
          )}
        </svg>
      );
    }
    
    if (toothType === "canine") {
      return (
        <svg viewBox="0 0 32 70" width={width * 0.8} height={height}>
          {/* Root - longer for canine */}
          <path
            d={isUpper 
              ? "M16 42 L16 68"
              : "M16 28 L16 2"
            }
            stroke={rootColor}
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          {/* Crown - pointed */}
          <path
            d={isUpper 
              ? "M6 40 Q6 20 16 16 Q26 20 26 40 Q26 44 16 44 Q6 44 6 40"
              : "M6 30 Q6 50 16 54 Q26 50 26 30 Q26 26 16 26 Q6 26 6 30"
            }
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="1.5"
          />
          {/* Condition indicator */}
          {condition !== "healthy" && !isMissing && (
            <circle
              cx="16"
              cy={isUpper ? "30" : "40"}
              r="5"
              fill={conditionColor}
              opacity="0.7"
            />
          )}
          {isMissing && (
            <>
              <line x1="6" y1={isUpper ? "18" : "28"} x2="26" y2={isUpper ? "42" : "52"} stroke="#9ca3af" strokeWidth="2" />
              <line x1="26" y1={isUpper ? "18" : "28"} x2="6" y2={isUpper ? "42" : "52"} stroke="#9ca3af" strokeWidth="2" />
            </>
          )}
        </svg>
      );
    }
    
    // Incisor
    return (
      <svg viewBox="0 0 28 70" width={width * 0.7} height={height}>
        {/* Root */}
        <path
          d={isUpper 
            ? "M14 44 L14 66"
            : "M14 26 L14 4"
          }
          stroke={rootColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Crown - flat rectangular */}
        <path
          d={isUpper 
            ? "M4 42 L4 22 Q4 18 8 18 L20 18 Q24 18 24 22 L24 42 Q24 46 14 46 Q4 46 4 42"
            : "M4 28 L4 48 Q4 52 8 52 L20 52 Q24 52 24 48 L24 28 Q24 24 14 24 Q4 24 4 28"
          }
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="1.5"
        />
        {/* Condition indicator */}
        {condition !== "healthy" && !isMissing && (
          <circle
            cx="14"
            cy={isUpper ? "32" : "38"}
            r="4"
            fill={conditionColor}
            opacity="0.7"
          />
        )}
        {isMissing && (
          <>
            <line x1="4" y1={isUpper ? "18" : "24"} x2="24" y2={isUpper ? "46" : "52"} stroke="#9ca3af" strokeWidth="2" />
            <line x1="24" y1={isUpper ? "18" : "24"} x2="4" y2={isUpper ? "46" : "52"} stroke="#9ca3af" strokeWidth="2" />
          </>
        )}
      </svg>
    );
  };
  
  return (
    <div
      className={cn(
        "flex flex-col items-center cursor-pointer transition-all group",
        disabled && "cursor-default opacity-60",
        !disabled && "hover:scale-110"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {/* Number on top for upper teeth */}
      {isUpper && (
        <span className="text-xs font-medium text-muted-foreground mb-0.5">{toothNumber}</span>
      )}
      
      {/* Tooth SVG */}
      <div className={cn(
        "transition-transform",
        !disabled && "group-hover:drop-shadow-md"
      )}>
        {renderToothSVG()}
      </div>
      
      {/* Number on bottom for lower teeth */}
      {!isUpper && (
        <span className="text-xs font-medium text-muted-foreground mt-0.5">{toothNumber}</span>
      )}
    </div>
  );
}
