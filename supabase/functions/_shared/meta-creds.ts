import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type MetaApiVersion = "v1" | "v2";

export interface MetaCreds {
  active: MetaApiVersion;
  token: string | undefined;
  phoneNumberId: string | undefined;
  wabaId: string | undefined;
}

/**
 * Resolve which Meta WhatsApp Cloud API credentials to use.
 * Reads `global_config.meta_api_active` ('v1' | 'v2') and maps to env secrets:
 *   v1 -> META_WHATSAPP_TOKEN / META_PHONE_NUMBER_ID / META_WABA_ID
 *   v2 -> META_WHATSAPP_TOKEN_V2 / META_PHONE_NUMBER_ID_V2 / META_WABA_ID_V2
 *
 * `override` can force a specific version (admin tools, copy script, etc.).
 */
export async function resolveMetaCreds(override?: MetaApiVersion): Promise<MetaCreds> {
  let active: MetaApiVersion = override ?? "v1";

  if (!override) {
    try {
      const SB_URL = Deno.env.get("SUPABASE_URL");
      const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SB_URL && SB_SERVICE) {
        const sb = createClient(SB_URL, SB_SERVICE);
        const { data } = await sb
          .from("global_config")
          .select("meta_api_active")
          .maybeSingle();
        if (data?.meta_api_active === "v2") active = "v2";
      }
    } catch (e) {
      console.warn("[meta-creds] Failed to read global_config, defaulting to v1", e);
    }
  }

  if (active === "v2") {
    return {
      active,
      token: Deno.env.get("META_WHATSAPP_TOKEN_V2"),
      phoneNumberId: Deno.env.get("META_PHONE_NUMBER_ID_V2"),
      wabaId: Deno.env.get("META_WABA_ID_V2"),
    };
  }

  return {
    active,
    token: Deno.env.get("META_WHATSAPP_TOKEN"),
    phoneNumberId: Deno.env.get("META_PHONE_NUMBER_ID"),
    wabaId: Deno.env.get("META_WABA_ID"),
  };
}

export function getMetaCredsByVersion(v: MetaApiVersion): MetaCreds {
  if (v === "v2") {
    return {
      active: "v2",
      token: Deno.env.get("META_WHATSAPP_TOKEN_V2"),
      phoneNumberId: Deno.env.get("META_PHONE_NUMBER_ID_V2"),
      wabaId: Deno.env.get("META_WABA_ID_V2"),
    };
  }
  return {
    active: "v1",
    token: Deno.env.get("META_WHATSAPP_TOKEN"),
    phoneNumberId: Deno.env.get("META_PHONE_NUMBER_ID"),
    wabaId: Deno.env.get("META_WABA_ID"),
  };
}