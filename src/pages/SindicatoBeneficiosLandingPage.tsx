import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Heart,
  GraduationCap,
  Sparkles,
  Scale,
  Stethoscope,
  Smile,
  Bone,
  Baby,
  FlaskConical,
  Eye,
  Brain,
  Hospital,
  Leaf,
  ArrowRight,
  CheckCircle2,
  Users,
  Shield,
  Phone,
  MapPin,
  Star,
  Zap,
  Quote,
  BadgePercent,
  Clock,
} from "lucide-react";
import { SINDICATO_UNION_ENTITY_ID } from "@/constants/sindicato";

import familiaHero from "@/assets/sindicato/familia-hero.jpg";
import familiaSaude from "@/assets/sindicato/familia-saude.jpg";
import familiaEducacao from "@/assets/sindicato/familia-educacao.jpg";
import familiaEstetica from "@/assets/sindicato/familia-estetica.jpg";
import perfilDaniela from "@/assets/sindicato/perfil-daniela.webp";
import perfilAlcides from "@/assets/sindicato/perfil-dalcides.jpg";

const LOGO_URL = "/apple-touch-icon-sindicato.png";

const OG_IMAGE_URL = "https://czmnkrurkzuerrcjzbkp.supabase.co/storage/v1/object/public/clinic-assets/sindicato%2Fog-hero-dashboard.png";
const PERFIL_ELINEY_URL = "https://czmnkrurkzuerrcjzbkp.supabase.co/storage/v1/object/public/union-app-content/convenios/eliney-silva-v2.jpg?v=20260529-landing";

const FILIACAO_URL = `/sindical/filiacao/${SINDICATO_UNION_ENTITY_ID}`;
const WHATSAPP_URL = "https://wa.me/557332239980?text=Olá! Quero saber mais sobre os benefícios do sindicato.";

interface Benefit {
  name: string;
  description: string;
  icon: React.ElementType;
  category: "saude" | "estudos" | "estetica" | "juridico";
  photo?: string;
}

const benefits: Benefit[] = [
  { name: "Dr. José Alcides", description: "Clínico Geral — Consulta 100% gratuita", icon: Stethoscope, category: "saude", photo: perfilAlcides },
  { name: "Dra. Juliane Leite", description: "Dentista — Atendimento 100% gratuito", icon: Smile, category: "saude" },
  { name: "Dr. Jorge Avelar", description: "Ortopedista — Consulta 100% gratuita", icon: Bone, category: "saude" },
  { name: "Dr. Pedro Roberto", description: "Urologista — Consulta 100% gratuita", icon: Stethoscope, category: "saude" },
  { name: "Drª Daniela Sales", description: "Terapia Holística — Bem-estar e saúde integrativa", icon: Leaf, category: "estetica", photo: perfilDaniela },
  { name: "Dra. Uiara Tiuba", description: "Pediatra — Cuidados para seus filhos", icon: Baby, category: "saude" },
  { name: "Hospital São José", description: "Descontos em exames hospitalares", icon: Hospital, category: "saude" },
  { name: "Laboratório Lidi", description: "Preventivo ginecológico 100% gratuito para titular + desconto em exames", icon: FlaskConical, category: "saude" },
  { name: "Laboratório Lidi", description: "Desconto em exames laboratoriais", icon: FlaskConical, category: "saude" },
  { name: "Laboratório Biolife", description: "Desconto em exames laboratoriais", icon: FlaskConical, category: "saude" },
  { name: "Clínica OftalmoSul", description: "Desconto em consultas e exames oftalmológicos", icon: Eye, category: "saude" },
  { name: "Clínica Medico Center", description: "Desconto em consultas e exames", icon: Stethoscope, category: "saude" },
  { name: "Clínica Pensar", description: "Desconto em consultas — Saúde mental", icon: Brain, category: "saude" },
  { name: "Dr. Eliney Silva", description: "Médico Psicólogo — Atende pelo convênio do sindicato", icon: Brain, category: "saude", photo: PERFIL_ELINEY_URL },
  { name: "Faculdade de Ilhéus", description: "Desconto para titular e dependentes", icon: GraduationCap, category: "estudos" },
  { name: "Uniasselvi", description: "Desconto para titular e dependentes", icon: GraduationCap, category: "estudos" },
  { name: "CCAA", description: "Desconto na mensalidade de idiomas", icon: GraduationCap, category: "estudos" },
  { name: "Espaçolaser", description: "Desconto para titular e dependentes", icon: Sparkles, category: "estetica" },
  { name: "Dra. Dione Mattos", description: "Assessoria jurídica trabalhista", icon: Scale, category: "juridico" },
];

