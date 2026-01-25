import { cn } from "@/lib/utils";
import { ZoomIn } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

interface TutorialImageProps {
  src: string;
  alt: string;
  caption?: string;
  className?: string;
}

export function TutorialImage({ src, alt, caption, className }: TutorialImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn("my-6", className)}>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <div className="group relative cursor-zoom-in rounded-xl overflow-hidden border border-border bg-muted/30 shadow-sm hover:shadow-lg transition-all duration-300">
            <img
              src={src}
              alt={alt}
              className="w-full h-auto object-cover"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-background/90 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <ZoomIn className="h-5 w-5 text-foreground" />
              </div>
            </div>
          </div>
        </DialogTrigger>
        <DialogContent className="max-w-5xl p-2 bg-background/95 backdrop-blur-sm">
          <img
            src={src}
            alt={alt}
            className="w-full h-auto rounded-lg"
          />
          {caption && (
            <p className="text-center text-sm text-muted-foreground mt-2 px-4">
              {caption}
            </p>
          )}
        </DialogContent>
      </Dialog>
      {caption && (
        <p className="text-sm text-muted-foreground text-center mt-3">
          {caption}
        </p>
      )}
    </div>
  );
}
