import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc } from '@/components/legal-doc';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Como o Frego trata dados pessoais de clientes, estabelecimentos e usuários do app, em conformidade com a LGPD.',
};

export default function PrivacidadePage() {
  return (
    <LegalDoc title="Política de Privacidade" updatedAt="2 de setembro de 2026">
      <p>
        Esta Política de Privacidade descreve como o <strong>Frego</strong>,
        plataforma de fidelidade operada pela <strong>Bearlabs</strong>{' '}
        (“nós”, “nosso” ou “Frego”), coleta, usa, armazena e compartilha dados
        pessoais no Brasil, em conformidade com a Lei Geral de Proteção de Dados
        (Lei nº 13.709/2018 — LGPD) e demais normas aplicáveis.
      </p>
      <p>
        Ao utilizar o aplicativo Frego, o painel do estabelecimento, o site ou
        recursos relacionados (incluindo avisos via WhatsApp), você declara ter
        lido esta Política. Os{' '}
        <Link href="/termos">Termos de Uso</Link> complementam este documento.
      </p>

      <h2>1. Controlador e contato</h2>
      <ul>
        <li>
          <strong>Controlador:</strong> Bearlabs, responsável pela plataforma
          Frego.
        </li>
        <li>
          <strong>Contato / privacidade:</strong>{' '}
          <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>
        </li>
        <li>
          Estabelecimentos (lojas) que usam o Frego também podem atuar como
          controladores ou operadores em relação aos dados dos próprios
          clientes, conforme a finalidade do programa de fidelidade da loja.
        </li>
      </ul>

      <h2>2. Quais dados coletamos</h2>

      <h3>2.1 Clientes (usuários do app / fregueses)</h3>
      <ul>
        <li>
          <strong>Telefone (E.164)</strong> — identificador principal da conta
          (OTP por SMS via Firebase Authentication).
        </li>
        <li>
          Nome de exibição e data de nascimento — <strong>opcionais</strong>.
          O app funciona só com o telefone; você pode pular ou apagar esses
          dados a qualquer momento no perfil.
        </li>
        <li>
          Vínculos com lojas (membership), progresso de campanhas, carimbos,
          pontos, resgates e histórico de transações de fidelidade.
        </li>
        <li>
          Preferências básicas no app (ex.: loja favorita), quando aplicável.
        </li>
        <li>
          Dados técnicos: identificadores de dispositivo, logs de uso, tokens
          de push (FCM), eventos de Analytics e Crashlytics (Firebase), IP e
          dados de diagnóstico necessários à segurança e ao funcionamento do
          serviço.
        </li>
      </ul>

      <h3>2.2 Equipe do estabelecimento</h3>
      <ul>
        <li>Nome, e-mail e senha (Firebase Authentication).</li>
        <li>
          Dados do negócio: nome, tipo, slogan, cores, logo/capa, unidades e
          endereços.
        </li>
        <li>
          Dados de operação no balcão: buscas por telefone, carimbos e resgates
          realizados pela equipe.
        </li>
      </ul>

      <h3>2.3 WhatsApp Business (por loja)</h3>
      <p>
        Quando a loja conecta o WhatsApp ao Frego (Meta WhatsApp Cloud API /
        Embedded Signup), podemos processar:
      </p>
      <ul>
        <li>
          Identificadores da conta WhatsApp Business (WABA), número de telefone
          comercial e metadados de qualidade/limites.
        </li>
        <li>
          Tokens de acesso criptografados para envio de mensagens em nome da
          loja.
        </li>
        <li>
          Status de templates (ex.: avisos de acúmulo de fidelidade) e eventos
          de entrega/falha via webhooks da Meta.
        </li>
        <li>
          Em modo de coexistência (app WhatsApp Business + API), a Meta pode
          sincronizar contatos e histórico conforme a escolha da loja no fluxo
          da Meta; o Frego pode receber e armazenar esses eventos para cumprir
          requisitos da plataforma, mesmo quando não exibe uma caixa de entrada
          completa no produto.
        </li>
      </ul>

      <h3>2.4 Cookies e tecnologias similares</h3>
      <p>
        Nos sites do Frego podemos usar cookies e armazenamento local
        essenciais à autenticação, sessão e preferências (ex.: loja ativa).
        Ferramentas de medição (quando ativas) podem coletar dados de uso
        agregados ou pseudonimizados.
      </p>

      <h2>3. Finalidades e bases legais</h2>
      <p>Tratamos dados pessoais para:</p>
      <ul>
        <li>
          <strong>Prestação do serviço</strong> (execução de contrato /
          procedimentos preliminares): criar e autenticar contas, operar
          programas de fidelidade, carimbar/resgatar, exibir carteira e
          histórico, enviar avisos de fidelidade acordados com a loja.
        </li>
        <li>
          <strong>Cumprimento de obrigação legal</strong> ou regulatória, quando
          aplicável.
        </li>
        <li>
          <strong>Legítimo interesse</strong>: segurança, prevenção a fraude,
          melhoria do produto, suporte e métricas agregadas — sempre com
          avaliação de impacto aos direitos dos titulares.
        </li>
        <li>
          <strong>Consentimento</strong>, quando exigido (ex.: comunicações
          opcionais ou recursos que a lei assim classifique). O consentimento
          pode ser revogado a qualquer momento, sem prejudicar o tratamento
          anterior.
        </li>
      </ul>

      <h2>4. Compartilhamento de dados</h2>
      <p>Podemos compartilhar dados com:</p>
      <ul>
        <li>
          <strong>Estabelecimentos participantes</strong>, para operar a
          fidelidade daquela loja (ex.: telefone e progresso do cliente naquele
          negócio).
        </li>
        <li>
          <strong>Operadores / subprocessadores</strong> que nos ajudam a
          prestar o serviço, sob contratos e medidas de segurança adequadas,
          incluindo: Google Firebase / Google Cloud (autenticação, push,
          analytics, hospedagem de API), Neon (banco de dados), Vercel
          (hospedagem web) e Meta Platforms (WhatsApp Business Platform),
          conforme integração escolhida pela loja.
        </li>
        <li>
          Autoridades públicas, quando houver obrigação legal ou ordem válida.
        </li>
      </ul>
      <p>
        Não vendemos dados pessoais. Transferências internacionais (quando
        ocorrerem em razão de provedores) observam a LGPD e mecanismos
        cabíveis de proteção.
      </p>

      <h2>5. Retenção e exclusão da conta</h2>
      <p>
        Mantemos dados pelo tempo necessário às finalidades desta Política, ao
        vínculo com lojas e a obrigações legais, fiscais ou de disputa.
      </p>
      <p>
        Você pode excluir a conta de cliente a qualquer momento no aplicativo
        Frego: <strong>Perfil → Excluir conta</strong>. A exclusão:
      </p>
      <ul>
        <li>
          remove o número de telefone, o nome, a data de nascimento e o vínculo
          com o Firebase Authentication (conta de login por SMS/OTP);
        </li>
        <li>
          encerra o acesso à carteira de fidelidade — carimbos, pontos e
          prêmios não resgatados são perdidos;
        </li>
        <li>apaga tokens de notificação push (FCM) associados à conta;</li>
        <li>
          conserva, de forma anonimizada, o histórico operacional das lojas
          (ledger append-only), sem identificá-lo, pelo tempo necessário a
          obrigações legais, prevenção a fraude e contabilidade do
          estabelecimento.
        </li>
      </ul>
      <p>
        Também é possível pedir exclusão pelo e-mail{' '}
        <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>. Após o encerramento da
        conta ou solicitação legítima, eliminamos ou anonimizamos os dados
        pessoais, salvo quando a retenção for exigida ou permitida por lei.
      </p>

      <h2>6. Segurança</h2>
      <p>
        Adotamos medidas técnicas e organizacionais razoáveis, incluindo
        criptografia de tokens sensíveis (ex.: tokens WhatsApp em repouso),
        controle de acesso, comunicação HTTPS e segregação multi-tenant por
        negócio. Nenhum sistema é 100% seguro; pedimos que você proteja suas
        credenciais e dispositivo.
      </p>

      <h2>7. Direitos do titular (LGPD)</h2>
      <p>Você pode solicitar, na medida aplicável:</p>
      <ul>
        <li>confirmação de tratamento e acesso aos dados;</li>
        <li>correção de dados incompletos, inexatos ou desatualizados;</li>
        <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
        <li>portabilidade, quando cabível;</li>
        <li>informação sobre compartilhamentos;</li>
        <li>revogação de consentimento;</li>
        <li>oposição a tratamentos baseados em legítimo interesse, nos termos da lei.</li>
      </ul>
      <p>
        A exclusão da conta no aplicativo (Perfil → Excluir conta) atende ao
        pedido de eliminação dos dados de identificação, nos termos da seção 5.
        Para exercer outros direitos, escreva para{' '}
        <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>. Podemos pedir
        confirmação de identidade. Também é possível apresentar reclamação à
        Autoridade Nacional de Proteção de Dados (ANPD).
      </p>

      <h2>8. Crianças e adolescentes</h2>
      <p>
        O Frego não é direcionado a menores de 13 anos. Se tomarmos ciência de
        coleta indevida, tomaremos medidas razoáveis para excluir os dados.
        Tratamentos envolvendo adolescentes observarão a LGPD e o consentimento
        específico quando exigido.
      </p>

      <h2>9. Alterações</h2>
      <p>
        Podemos atualizar esta Política periodicamente. A data de “Última
        atualização” indica a versão vigente. Em mudanças relevantes, poderemos
        notificar pelo app, e-mail ou aviso no site.
      </p>

      <h2>10. Contato</h2>
      <p>
        Dúvidas sobre privacidade:{' '}
        <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalDoc>
  );
}
