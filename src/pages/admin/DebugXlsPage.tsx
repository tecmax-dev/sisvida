import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

export default function DebugXlsPage() {
  const [result, setResult] = useState<string>("Carregando...");

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/temp-import.xls");
        const buffer = await response.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });

        const lines: string[] = [];
        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
          lines.push(`\n=== ABA: ${sheetName} ===`);
          lines.push(`Linhas: ${json.length}`);
          if (json.length > 0) {
            lines.push(`Cabeçalhos: ${JSON.stringify(json[0])}`);
          }
          // Mostrar primeiras 5 linhas de dados
          for (let i = 1; i < Math.min(6, json.length); i++) {
            lines.push(`Linha ${i}: ${JSON.stringify(json[i])}`);
          }
        }
        setResult(lines.join("\n"));
      } catch (e) {
        setResult("Erro: " + String(e));
      }
    })();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Debug XLS</h1>
      <pre className="bg-muted p-4 rounded text-xs whitespace-pre-wrap overflow-auto max-h-[80vh]">
        {result}
      </pre>
    </div>
  );
}
