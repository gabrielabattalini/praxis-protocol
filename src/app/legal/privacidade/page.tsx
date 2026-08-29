import { SUPPORT_EMAIL } from "@/lib/legal-contact";

export const metadata = {
  title: "Política de Privacidade · Praxis",
};

const LAST_UPDATE = "29 de julho de 2026";

export default function PrivacidadePage() {
  return (
    <article>
      <h1>Política de Privacidade</h1>
      <p className="text-xs text-zinc-500">Última atualização: {LAST_UPDATE}</p>

      <p>
        Esta política explica, nos termos da Lei Geral de Proteção de Dados
        (Lei 13.709/2018 — LGPD), como o Praxis trata seus dados pessoais.
      </p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li><strong>Conta:</strong> nome e e-mail, via provedor de autenticação (Clerk).</li>
        <li><strong>Uso do app:</strong> os registros que você cria — orçamento, treinos, refeições, listas de compras, sono e afins.</li>
        <li><strong>Pagamento:</strong> processado pela Stripe. Recebemos apenas a confirmação do pagamento e o e-mail do comprador; o cartão nunca passa por nossos servidores.</li>
        <li><strong>Integrações opcionais:</strong> se você conectar o Telegram, guardamos o vínculo necessário pra enviar seus lembretes.</li>
      </ul>

      <h2>2. Para que usamos</h2>
      <ul>
        <li>Prestar o serviço: sincronizar seus dados entre dispositivos e gerar seus relatórios.</li>
        <li>Verificar o status de pagamento e liberar o acesso.</li>
        <li>Enviar notificações que você habilitar (navegador, Telegram, e-mail semanal).</li>
      </ul>
      <p>Não vendemos seus dados. Não usamos seus registros pessoais para publicidade.</p>

      <h2>3. Com quem compartilhamos</h2>
      <p>
        Apenas com os operadores necessários pra rodar o serviço: Clerk
        (autenticação), Stripe (pagamentos), Vercel (hospedagem), Upstash
        (banco de dados) e Telegram (se você conectar). Cada um trata os
        dados sob seus próprios termos e contratos de proteção.
      </p>

      <h2>4. Por quanto tempo guardamos</h2>
      <p>
        Enquanto sua conta existir. Você pode exportar seus dados
        (Configurações → Backup) e pode solicitar a exclusão definitiva da
        conta e dos dados pelo e-mail de contato.
      </p>

      <h2>5. Seus direitos (LGPD)</h2>
      <ul>
        <li>Confirmar a existência de tratamento e acessar seus dados;</li>
        <li>Corrigir dados incompletos ou desatualizados;</li>
        <li>Solicitar anonimização, bloqueio ou eliminação;</li>
        <li>Solicitar a portabilidade (o export em Configurações já entrega seus dados em formato aberto);</li>
        <li>Revogar consentimentos (ex.: desligar notificações a qualquer momento).</li>
      </ul>

      <h2>6. Segurança</h2>
      <p>
        Usamos autenticação gerenciada, criptografia em trânsito (HTTPS) e
        segregação de dados por conta. Nenhum sistema é infalível; incidentes
        relevantes serão comunicados conforme a LGPD.
      </p>

      <h2>7. Contato do controlador</h2>
      <p>
        Para exercer qualquer direito, escreva para{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </article>
  );
}
