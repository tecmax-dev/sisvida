import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

type AuditAction = 
  | 'view_clinic'
  | 'access_clinic'
  | 'view_clinics_list'
  | 'view_users_list'
  | 'view_audit_logs'
  | 'login'
  | 'logout'
  | 'create_super_admin'
  | 'remove_super_admin'
  | 'block_clinic'
  | 'unblock_clinic'
  | 'manage_clinic_plan'
  | 'delete_clinic'
  | 'new_user_signup'
  | 'create_user'
  | 'update_user';

type EntityType = 'clinic' | 'user' | 'super_admin' | 'system' | 'subscription';

interface AuditLogParams {
  action: AuditAction;
  entityType: EntityType;
  entityId?: string;
  details?: Record<string, unknown>;
}

export function useAuditLog() {
  const { user } = useAuth();

  const logAction = async ({ action, entityType, entityId, details }: AuditLogParams) => {
    if (!user) return;

    try {
      const insertData = {
        user_id: user.id,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        details: details ? JSON.parse(JSON.stringify(details)) : null,
        user_agent: navigator.userAgent,
      };
      
      await supabase.from('audit_logs').insert(insertData);
    } catch (error) {
      console.error('Failed to log audit action:', error);
    }
  };

  return { logAction };
}
