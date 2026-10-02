import { useState } from "react";
import { WorkerRosterEditor } from "./WorkerRosterEditor";

export function AccountingWorkerRoster({ accountingOfficeId, employers }: {
  accountingOfficeId: string; employers: { id: string; name: string; trade_name?: string | null }[];
}) {
  const [employerId, setEmployerId] = useState("");
  return (
    <div className="mt-8 space-y-3">
      <select value={employerId} onChange={(e) => setEmployerId(e.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
        <option value="">Escolha a empresa para montar a lista de trabalhadores</option>
        {employers.map((e) => <option key={e.id} value={e.id}>{e.trade_name || e.name}</option>)}
      </select>
      {employerId && <WorkerRosterEditor key={employerId} employerId={employerId} portalType="accounting_office" portalId={accountingOfficeId} />}
    </div>
  );
}
