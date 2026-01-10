import { useMemo } from "react";
import { useAuth } from "./useAuth";

export interface Nomenclature {
  /** Singular form: "Associado" */
  singular: string;
  /** Plural form: "Associados" */
  plural: string;
  /** Lowercase singular: "associado" */
  singularLower: string;
  /** Lowercase plural: "associados" */
  pluralLower: string;
  /** Definite article: "o" or "a" */
  article: string;
  /** Plural definite article: "os" or "as" */
  articlePlural: string;
  /** Indefinite article: "um" or "uma" */
  indefiniteArticle: string;
  /** Possessive: "do" or "da" */
  possessive: string;
  /** Plural possessive: "dos" or "das" */
  possessivePlural: string;
  
  /**
   * Format a template string replacing placeholders
   * @example format("Cadastrar {singular}") => "Cadastrar Associado"
   * @example format("Lista de {plural}") => "Lista de Associados"
   */
  format: (template: string) => string;
}

// Default fallback
const DEFAULT_NOMENCLATURE = "Paciente";

// Predefined nomenclatures with their grammatical properties
const NOMENCLATURE_CONFIG: Record<string, { 
  plural: string; 
  article: string; 
  articlePlural: string;
  indefiniteArticle: string;
  possessive: string;
  possessivePlural: string;
}> = {
  "Paciente": { 
    plural: "Pacientes", 
    article: "o", 
    articlePlural: "os",
    indefiniteArticle: "um",
    possessive: "do",
    possessivePlural: "dos"
  },
  "Associado": { 
    plural: "Associados", 
    article: "o", 
    articlePlural: "os",
    indefiniteArticle: "um",
    possessive: "do",
    possessivePlural: "dos"
  },
  "Filiado": { 
    plural: "Filiados", 
    article: "o", 
    articlePlural: "os",
    indefiniteArticle: "um",
    possessive: "do",
    possessivePlural: "dos"
  },
  "Cliente": { 
    plural: "Clientes", 
    article: "o", 
    articlePlural: "os",
    indefiniteArticle: "um",
    possessive: "do",
    possessivePlural: "dos"
  },
  "Beneficiário": { 
    plural: "Beneficiários", 
    article: "o", 
    articlePlural: "os",
    indefiniteArticle: "um",
    possessive: "do",
    possessivePlural: "dos"
  },
  "Contribuinte": { 
    plural: "Contribuintes", 
    article: "o", 
    articlePlural: "os",
    indefiniteArticle: "um",
    possessive: "do",
    possessivePlural: "dos"
  },
  "Sócio": { 
    plural: "Sócios", 
    article: "o", 
    articlePlural: "os",
    indefiniteArticle: "um",
    possessive: "do",
    possessivePlural: "dos"
  },
  "Membro": { 
    plural: "Membros", 
    article: "o", 
    articlePlural: "os",
    indefiniteArticle: "um",
    possessive: "do",
    possessivePlural: "dos"
  },
};

/**
 * Hook that provides the clinic's configured nomenclature for person records.
 * Uses the clinic's entity_nomenclature setting, falling back to "Paciente".
 */
export function useNomenclature(): Nomenclature {
  const { currentClinic } = useAuth();
  
  return useMemo(() => {
    const singular = currentClinic?.entity_nomenclature || DEFAULT_NOMENCLATURE;
    
    // Get config for this nomenclature, or use defaults
    const config = NOMENCLATURE_CONFIG[singular] || {
      plural: `${singular}s`,
      article: "o",
      articlePlural: "os",
      indefiniteArticle: "um",
      possessive: "do",
      possessivePlural: "dos",
    };
    
    const nomenclature: Nomenclature = {
      singular,
      plural: config.plural,
      singularLower: singular.toLowerCase(),
      pluralLower: config.plural.toLowerCase(),
      article: config.article,
      articlePlural: config.articlePlural,
      indefiniteArticle: config.indefiniteArticle,
      possessive: config.possessive,
      possessivePlural: config.possessivePlural,
      format: (template: string) => {
        return template
          .replace(/{singular}/g, singular)
          .replace(/{plural}/g, config.plural)
          .replace(/{singularLower}/g, singular.toLowerCase())
          .replace(/{pluralLower}/g, config.plural.toLowerCase())
          .replace(/{article}/g, config.article)
          .replace(/{articlePlural}/g, config.articlePlural)
          .replace(/{indefiniteArticle}/g, config.indefiniteArticle)
          .replace(/{possessive}/g, config.possessive)
          .replace(/{possessivePlural}/g, config.possessivePlural);
      },
    };
    
    return nomenclature;
  }, [currentClinic?.entity_nomenclature]);
}

/**
 * Get available nomenclature options for configuration UI
 */
export function getNomenclatureOptions(): { value: string; label: string }[] {
  return Object.keys(NOMENCLATURE_CONFIG).map(key => ({
    value: key,
    label: key,
  }));
}
