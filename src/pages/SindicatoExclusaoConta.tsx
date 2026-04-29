import { Link } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SindicatoExclusaoConta = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Exclusão de Conta e Dados</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Solicitação de exclusão de conta e dados pessoais do app do sindicato
            </p>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold mb-2">Como solicitar a exclusão</h2>
              <p className="text-muted-foreground">
                A exclusão da conta no app está vinculada ao processo de{" "}
                <strong>desfiliação do sindicato</strong>. Por se tratar de relação
                sindical formal, a solicitação deve ser feita <strong>presencialmente</strong>{" "}
                na sede da entidade, mediante apresentação de documento de identidade
                com foto e assinatura do termo de desfiliação.
              </p>
            </section>

            <section className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Atendimento presencial
              </h3>
              <p className="text-muted-foreground">
                Compareça à sede do seu sindicato em horário comercial. Os contatos
                e endereços estão disponíveis abaixo:
              </p>
              <div className="space-y-2">
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href="tel:+557332311784" className="hover:underline">
                    (73) 3231-1784
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <a
                    href="mailto:contato@sindicato.org.br"
                    className="hover:underline"
                  >
                    contato@sindicato.org.br
                  </a>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">O que será excluído</h2>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Dados cadastrais (nome, CPF, e-mail, telefone, endereço)</li>
                <li>Foto pessoal e foto da carteirinha digital</li>
                <li>Histórico de agendamentos médicos</li>
                <li>Documentos enviados (contracheques, comprovantes)</li>
                <li>Credenciais de acesso ao app</li>
                <li>Dados de dependentes vinculados</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">O que é retido por obrigação legal</h2>
              <p className="text-muted-foreground mb-2">
                Em conformidade com a LGPD (Lei nº 13.709/2018, art. 16) e legislações
                fiscais e trabalhistas brasileiras, alguns dados são retidos mesmo após
                a exclusão da conta:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Registros financeiros e fiscais (contribuições, boletos pagos) — mantidos por até 5 anos</li>
                <li>Histórico de filiação e desfiliação sindical — mantido conforme legislação trabalhista</li>
                <li>Documentos de homologação rescisória (quando aplicável) — mantidos pelo prazo legal</li>
              </ul>
            </section>

            <section className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Prazo de processamento
              </h3>
              <p className="text-muted-foreground">
                Após a confirmação da desfiliação presencial, a exclusão dos dados
                pessoais do app é efetivada em <strong>até 30 dias</strong>, conforme
                prazo previsto na LGPD.
              </p>
            </section>

            <section className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Para mais informações sobre o tratamento dos seus dados, consulte
                nossa{" "}
                <Link
                  to="/sindicato/politica-de-privacidade"
                  className="text-primary hover:underline"
                >
                  Política de Privacidade
                </Link>
                .
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SindicatoExclusaoConta;