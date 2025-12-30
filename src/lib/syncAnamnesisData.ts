import { supabase } from "@/integrations/supabase/client";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options?: { id: string; option_text: string }[];
}

interface Answer {
  question_id: string;
  answer_text: string | null;
  answer_option_ids: string[] | null;
}

interface SyncAnamnesisParams {
  clinicId: string;
  patientId: string;
  questions: Question[];
  answers: Answer[];
}

// Keywords to map questions to anamnesis fields (Portuguese)
const fieldMappings: Record<string, string[]> = {
  blood_type: ["tipo sanguíneo", "tipo de sangue", "grupo sanguíneo"],
  allergies: ["alergia", "alergias", "reações alérgicas", "alérgico"],
  chronic_diseases: ["doença crônica", "doenças crônicas", "condições crônicas", "patologia", "diabetes", "hipertensão", "asma"],
  current_medications: ["medicamento", "medicamentos", "remédio", "remédios", "medicação", "usa algum medicamento", "toma algum medicamento"],
  previous_surgeries: ["cirurgia", "cirurgias", "procedimento cirúrgico", "operação", "operações", "já fez cirurgia"],
  family_history: ["histórico familiar", "antecedentes familiares", "doenças na família", "casos na família"],
  smoking: ["fuma", "tabagismo", "fumante", "cigarro", "tabaco"],
  alcohol: ["álcool", "bebida alcoólica", "etilismo", "bebe", "consumo de álcool"],
  physical_activity: ["atividade física", "exercício", "exercícios", "pratica esporte", "sedentário", "academia"],
  emergency_contact_name: ["contato de emergência", "nome do contato", "responsável"],
  emergency_contact_phone: ["telefone de emergência", "telefone do contato", "telefone responsável"],
  additional_notes: ["observação", "observações", "informações adicionais", "outras informações", "notas"],
};

// Get the answer display value
const getAnswerValue = (question: Question, answer: Answer | undefined): string => {
  if (!answer) return "";

  if (question.question_type === "boolean") {
    if (!answer.answer_text || answer.answer_text === "false") {
      return "Não";
    }
    return answer.answer_text === "true" ? "Sim" : answer.answer_text;
  }

  if (["text", "textarea", "date", "number"].includes(question.question_type)) {
    return answer.answer_text || "";
  }

  if (["radio", "select", "checkbox"].includes(question.question_type)) {
    if (!answer.answer_option_ids || answer.answer_option_ids.length === 0) return "";
    
    const selectedOptions = question.options
      ?.filter(opt => answer.answer_option_ids?.includes(opt.id))
      .map(opt => opt.option_text);
    
    return selectedOptions?.join(", ") || "";
  }

  return answer.answer_text || "";
};

// Check if a question matches a field based on keywords
const matchesField = (questionText: string, keywords: string[]): boolean => {
  const normalizedQuestion = questionText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return keywords.some(keyword => {
    const normalizedKeyword = keyword.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return normalizedQuestion.includes(normalizedKeyword);
  });
};

// Convert string answer to boolean for habit fields
const parseBooleanAnswer = (value: string): boolean => {
  const positiveAnswers = ["sim", "yes", "true", "1", "s"];
  return positiveAnswers.includes(value.toLowerCase().trim());
};

/**
 * Syncs dynamic anamnesis data to the patient's anamnesis record
 * This allows professionals to easily consult patient medical history
 */
export const syncDynamicAnamnesisToPatient = async ({
  clinicId,
  patientId,
  questions,
  answers,
}: SyncAnamnesisParams): Promise<void> => {
  try {
    // Build the anamnesis data from questions/answers
    const anamnesisData: Record<string, any> = {};
    const textFields: string[] = [];

    for (const question of questions) {
      const answer = answers.find(a => a.question_id === question.id);
      const answerValue = getAnswerValue(question, answer);
      
      if (!answerValue) continue;

      let fieldMatched = false;

      // Try to match to specific fields
      for (const [field, keywords] of Object.entries(fieldMappings)) {
        if (matchesField(question.question_text, keywords)) {
          fieldMatched = true;

          // Handle boolean fields (habits)
          if (["smoking", "alcohol", "physical_activity"].includes(field)) {
            anamnesisData[field] = parseBooleanAnswer(answerValue);
          } else {
            // For text fields, append if already exists
            if (anamnesisData[field]) {
              anamnesisData[field] += `\n${answerValue}`;
            } else {
              anamnesisData[field] = answerValue;
            }
          }
          break;
        }
      }

      // If no specific field matched, add to additional notes
      if (!fieldMatched && answerValue) {
        textFields.push(`${question.question_text}: ${answerValue}`);
      }
    }

    // Add unmatched fields to additional_notes
    if (textFields.length > 0) {
      const existingNotes = anamnesisData.additional_notes || "";
      anamnesisData.additional_notes = existingNotes 
        ? `${existingNotes}\n\n--- Anamnese Dinâmica ---\n${textFields.join("\n")}`
        : `--- Anamnese Dinâmica ---\n${textFields.join("\n")}`;
    }

    // Only proceed if we have data to sync
    if (Object.keys(anamnesisData).length === 0) {
      console.log("No anamnesis data to sync");
      return;
    }

    // Check if patient already has an anamnesis record
    const { data: existingAnamnesis } = await supabase
      .from("anamnesis")
      .select("id, additional_notes")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingAnamnesis) {
      // Update existing record, merging text fields
      const updateData: Record<string, any> = { ...anamnesisData };
      
      // For text fields, append new data to existing
      const textFieldNames = ["allergies", "chronic_diseases", "current_medications", "previous_surgeries", "family_history", "additional_notes"];
      
      for (const field of textFieldNames) {
        if (updateData[field] && existingAnamnesis[field as keyof typeof existingAnamnesis]) {
          // Only append if the new data is different
          const existingValue = String(existingAnamnesis[field as keyof typeof existingAnamnesis] || "");
          if (!existingValue.includes(updateData[field])) {
            updateData[field] = `${existingValue}\n${updateData[field]}`;
          }
        }
      }

      const { error: updateError } = await supabase
        .from("anamnesis")
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingAnamnesis.id);

      if (updateError) {
        console.error("Error updating anamnesis:", updateError);
        throw updateError;
      }

      console.log("Anamnesis updated successfully");
    } else {
      // Create new anamnesis record
      const { error: insertError } = await supabase
        .from("anamnesis")
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          ...anamnesisData,
        });

      if (insertError) {
        console.error("Error creating anamnesis:", insertError);
        throw insertError;
      }

      console.log("Anamnesis created successfully");
    }
  } catch (error) {
    console.error("Error syncing anamnesis data:", error);
    // Don't throw - we don't want to fail the main save operation
  }
};
