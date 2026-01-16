interface PageNumberProps {
  current: number;
  total: number;
  variant?: 'light' | 'dark';
}

export function PageNumber({ current, total, variant = 'dark' }: PageNumberProps) {
  const baseClasses = "absolute bottom-2 right-4 text-xs font-medium print:text-[10px]";
  const variantClasses = variant === 'light' 
    ? "text-white/70" 
    : "text-gray-400";

  return (
    <div className={`${baseClasses} ${variantClasses}`}>
      Página {current} de {total}
    </div>
  );
}
