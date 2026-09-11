import { ArrowLeft, Shield, Lock, Eye, Database, Trash2, UserCheck, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicPageWrapper } from "@/components/layout/PublicLayout";

export default function SindicatoPrivacyPolicy() {
  return (
    <PublicPageWrapper>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        {/* Header */}
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container flex items-center gap-4 py-4">
            <Link
              to="/sindicato"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold text-foreground">Política de Privacidade</h1>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="container max-w-3xl py-8 md:py-12 space-y-8">
          {/* Intro */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <Shield className="h-6 w-6 text-primary flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                Esta Política de Privacidade aplica-se ao aplicativo <strong>SECMI - Sindicato dos Comerciários de Ilhéus</strong> (Package ID: <code className="text-xs bg-muted px-1 py-0.5 rounded">br.org.secmi.comerciariosilheus.app</code>), publicado na Google Play Store pela entidade <strong>Sindicato dos Comerciários de Ilhéus e Região</strong>. Este documento descreve como coletamos, usamos e protegemos suas informações pessoais, em conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong>.
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 space-y-3 text-sm border border-border">
              <div className="space-y-1.5">
                <p className="font-semibold text-foreground">📱 Aplicativo</p>
                <p className="text-muted-foreground"><strong>Nome:</strong> SECMI - Sindicato dos Comerciários de Ilhéus</p>
                <p className="text-muted-foreground"><strong>Package ID (Google Play):</strong> br.org.secmi.comerciariosilheus.app</p>
                <p className="text-muted-foreground"><strong>Plataforma:</strong> Google Play Store (Android)</p>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-border">
                <p className="font-semibold text-foreground">⚖️ Entidade Legal (Controladora dos Dados)</p>
                <p className="text-muted-foreground"><strong>Nome:</strong> Sindicato dos Comerciários de Ilhéus e Região</p>
                <p className="text-muted-foreground"><strong>CNPJ:</strong> 14.173.298/0001-46</p>
                <p className="text-muted-foreground"><strong>Endereço:</strong> Rua Coronel Paiva, nº 99, Centro, Ilhéus - BA, CEP 45653-310</p>
                <p className="text-muted-foreground"><strong>E-mail:</strong> comerciariosilheus@gmail.com</p>
                <p className="text-muted-foreground"><strong>Telefone:</strong> (73) 3223-9980</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Última atualização: 16 de abril de 2026
            </p>
          </section>

          {/* Section 1 */}
          <PolicySection
            icon={<Database className="h-5 w-5" />}
            title="1. Dados Coletados"
            content={
              <div className="space-y-3">
                <p>Ao utilizar o aplicativo, podemos coletar os seguintes dados:</p>
                <ul className="list-disc list-inside space-y-1.5 text-sm">
                  <li><strong>Dados de identificação:</strong> nome completo, CPF, data de nascimento</li>
                  <li><strong>Dados de contato:</strong> telefone, e-mail, endereço</li>
                  <li><strong>Dados profissionais:</strong> empresa, cargo, matrícula sindical</li>
                  <li><strong>Dados de saúde:</strong> informações relacionadas a agendamentos médicos e odontológicos (quando aplicável)</li>
                  <li><strong>Dados de dependentes:</strong> nome, CPF e data de nascimento de dependentes cadastrados</li>
                  <li><strong>Dados técnicos:</strong> token de notificação push, modelo do dispositivo, sistema operacional</li>
                </ul>
              </div>
            }
          />

          {/* Section 2 */}
          <PolicySection
            icon={<Eye className="h-5 w-5" />}
            title="2. Finalidade do Tratamento"
            content={
              <div className="space-y-3">
                <p>Seus dados são utilizados exclusivamente para:</p>
                <ul className="list-disc list-inside space-y-1.5 text-sm">
                  <li>Gerenciar seu cadastro como associado/beneficiário</li>
                  <li>Realizar agendamento de consultas e serviços</li>
                  <li>Enviar notificações sobre consultas, benefícios e comunicados</li>
                  <li>Emitir e validar carteirinha digital</li>
                  <li>Gerenciar dependentes vinculados</li>
                  <li>Melhorar a experiência do usuário no aplicativo</li>
                </ul>
              </div>
            }
          />

          {/* Section 3 */}
          <PolicySection
            icon={<Lock className="h-5 w-5" />}
            title="3. Segurança dos Dados"
            content={
              <div className="space-y-3">
                <p>Adotamos medidas técnicas e organizacionais para proteger seus dados:</p>
                <ul className="list-disc list-inside space-y-1.5 text-sm">
                  <li>Criptografia em trânsito (HTTPS/TLS) e em repouso</li>
                  <li>Autenticação segura com verificação de e-mail</li>
                  <li>Controle de acesso baseado em perfis (RLS)</li>
                  <li>Logs de auditoria para rastreabilidade de acessos</li>
                  <li>Backups automáticos e redundância de dados</li>
                </ul>
              </div>
            }
          />

          {/* Section 4 */}
          <PolicySection
            icon={<UserCheck className="h-5 w-5" />}
            title="4. Compartilhamento de Dados"
            content={
              <div className="space-y-3">
                <p>Seus dados <strong>não são vendidos ou compartilhados</strong> com terceiros para fins comerciais. O compartilhamento ocorre apenas:</p>
                <ul className="list-disc list-inside space-y-1.5 text-sm">
                  <li>Com profissionais de saúde vinculados, para atendimento agendado</li>
                  <li>Com a administração do sindicato, para gestão de benefícios</li>
                  <li>Quando exigido por determinação legal ou judicial</li>
                </ul>
              </div>
            }
          />

          {/* Section 5 */}
          <PolicySection
            icon={<Shield className="h-5 w-5" />}
            title="5. Direitos do Titular"
            content={
              <div className="space-y-3">
                <p>Conforme a LGPD, você tem direito a:</p>
                <ul className="list-disc list-inside space-y-1.5 text-sm">
                  <li>Confirmar a existência de tratamento de dados</li>
                  <li>Acessar seus dados pessoais</li>
                  <li>Corrigir dados incompletos ou desatualizados</li>
                  <li>Solicitar a anonimização ou eliminação de dados desnecessários</li>
                  <li>Revogar consentimento a qualquer momento</li>
                  <li>Solicitar a portabilidade dos dados</li>
                </ul>
              </div>
            }
          />

          {/* Section 6 */}
          <PolicySection
            icon={<Trash2 className="h-5 w-5" />}
            title="6. Retenção e Exclusão"
            content={
              <p>Seus dados são mantidos enquanto houver vínculo ativo com o sindicato ou necessidade legal de retenção. Após o desligamento, os dados serão mantidos pelo prazo legal aplicável e, em seguida, anonimizados ou excluídos.</p>
            }
          />

          {/* Section 7 */}
          <PolicySection
            icon={<Mail className="h-5 w-5" />}
            title="7. Contato e Encarregado (DPO)"
            content={
              <div className="space-y-3">
                <p>Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato:</p>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                  <p><strong>Sindicato dos Comerciários de Ilhéus</strong></p>
                  <p>E-mail: <a href="mailto:comerciariosilheus@gmail.com" className="text-primary hover:underline">comerciariosilheus@gmail.com</a></p>
                  <p>Telefone: <a href="tel:+557332239980" className="text-primary hover:underline">(73) 3223-9980</a></p>
                </div>
              </div>
            }
          />

          {/* Section 8 */}
          <PolicySection
            icon={<Eye className="h-5 w-5" />}
            title="8. Notificações Push"
            content={
              <p>O aplicativo pode solicitar permissão para enviar notificações push. Essas notificações são usadas exclusivamente para lembretes de consultas, comunicados sindicais e atualizações de benefícios. Você pode desativar as notificações a qualquer momento nas configurações do seu dispositivo.</p>
            }
          />

          {/* Section 9 */}
          <PolicySection
            icon={<Lock className="h-5 w-5" />}
            title="9. Alterações nesta Política"
            content={
              <p>Esta política pode ser atualizada periodicamente. Notificaremos sobre mudanças significativas por meio do aplicativo. Recomendamos a revisão periódica deste documento.</p>
            }
          />

          {/* Footer */}
          <div className="pt-8 border-t border-border text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              © 2026 Sindicato dos Comerciários de Ilhéus e Região - Todos os direitos reservados
            </p>
            <p className="text-xs text-muted-foreground">
              Em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)
            </p>
          </div>
        </main>
      </div>
    </PublicPageWrapper>
  );
}

function PolicySection({
  icon,
  title,
  content,
}: {
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}) {
  return (
    <section className="bg-card rounded-xl border border-border p-6 space-y-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="text-primary">{icon}</div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed pl-8">
        {content}
      </div>
    </section>
  );
}
