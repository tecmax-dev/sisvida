import { Link } from "react-router-dom";
import prosindwebLogo from "@/assets/prosindweb-logo.png";


interface LogoProps {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  customSrc?: string;
}

export function Logo({ variant = "dark", size = "md", showText = true, customSrc }: LogoProps) {
  const sizes = {
    sm: "h-8",
    md: "h-10",
    lg: "h-14",
  };

  return (
    <Link to="/" className="flex items-center gap-2 group">
      <img 
        src={customSrc || prosindwebLogo} 
        alt="Prosinge - Gestão Sindical" 

        className={`${sizes[size]} w-auto object-contain`}
      />
    </Link>
  );
}