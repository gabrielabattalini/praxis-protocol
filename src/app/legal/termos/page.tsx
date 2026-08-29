export const metadata = {
  title: "Termos de Uso · Praxis",
};

const LAST_UPDATE = "29 de julho de 2026";

export default function TermosPage() {
  return (
    <article>
      <h1>Termos de Uso</h1>
      <p className="text-xs text-zinc-500">Última atualização: {LAST_UPDATE}</p>

      <h2>1. O serviço</h2>
      <p>
        O Praxis é um aplicativo de organização pessoal por assinatura
        (finanças, treino, nutrição, mercado, sono e módulos relacionados).
        Ao criar uma conta ou assinar, você concorda com estes Termos.
      </p>

      <h2>2. Conta e acesso</h2>
      <ul>
        <li>Você é responsável pela veracidade dos dados da sua conta e pela guarda das credenciais de login.</li>
        <li>O acesso completo ao aplicativo é liberado mediante pagamento confirmado (assinatura ou compra) processado pela Stripe.</li>
        <li>Contas são pessoais e intransferíveis; o compartilhamento de acesso pode levar à suspensão.</li>
      </ul>

      <h2>3. Pagamento e renovação</h2>
      <ul>
        <li>Os pagamentos são processados pela Stripe. Não armazenamos os dados do seu cartão.</li>
        <li>Assinaturas renovam automaticamente até o cancelamento, que pode ser feito a qualquer momento pelo portal do assinante (Configurações → Assinatura), com efeito ao fim do período já pago.</li>
        <li>Falha de pagamento pode suspender o acesso até a regularização.</li>
      </ul>

      <h2>4. Uso aceitável</h2>
      <p>
        É proibido usar o serviço para fins ilícitos, tentar burlar
        limitações técnicas ou de plano, sobrecarregar a infraestrutura ou
        realizar engenharia reversa não autorizada por lei.
      </p>

      <h2>5. Conteúdo e dados do usuário</h2>
      <p>
        Os dados que você registra (finanças, treinos, refeições etc.) são
        seus. Nós os tratamos conforme a{" "}
        <a href="/legal/privacidade" className="underline underline-offset-2">
          Política de Privacidade
        </a>
        . Você pode exportar seus dados a qualquer momento em Configurações →
        Backup.
      </p>

      <h2>6. Aviso importante — não é aconselhamento profissional</h2>
      <p>
        O Praxis é uma ferramenta de organização. As informações exibidas
        (inclusive de nutrição, treino e finanças) não substituem orientação
        de médico, nutricionista, educador físico, contador ou outro
        profissional habilitado.
      </p>

      <h2>7. Disponibilidade e alterações</h2>
      <p>
        Trabalhamos para manter o serviço disponível, mas não garantimos
        operação ininterrupta. Funcionalidades podem evoluir ou ser
        descontinuadas; mudanças relevantes nestes Termos serão comunicadas
        no aplicativo.
      </p>

      <h2>8. Cancelamento e reembolso</h2>
      <p>
        Regras de arrependimento e reembolso estão na{" "}
        <a href="/legal/reembolso" className="underline underline-offset-2">
          Política de Reembolso
        </a>
        , que segue o Código de Defesa do Consumidor.
      </p>

      <h2>9. Limitação de responsabilidade</h2>
      <p>
        Na máxima extensão permitida em lei, o Praxis não responde por danos
        indiretos decorrentes do uso ou da indisponibilidade do serviço. Nada
        nestes Termos afasta direitos garantidos pelo CDC.
      </p>

      <h2>10. Foro e legislação</h2>
      <p>
        Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro do
        domicílio do consumidor para dirimir controvérsias.
      </p>
    </article>
  );
}
