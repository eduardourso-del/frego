import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDoc } from '@/components/legal-doc';
import { CONTACT_EMAIL, CONTACT_MAILTO } from '@/lib/contact';

export const metadata: Metadata = {
  title: 'Suporte',
  description:
    'Ajuda do app Frego: entrar com o telefone, acompanhar benefícios, resgatar no caixa e falar com a equipe.',
};

export default function SuportePage() {
  return (
    <LegalDoc
      title="Suporte"
      intro={
        <>
          <p className="text-[16px] leading-relaxed text-[var(--color-neutral-500)]">
            Tem dúvida sobre o app, a conta ou uma loja? Escreva para{' '}
            <a
              href={CONTACT_MAILTO}
              className="font-medium text-[var(--color-primary-500)] hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            . Respondemos em horário comercial.
          </p>
          <a
            href={CONTACT_MAILTO}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[var(--color-primary-500)] px-5 text-[14px] font-extrabold text-[var(--color-on-primary)] transition-[transform,background] hover:bg-[var(--color-primary-600)] active:scale-[0.98]"
          >
            Enviar e-mail
          </a>
        </>
      }
    >
      <h2>App do cliente</h2>

      <h3>Como entro?</h3>
      <p>
        Abra o app e entre com o número de telefone. Você recebe um código por
        SMS. Não tem senha, nem login com Google ou Apple. Nome e aniversário
        são opcionais.
      </p>

      <h3>Não recebi o SMS</h3>
      <p>
        Confira o DDD e o número, espere um minuto e peça o código de novo. Se
        ainda não chegar, escreva para{' '}
        <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a> com o telefone usado.
      </p>

      <h3>Como ganho carimbos, pontos ou cashback?</h3>
      <p>
        Na visita, a loja registra no caixa. O progresso aparece no app — nas
        lojas, nos prêmios e no histórico.
      </p>

      <h3>Como resgato um prêmio?</h3>
      <p>
        Quando chega a meta, o prêmio aparece na tela. Mostre no caixa. A loja
        confirma. Sem cartão de papel.
      </p>

      <h3>A loja não aparece</h3>
      <p>
        O app mostra as lojas em que você já foi cadastrado. Peça no caixa
        para te cadastrar. Se a loja usa Frego e mesmo assim não aparece, fale
        com a gente.
      </p>

      <h3>Como excluo a conta?</h3>
      <p>
        No app: <strong>Perfil → Excluir conta</strong>. Também dá para pedir
        pelo e-mail{' '}
        <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>. Detalhes na{' '}
        <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2>Lojas</h2>
      <p>
        O painel da loja está em <Link href="/login">frego.app.br/login</Link>.
        Para cadastrar o negócio, use{' '}
        <Link href="/register">Cadastrar meu negócio</Link>. Dúvidas de
        campanha, balcão ou acesso: o mesmo e-mail{' '}
        <a href={CONTACT_MAILTO}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Documentos</h2>
      <ul>
        <li>
          <Link href="/privacidade">Política de Privacidade</Link>
        </li>
        <li>
          <Link href="/termos">Termos de Uso</Link>
        </li>
      </ul>
    </LegalDoc>
  );
}
