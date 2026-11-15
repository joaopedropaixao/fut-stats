import { matchRotationPlan, rotationStatus, TEAM_LABELS, type MatchView } from '@fut-stats/shared';
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Bump } from '../../components/ui/bump';
import { Button, IconButton } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { Sheet } from '../../components/ui/sheet';
import { TeamSegmented } from '../lineup/team-segmented';
import type { TeamKey } from '../lineup/lineup-draft';
import { useRotationClock } from './use-rotation-clock';
import { rotationPhase, type RotationPhase } from './rotation-phase';
import { playRotationWhistle, shouldWhistleOnTurnChange } from './rotation-sound';

const PREFS_KEY = 'fut-stats:rotation:preferences:v1';
type Preferences = { sound: boolean; wakeLock: boolean };
const DEFAULT_PREFERENCES: Preferences = { sound: false, wakeLock: false };
type SheetName = 'duration' | 'stop' | 'table' | null;

function readPreferences(): Preferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
    if (typeof value !== 'object' || value === null) return DEFAULT_PREFERENCES;
    const prefs = value as Partial<Preferences>;
    return { sound: prefs.sound === true, wakeLock: prefs.wakeLock === true };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function formatDuration(ms: number, roundUp = false): string {
  const seconds = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function savePreferences(prefs: Preferences) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Preferências são opcionais: navegação privada ou armazenamento bloqueado não impede o rodízio.
  }
}

function resumeRotationAudio(audio: { current: AudioContext | null }) {
  if (typeof AudioContext === 'undefined') return;
  try {
    audio.current ??= new AudioContext();
    if (audio.current.state === 'suspended') void audio.current.resume().catch(() => {});
  } catch {
    audio.current = null;
  }
}

function useWakeLock(enabled: boolean) {
  const [supported] = useState(() => typeof navigator !== 'undefined' && 'wakeLock' in navigator);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!enabled || !supported) return;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const api = navigator as Navigator & {
          wakeLock: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        const next = await api.wakeLock.request('screen');
        if (cancelled) await next.release();
        else lock.current = next;
      } catch {
        // A permissão pode ser negada pelo navegador; a preferência fica salva e tenta de novo ao voltar.
      }
    };
    const onVisibility = () => void acquire();
    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock.current?.release();
      lock.current = null;
    };
  }, [enabled, supported]);

  return supported;
}

function PreferenceSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center shadow-card"
    >
      <span aria-hidden className={checked ? 'text-success' : 'text-text-muted'}>
        <Icon name={checked ? 'check' : 'x'} size={16} />
      </span>
      <PixelText wrap>{`${label}: ${checked ? 'LIGADO' : 'DESLIGADO'}`}</PixelText>
    </button>
  );
}

