import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export interface UnionEntity {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  entity_type: "sindicato" | "federacao" | "confederacao";
  categoria_laboral: string | null;
  abrangencia: "municipal" | "intermunicipal" | "estadual" | "interestadual" | "nacional";
  email_institucional: string | null;
  responsavel_legal: string | null;
  telefone: string | null;
  email_contato: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  status: "ativa" | "suspensa" | "em_analise" | "inativa";
  data_ativacao: string | null;
  ultimo_acesso: string | null;
  clinic_id: string | null;
}

export function useUnionEntity() {
  const { user, userRoles } = useAuth();
  const [entity, setEntity] = useState<UnionEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUnionEntityAdmin, setIsUnionEntityAdmin] = useState(false);

  useEffect(() => {
    const fetchUnionEntity = async () => {
      if (!user) {
        setEntity(null);
        setIsUnionEntityAdmin(false);
        setLoading(false);
        return;
      }

      // Check if user has entidade_sindical_admin role
      const hasUnionRole = userRoles.some(
        (role) => role.role === ("entidade_sindical_admin" as any)
      );

      // Also check directly in user_roles table for roles without clinic_id
      const { data: directRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "entidade_sindical_admin")
        .maybeSingle();

      const isEntityAdmin = hasUnionRole || !!directRoles;
      setIsUnionEntityAdmin(isEntityAdmin);

      if (!isEntityAdmin) {
        setEntity(null);
        setLoading(false);
        return;
      }

      // Fetch union entity data including clinic_id
      const { data, error } = await supabase
        .from("union_entities")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("[UnionEntity] Error fetching entity:", error);
        setEntity(null);
      } else {
        setEntity(data as UnionEntity | null);
      }

      setLoading(false);
    };

    fetchUnionEntity();
  }, [user, userRoles]);

  return {
    entity,
    loading,
    isUnionEntityAdmin,
  };
}
