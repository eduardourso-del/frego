import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc } from '@/components/legal-doc';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description:
    'Termos e condições de uso da plataforma Frego para estabelecimentos e clientes.',
};

export default function TermosPage() {
  return (
    <LegalDoc title="Termos de Uso" updatedAt="11 de agosto de 2026">
      <p>
        Estes Termos de Uso (“Termos”) regem o acesso e o uso da plataforma{' '}
        <strong>Frego</strong>, operada pela <strong>Bearlabs</strong>{' '}
        (“Frego”, “nós”), incluindo o aplicativo móvel, o painel web do
        estabelecimento, APIs e integrações (como WhatsApp). Ao criar conta,
        cadastrar um negócio ou utilizar o serviço, você concorda com estes
        Termos e com a{' '}
        <Link href="/privacidade">Política de Privacidade</Link>.
      </p>
      <p>
        Se você não concordar, não utilize o Frego.
      </p>

      <h2>1. O serviço</h2>
      <p>
        O Frego é uma plataforma SaaS multi-tenant de fidelidade que permite a
        estabelecimentos criar e operar programas de carimbos/pontos e a
        clientes acompanhar saldos, resgates e histórico. O telefone do cliente
        é o identificador principal da conta de consumidor.
      </p>
      <p>
        Recursos podem incluir autenticação por OTP, painel de balcão, campanhas,
        relatórios, notificações e envio de mensagens de fidelidade pelo
        WhatsApp Business da loja, quando conectado.
      </p>

      <h2>2. Contas e elegibilidade</h2>
      <ul>
        <li>
          <strong>Clientes:</strong> devem informar um número de telefone válido
          e completar a verificação. São responsáveis pela segurança do
          dispositivo e do código OTP.
        </li>
        <li>
          <strong>Estabelecimentos:</strong> o cadastro pode depender de
          aprovação da equipe Frego. O responsável declara ter poderes para
          vincular a loja e aceitar estes Termos em nome do negócio.
        </li>
        <li>
          Você se compromete a fornecer informações verdadeiras e atualizadas e
          a não compartilhar credenciais.
        </li>
      </ul>

      <h2>3. Programas de fidelidade</h2>
      <ul>
        <li>
          Regras de campanha (metas, prêmios, validade, expiração de saldo)
          são definidas pelo estabelecimento, dentro das funcionalidades do
          Frego.
        </li>
        <li>
          Transações de carimbo e resgate são registradas de forma append-only;
          o saldo é derivado desse histórico.
        </li>
        <li>
          Disputas sobre atendimento, produtos, prêmios ou qualidade do
          estabelecimento são de responsabilidade da loja. O Frego é a
          ferramenta tecnológica, não o comerciante da oferta.
        </li>
      </ul>

      <h2>4. WhatsApp e comunicações</h2>
      <ul>
        <li>
          A conexão do WhatsApp é opcional e feita pela loja via Meta (Embedded
          Signup / Cloud API). A loja permanece responsável pelo número, pela
          conta WhatsApp Business e pelo cumprimento das políticas da Meta e da
          legislação de comunicações.
        </li>
        <li>
          O Frego pode enviar, em nome da loja, avisos transacionais de
          fidelidade (ex.: atualização de saldo), sujeitos a aprovação de
          templates pela Meta.
        </li>
        <li>
          Em coexistência, a loja pode manter o app WhatsApp Business no mesmo
          número. Desconectar a plataforma no celular pode encerrar o vínculo
          com o Frego.
        </li>
        <li>
          A disponibilidade do WhatsApp depende da Meta e pode ser interrompida
          por restrições de conta, revisão de app, limites de mensagem ou
          indisponibilidade de rede.
        </li>
      </ul>

      <h2>5. Uso aceitável</h2>
      <p>É vedado:</p>
      <ul>
        <li>usar o Frego para fins ilícitos, fraudulentos ou abusivos;</li>
        <li>
          tentar acessar dados de outros tenants, invadir sistemas ou
          sobrecarregar a plataforma;
        </li>
        <li>
          enviar spam ou mensagens em desacordo com a lei, com as políticas da
          Meta ou com o consentimento aplicável;
        </li>
        <li>
          fazer engenharia reversa não autorizada, copiar ou revender o
          software além do permitido por lei;
        </li>
        <li>
          cadastrar estabelecimentos fictícios ou dados de terceiros sem
          autorização.
        </li>
      </ul>
      <p>
        Podemos suspender ou encerrar contas que violem estes Termos ou
        coloquem em risco a plataforma, usuários ou parceiros.
      </p>

      <h2>6. Planos, taxas e disponibilidade</h2>
      <p>
        Condições comerciais (planos, preços, trial, cobrança) são as
        divulgadas no momento da contratação ou em proposta comercial. O Frego
        pode evoluir funcionalidades; recursos beta podem ser alterados ou
        descontinuados. Buscamos alta disponibilidade, mas não garantimos
        operação ininterrupta ou isenta de erros.
      </p>

      <h2>7. Propriedade intelectual</h2>
      <p>
        O software, marcas, layout e conteúdos do Frego pertencem à Bearlabs ou
        a licenciadores. O estabelecimento conserva direitos sobre sua marca,
        dados comerciais e conteúdos que carregar. Você concede ao Frego
        licença limitada para hospedar e exibir esses materiais apenas para
        prestar o serviço.
      </p>

      <h2>8. Privacidade</h2>
      <p>
        O tratamento de dados pessoais segue a{' '}
        <Link href="/privacidade">Política de Privacidade</Link>. Ao usar o
        Frego, você também reconhece o papel das lojas no tratamento dos dados
        de seus clientes no âmbito do programa de fidelidade.
      </p>

      <h2>9. Isenções e limitação de responsabilidade</h2>
      <ul>
        <li>
          O serviço é fornecido “como está” e “conforme disponível”, na máxima
          extensão permitida pela lei.
        </li>
        <li>
          Não nos responsabilizamos por atos de estabelecimentos, falhas de
          provedores terceiros (incluindo Firebase, Meta, operadoras de
          telefonia), indisponibilidade de SMS/WhatsApp ou decisões de
          aprovação de templates.
        </li>
        <li>
          Na medida permitida, nossa responsabilidade total por danos
          decorrentes do uso do Frego limita-se ao valor efetivamente pago pelo
          estabelecimento ao Frego nos 3 (três) meses anteriores ao evento, ou,
          se não houver pagamento, a R$ 500,00 — sem prejuízo de direitos
          inafastáveis do consumidor quando aplicáveis.
        </li>
      </ul>

      <h2>10. Rescisão</h2>
      <p>
        Você pode deixar de usar o serviço a qualquer momento. Estabelecimentos
        podem solicitar desconexão do WhatsApp e encerramento da conta conforme
        canais de suporte. Podemos encerrar ou restringir o acesso em caso de
        violação, risco, inadimplência ou descontinuação do produto, com aviso
        razoável quando viável.
      </p>

      <h2>11. Alterações dos Termos</h2>
      <p>
        Podemos atualizar estes Termos. A data no topo indica a versão vigente.
        O uso continuado após a publicação das alterações, quando permitido,
        constitui aceitação. Se a mudança exigir novo consentimento, solicitamos
        conforme a lei.
      </p>

      <h2>12. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pelas leis da República Federativa do Brasil.
        Fica eleito o foro da comarca de São Paulo/SP, com renúncia a qualquer
        outro, por mais privilegiado que seja, salvo foro legal obrigatório do
        consumidor.
      </p>

      <h2>13. Contato</h2>
      <p>
        Contato:{' '}
        <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalDoc>
  );
}