export function RotationCard({
  view,
  onStart,
  onStop,
  onError,
  pending,
}: {
  view: MatchView;
  onStart: (minutes: number) => Promise<unknown>;
  onStop: () => Promise<unknown>;
  onError: (error: unknown) => void;
  pending: boolean;
}) {
  const [team, setTeam] = useState<TeamKey>(view.me.team ?? 'WHITE');
  const [sheet, setSheet] = useState<SheetName>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [minutes, setMinutes] = useState(() => view.rotation?.minutes ?? 60);
  const [preferences, setPreferences] = useState(readPreferences);
  const audio = useRef<AudioContext | null>(null);
  const lastChange = useRef<string | null>(null);
  const lastTurn = useRef<{ team: TeamKey; index: number } | null>(null);
  const hiddenSinceLastVisible = useRef(false);
  const [visibilityRestore, setVisibilityRestore] = useState(0);
  const handledVisibilityRestore = useRef(0);
  const rotation = view.rotation;
  const { elapsedMs } = useRotationClock(view.serverTime, rotation?.startedAt ?? null);
  const plan = useMemo(() => matchRotationPlan(view), [view]);
  const status = useMemo(
    () => (plan && rotation ? rotationStatus(plan, rotation.minutes, elapsedMs) : null),
    [plan, rotation, elapsedMs],
  );
  const turns = plan?.[team].turns ?? [];
  const currentTurn = turns.find((turn) => elapsedMs >= turn.startMs && elapsedMs < turn.endMs);
  const visibleTurn = currentTurn ?? turns.at(-1);
  const turnIndex = visibleTurn?.index ?? null;
  const elapsedInTurn = visibleTurn ? elapsedMs - visibleTurn.startMs : 0;
  const nextInMs = status?.teams[team].next?.inMs ?? null;
  const phase: RotationPhase = status
    ? rotationPhase({
        finished: status.finished,
        nextInMs,
        turnIndex: visibleTurn?.index ?? 0,
        elapsedInTurnMs: elapsedInTurn,
      })
    : 'COUNTDOWN';
  const nextKey = `${team}:${visibleTurn?.index ?? -1}`;
  const changed = phase === 'CHANGE' && visibleTurn && visibleTurn.index > 0;
  const enterIds = changed
    ? (turns[visibleTurn.index - 1]?.out ?? [])
    : (status?.teams[team].next?.enter ?? []);
  const leaveIds = changed ? visibleTurn.out : (status?.teams[team].next?.leave ?? []);
  const playerById = useMemo(
    () => new Map(view.players.map((player) => [player.membershipId, player])),
    [view.players],
  );
  const isMyTeam = view.me.team === team;
  const iEnter = isMyTeam && enterIds.includes(view.me.membershipId);
  const iLeave = isMyTeam && leaveIds.includes(view.me.membershipId);
  const iAmOut = isMyTeam && (status?.teams[team].out.includes(view.me.membershipId) ?? false);
  const showWakeLock = useWakeLock(preferences.wakeLock);

  useEffect(() => savePreferences(preferences), [preferences]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        hiddenSinceLastVisible.current = true;
        return;
      }
      if (!hiddenSinceLastVisible.current) return;
      hiddenSinceLastVisible.current = false;
      if (preferences.sound) resumeRotationAudio(audio);
      setVisibilityRestore((restore) => restore + 1);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [preferences.sound]);

  useEffect(() => {
    if (turnIndex === null) return;
    const currentTurn = { team, index: turnIndex };
    if (handledVisibilityRestore.current !== visibilityRestore) {
      lastTurn.current = currentTurn;
      handledVisibilityRestore.current = visibilityRestore;
      return;
    }
    const shouldWhistle = shouldWhistleOnTurnChange(lastTurn.current, currentTurn, {
      enabled: preferences.sound,
      visible: document.visibilityState === 'visible',
      syncingAfterBackground: false,
    });
    lastTurn.current = currentTurn;
    if (shouldWhistle) playRotationWhistle(audio.current, true);
  }, [team, turnIndex, preferences.sound, visibilityRestore]);

  useEffect(() => {
    if (lastChange.current === null) {
      lastChange.current = phase === 'CHANGE' ? nextKey : '';
      return;
    }
    if (phase !== 'CHANGE') {
      lastChange.current = '';
      return;
    }
    if (lastChange.current === nextKey) return;
    lastChange.current = nextKey;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(120);
  }, [nextKey, phase, preferences.sound]);

  useEffect(() => () => void audio.current?.close(), []);

  const close = () => {
    setSheet(null);
    setMenuOpen(false);
  };

  const submitStart = (duration: number) => {
    void onStart(duration).catch(onError);
    close();
  };

  const submitStop = () => {
    void onStop().catch(onError);
    close();
  };

  const countdown =
    phase === 'CHANGE' ? '0:00' : formatDuration(nextInMs ?? status?.remainingMs ?? 0, true);

  if (!rotation)
    return (
      <>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            icon="clock"
            block
            label="Ligar rodízio"
            onClick={() => setSheet('duration')}
          />
          <p className="text-sm text-text-muted">
            Divide o tempo entre os jogadores de linha e avisa cada troca.
          </p>
        </div>
        {sheet === 'duration' && (
          <RotationDurationSheet
            view={view}
            minutes={minutes}
            setMinutes={setMinutes}
            onClose={close}
            onConfirm={submitStart}
            pending={pending}
            restarting={false}
          />
        )}
      </>
    );
  if (!plan || !status) return null;

  return (
    <>
      <section
        aria-label="Rodízio"
        onPointerDownCapture={() => {
          if (preferences.sound) resumeRotationAudio(audio);
        }}
        onKeyDownCapture={() => {
          if (preferences.sound) resumeRotationAudio(audio);
        }}
        className={`moment-frame animate-moment-in flex flex-col bg-surface-raised ${phase === 'CHANGE' ? 'animate-rotation-change' : ''}`}
      >
        <header className="flex min-h-11 items-center justify-between bg-track px-4 shadow-[inset_0_-3px_0_0_var(--color-border-strong)]">
          <PixelText>RODÍZIO</PixelText>
          {view.me.isAdmin && (
            <div className="relative">
              <IconButton
                icon="more"
                label="Opções do rodízio"
                onClick={() => setMenuOpen((open) => !open)}
              />
              {menuOpen && (
                <div className="absolute top-12 right-0 z-10 flex min-w-48 flex-col bg-surface-3 p-2 shadow-float">
                  <Button
                    variant="outline"
                    size={44}
                    label="Reiniciar"
                    onClick={() => setSheet('duration')}
                  />
                  <Button
                    variant="danger"
                    size={44}
                    label="Parar rodízio"
                    onClick={() => setSheet('stop')}
                  />
                </div>
              )}
            </div>
          )}
        </header>

        <div className="flex flex-col gap-2 p-3">
          <TeamSegmented value={team} onChange={setTeam} />

          {isMyTeam && (iEnter || iLeave) && (
            <div
              role="status"
              className="bg-warning/14 px-3 py-2 text-center text-warning shadow-card"
            >
              <PixelText>{iEnter ? 'VOCÊ ENTRA' : 'VOCÊ SAI'}</PixelText>
            </div>
          )}

          {phase === 'FINISHED' ? (
            <div
              role="status"
              className="flex flex-col items-center gap-2 bg-warning/14 py-4 text-warning"
            >
              <Icon name="alert" size={24} />
              <PixelText>FIM DO TEMPO</PixelText>
              <PixelDigits
                value={formatDuration(rotation.minutes * 60_000)}
                scale={4}
                label="Tempo total"
              />
              {view.permissions.finish && (
                <p className="text-center text-base text-text">Finalize o jogo com o placar.</p>
              )}
            </div>
          ) : turns.length === 0 ? (
            <p className="bg-surface px-3 py-4 text-center shadow-card">
              <PixelText wrap>{`${TEAM_LABELS[team]}: SEM RESERVAS. NINGUÉM SAI.`}</PixelText>
            </p>
          ) : (
            <>
              <div className="flex flex-col items-center gap-1 py-1">
                <span
                  className={`inline-flex items-center gap-2 ${phase === 'PREPARE' ? 'text-warning' : 'text-text-muted'}`}
                >
                  {phase === 'PREPARE' && <Icon name="alert" size={18} />}
                  <PixelText>
                    {phase === 'PREPARE'
                      ? 'PREPARA'
                      : phase === 'CHANGE'
                        ? 'TROCA!'
                        : nextInMs === null
                          ? 'FIM DO RODÍZIO EM'
                          : 'PRÓXIMA TROCA EM'}
                  </PixelText>
                </span>
                <Bump value={countdown} scale={1.12}>
                  <PixelDigits value={countdown} scale={5} label={`Contagem ${countdown}`} />
                </Bump>
              </div>

              {phase === 'CHANGE' && (
                <p
                  role="status"
                  className="animate-rotation-message bg-success/12 px-3 py-3 text-center shadow-card"
                >
                  <PixelText wrap>{`ENTRA ${
                    enterIds
                      .map((id) => playerById.get(id)?.nickname)
                      .filter(Boolean)
                      .join(', ') || 'NINGUÉM'
                  }, SAI ${
                    leaveIds
                      .map((id) => playerById.get(id)?.nickname)
                      .filter(Boolean)
                      .join(', ') || 'NINGUÉM'
                  }`}</PixelText>
                </p>
              )}
              {iAmOut && (
                <p className="bg-warning/14 px-3 py-3 text-center text-warning shadow-card">
                  <PixelText>VOCÊ ESTÁ NO BANCO</PixelText>
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <RotationPlayers
                  label="▲ ENTRA"
                  kind="enter"
                  ids={enterIds}
                  players={playerById}
                  team={team}
                  meId={view.me.membershipId}
                />
                <RotationPlayers
                  label="▼ SAI"
                  kind="leave"
                  ids={leaveIds}
                  players={playerById}
                  team={team}
                  meId={view.me.membershipId}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-center gap-1 self-center text-text-muted">
            <PixelText>JOGO</PixelText>
            <PixelDigits decorative value={formatDuration(status.elapsedMs)} scale={2} />
            <PixelText>DE</PixelText>
            <PixelDigits decorative value={formatDuration(rotation.minutes * 60_000)} scale={2} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <PreferenceSwitch
              label="Som"
              checked={preferences.sound}
              onChange={(sound) => {
                if (sound) resumeRotationAudio(audio);
                setPreferences((old) => ({ ...old, sound }));
              }}
            />
            {showWakeLock && (
              <PreferenceSwitch
                label="Tela ligada"
                checked={preferences.wakeLock}
                onChange={(wakeLock) => setPreferences((old) => ({ ...old, wakeLock }))}
              />
            )}
          </div>
          <Button
            variant="outline"
            size={44}
            label="Ver tabela"
            onClick={() => setSheet('table')}
          />
        </div>
      </section>

      {sheet === 'duration' && (
        <RotationDurationSheet
          view={view}
          minutes={minutes}
          setMinutes={setMinutes}
          onClose={close}
          onConfirm={submitStart}
          pending={pending}
          restarting
        />
      )}

      {sheet === 'stop' && (
        <Sheet
          title="Parar o rodízio?"
          onClose={close}
          actions={(closeSheet) => (
            <>
              <Button
                variant="outline"
                size={52}
                label="Voltar"
                className="flex-1"
                onClick={closeSheet}
              />
              <Button
                variant="danger"
                size={52}
                label="Parar rodízio"
                className="flex-1"
                loading={pending}
                onClick={submitStop}
              />
            </>
          )}
        >
          <p>O card some para todo mundo. Você pode ligar o rodízio de novo durante o jogo.</p>
        </Sheet>
      )}

      {sheet === 'table' && (
        <Sheet
          title={`Tabela · ${TEAM_LABELS[team]}`}
          onClose={close}
          actions={(closeSheet) => (
            <Button variant="outline" size={52} label="Fechar" block onClick={closeSheet} />
          )}
        >
          <div className="flex max-h-[55dvh] flex-col overflow-y-auto">
            {turns.map((turn) => {
              const current = elapsedMs >= turn.startMs && elapsedMs < turn.endMs;
              return (
                <div
                  key={turn.index}
                  className={`flex flex-col gap-1 px-2 py-3 shadow-[inset_0_2px_0_0_var(--color-border)] ${current ? 'bg-success/10' : ''}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <PixelText>{`${formatDuration(turn.startMs)} – ${formatDuration(turn.endMs)}`}</PixelText>
                    {current && <Badge label="AGORA" variant="admin" />}
                  </div>
                  <PixelText className="text-text-muted">Ficam fora:</PixelText>
                  <div className="flex flex-wrap gap-2">
                    {turn.out.map((id) => {
                      const player = playerById.get(id);
                      if (!player) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1.5">
                          <PixelText wrap>{player.nickname}</PixelText>
                          {id === view.me.membershipId && <Badge label="VOCÊ" />}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Sheet>
      )}
    </>
  );
}

function RotationDurationSheet({
  view,
  minutes,
  setMinutes,
  onClose,
  onConfirm,
  pending,
  restarting,
}: {
  view: MatchView;
  minutes: number;
  setMinutes: Dispatch<SetStateAction<number>>;
  onClose: () => void;
  onConfirm: (minutes: number) => void;
  pending: boolean;
  restarting: boolean;
}) {
  const preview = matchRotationPlan({ ...view, rotation: { startedAt: view.serverTime, minutes } });
  return (
    <Sheet
      title={restarting ? 'Reiniciar o rodízio?' : 'Ligar o rodízio?'}
      onClose={onClose}
      actions={(closeSheet) => (
        <>
          <Button
            variant="outline"
            size={52}
            label="Voltar"
            className="flex-1"
            onClick={closeSheet}
          />
          <Button
            size={52}
            label={restarting ? 'Reiniciar' : 'Ligar'}
            className="flex-1"
            loading={pending}
            onClick={() => onConfirm(minutes)}
          />
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <p>O tempo fica dividido por igual entre os jogadores de linha de cada time.</p>
        <div className="flex items-center justify-center gap-4">
          <IconButton
            icon="minus"
            label="Diminuir duração em cinco minutos"
            disabled={minutes <= 20}
            onClick={() => setMinutes((n) => Math.max(20, n - 5))}
          />
          <span className="flex flex-col items-center gap-1">
            <PixelDigits value={minutes} scale={5} label={`${minutes} minutos`} />
            <PixelText className="text-text-muted">MINUTOS</PixelText>
          </span>
          <IconButton
            icon="plus"
            label="Aumentar duração em cinco minutos"
            disabled={minutes >= 120}
            onClick={() => setMinutes((n) => Math.min(120, n + 5))}
          />
        </div>
        <div className="flex flex-col gap-2 bg-surface p-3 shadow-card">
          {(['WHITE', 'BLACK'] as const).map((side) => {
            const duration = preview?.[side].turns[0]?.endMs;
            return (
              <PixelText key={side} wrap>
                {duration
                  ? `${TEAM_LABELS[side]}: TROCA A CADA ${formatDuration(duration)}`
                  : `${TEAM_LABELS[side]}: SEM RESERVAS`}
              </PixelText>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}

function RotationPlayers({
  label,
  kind,
  ids,
  players,
  team,
  meId,
}: {
  label: string;
  kind: 'enter' | 'leave';
  ids: string[];
  players: Map<string, MatchView['players'][number]>;
  team: TeamKey;
  meId: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1 bg-surface p-1 ${kind === 'enter' ? 'text-success' : 'text-danger'} shadow-card`}
    >
      <PixelText className="self-center">{label}</PixelText>
      {ids.length === 0 ? (
        <PixelText className="self-center text-text-muted">NINGUÉM</PixelText>
      ) : (
        ids.map((id) => {
          const player = players.get(id);
          if (!player) return null;
          return (
            <div
              key={id}
              className="flex min-w-0 flex-col items-center gap-1 text-center text-text"
            >
              <Avatar
                nickname={player.nickname}
                avatar={player.avatar}
                team={team === 'WHITE' ? 'white' : 'black'}
                size={40}
              />
              <PixelText wrap className="max-w-full break-words">
                {player.nickname}
              </PixelText>
              {id === meId && <Badge label="VOCÊ" className="px-2" />}
            </div>
          );
        })
      )}
    </div>
  );
}
