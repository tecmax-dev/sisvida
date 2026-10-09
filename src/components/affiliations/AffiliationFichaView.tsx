const fmtDate = (v?: string | null) => {
  if (!v) return "-";
  const m = String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
};

const ROWS: [string, string, ((v: any) => string)?][] = [
  ["Nome", "nome"], ["CPF", "cpf"], ["RG", "rg"], ["Nascimento", "data_nascimento", fmtDate],
  ["Telefone", "telefone"], ["E-mail", "email"], ["Endereço", "endereco"], ["Cargo/Função", "cargo"],
  ["Admissão", "data_admissao", fmtDate], ["Empresa", "empresa_razao_social"], ["CNPJ", "empresa_cnpj"],
  ["Matrícula", "matricula"], ["Forma de pagamento", "forma_pagamento"],
  ["Data da solicitação", "created_at", fmtDate], ["Data da aprovação", "aprovado_at", fmtDate],
];

/** Ficha de filiação (instantâneo gravado no momento da disponibilização). */
export function AffiliationFichaView({ snapshot, fileUrl }: { snapshot: Record<string, any>; fileUrl?: string | null }) {
  if (fileUrl) {
    return <iframe title="Ficha de filiação" src={fileUrl} className="h-[60vh] w-full rounded-md border" />;
  }
  return (
    <div className="space-y-4 rounded-md border bg-card p-4 text-sm">
      <h3 className="text-center text-base font-semibold">FICHA DE FILIAÇÃO SINDICAL</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {ROWS.filter(([, k]) => snapshot?.[k]).map(([label, key, f]) => (
          <div key={key} className="border-b pb-1">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium">{f ? f(snapshot[key]) : String(snapshot[key])}</dd>
          </div>
        ))}
      </dl>
      {snapshot?.assinatura_aceite_desconto && (
        <p className="rounded bg-muted p-2 text-xs">
          Autorização de desconto assinada em {fmtDate(snapshot.assinatura_aceite_at)}.
        </p>
      )}
      {snapshot?.assinatura_digital_url && (
        <div>
          <p className="text-xs text-muted-foreground">Assinatura</p>
          <img src={snapshot.assinatura_digital_url} alt="Assinatura do associado" className="mt-1 max-h-24 object-contain" />
        </div>
      )}
    </div>
  );
}

export { fmtDate };
