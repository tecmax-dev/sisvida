import { Link } from "react-router-dom";
import { Activity } from "lucide-react";

interface LogoProps {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ variant = "dark", size = "md", showText = true }: LogoProps) {
  const sizes = {
    sm: { icon: "h-7 w-7", text: "text-lg" },
    md: { icon: "h-9 w-9", text: "text-xl" },
    lg: { icon: "h-12 w-12", text: "text-2xl" },
  };

  const colors = {
    light: "text-primary-foreground",
    dark: "text-foreground",
  };

  return (
    <Link to="/" className="flex items-center gap-2 group">
      <div className={`${sizes[size].icon} rounded-full bg-primary flex items-center justify-center`}>
        <Activity className="w-5 h-5 text-primary-foreground" />
      </div>
      {showText && (
        <span
          className={`font-bold tracking-tight ${sizes[size].text} ${colors[variant]} group-hover:text-primary transition-colors`}
        >
          Eclini
        </span>
      )}
    </Link>
  );
}
