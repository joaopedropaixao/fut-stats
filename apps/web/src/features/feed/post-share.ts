import type { Post } from '@fut-stats/shared';

/** O texto que vai para o WhatsApp: o título (se tiver), o texto da resenha e o link do app. */
export function postShareText(post: Pick<Post, 'title' | 'body'>, appUrl: string): string {
  return [post.title ? `*${post.title}*` : null, post.body, `Fut Stats: ${appUrl}`]
    .filter((part): part is string => part !== null)
    .join('\n\n');
}

/** O link `wa.me` com a resenha pronta para mandar. */
export function whatsappUrl(post: Pick<Post, 'title' | 'body'>, appUrl: string): string {
  return `https://wa.me/?text=${encodeURIComponent(postShareText(post, appUrl))}`;
}
