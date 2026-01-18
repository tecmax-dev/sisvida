import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { extractFunctionsError } from "@/lib/functionsError";
import {
  clearApiMigrationCheckpoint,
  loadApiMigrationCheckpoint,
  saveApiMigrationCheckpoint,
  type ApiMigrationCheckpoint,
} from "@/lib/apiMigrationCheckpoint";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Database,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Zap,
  StopCircle,
} from "lucide-react";

interface TableResult {
  success: boolean;
  count: number;
  error?: string;
}

interface MigrationState {
  phase: "idle" | "summary" | "users" | "tables" | "done" | "stopped";
  summary: { table: string; count: number }[] | null;
  userMapping: Record<string, string>;
  idMapping: Record<string, string>; // Global ID mapping for all entities
  usersCreated: number;
  usersSkipped: number;
  tables: Record<string, TableResult>;
  currentTable: string | null;
  progress: number;
  errors: string[];
}

export function ApiMigrationPanel() {
  const [sourceApiUrl, setSourceApiUrl] = useState("");
  const [syncKey, setSyncKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [debugDetails, setDebugDetails] = useState<string>("");
  const stopRequestedRef = useRef(false);
  const [state, setState] = useState<MigrationState>({
    phase: "idle",
    summary: null,
    userMapping: {},
    idMapping: {},
    usersCreated: 0,
    usersSkipped: 0,
    tables: {},
    currentTable: null,
    progress: 0,
    errors: [],
  });

  const [checkpoint, setCheckpoint] = useState<ApiMigrationCheckpoint | null>(() => loadApiMigrationCheckpoint());

  useEffect(() => {
    if (!checkpoint) return;
    if (!sourceApiUrl.trim() && checkpoint.sourceApiUrl) {
      setSourceApiUrl(checkpoint.sourceApiUrl);
    }
  }, [checkpoint, sourceApiUrl]);

  const canResume =
    Boolean(
      checkpoint &&
        checkpoint.sourceApiUrl === sourceApiUrl.trim() &&
        Array.isArray(checkpoint.summary) &&
        checkpoint.summary.length > 0
    );

  const persistCheckpoint = (cp: ApiMigrationCheckpoint | null) => {
    if (!cp) {
      clearApiMigrationCheckpoint();
      setCheckpoint(null);
      return;
    }
    saveApiMigrationCheckpoint(cp);
    setCheckpoint(cp);
  };

  const resetState = () => {
    persistCheckpoint(null);
    setDebugDetails("");
    stopRequestedRef.current = false;
    setState({
      phase: "idle",
      summary: null,
      userMapping: {},
      idMapping: {},
      usersCreated: 0,
      usersSkipped: 0,
      tables: {},
      currentTable: null,
      progress: 0,
      errors: [],
    });
  };

  const handleStopMigration = () => {
    stopRequestedRef.current = true;
    toast.warning("Parando importação... aguarde a requisição atual finalizar.");
  };

  const formatInvokeError = (err: unknown): string => {
    const ex = extractFunctionsError(err);
    const prefix = ex.status ? `HTTP ${ex.status}: ` : "";
    return `${prefix}${ex.message}`;
  };

  const captureDebug = (payload: unknown) => {
    try {
      setDebugDetails(JSON.stringify(payload, null, 2).slice(0, 8000));
    } catch {
      setDebugDetails(String(payload));
    }
  };

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const shouldRetryInvokeError = (err: unknown): boolean => {
    const ex = extractFunctionsError(err);
    const rawName = (ex.raw as any)?.name;
    return (
      rawName === "FunctionsFetchError" ||
      /Failed to send a request/i.test(ex.message) ||
      /NetworkError|Failed to fetch/i.test(ex.message)
    );
  };

  const getLimitForTable = (tableName: string, count: number): number => {
    // Hard caps for known heavy endpoints
    const byTable: Record<string, number> = {
      patients: 200,
      medical_records: 100,
    };

    const override = byTable[tableName];
    if (override) return override;

    // Default heuristic
    return count > 20000 ? 100 : count > 5000 ? 200 : 500;
  };

  const runTables = async (args: {
    tablesToImport: { table: string; count: number }[];
    userMapping: Record<string, string>;
    usersCreated: number;
    usersSkipped: number;
    startIndex: number;
    startPage: number;
    startLimit: number | null;
    accumulatedIdMapping: Record<string, string>;
    existingTables: Record<string, TableResult>;
  }): Promise<{ stopped: boolean; accumulatedIdMapping: Record<string, string> }> => {
    const totalTables = args.tablesToImport.length || 1;
    let accumulatedIdMapping: Record<string, string> = { ...args.accumulatedIdMapping };

    // Local mutable copy (easier to persist to checkpoint)
    const tablesState: Record<string, TableResult> = { ...args.existingTables };

    // Save an initial checkpoint so "Continuar" works even before the first chunk finishes
    persistCheckpoint({
      v: 1,
      sourceApiUrl: sourceApiUrl.trim(),
      summary: args.tablesToImport,
      userMapping: args.userMapping,
      usersCreated: args.usersCreated,
      usersSkipped: args.usersSkipped,
      tables: tablesState,
      currentIndex: Math.max(0, args.startIndex),
      page: Math.max(0, args.startPage),
      limit: Math.max(1, args.startLimit ?? 200),
      accumulatedIdMapping,
      timestamp: Date.now(),
    });

    for (let i = args.startIndex; i < args.tablesToImport.length; i++) {
      if (stopRequestedRef.current) {
        toast.dismiss("migration");
        toast.info("Importação interrompida pelo usuário.");
        setState((s) => ({ ...s, phase: "stopped", currentTable: null }));
        return { stopped: true, accumulatedIdMapping };
      }

      const table = args.tablesToImport[i];
      const tableName = table.table;

      const isResumeTable = i === args.startIndex;
      let limit = isResumeTable
        ? (args.startLimit ?? getLimitForTable(tableName, table.count))
        : getLimitForTable(tableName, table.count);
      let page = isResumeTable ? args.startPage : 0;
      let hasMore = true;
      let imported = tablesState[tableName]?.count ?? 0;
      const tableErrors: string[] = [];
      let safety = 0;

      setState((s) => ({
        ...s,
        phase: "tables",
        currentTable: tableName,
        idMapping: accumulatedIdMapping,
        progress: 25 + Math.round((i / totalTables) * 70),
        // Keep already-imported results visible while continuing
        tables: { ...tablesState },
      }));

      toast.loading(`Importando ${tableName} (${table.count} registros)...`, { id: "migration" });

      // Persist that we're starting (or resuming) this table
      persistCheckpoint({
        v: 1,
        sourceApiUrl: sourceApiUrl.trim(),
        summary: args.tablesToImport,
        userMapping: args.userMapping,
        usersCreated: args.usersCreated,
        usersSkipped: args.usersSkipped,
        tables: tablesState,
        currentIndex: i,
        page,
        limit,
        accumulatedIdMapping,
        timestamp: Date.now(),
      });

      while (hasMore) {
        if (stopRequestedRef.current) {
          toast.dismiss("migration");
          toast.info("Importação interrompida pelo usuário.");
          setState((s) => ({ ...s, phase: "stopped", currentTable: null }));

          persistCheckpoint({
            v: 1,
            sourceApiUrl: sourceApiUrl.trim(),
            summary: args.tablesToImport,
            userMapping: args.userMapping,
            usersCreated: args.usersCreated,
            usersSkipped: args.usersSkipped,
            tables: tablesState,
            currentIndex: i,
            page,
            limit,
            accumulatedIdMapping,
            timestamp: Date.now(),
          });

          return { stopped: true, accumulatedIdMapping };
        }

        safety++;
        if (safety > 5000) {
          tableErrors.push("Limite de páginas excedido (proteção contra loop infinito)");
          break;
        }

        try {
          let tableData: any = null;
          let tableError: unknown = null;
          let retries = 0;

          while (true) {
            const res = await supabase.functions.invoke("import-from-api", {
              body: {
                sourceApiUrl: sourceApiUrl.trim(),
                syncKey: syncKey.trim(),
                phase: "table",
                tableName,
                userMapping: args.userMapping,
                idMapping: accumulatedIdMapping,
                page,
                limit,
                maxPages: 1,
              },
            });

            tableData = res.data;
            tableError = res.error;

            if (!tableError) break;

            // Retry by reducing payload size (common for big tables like patients)
            if (shouldRetryInvokeError(tableError) && retries < 3 && limit > 50) {
              retries++;
              const nextLimit = Math.max(50, Math.floor(limit / 2));
              console.warn(`[ApiMigration] ${tableName}: retry ${retries} (limit ${limit} -> ${nextLimit})`);
              limit = nextLimit;
              await sleep(900 * retries);
              continue;
            }

            break;
          }

          if (tableError) {
            const msg = formatInvokeError(tableError);
            captureDebug({ phase: "table", table: tableName, page, limit, error: extractFunctionsError(tableError) });
            tableErrors.push(msg);
            break;
          }

          if (tableData && tableData.success === false) {
            const msg = tableData?.error || "Erro ao importar tabela";
            captureDebug({ phase: "table", table: tableName, page, limit, response: tableData });
            tableErrors.push(msg);
            break;
          }

          const chunk = tableData?.tables?.[tableName];
          if (chunk?.count) imported += chunk.count;
          if (chunk?.error) tableErrors.push(chunk.error);

          if (tableData?.idMapping) {
            accumulatedIdMapping = { ...accumulatedIdMapping, ...tableData.idMapping };
          }

          hasMore = Boolean(tableData?.hasMore);
          page = Number.isFinite(Number(tableData?.nextPage)) ? Number(tableData.nextPage) : page + 1;

          tablesState[tableName] = {
            success: tableErrors.length === 0 && (chunk?.success ?? true),
            count: imported,
            error: tableErrors.length > 0 ? tableErrors[0] : undefined,
          };

          setState((s) => ({
            ...s,
            idMapping: accumulatedIdMapping,
            tables: { ...tablesState },
          }));

          // Persist progress after each chunk
          persistCheckpoint({
            v: 1,
            sourceApiUrl: sourceApiUrl.trim(),
            summary: args.tablesToImport,
            userMapping: args.userMapping,
            usersCreated: args.usersCreated,
            usersSkipped: args.usersSkipped,
            tables: tablesState,
            currentIndex: i,
            page,
            limit,
            accumulatedIdMapping,
            timestamp: Date.now(),
          } as any);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          tableErrors.push(msg);
          break;
        }
      }

      // Finalize table result
      tablesState[tableName] = {
        success: tableErrors.length === 0,
        count: imported,
        error: tableErrors.length > 0 ? tableErrors.slice(0, 2).join(" | ") : undefined,
      };

      setState((s) => ({
        ...s,
        idMapping: accumulatedIdMapping,
        tables: { ...tablesState },
        errors:
          tableErrors.length > 0 ? [...s.errors, `${tableName}: ${tableErrors[0]}`] : s.errors,
      }));

      // After finishing a table, checkpoint the start of the next one
      persistCheckpoint({
        v: 1,
        sourceApiUrl: sourceApiUrl.trim(),
        summary: args.tablesToImport,
        userMapping: args.userMapping,
        usersCreated: args.usersCreated,
        usersSkipped: args.usersSkipped,
        tables: tablesState,
        currentIndex: i + 1,
        page: 0,
        limit: 200,
        accumulatedIdMapping,
        timestamp: Date.now(),
      });
    }

    return { stopped: false, accumulatedIdMapping };
  };

  const handleResume = async () => {
    if (!checkpoint) return;
    if (!sourceApiUrl.trim() || !syncKey.trim()) {
      toast.error("Preencha a URL da API e a chave de sincronização");
      return;
    }

    if (checkpoint.sourceApiUrl !== sourceApiUrl.trim()) {
      toast.error("A URL atual é diferente da migração salva");
      return;
    }

    stopRequestedRef.current = false;
    setMigrating(true);

    try {
      const tablesToImport = checkpoint.summary;
      const safeIndex = Math.min(Math.max(0, checkpoint.currentIndex), Math.max(0, tablesToImport.length - 1));

      setState((s) => ({
        ...s,
        phase: "tables",
        summary: tablesToImport,
        userMapping: checkpoint.userMapping,
        idMapping: checkpoint.accumulatedIdMapping,
        usersCreated: checkpoint.usersCreated,
        usersSkipped: checkpoint.usersSkipped,
        tables: checkpoint.tables as any,
        currentTable: tablesToImport[safeIndex]?.table ?? null,
        progress: 25 + Math.round((safeIndex / Math.max(1, tablesToImport.length)) * 70),
      }));

      toast.loading(`Continuando importação...`, { id: "migration" });

      const { stopped } = await runTables({
        tablesToImport,
        userMapping: checkpoint.userMapping,
        usersCreated: checkpoint.usersCreated,
        usersSkipped: checkpoint.usersSkipped,
        startIndex: safeIndex,
        startPage: checkpoint.page,
        startLimit: checkpoint.limit,
        accumulatedIdMapping: checkpoint.accumulatedIdMapping,
        existingTables: checkpoint.tables as any,
      });

      if (stopped) return;

      setState((s) => ({ ...s, phase: "done", currentTable: null, progress: 100 }));
      toast.dismiss("migration");
      toast.success("Migração concluída!");
      persistCheckpoint(null);
    } catch (error) {
      toast.dismiss("migration");
      const msg = error instanceof Error ? error.message : "Erro na migração";
      toast.error(msg);
      setState((s) => ({ ...s, errors: [...s.errors, msg] }));
    } finally {
      setMigrating(false);
    }
  };

  const handleMigration = async () => {
    if (!sourceApiUrl.trim() || !syncKey.trim()) {
      toast.error("Preencha a URL da API e a chave de sincronização");
      return;
    }

    setMigrating(true);
    resetState();

    try {
      // Phase 1: Get summary
      setState((s) => ({ ...s, phase: "summary", progress: 5 }));
      toast.loading("Obtendo resumo do projeto origem...", { id: "migration" });

      const { data: summaryData, error: summaryError } = await supabase.functions.invoke(
        "import-from-api",
        {
          body: { sourceApiUrl: sourceApiUrl.trim(), syncKey: syncKey.trim(), phase: "summary" },
        }
      );

      if (summaryError) {
        captureDebug({ phase: "summary", error: extractFunctionsError(summaryError) });
        throw new Error(formatInvokeError(summaryError));
      }
      if (!summaryData?.success) {
        captureDebug({ phase: "summary", response: summaryData });
        throw new Error(summaryData?.error || "Erro ao obter resumo");
      }

      console.log("[ApiMigration] Summary response:", summaryData.summary);

      // Handle different response formats - could be array or object with tables property
      let tables: { table: string; count: number }[] = [];
      const summary = summaryData.summary;
      
      console.log("[ApiMigration] Raw summary received:", JSON.stringify(summary, null, 2));
      console.log("[ApiMigration] Summary type:", typeof summary, Array.isArray(summary) ? "isArray" : "");
      
      // Metadata keys that should NOT be treated as table names (exact match, case-insensitive check)
      const metadataKeys = new Set([
        "total", "timestamp", "tablecount", "authuserscount", 
        "tables", "error", "success", "message", "count", "version"
      ]);
      
      // Helper to check if a key looks like a valid table name - MORE PERMISSIVE
      const isValidTableName = (key: string): boolean => {
        if (!key || typeof key !== "string") return false;
        const lowerKey = key.toLowerCase();
        if (metadataKeys.has(lowerKey)) return false;
        // Exclude keys that end with "Count" (metadata fields)
        if (/count$/i.test(key)) return false;
        // Accept almost anything that could be a table name
        // Just exclude obviously wrong things
        return key.length > 0 && key.length < 100;
      };
      
      // Try multiple parsing strategies
      if (Array.isArray(summary)) {
        console.log("[ApiMigration] Summary is array with", summary.length, "items");
        console.log("[ApiMigration] First item sample:", JSON.stringify(summary[0]));
        
        // Strategy 1: Array of { table, count }
        if (summary.length > 0 && typeof summary[0] === "object" && summary[0].table) {
          tables = summary
            .filter((item) => item && typeof item === "object" && item.table && isValidTableName(item.table))
            .map((item) => ({
              table: String(item.table),
              count: Number(item.count) || 0,
            }));
          console.log("[ApiMigration] Parsed as array of {table, count}:", tables.length, "tables");
        }
        // Strategy 2: Array of { name, count } or similar
        else if (summary.length > 0 && typeof summary[0] === "object" && summary[0].name) {
          tables = summary
            .filter((item) => item && typeof item === "object" && item.name && isValidTableName(item.name))
            .map((item) => ({
              table: String(item.name),
              count: Number(item.count || item.rows || item.total) || 0,
            }));
          console.log("[ApiMigration] Parsed as array of {name, count}:", tables.length, "tables");
        }
        // Strategy 3: Array of strings (table names only)
        else if (summary.length > 0 && typeof summary[0] === "string") {
          tables = summary
            .filter((name) => typeof name === "string" && isValidTableName(name))
            .map((name) => ({
              table: String(name),
              count: 1, // Unknown count
            }));
          console.log("[ApiMigration] Parsed as array of strings:", tables.length, "tables");
        }
      } else if (summary?.tables && Array.isArray(summary.tables)) {
        console.log("[ApiMigration] Summary has tables array with", summary.tables.length, "items");
        console.log("[ApiMigration] First table sample:", JSON.stringify(summary.tables[0]));
        
        tables = summary.tables
          .filter((item: any) => {
            if (typeof item === "object" && (item.table || item.name)) {
              return isValidTableName(item.table || item.name);
            }
            if (typeof item === "string") {
              return isValidTableName(item);
            }
            return false;
          })
          .map((item: any) => ({
            table: String(item.table || item.name || item),
            count: Number(item.count || item.rows || item.total) || 0,
          }));
        console.log("[ApiMigration] Parsed tables array:", tables.length, "tables");
      } else if (summary && typeof summary === "object" && !Array.isArray(summary)) {
        console.log("[ApiMigration] Summary is object with keys:", Object.keys(summary));
        
        // If it's an object with table names as keys, convert to array
        tables = Object.entries(summary)
          .filter(([key, value]) => {
            // Skip if value is not a number or object with count
            if (typeof value !== "number" && typeof value !== "object") return false;
            return isValidTableName(key);
          })
          .map(([table, data]: [string, any]) => ({
            table,
            count: typeof data === "number" ? data : Number(data?.count || data?.rows || data?.total) || 0,
          }))
          .filter((t) => t.count > 0); // Only include tables with data
        console.log("[ApiMigration] Parsed as object keys:", tables.length, "tables");
      }
      
      // Order tables to reduce FK issues (dependencies first)
      // Level 0: No FK dependencies (standalone tables)
      // Level 1: Only depends on Level 0
      // Level 2: Depends on Level 1, etc.
      const preferredOrder = [
        // Level 0 - Standalone base tables (no FKs or only self-referencing)
        "clinics",
        "subscription_addons",
        "subscription_plans",
        "union_entities",
        "system_notifications",
        "system_features",
        "permission_definitions",
        "specialties",
        "tuss_codes",
        "icd10_codes",
        "medications",
        "national_holidays",
        "municipal_holidays",
        "state_holidays",
        "carousel_banners",
        "hero_settings",
        "global_config",
        "chat_settings",
        "chat_working_hours",
        "chat_quick_responses",
        "chat_sectors",
        "negotiation_settings",
        "document_settings",
        "nps_settings",
        "panel_banners",
        "panels",
        "contribution_types",
        "employer_categories",
        "mobile_app_tabs",
        
        // Level 1 - Depends on clinics/union_entities
        "profiles", // depends on auth.users (handled by userMapping)
        "user_roles", // depends on auth.users
        "super_admins", // depends on auth.users
        "insurance_plans", // may depend on clinics
        "procedures", // depends on clinics
        "suppliers", // depends on clinics
        "union_suppliers", // depends on union_entities
        "chart_of_accounts", // depends on clinics
        "union_chart_of_accounts", // depends on union_entities
        "cash_registers", // depends on clinics
        "union_cash_registers", // depends on union_entities
        "financial_categories", // depends on clinics
        "union_financial_categories", // depends on union_entities
        "cost_centers", // depends on clinics
        "union_cost_centers", // depends on union_entities
        "access_groups", // depends on clinics
        "clinic_holidays", // depends on clinics
        "totems", // depends on clinics
        "queues", // depends on clinics
        "anamnese_templates", // depends on clinics
        "patient_segments", // depends on clinics
        "automation_flows", // depends on clinics
        "campaigns", // depends on clinics
        "webhooks", // depends on clinics
        "api_keys", // depends on clinics
        "smtp_settings", // depends on auth.users
        "evolution_configs", // depends on clinics
        "twilio_configs", // depends on clinics
        "lytex_sync_logs", // depends on clinics
        "whatsapp_sectors", // standalone
        "whatsapp_operators", // may depend on auth.users
        "whatsapp_contacts", // standalone
        "whatsapp_quick_replies", // standalone
        "whatsapp_module_settings", // depends on clinics
        "homologacao_settings", // depends on clinics
        "homologacao_service_types", // depends on clinics
        "homologacao_schedules", // depends on clinics
        "homologacao_professionals", // depends on clinics
        "homologacao_blocks", // depends on schedules
        "union_convenio_categories", // depends on union_entities
        "union_convenios", // depends on union_entities
        "sindical_categorias", // standalone
        
        // Level 2 - Depends on Level 1
        "access_group_permissions", // depends on access_groups
        "patients", // depends on clinics
        "union_suppliers", // depends on union_entities
        "professionals", // depends on clinics, auth.users
        "employers", // depends on clinics, union_entities
        "accounting_offices", // depends on clinics, union_entities
        "anamnese_questions", // depends on anamnese_templates
        "exams", // depends on clinics
        "feature_permissions", // depends on system_features
        "plan_features", // depends on system_features
        "subscriptions", // depends on clinics, subscription_plans
        "clinic_addons", // depends on clinics, subscription_addons
        "addon_requests", // depends on clinics, subscription_addons
        "upgrade_requests", // depends on auth.users
        "import_logs", // depends on clinics
        "whatsapp_operator_sectors", // depends on operators, sectors
        "whatsapp_ai_conversations", // standalone
        "sindical_payment_methods", // depends on sindicatos
        "member_categories", // depends on union_entities
        
        // Level 3 - Depends on Level 2
        "patient_cards", // depends on patients
        "patient_folders", // depends on patients
        "patient_dependents", // depends on patients
        "patient_attachments", // depends on patients, folders
        "patient_first_access_tokens", // depends on patients
        "patient_password_resets", // depends on patients
        "marketing_consents", // depends on patients
        "medical_records", // depends on patients, clinics
        "anamnesis", // depends on patients, clinics
        "anamnese_responses", // depends on patients, templates, professionals
        "anamnese_question_options", // depends on anamnese_questions
        "anamnese_answers", // depends on anamnese_responses, questions
        "odontogram_records", // depends on patients
        "prescriptions", // depends on patients
        "exam_results", // depends on exams, patients
        "professional_procedures", // depends on professionals, procedures
        "professional_specialties", // depends on professionals, specialties
        "professional_insurance_plans", // depends on professionals, insurance_plans
        "professional_commissions", // depends on professionals
        "professional_schedule_exceptions", // depends on professionals
        "accounting_office_employers", // depends on accounting_offices, employers
        "patient_employers", // depends on patients, employers
        "procedure_insurance_prices", // depends on procedures, insurance_plans
        "employer_contributions", // depends on employers, clinics
        "cash_transfers", // depends on cash_registers
        "union_cash_transfers", // depends on union_cash_registers
        "financial_transactions", // depends on clinics, categories, cash_registers
        "union_financial_transactions", // depends on union_entities, categories, cash_registers, suppliers
        "cash_flow_history", // depends on clinics, cash_registers
        "union_cash_flow_history", // depends on union_entities, cash_registers
        "whatsapp_tickets", // depends on contacts
        "sindical_associados", // depends on sindicatos
        "members", // depends on union_entities
        
        // Level 4 - Depends on Level 3
        "appointments", // depends on patients, professionals, procedures, clinics
        "medical_documents", // depends on medical_records
        "tiss_guides", // depends on patients
        "tiss_guide_items", // depends on tiss_guides
        "tiss_status_history", // depends on tiss_guides
        "tiss_xml_files", // depends on tiss_guides
        "contribution_audit_logs", // depends on employer_contributions
        "lytex_conciliation_logs", // depends on employer_contributions
        "debt_negotiations", // depends on employers
        "negotiation_items", // depends on negotiations, contributions
        "negotiation_installments", // depends on negotiations
        "card_expiry_notifications", // depends on patient_cards
        "payslip_requests", // depends on patient_cards
        "whatsapp_ticket_messages", // depends on tickets
        "whatsapp_booking_sessions", // depends on patients
        "sindical_associado_dependentes", // depends on associados
        "member_contributions", // depends on members
        "union_member_audit_logs", // depends on patients/members
        "union_supplier_defaults", // depends on union_suppliers
        
        // Level 5 - Depends on Level 4
        "pending_confirmations", // depends on appointments
        "pre_attendance", // depends on appointments
        "queue_calls", // depends on queues, patients
        "audit_logs", // depends on auth.users
        "attachment_access_logs", // depends on attachments, auth.users
        "birthday_message_logs", // depends on patients, clinics
        "message_logs", // depends on patients
        "accounting_office_portal_logs", // depends on accounting_offices
        "employer_portal_logs", // depends on employers
        "chat_conversations", // depends on clinics, auth.users
        "chat_messages", // depends on conversations
        "push_notification_tokens", // depends on patients
        "push_notification_history", // depends on clinics
        "homologacao_appointments", // depends on schedules, professionals
        "homologacao_notification_logs", // depends on appointments
        "homologacao_notifications", // depends on appointments
        "homologacao_professional_services", // depends on professionals, services
        "telemedicine_sessions", // depends on appointments
        "segment_patients", // depends on segments, patients
        "scheduled_automations", // depends on automations
        "clinic_notification_reads", // depends on notifications, clinics
        "api_logs", // depends on api_keys
        "whatsapp_incoming_logs", // depends on various
        "webhook_logs", // depends on webhooks
        "lytex_webhook_logs", // standalone logs
        "email_confirmations", // depends on auth.users
        "pending_dependent_approvals", // depends on patients
        "mercado_pago_payments", // depends on clinics
        "package_templates", // depends on clinics
        "package_payments", // depends on packages
        "package_sessions", // depends on packages
        "patient_packages", // depends on patients, packages
        "quotes", // depends on clinics
        "quote_items", // depends on quotes
        "recurring_transactions", // depends on financial
        "expense_liquidation_history", // depends on transactions
        "transaction_cost_centers", // depends on transactions
        "stock_categories", // depends on clinics
        "stock_products", // depends on clinics
        "stock_movements", // depends on products
        "stock_alerts", // depends on products
        "medical_repass_rules", // depends on clinics
        "medical_repass_periods", // depends on clinics
        "medical_repass_items", // depends on periods
        "medical_repass_payments", // depends on periods
        "waiting_list", // depends on clinics
        "union_payment_history", // depends on union_entities
        "union_share_logs", // depends on union_entities
        "union_audit_logs", // depends on union_entities
        "union_app_content", // depends on union_entities
        "member_portal_logs", // depends on members
        "user_settings_widgets", // depends on auth.users
      ];
      const orderIndex = new Map(preferredOrder.map((t, i) => [t, i] as const));
      tables.sort((a, b) => {
        const ai = orderIndex.get(a.table) ?? 9999;
        const bi = orderIndex.get(b.table) ?? 9999;
        if (ai !== bi) return ai - bi;
        return a.table.localeCompare(b.table);
      });

      console.log("[ApiMigration] Final tables to import:", tables.length, tables.map(t => `${t.table}(${t.count})`));
      
      if (tables.length === 0) {
        console.error("[ApiMigration] No valid tables found! Raw summary was:", JSON.stringify(summary));
        const rawSummaryPreview = JSON.stringify(summary).substring(0, 500);
        const msg = `Nenhuma tabela válida encontrada. Formato recebido: ${rawSummaryPreview}...`;
        captureDebug({ phase: "summary", summary });
        setState((s) => ({
          ...s,
          errors: [...s.errors, msg],
        }));
        throw new Error(msg);
      }
      
      setState((s) => ({ ...s, summary: tables, progress: 10 }));

      // Phase 2: Import users
      setState((s) => ({ ...s, phase: "users", progress: 15 }));
      toast.loading("Importando usuários...", { id: "migration" });

      const { data: usersData, error: usersError } = await supabase.functions.invoke(
        "import-from-api",
        {
          body: { sourceApiUrl: sourceApiUrl.trim(), syncKey: syncKey.trim(), phase: "users" },
        }
      );

      if (usersError) {
        captureDebug({ phase: "users", error: extractFunctionsError(usersError) });
        throw new Error(formatInvokeError(usersError));
      }
      if (usersData && usersData.success === false) {
        captureDebug({ phase: "users", response: usersData });
        throw new Error(usersData?.error || "Erro ao importar usuários");
      }
      const userMapping = usersData?.userMapping || {};
      const usersCreated = usersData?.usersCreated || 0;
      const usersSkipped = usersData?.usersSkipped || 0;

      setState((s) => ({
        ...s,
        userMapping,
        usersCreated,
        usersSkipped,
        progress: 25,
      }));

      // Phase 3: Import tables
      setState((s) => ({ ...s, phase: "tables" }));

      const safeTables: { table: string; count: number }[] = Array.isArray(tables) ? tables : [];
      if (!Array.isArray(tables)) {
        console.warn("[ApiMigration] Unexpected tables shape:", tables);
        setState((s) => ({
          ...s,
          errors: [...s.errors, "Resumo do projeto origem veio em formato inesperado (sem lista de tabelas)."],
        }));
      }

      const tablesToImport = safeTables.filter((t) => Number(t?.count || 0) > 0);
      const totalTables = tablesToImport.length;

      // If there are no tables to import, do not show a misleading "success".
      if (totalTables === 0) {
        setState((s) => ({ ...s, phase: "done", currentTable: null, progress: 100 }));
        toast.dismiss("migration");
        toast.warning(
          usersCreated > 0 || usersSkipped > 0
            ? `Nenhuma tabela para importar. Usuários: ${usersCreated} criados, ${usersSkipped} já existiam.`
            : "Nenhuma tabela para importar. Verifique o resumo retornado pela API de origem."
        );
        return;
      }

      // Execute table import loop (persisting checkpoints for resume)

      const { stopped } = await runTables({
        tablesToImport,
        userMapping,
        usersCreated,
        usersSkipped,
        startIndex: 0,
        startPage: 0,
        startLimit: null,
        accumulatedIdMapping: { ...userMapping },
        existingTables: {},
      });

      if (stopped) return;

      setState((s) => ({ ...s, phase: "done", currentTable: null, progress: 100 }));
      toast.dismiss("migration");
      toast.success("Migração concluída!");
      persistCheckpoint(null);
    } catch (error) {
      toast.dismiss("migration");
      const msg = error instanceof Error ? error.message : "Erro na migração";
      toast.error(msg);
      setState((s) => ({ ...s, errors: [...s.errors, msg] }));
    } finally {
      setMigrating(false);
    }
  };

  const successCount = Object.values(state.tables).filter((t) => t.success && t.count > 0).length;
  const errorCount = Object.values(state.tables).filter((t) => !t.success).length;
  const totalRecords = Object.values(state.tables).reduce((sum, t) => sum + (t.count || 0), 0);

  return (
    <Card className="border-accent/20 bg-accent/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent" />
          Migração via API
        </CardTitle>
        <CardDescription>
          Importa dados usando a API de sincronização criada no projeto origem.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="api-url">URL da API de Sincronização</Label>
            <Input
              id="api-url"
              type="url"
              placeholder="https://xxxxx.supabase.co/functions/v1/data-sync-api"
              value={sourceApiUrl}
              onChange={(e) => setSourceApiUrl(e.target.value)}
              disabled={migrating}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sync-key">Chave de Sincronização (x-sync-key)</Label>
            <div className="relative">
              <Input
                id="sync-key"
                type={showKey ? "text" : "password"}
                placeholder="DATA_SYNC_API_KEY"
                value={syncKey}
                onChange={(e) => setSyncKey(e.target.value)}
                disabled={migrating}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowKey(!showKey)}
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {state.phase !== "idle" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {state.phase === "summary" && "Obtendo resumo..."}
                {state.phase === "users" && "Importando usuários..."}
                {state.phase === "tables" && state.currentTable && `Importando ${state.currentTable}...`}
                {state.phase === "done" && "Migração concluída!"}
                {state.phase === "stopped" && "Importação interrompida"}
              </span>
              <span className="font-medium">{state.progress}%</span>
            </div>
            <Progress value={state.progress} className="h-2" />
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button onClick={handleMigration} disabled={migrating} variant="default">
            {migrating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Executar Migração via API
              </>
            )}
          </Button>

          {!migrating && canResume && (
            <Button onClick={handleResume} variant="secondary">
              <RefreshCw className="mr-2 h-4 w-4" />
              Continuar de onde parou
            </Button>
          )}

          {migrating && (
            <Button onClick={handleStopMigration} variant="destructive" size="sm">
              <StopCircle className="mr-2 h-4 w-4" />
              Parar Importação
            </Button>
          )}

          {state.phase !== "idle" && !migrating && (
            <Button onClick={resetState} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>

        {(state.usersCreated > 0 || state.usersSkipped > 0) && (
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              {state.usersCreated} usuários criados
            </Badge>
            {state.usersSkipped > 0 && (
              <Badge variant="outline" className="bg-muted">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {state.usersSkipped} já existiam
              </Badge>
            )}
          </div>
        )}

        {Object.keys(state.tables).length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {successCount} tabelas migradas
              </Badge>

              {errorCount > 0 && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  <XCircle className="mr-1 h-3 w-3" />
                  {errorCount} erros
                </Badge>
              )}

              <Badge variant="outline" className="bg-muted">
                {totalRecords.toLocaleString()} registros totais
              </Badge>
            </div>

            <ScrollArea className="h-[300px] rounded-md border bg-background p-4">
              <div className="space-y-2">
                {Object.entries(state.tables).map(([table, info]) => (
                  <div
                    key={table}
                    className="flex items-center justify-between py-1 border-b last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {info.success ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-mono text-sm">{table}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {info.count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {info.count} rows
                        </Badge>
                      )}
                      {info.error && (
                        <span className="text-xs text-destructive max-w-[200px] truncate" title={info.error}>
                          {info.error}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {state.errors.length > 0 && (
          <div className="space-y-2">
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
              <XCircle className="mr-1 h-3 w-3" />
              Erros
            </Badge>
            <ScrollArea className="h-[150px] rounded-md border bg-background p-3">
              <pre className="text-xs text-destructive whitespace-pre-wrap">
                {state.errors.join("\n")}
              </pre>
            </ScrollArea>
          </div>
        )}

        {debugDetails && (
          <div className="space-y-2">
            <Badge variant="outline" className="bg-muted">
              <Database className="mr-1 h-3 w-3" />
              Detalhes técnicos
            </Badge>
            <ScrollArea className="h-[180px] rounded-md border bg-background p-3">
              <pre className="text-xs whitespace-pre-wrap">{debugDetails}</pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
