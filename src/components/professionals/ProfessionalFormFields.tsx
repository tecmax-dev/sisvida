import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, User, FileText } from "lucide-react";

interface ProfessionalFormFieldsProps {
  // Basic fields
  address: string;
  setAddress: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  state: string;
  setState: (value: string) => void;
  zipCode: string;
  setZipCode: (value: string) => void;
  whatsapp: string;
  setWhatsapp: (value: string) => void;
  bio: string;
  setBio: (value: string) => void;
  education: string;
  setEducation: (value: string) => void;
  experience: string;
  setExperience: (value: string) => void;
}

const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

function formatZipCode(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

function formatWhatsApp(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function ProfessionalFormFields({
  address,
  setAddress,
  city,
  setCity,
  state,
  setState,
  zipCode,
  setZipCode,
  whatsapp,
  setWhatsapp,
  bio,
  setBio,
  education,
  setEducation,
  experience,
  setExperience,
}: ProfessionalFormFieldsProps) {
  return (
    <Tabs defaultValue="address" className="w-full mt-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="address" className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Endereço
        </TabsTrigger>
        <TabsTrigger value="profile" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Perfil Público
        </TabsTrigger>
      </TabsList>

      <TabsContent value="address" className="space-y-4 mt-4">
        <div>
          <Label htmlFor="address">Endereço completo</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Rua, número, bairro"
            className="mt-1.5"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Cidade"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="state">Estado</Label>
            <select
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Selecione</option>
              {brazilianStates.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="zipCode">CEP</Label>
            <Input
              id="zipCode"
              value={zipCode}
              onChange={(e) => setZipCode(formatZipCode(e.target.value))}
              placeholder="00000-000"
              maxLength={9}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
              placeholder="(00) 00000-0000"
              maxLength={15}
              className="mt-1.5"
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          O endereço será exibido na página pública do profissional com Google Maps.
        </p>
      </TabsContent>

      <TabsContent value="profile" className="space-y-4 mt-4">
        <div>
          <Label htmlFor="bio">Sobre Mim</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Apresentação profissional para os pacientes..."
            rows={3}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="education">Formação</Label>
          <Textarea
            id="education"
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            placeholder="Graduação, pós-graduação, especializações..."
            rows={3}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="experience">Experiência Profissional</Label>
          <Textarea
            id="experience"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder="Experiência clínica, hospitais, clínicas anteriores..."
            rows={3}
            className="mt-1.5"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Estas informações serão exibidas na página pública de agendamento.
        </p>
      </TabsContent>
    </Tabs>
  );
}
