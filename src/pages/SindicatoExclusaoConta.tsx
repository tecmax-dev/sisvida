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
            <CardTitle className="text-2xl">
              Exclusão de Conta e Dados — App Comerciários de Ilhéus
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              Esta página descreve como solicitar a exclusão da sua conta e dos
              seus dados pessoais no aplicativo{" "}
              <strong>Comerciários de Ilhéus</strong>, publicado pelo{" "}
              <strong>Sindicato dos Comerciários de Ilhéus e Região</strong>.
            </p>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold mb-2">
                Etapas para solicitar a exclusão da conta
              </h2>
              <p className="text-muted-foreground mb-3">
                A conta no app <strong>Comerciários de Ilhéus</strong> está
                vinculada à filiação sindical. Para excluí-la, siga os passos
                abaixo:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>
                  Entre em contato com o sindicato pelo telefone{" "}
                  <a href="tel:+557332239980" className="text-primary hover:underline">
                    (73) 3223-9980
                  </a>{" "}
                  ou pelo e-mail{" "}
                  <a
                    href="mailto:comerciariosilheus@gmail.com?subject=Solicitação%20de%20exclusão%20de%20conta%20-%20App%20Comerciários%20de%20Ilhéus"
                    className="text-primary hover:underline"
                  >
                    comerciariosilheus@gmail.com
                  </a>{" "}
                  informando seu nome completo, CPF e que deseja excluir sua
                  conta no app.
                </li>
                <li>
                  Compareça <strong>presencialmente</strong> à sede do Sindicato
                  dos Comerciários de Ilhéus e Região, levando documento de
                  identidade com foto.
                </li>
                <li>
                  Assine o <strong>termo de desfiliação sindical</strong>, que
                  também autoriza a exclusão da sua conta e dos seus dados
                  pessoais do app.
                </li>
                <li>
                  Após a confirmação, sua conta e os dados pessoais associados
                  serão excluídos do app em até <strong>30 dias</strong>.
                </li>
              </ol>
            </section>

            <section className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Canais de contato do desenvolvedor
              </h3>
              <p className="text-muted-foreground">
                Sindicato dos Comerciários de Ilhéus e Região — desenvolvedor
                responsável pelo app <strong>Comerciários de Ilhéus</strong>:
              </p>
              <div className="space-y-2">
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href="tel:+557332239980" className="hover:underline">
                    (73) 3223-9980
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <a
                    href="mailto:comerciariosilheus@gmail.com"
                    className="hover:underline"
                  >
                    comerciariosilheus@gmail.com
                  </a>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">
                Tipos de dados que serão excluídos
              </h2>
              <p className="text-muted-foreground mb-2">
                Após a confirmação da solicitação, os seguintes dados pessoais
                serão excluídos permanentemente do app em até{" "}
                <strong>30 dias</strong>:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Dados cadastrais (nome, CPF, e-mail, telefone, endereço)</li>
                <li>Foto pessoal e foto da carteirinha digital</li>
                <li>Histórico de agendamentos de atendimentos</li>
                <li>Documentos enviados (contracheques, comprovantes)</li>
                <li>Credenciais de acesso ao app</li>
                <li>Dados de dependentes vinculados</li>
                <li>Histórico de mensagens e notificações no app</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">
                Tipos de dados que são mantidos e por quanto tempo
              </h2>
              <p className="text-muted-foreground mb-2">
                Em conformidade com a LGPD (Lei nº 13.709/2018, art. 16) e
                legislações fiscais e trabalhistas brasileiras, alguns dados
                precisam ser retidos mesmo após a exclusão da conta, pelos
                seguintes prazos adicionais de armazenamento:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>
                  <strong>Registros financeiros e fiscais</strong>{" "}
                  (contribuições, boletos pagos): retidos por até{" "}
                  <strong>5 anos</strong> (Código Tributário Nacional).
                </li>
                <li>
                  <strong>Histórico de filiação e desfiliação sindical</strong>:
                  retido por até <strong>5 anos</strong> após a desfiliação.
                </li>
                <li>
                  <strong>Documentos de homologação rescisória</strong> (quando
                  aplicável): retidos por até <strong>30 anos</strong>, conforme
                  legislação trabalhista (CLT).
                </li>
              </ul>
            </section>

            <section className="border-t pt-6">
              <h2 className="text-lg font-semibold mb-2">
                Exclusão parcial de dados (sem excluir a conta)
              </h2>
              <p className="text-muted-foreground mb-2">
                Você também pode solicitar a exclusão apenas de dados
                específicos, mantendo sua conta ativa no app{" "}
                <strong>Comerciários de Ilhéus</strong>. Isso inclui, por
                exemplo:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
                <li>Foto pessoal ou foto da carteirinha digital</li>
                <li>Documentos enviados (contracheques, comprovantes)</li>
                <li>Histórico de agendamentos passados</li>
                <li>Endereço, e-mail ou telefone de contato</li>
                <li>Dados de dependentes específicos</li>
              </ul>
              <p className="text-muted-foreground mb-2">
                <strong>Etapas para exclusão parcial:</strong>
              </p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>
                  Envie um e-mail para{" "}
                  <a
                    href="mailto:comerciariosilheus@gmail.com?subject=Solicitação%20de%20exclusão%20parcial%20de%20dados%20-%20App%20Comerciários%20de%20Ilhéus"
                    className="text-primary hover:underline"
                  >
                    comerciariosilheus@gmail.com
                  </a>{" "}
                  ou ligue para{" "}
                  <a href="tel:+557332239980" className="text-primary hover:underline">
                    (73) 3223-9980
                  </a>
                  .
                </li>
                <li>
                  Informe seu nome completo, CPF e quais dados deseja remover.
                </li>
                <li>
                  A solicitação é processada em até <strong>30 dias</strong>,
                  conforme a LGPD. Dados retidos por obrigação legal (ver seção
                  acima) não podem ser removidos.
                </li>
              </ol>
            </section>

            <section className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Prazo de processamento
              </h3>
              <p className="text-muted-foreground">
                Após a confirmação da desfiliação presencial, a exclusão dos
                dados pessoais do app <strong>Comerciários de Ilhéus</strong> é
                efetivada em <strong>até 30 dias</strong>, conforme prazo
                previsto na LGPD.
              </p>
            </section>

            <section className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Para mais informações sobre o tratamento dos seus dados,
                consulte nossa{" "}
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