const categoryConfig = {
  saude: { label: "Saúde", icon: Heart, solidColor: "bg-cta", bg: "bg-cta/5", text: "text-cta", border: "border-cta/20", image: familiaSaude, imageAlt: "Família sendo atendida em consulta médica" },
  estudos: { label: "Educação", icon: GraduationCap, solidColor: "bg-primary", bg: "bg-primary/5", text: "text-primary", border: "border-primary/20", image: familiaEducacao, imageAlt: "Jovens comemorando matrícula na faculdade" },
  estetica: { label: "Estética & Beleza", icon: Sparkles, solidColor: "bg-cta", bg: "bg-cta/5", text: "text-cta", border: "border-cta/20", image: familiaEstetica, imageAlt: "Mulher sorrindo em clínica de estética" },
  juridico: { label: "Jurídico", icon: Scale, solidColor: "bg-primary", bg: "bg-primary/5", text: "text-primary", border: "border-primary/20", image: null, imageAlt: "" },
};

const testimonials = [
  { name: "Maria S.", role: "Comerciária em Ilhéus", text: "Com o convênio do sindicato, consegui fazer todos os exames da minha família pagando muito menos. É uma economia enorme no final do mês!", avatar: "M" },
  { name: "Carlos R.", role: "Comerciário em Itacaré", text: "Minha filha conseguiu desconto na faculdade pelo sindicato. Algo que parecia impossível se tornou realidade!", avatar: "C" },
  { name: "Ana L.", role: "Comerciária em Ubaitaba", text: "A assessoria jurídica me ajudou quando mais precisei. Ter o sindicato ao meu lado fez toda a diferença.", avatar: "A" },
];

