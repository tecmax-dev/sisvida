import { User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactAvatarProps {
  profilePicUrl: string | null;
  name?: string | null;
  size?: "sm" | "md";
  className?: string;
  children?: React.ReactNode;
}

export function ContactAvatar({ profilePicUrl, name, size = "md", className, children }: ContactAvatarProps) {
  const sizeClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className={cn(sizeClass, "rounded-full flex-shrink-0 relative overflow-hidden", className)}>
      {profilePicUrl ? (
        <img
          src={profilePicUrl}
          alt={name || ""}
          className="h-full w-full rounded-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
          }}
        />
      ) : null}
      <div className={cn(
        "h-full w-full rounded-full bg-primary/10 flex items-center justify-center",
        profilePicUrl ? "hidden" : ""
      )}>
        <User className={cn(iconSize, "text-primary")} />
      </div>
      {children}
    </div>
  );
}
