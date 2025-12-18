import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ODONTOGRAM_CONDITIONS } from "./Odontogram";

export function OdontogramLegend() {
  return (
    <Card>
      <CardHeader className="py-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          Legenda
        </CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        <div className="flex flex-wrap gap-3">
          {ODONTOGRAM_CONDITIONS.map((condition) => (
            <div key={condition.id} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm border"
                style={{
                  backgroundColor: condition.id === "healthy" ? "transparent" : `${condition.color}40`,
                  borderColor: condition.color,
                }}
              />
              <span className="text-xs text-muted-foreground">{condition.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