export default function SindicatoBeneficiosLandingPage() {
  const [urgencyCount] = useState(Math.floor(Math.random() * 30) + 42);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    document.documentElement.style.colorScheme = "light";
    document.title = "Prosinge - Gestão Sindical | SECMI - Benefícios do Associado";
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) link.href = LOGO_URL;

    // Open Graph meta tags for social sharing
    const ogTags = [
      { property: "og:title", content: "SECMI - Benefícios do Associado | Sindicato dos Comerciários de Ilhéus" },
      { property: "og:description", content: "Associe-se ao SECMI e garanta consultas médicas, descontos em faculdades, assessoria jurídica e muito mais para você e toda sua família. 89 anos defendendo seus direitos!" },
      { property: "og:image", content: OG_IMAGE_URL },
      { property: "og:image:width", content: "1024" },
      { property: "og:image:height", content: "768" },
      { property: "og:url", content: window.location.href },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: "SECMI - Sindicato dos Comerciários" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "SECMI - Benefícios do Associado | Sindicato dos Comerciários de Ilhéus" },
      { name: "twitter:description", content: "Associe-se ao SECMI e garanta consultas médicas, descontos em faculdades, assessoria jurídica e muito mais para você e toda sua família." },
      { name: "twitter:image", content: OG_IMAGE_URL },
    ];

    ogTags.forEach(({ property, name, content }) => {
      const selector = property ? `meta[property="${property}"]` : `meta[name="${name}"]`;
      let meta = document.querySelector(selector) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement("meta");
        if (property) meta.setAttribute("property", property);
        if (name) meta.setAttribute("name", name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    });
  }, []);

  const grouped = {
    saude: benefits.filter((b) => b.category === "saude"),
    estudos: benefits.filter((b) => b.category === "estudos"),
    estetica: benefits.filter((b) => b.category === "estetica"),
    juridico: benefits.filter((b) => b.category === "juridico"),
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 [color-scheme:light]" data-theme="light">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src={LOGO_URL} alt="SECMI" className="w-10 h-10 rounded-xl" />
            <div>
              <span className="font-bold text-gray-900 text-sm leading-tight block">Sindicato dos Comerciários</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Ilhéus • Itacaré • Ubaitaba • Una • Uruçuca</span>
            </div>
          </a>
          <Button className="bg-[#094798] hover:bg-[#138a7d] text-white rounded-full px-6 text-sm font-semibold shadow-md" asChild>
            <a href={FILIACAO_URL}>Filiar-se agora</a>
          </Button>
        </div>
      </header>

      {/* Hero with Image */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={familiaHero} alt="Família feliz protegida pelo sindicato" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
              <Star className="w-4 h-4 text-yellow-300" />
              <span className="text-white/90 text-sm font-medium">89 anos defendendo seus direitos</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
              Sua família merece{" "}
              <span className="relative inline-block">
                <span className="relative z-10">mais benefícios</span>
                <span className="absolute bottom-1 left-0 right-0 h-3 bg-yellow-400/30 rounded-sm" />
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/85 mb-8 leading-relaxed">
              Associe-se ao SECMI e garanta <strong className="text-white">consultas médicas, descontos em faculdades, assessoria jurídica</strong> e muito mais — para você <strong className="text-white">e toda sua família</strong>.
            </p>

            {/* Urgency badge */}
            <div className="inline-flex items-center gap-2 bg-yellow-400/20 border border-yellow-400/30 rounded-full px-4 py-2 mb-8">
              <Clock className="w-4 h-4 text-yellow-300 animate-pulse" />
              <span className="text-yellow-100 text-sm font-medium">{urgencyCount} pessoas se associaram este mês</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-yellow-400 text-gray-900 hover:bg-yellow-300 rounded-full px-8 h-14 text-base font-bold shadow-xl transition-all hover:scale-105 hover:shadow-2xl"
                asChild
              >
                <a href={FILIACAO_URL} className="flex items-center gap-2">
                  Quero me associar agora
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <Button
                size="lg"
                className="border-2 border-white/30 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 rounded-full px-8 h-14 text-base font-semibold"
                asChild
              >
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Fale pelo WhatsApp
                </a>
              </Button>
            </div>

            <p className="mt-6 text-white/50 text-sm flex items-center gap-4">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Sem burocracia</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> 100% online</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Benefícios imediatos</span>
            </p>
          </div>
        </div>
      </section>

      {/* Value Proposition Strip */}
      <section className="bg-[#094798] py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-6 md:gap-12 text-white text-sm font-medium">
            <span className="flex items-center gap-2"><BadgePercent className="w-5 h-5" /> Até 50% de desconto</span>
            <span className="flex items-center gap-2"><Users className="w-5 h-5" /> Você + toda família</span>
            <span className="flex items-center gap-2"><Shield className="w-5 h-5" /> 17+ convênios ativos</span>
            <span className="flex items-center gap-2"><MapPin className="w-5 h-5" /> 5 cidades atendidas</span>
          </div>
        </div>
      </section>

      {/* Social Proof Stats */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { value: "89", label: "Anos de história", suffix: "" },
              { value: "17+", label: "Convênios ativos", suffix: "" },
              { value: "5", label: "Cidades atendidas", suffix: "" },
              { value: "12", label: "Especialidades médicas", suffix: "" },
            ].map((stat, i) => (
              <div key={i} className="text-center p-4">
                <div className="text-3xl md:text-4xl font-extrabold text-[#094798] mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits by Category — with images */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest text-[#094798] uppercase mb-3">Convênios Exclusivos</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Economia real para sua família
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Descontos e atendimento diferenciado em saúde, educação, estética e assessoria jurídica.
            </p>
          </div>

          <div className="space-y-20 max-w-6xl mx-auto">
            {(Object.keys(grouped) as Array<keyof typeof grouped>).map((cat, catIndex) => {
              const config = categoryConfig[cat];
              const items = grouped[cat];
              if (items.length === 0) return null;
              const isReversed = catIndex % 2 !== 0;

              return (
                <div key={cat} className="space-y-6">
                  {/* Category header with image */}
                  {config.image && (
                    <div className={`grid md:grid-cols-2 gap-8 items-center ${isReversed ? "md:[direction:rtl]" : ""}`}>
                      <div className="rounded-2xl overflow-hidden shadow-xl">
                        <img
                          src={config.image}
                          alt={config.imageAlt}
                          className="w-full h-64 md:h-80 object-cover hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                      </div>
                      <div className={isReversed ? "md:[direction:ltr]" : ""}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-12 h-12 rounded-xl ${config.solidColor} flex items-center justify-center shadow-md`}>
                            <config.icon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold text-gray-900">{config.label}</h3>
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${config.bg} ${config.text}`}>
                              {items.length} {items.length === 1 ? "convênio" : "convênios"}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-500 mb-6 leading-relaxed">
                          {cat === "saude" && "Cuide da saúde de toda a família com consultas, exames e tratamentos a preços acessíveis nos melhores profissionais da região."}
                          {cat === "estudos" && "Invista no futuro! Descontos em faculdades e cursos de idiomas para você e seus dependentes."}
                          {cat === "estetica" && "Você merece se cuidar! Descontos especiais em estética e beleza para associados."}
                          {cat === "juridico" && "Orientação jurídica trabalhista especializada para proteger seus direitos."}
                        </p>
                        <Button
                          className="bg-[#094798] hover:bg-[#138a7d] text-white rounded-full px-6 font-semibold shadow-md"
                          asChild
                        >
                          <a href={FILIACAO_URL} className="flex items-center gap-2">
                            Quero esses benefícios
                            <ArrowRight className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* If no image (juridico), show inline header */}
                  {!config.image && (
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-12 h-12 rounded-xl ${config.solidColor} flex items-center justify-center shadow-md`}>
                        <config.icon className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">{config.label}</h3>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${config.bg} ${config.text}`}>
                          {items.length} {items.length === 1 ? "convênio" : "convênios"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Benefit cards */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((b, i) => (
                      <a
                        key={i}
                        href={FILIACAO_URL}
                        className={`group flex items-start gap-4 p-4 rounded-xl border ${config.border} bg-white hover:shadow-lg transition-all duration-200 hover:-translate-y-1 cursor-pointer`}
                      >
                        {b.photo ? (
                          <img src={b.photo} alt={b.name} className="w-10 h-10 rounded-lg object-cover shrink-0 group-hover:scale-110 transition-transform" />
                        ) : (
                          <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                            <b.icon className={`w-5 h-5 ${config.text}`} />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-gray-900 text-sm group-hover:text-[#094798] transition-colors">{b.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{b.description}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mid-page CTA */}
      <section className="py-16 bg-[#0c4a42]">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-4">
            Tudo isso por menos do que você imagina!
          </h2>
          <p className="text-white/70 mb-8 max-w-lg mx-auto">
            A filiação ao sindicato dá acesso a todos os convênios para você e sua família. Não perca mais tempo!
          </p>
          <Button
            size="lg"
            className="bg-yellow-400 text-gray-900 hover:bg-yellow-300 rounded-full px-10 h-14 text-base font-bold shadow-xl transition-all hover:scale-105"
            asChild
          >
            <a href={FILIACAO_URL} className="flex items-center gap-2">
              Associar-se agora — É rápido!
              <ArrowRight className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest text-[#094798] uppercase mb-3">Depoimentos</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Quem é associado, recomenda
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((t, i) => (
              <Card key={i} className="border-gray-200 bg-gray-50 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <Quote className="w-8 h-8 text-[#094798]/20 mb-3" />
                  <p className="text-gray-600 text-sm leading-relaxed mb-4 italic">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#094798] text-white flex items-center justify-center font-bold text-sm">
                      {t.avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                      <div className="text-xs text-gray-500">{t.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Join — Compact */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest text-[#094798] uppercase mb-3">Vantagens</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Por que se associar ao SECMI?
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Shield, title: "Proteção Trabalhista", desc: "Seus direitos garantidos pela Convenção Coletiva de Trabalho." },
              { icon: Heart, title: "Saúde Acessível", desc: "Consultas médicas, exames e tratamentos com valores reduzidos." },
              { icon: GraduationCap, title: "Educação com Desconto", desc: "Faculdades e cursos de idiomas para você e sua família." },
              { icon: Scale, title: "Assessoria Jurídica", desc: "Orientação trabalhista gratuita para associados." },
              { icon: Users, title: "Representação Forte", desc: "Negociações coletivas que valorizam o seu trabalho." },
              { icon: Zap, title: "Serviços Digitais", desc: "App exclusivo com carteirinha digital e agendamento online." },
            ].map((r, i) => (
              <a key={i} href={FILIACAO_URL} className="block group">
                <Card className="border-gray-200 bg-white hover:shadow-lg transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[#094798]/30 h-full">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-[#094798]/10 flex items-center justify-center mb-4 group-hover:bg-[#094798]/20 transition-colors">
                      <r.icon className="w-6 h-6 text-[#094798]" />
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2 group-hover:text-[#094798] transition-colors">{r.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{r.desc}</p>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* How to Join — Steps */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <span className="inline-block text-xs font-bold tracking-widest text-[#094798] uppercase mb-3">Como associar-se</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              3 passos simples
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", title: "Preencha o cadastro", desc: "Acesse nosso formulário online e informe seus dados. Leva menos de 3 minutos!" },
              { step: "2", title: "Confirmação rápida", desc: "Nossa equipe valida suas informações e ativa sua associação em até 24h." },
              { step: "3", title: "Use seus benefícios!", desc: "Receba sua carteirinha digital e comece a economizar em todos os convênios!" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#094798] text-white text-2xl font-extrabold flex items-center justify-center mx-auto mb-4 shadow-lg">
                  {item.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-lg">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Button
              size="lg"
              className="bg-[#094798] hover:bg-[#138a7d] text-white rounded-full px-10 h-14 text-base font-bold shadow-xl transition-all hover:scale-105"
              asChild
            >
              <a href={FILIACAO_URL} className="flex items-center gap-2">
                Começar meu cadastro
                <ArrowRight className="h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <MapPin className="w-8 h-8 text-[#094798] mx-auto mb-4" />
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-4">
              Abrangência regional
            </h2>
            <p className="text-gray-500 mb-8">
              Representamos os trabalhadores do comércio de toda a região:
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["Ilhéus", "Itacaré", "Ubaitaba", "Una", "Uruçuca"].map((city) => (
                <span key={city} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#094798]/10 text-[#094798] font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  {city}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0">
          <img src={familiaHero} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[#0c4a42]/90" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-6">
              Não fique de fora!
            </h2>
            <p className="text-lg text-white/80 mb-4 max-w-2xl mx-auto">
              Cada dia sem associação é um dia pagando mais caro em consultas, exames e educação. Seus colegas de trabalho já estão economizando.
            </p>
            <p className="text-yellow-300 font-semibold text-lg mb-8">
              Associe-se hoje e comece a usar os benefícios amanhã!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-yellow-400 text-gray-900 hover:bg-yellow-300 rounded-full px-10 h-14 text-lg font-bold shadow-xl transition-all hover:scale-105"
                asChild
              >
                <a href={FILIACAO_URL} className="flex items-center gap-2">
                  Filiar-se agora
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <Button
                size="lg"
                className="border-2 border-white/30 bg-transparent text-white hover:bg-white/10 rounded-full px-8 h-14 text-base font-semibold"
                asChild
              >
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  WhatsApp
                </a>
              </Button>
            </div>
            <p className="mt-6 text-white/40 text-sm">
              SECMI — Sindicato dos Empregados no Comércio de Ilhéus e Região
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <a href="/" className="flex items-center gap-3 hover:text-white transition-colors group">
              <img src={LOGO_URL} alt="SECMI" className="w-8 h-8 rounded-lg group-hover:opacity-80 transition-opacity" />
              <span className="text-sm">SECMI — Sindicato dos Empregados no Comércio de Ilhéus e Região</span>
            </a>
            <div className="flex items-center gap-4 text-sm">
              <a href="https://www.comerciariosilheus.org.br" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Site oficial
              </a>
              <span className="text-gray-700">•</span>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Contato
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110"
        aria-label="Fale pelo WhatsApp"
      >
        <Phone className="w-6 h-6" />
      </a>
    </div>
  );
}
