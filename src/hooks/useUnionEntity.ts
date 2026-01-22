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
  allow_duplicate_competence: boolean;
  logo_url: string | null;
  president_name: string | null;
  president_signature_url: string | null;
}

export function useUnionEntity() {
  const { user, userRoles, currentClinic, isSuperAdmin } = useAuth();
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

      const isEntityAdmin = hasUnionRole || !!directRoles || isSuperAdmin;
      setIsUnionEntityAdmin(isEntityAdmin);

      // Try to fetch union entity by user_id first (direct entity admin)
      let { data, error } = await supabase
        .from("union_entities")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // If not found and user has a current clinic, try by clinic_id
      if (!data && currentClinic?.id) {
        const result = await supabase
          .from("union_entities")
          .select("*")
          .eq("clinic_id", currentClinic.id)
          .maybeSingle();
        
        data = result.data;
        error = result.error;
      }

      // For super admins without direct link, try to get any active entity
      if (!data && isSuperAdmin) {
        const result = await supabase
          .from("union_entities")
          .select("*")
          .eq("status", "ativa")
          .limit(1)
          .maybeSingle();
        
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error("[UnionEntity] Error fetching entity:", error);
        setEntity(null);
      } else {
        setEntity(data as UnionEntity | null);
      }

      setLoading(false);
    };

    fetchUnionEntity();
  }, [user, userRoles, currentClinic, isSuperAdmin]);

  return {
    entity,
    loading,
    isUnionEntityAdmin,
  };
}
