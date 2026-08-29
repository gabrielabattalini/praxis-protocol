import { SUPPORT_EMAIL } from "@/lib/legal-contact";

export const metadata = {
  title: "Política de Reembolso · Praxis",
};

const LAST_UPDATE = "29 de julho de 2026";

export default function ReembolsoPage() {
  return (
    <article>
      <h1>Política de Reembolso e Cancelamento</h1>
      <p className="text-xs text-zinc-500">Última atualização: {LAST_UPDATE}</p>

      <h2>1. Direito de arrependimento — 7 dias</h2>
      <p>
        Nos termos do art. 49 do Código de Defesa do Consumidor, você pode
        desistir da compra em até <strong>7 dias corridos</strong> após o
        primeiro pagamento, com <strong>reembolso integral</strong>, sem
        precisar justificar. Basta pedir pelo e-mail de contato ou cancelar
        pelo portal e solicitar o estorno.
      </p>

      <h2>2. Cancelamento da assinatura</h2>
      <ul>
        <li>Cancele a qualquer momento em Configurações → Assinatura → “Gerenciar assinatura”.</li>
        <li>O cancelamento interrompe as renovações futuras; o acesso permanece ativo até o fim do período já pago.</li>
        <li>Após o período pago, a conta perde o acesso completo, mas seus dados são preservados e podem ser exportados.</li>
      </ul>

      <h2>3. Reembolsos fora dos 7 dias</h2>
      <p>
        Renovações já cobradas fora da janela de arrependimento não são
        reembolsadas proporcionalmente, salvo falha grave de prestação do
        serviço — nesse caso, analisamos e respondemos em até 5 dias úteis.
      </p>

      <h2>4. Como o estorno acontece</h2>
      <p>
        O reembolso é feito pela Stripe, no mesmo meio de pagamento da
        compra. O prazo de aparecimento na fatura depende do emissor do
        cartão (normalmente 5 a 10 dias úteis).
      </p>

      <h2>5. Contato</h2>
      <p>
        Pedidos e dúvidas:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-2">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
    </article>
  );
}
