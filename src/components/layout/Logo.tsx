import { Link } from "react-router-dom";

interface LogoProps {
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

export function Logo({ variant = "dark", size = "md", showText = true }: LogoProps) {
  const sizes = {
    sm: { img: "h-8", text: "text-lg" },
    md: { img: "h-10", text: "text-xl" },
    lg: { img: "h-14", text: "text-2xl" },
  };

  return (
    <Link to="/" className="flex items-center gap-2 group">
      <img 
        src="/logo.png" 
        alt="Eclini" 
        className={`${sizes[size].img} w-auto object-contain`}
      />
    </Link>
  );
}