import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface EvolutionContact {
  remoteJid?: string;
  profilePicUrl?: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^55/, "");
}

export function useContactProfilePics() {
  const { data: contactMap } = useQuery({
    queryKey: ["evolution-contacts-pic-map"],
    queryFn: async () => {
      try {
        const res = await supabase.functions.invoke("evolution-contacts");
        const data = res?.data;
        if (res?.error || !Array.isArray(data)) return {};
        const map: Record<string, string> = {};
        for (const c of data as EvolutionContact[]) {
        if (c.remoteJid && c.profilePicUrl) {
          const phone = c.remoteJid.replace(/@.*$/, "");
          map[normalizePhone(phone)] = c.profilePicUrl;
        }
        }
        return map;
      } catch {
        return {};
      }
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const getProfilePic = (contactNumber: string): string | null => {
    if (!contactMap) return null;
    const normalized = normalizePhone(contactNumber);
    return contactMap[normalized] || null;
  };

  return { getProfilePic };
}
