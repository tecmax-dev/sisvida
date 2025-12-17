import { Link } from "react-router-dom";

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
    <Link to="/" className="flex items-center gap-2.5 group">
      <div className={`${sizes[size].icon} relative`}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full transition-transform duration-300 group-hover:scale-105"
        >
          <rect
            x="2"
            y="2"
            width="36"
            height="36"
            rx="10"
            className="fill-primary"
          />
          <path
            d="M12 20H28M20 12V28"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-primary-foreground"
          />
          <circle
            cx="20"
            cy="20"
            r="6"
            className="fill-primary-foreground/20"
          />
        </svg>
      </div>
      {showText && (
        <span
          className={`font-bold tracking-tight ${sizes[size].text} ${colors[variant]} transition-colors`}
        >
          Eclini
        </span>
      )}
    </Link>
  );
}
