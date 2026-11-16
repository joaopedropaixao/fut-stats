import { describe, expect, it } from 'vitest';
import {
  COMMENT_MAX_LENGTH,
  commentInputSchema,
  FEED_ALERT_TYPES,
  POST_BODY_MAX_LENGTH,
  POST_REACTIONS,
  POST_TITLE_MAX_LENGTH,
  postInputSchema,
} from './index';

describe('feed: limites e listas do domain reexportados', () => {
  it('os limites e as listas vêm do shared, com os valores do spec', () => {
    expect(POST_TITLE_MAX_LENGTH).toBe(60);
    expect(POST_BODY_MAX_LENGTH).toBe(1000);
    expect(COMMENT_MAX_LENGTH).toBe(280);
    expect([...POST_REACTIONS]).toEqual(['BALL', 'CATFISH', 'OSS', 'WHISTLE', 'POPCORN']);
    expect(FEED_ALERT_TYPES[0]).toBe('IN_PROGRESS');
  });

  it('os schemas aplicam esses mesmos limites', () => {
    expect(postInputSchema.safeParse({ body: 'a'.repeat(POST_BODY_MAX_LENGTH) }).success).toBe(
      true,
    );
    expect(postInputSchema.safeParse({ body: 'a'.repeat(POST_BODY_MAX_LENGTH + 1) }).success).toBe(
      false,
    );
    expect(
      postInputSchema.safeParse({ title: 'a'.repeat(POST_TITLE_MAX_LENGTH + 1), body: 'x' })
        .success,
    ).toBe(false);
    expect(commentInputSchema.safeParse({ text: 'a'.repeat(COMMENT_MAX_LENGTH + 1) }).success).toBe(
      false,
    );
  });
});
