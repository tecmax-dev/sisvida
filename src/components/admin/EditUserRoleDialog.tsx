import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

interface UserClinic {
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  role: string;
}

interface UserWithEmail {
  user_id: string;
  name: string;
  email: string;
  clinics: UserClinic[];
}

interface AccessGroup {
  id: string;
  name: string;
  clinic_id: string | null;
  module_type: string | null;
}

const ROLE_OPTIONS = [
  { value: "owner", label: "Proprietário" },
  { value: "admin", label: "Administrador" },
  { value: "administrative", label: "Administrativo" },
  { value: "receptionist", label: "Recepcionista" },
  { value: "professional", label: "Profissional" },
  { value: "moderator", label: "Moderador" },
  { value: "entidade_sindical_admin", label: "Admin Entidade Sindical" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithEmail | null;
  defaultClinicId?: string;
  onSuccess?: () => void;
}

const safeText = (value: unknown, fallback = "-") => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
};

const normalizeClinics = (clinics: unknown): UserClinic[] => {
  if (!Array.isArray(clinics)) return [];
  return clinics
    .filter((clinic): clinic is Record<string, unknown> => !!clinic && typeof clinic === "object")
    .map((clinic) => ({
      clinic_id: safeText(clinic.clinic_id, ""),
      clinic_name: safeText(clinic.clinic_name, "Clínica"),
      clinic_slug: safeText(clinic.clinic_slug, ""),
      role: safeText(clinic.role, "receptionist"),
    }))
    .filter((clinic) => clinic.clinic_id);
};

const normalizeGroups = (groups: unknown): AccessGroup[] => {
  if (!Array.isArray(groups)) return [];
  return groups
    .filter((group): group is Record<string, unknown> => !!group && typeof group === "object")
    .map((group) => ({
      id: safeText(group.id, ""),
      name: safeText(group.name, "Grupo de acesso"),
      clinic_id: group.clinic_id === null ? null : safeText(group.clinic_id, ""),
      module_type: group.module_type === null ? null : safeText(group.module_type, ""),
    }))
    .filter((group) => group.id);
};

export function EditUserRoleDialog({
  open,
  onOpenChange,
  user,
  defaultClinicId,
  onSuccess,
}: Props) {
  const [clinicId, setClinicId] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [accessGroupId, setAccessGroupId] = useState<string>("none");
  const [groups, setGroups] = useState<AccessGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    const clinics = normalizeClinics(user.clinics);
    const initial =
      defaultClinicId && clinics.find((c) => c.clinic_id === defaultClinicId)
        ? defaultClinicId
        : clinics[0]?.clinic_id || "";
    setClinicId(initial);
  }, [open, user, defaultClinicId]);

  // Load current role + groups when clinic changes
  useEffect(() => {
    if (!open || !user || !clinicId) return;

    const current = normalizeClinics(user.clinics).find((c) => c.clinic_id === clinicId);
    setRole(current?.role || "receptionist");

    const loadData = async () => {
      setLoading(true);
      try {
        // Current access_group_id from DB
        const urRes = (await supabase
          .from("user_roles")
          .select("access_group_id")
          .eq("user_id", user.user_id)
          .eq("clinic_id", clinicId)
          .maybeSingle()) ?? { data: null };
        const ur = urRes.data;
        setAccessGroupId(ur?.access_group_id || "none");

        // Available access groups (global system groups + this clinic's custom groups)
        const agRes = (await supabase
          .from("access_groups")
          .select("id, name, clinic_id, module_type")
          .eq("is_active", true)
          .or(`clinic_id.is.null,clinic_id.eq.${clinicId}`)
          .order("name")) ?? { data: [] };
        setGroups(normalizeGroups(agRes.data));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [open, user, clinicId]);

  const handleSave = async () => {
    if (!user || !clinicId || !role) return;
    setSaving(true);
    try {
      const res = (await supabase.functions.invoke("update-user-role", {
        body: {
          user_id: user.user_id,
          clinic_id: clinicId,
          role,
          access_group_id: accessGroupId === "none" ? null : accessGroupId,
        },
      })) ?? { data: null, error: null };
      const { data, error } = res;
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Tipo de acesso atualizado com sucesso");
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Erro ao atualizar tipo de acesso");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const clinics = normalizeClinics(user.clinics);
  const selectedClinic = clinics.find((c) => c.clinic_id === clinicId);
  const userName = safeText(user.name, "Usuário");
  const userEmail = safeText(user.email, "Sem e-mail");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Alterar Tipo de Acesso
          </DialogTitle>
          <DialogDescription>
            {userName} — {userEmail}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Clínica / Vínculo</Label>
            {clinics.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este usuário não possui vínculo com nenhuma clínica.
              </p>
            ) : (
              <Select value={clinicId} onValueChange={setClinicId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a clínica" />
                </SelectTrigger>
                <SelectContent>
                  {clinics.map((c) => (
                    <SelectItem key={c.clinic_id} value={c.clinic_id}>
                      {c.clinic_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Role (tipo base)</Label>
            <Select value={role} onValueChange={setRole} disabled={!clinicId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Grupo de Acesso</Label>
            <Select
              value={accessGroupId}
              onValueChange={setAccessGroupId}
              disabled={!clinicId || loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum (usar permissões da role)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (permissões padrão da role)</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                    {g.module_type ? ` · ${g.module_type === "union" ? "Sindical" : "Clínico"}` : ""}
                    {g.clinic_id ? " · personalizado" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Quando definido, o grupo controla as permissões granulares (ex: Secretária Sênior, Financeiro/Administrativo).
            </p>
          </div>

          {selectedClinic && (
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Atual: <strong>{selectedClinic.role}</strong> em <strong>{selectedClinic.clinic_name}</strong>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || !clinicId || !role}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
