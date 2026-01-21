import { useEffect } from "react";
import { useTheme } from "next-themes";
import { Outlet } from "react-router-dom";

/**
 * Layout wrapper for all public pages that forces light mode.
 * This ensures public pages are not affected by the user's dark mode preference
 * configured in the dashboard.
 */
export function PublicLayout() {
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    // Store the current theme before forcing light mode
    const previousTheme = theme;
    
    // Force light mode for public pages
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
    
    return () => {
      // Restore the previous theme when leaving public pages
      if (previousTheme && previousTheme !== "light") {
        setTheme(previousTheme);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 [color-scheme:light]" data-theme="light">
      <Outlet />
    </div>
  );
}

/**
 * Wrapper component for standalone public pages (not using Outlet)
 */
export function PublicPageWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Force light mode for public pages
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 [color-scheme:light]" data-theme="light">
      {children}
    </div>
  );
}
