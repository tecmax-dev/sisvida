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
      const { data, error } = await supabase.functions.invoke("evolution-contacts");
      if (error || !Array.isArray(data)) return {};
      const map: Record<string, string> = {};
      for (const c of data as EvolutionContact[]) {
        if (c.remoteJid && c.profilePicUrl) {
          const phone = c.remoteJid.replace(/@.*$/, "");
          map[normalizePhone(phone)] = c.profilePicUrl;
        }
      }
      return map;
    },
    staleTime: 10 * 60 * 1000,
  });

  const getProfilePic = (contactNumber: string): string | null => {
    if (!contactMap) return null;
    const normalized = normalizePhone(contactNumber);
    return contactMap[normalized] || null;
  };

  return { getProfilePic };
}
