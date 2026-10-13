export type Tournament = { round: number; contenders: number[]; winners: number[]; cursor: number; decisions: number };

export function startTournament(count: number, random = Math.random): Tournament {
  if (!Number.isInteger(count) || count < 1) throw new Error("A game needs shows.");
  const contenders = Array.from({ length: count }, (_, i) => i);
  for (let i = contenders.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [contenders[i], contenders[j]] = [contenders[j], contenders[i]];
  }
  return { round: 1, contenders, winners: [], cursor: 0, decisions: 0 };
}

export function pickTournament(game: Tournament, pick: number): Tournament {
  if (game.contenders.length === 1 || !game.contenders.slice(game.cursor, game.cursor + 2).includes(pick)) throw new Error("Choose a show in this pair.");
  const next = { ...game, winners: [...game.winners, pick], cursor: game.cursor + 2, decisions: game.decisions + 1 };
  if (next.cursor >= next.contenders.length - 1) {
    if (next.cursor === next.contenders.length - 1) next.winners.push(next.contenders[next.cursor]);
    return { ...next, round: next.round + 1, contenders: next.winners, winners: [], cursor: 0 };
  }
  return next;
}
