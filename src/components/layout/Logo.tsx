import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function Logo({ variant = "dark", size = "md", showText = true, className }: LogoProps) {
  const sizes = {
    sm: { img: "h-8", text: "text-lg" },
    md: { img: "h-10", text: "text-xl" },
    lg: { img: "h-14", text: "text-2xl" },
  };

  return (
    <Link to="/" className={cn("flex items-center gap-2 group", className)}>
      <img 
        src="/logo.png" 
        alt="Eclini" 
        className={cn(
          sizes[size].img, 
          "w-auto object-contain",
          variant === "light" && "brightness-0 invert"
        )}
      />
    </Link>
  );
}