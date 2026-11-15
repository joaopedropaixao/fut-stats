import type { RosterMember } from '@fut-stats/shared';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RosterRow } from './roster-row';

const member: RosterMember = {
  id: 'm1',
  nickname: 'Marcelinho',
  photoUrl: null,
  role: 'PLAYER',
  primaryPosition: 'FORWARD',
  secondaryPositions: [],
  isHiredGoalkeeper: false,
  avatar: { skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' },
  initialRating: 7.5,
  active: true,
};

describe('RosterRow (C38)', () => {
  it('C38: a linha tem 72 px fixos, não "no mínimo" (posição longa e selo não empurram a altura)', () => {
    const noop = () => undefined;
    const html = renderToString(
      <RosterRow
        member={member}
        mine={false}
        onEdit={noop}
        onToggleAdmin={noop}
        onRemove={noop}
        onReactivate={noop}
      />,
    );
    expect(html).toContain('flex h-18 ');
    expect(html).not.toContain('min-h-18');
  });
});
