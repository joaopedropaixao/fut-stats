/** Data da última atualização do texto (mudou o texto, muda a data). */
export const PRIVACY_UPDATED_AT = '18 de novembro de 2026';

/** Marcador do e-mail enquanto o dono não preenche. Com ele, a checagem de deploy barra a release (PR para a `main`). */
export const CONTACT_EMAIL_PLACEHOLDER = '[e-mail de contato do dono]';

/**
 * PREENCHER (dono): o e-mail de contato que vai na política, trocando o valor abaixo por um texto entre aspas
 * (ex.: `export const CONTACT_EMAIL: string = 'voce@exemplo.com';`). Único lugar do e-mail no app; os testes não
 * dependem do valor.
 */
export const CONTACT_EMAIL: string = 'jp.gubert@gmail.com';

export type PrivacySection = {
  id: string;
  title: string;
  /** Parágrafos antes da lista (ou o texto todo, quando não há lista). */
  paragraphs: string[];
  items?: string[];
  /** O e-mail de contato, em destaque depois dos parágrafos. */
  contact?: string;
};

/** O texto da Política de Privacidade (spec `producao`, C31). Português simples, sem jurídico. */
export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    id: 'dados',
    title: 'O que a gente guarda',
    paragraphs: ['Só o que o app precisa para a pelada funcionar:'],
    items: [
      'Da sua conta Google: nome, e-mail e foto.',
      'Do seu perfil na pelada: apelido e bonequinho.',
      'O que você faz no app: presença, times, lances, notas, votos, resenhas, comentários e reações.',
      'As inscrições de aviso do seu aparelho (para o app te avisar, se você ligar os avisos).',
    ],
  },
  {
    id: 'para-que',
    title: 'Para que a gente usa',
    paragraphs: [
      'Para fazer a pelada funcionar: montar os times, fechar as notas, mostrar o ranking e o feed, apurar a votação e mandar os avisos. Nada além disso.',
    ],
  },
  {
    id: 'voto',
    title: 'Seu voto é anônimo',
    paragraphs: [
      'Os outros jogadores não veem em quem você votou. Eles só veem o resultado da votação.',
    ],
  },
  {
    id: 'compartilhamento',
    title: 'Com quem a gente compartilha',
    paragraphs: [
      'A gente não vende e não compartilha os seus dados, a não ser com os serviços que fazem o app funcionar:',
    ],
    items: [
      'Google: o login.',
      'Vercel, Render e Neon: onde o app e o banco de dados ficam hospedados.',
      'Sentry: o registro dos erros do app, sem e-mail e sem nome.',
      'Os serviços de aviso (push) dos navegadores: para o aviso chegar no seu aparelho.',
    ],
  },
  {
    id: 'backup',
    title: 'Cópia de segurança',
    paragraphs: ['Todo dia o banco de dados ganha uma cópia cifrada, guardada por 30 dias.'],
  },
  {
    id: 'apagar',
    title: 'Sair ou apagar seus dados',
    paragraphs: [
      'Quer sair da pelada ou que a gente apague os seus dados? A gente apaga. Fale com o admin da sua pelada ou escreva para o dono do app:',
    ],
    contact: CONTACT_EMAIL,
  },
];
