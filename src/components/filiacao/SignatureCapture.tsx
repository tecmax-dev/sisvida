import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eraser, PenTool, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignatureCaptureProps {
  onSign: (signatureData: string) => void;
  existingSignature?: string | null;
  className?: string;
  showAuthorizationText?: boolean;
  contributionInfo?: string;
}

export function SignatureCapture({
  onSign,
  existingSignature,
  className,
  showAuthorizationText = true,
  contributionInfo = "2% do menor piso da categoria",
}: SignatureCaptureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [isSigned, setIsSigned] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Configurar tamanho do canvas
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    ctx.scale(dpr, dpr);

    // Estilo de desenho
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Carregar assinatura existente
    if (existingSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setHasSignature(true);
        setIsSigned(true);
      };
      img.src = existingSignature;
    }
  }, [existingSignature]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isSigned) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    e.preventDefault();
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isSigned) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    e.preventDefault();
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) {
      ctx.closePath();
    }
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas || !container) return;

    const rect = container.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
    setIsSigned(false);
  };

  const confirmSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    const signatureData = canvas.toDataURL("image/png");
    onSign(signatureData);
    setIsSigned(true);
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-0">
        {showAuthorizationText && (
          <div className="bg-amber-50 border-b border-amber-200 p-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Autorização de Desconto de Contribuição Sindical
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Ao assinar abaixo, autorizo o desconto da contribuição sindical correspondente a{" "}
                  <strong>{contributionInfo}</strong>, conforme previsto na legislação vigente.
                  Esta autorização é válida enquanto durar meu vínculo com a categoria.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <PenTool className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              Assinatura Digital <span className="text-red-500">*</span>
            </span>
            {isSigned && (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium">
                <Check className="h-3 w-3" />
                Assinado
              </span>
            )}
          </div>

          <div
            ref={containerRef}
            className={cn(
              "relative border-2 border-dashed rounded-lg bg-white transition-colors",
              isSigned ? "border-green-400" : "border-gray-300 hover:border-blue-400"
            )}
            style={{ height: "120px" }}
          >
            <canvas
              ref={canvasRef}
              className={cn(
                "w-full h-full touch-none",
                isSigned ? "cursor-default" : "cursor-crosshair"
              )}
              style={{ touchAction: "none" }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            
            {!hasSignature && !isSigned && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-400 text-sm">
                  Assine aqui com o mouse ou toque
                </p>
              </div>
            )}

            {/* Linha de base */}
            <div className="absolute bottom-4 left-4 right-4 border-b border-gray-300" />
          </div>

          <div className="flex justify-end gap-2 mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearSignature}
              disabled={!hasSignature}
            >
              <Eraser className="h-4 w-4 mr-1" />
              Limpar
            </Button>
            {!isSigned && (
              <Button
                type="button"
                size="sm"
                onClick={confirmSignature}
                disabled={!hasSignature}
              >
                <Check className="h-4 w-4 mr-1" />
                Confirmar Assinatura
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
