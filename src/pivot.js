export const MAIN_REACTIONS = ["❤️", "👍", "👎", "Haha", "‼️", "❓"];

function reactionKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\p{M}\p{Cf}]/gu, "")
    .trim()
    .toLowerCase();
}

const MAIN_REACTION_LABELS = new Map(
  MAIN_REACTIONS.map((reaction) => [reactionKey(reaction), reaction]),
);

export function isMainReaction(reaction) {
  return MAIN_REACTION_LABELS.has(reactionKey(reaction));
}

export function pivotReactions(rows) {
  const reactionTotals = new Map();
  const people = new Map();

  for (const row of rows) {
    const person = String(row.person ?? "").trim();
    if (!person) continue;

    const rawReaction = String(row.reaction ?? "").trim();
    const reaction =
      MAIN_REACTION_LABELS.get(reactionKey(rawReaction)) ?? rawReaction;
    const count = Number(row.count);

    reactionTotals.set(reaction, (reactionTotals.get(reaction) ?? 0) + count);

    let personCounts = people.get(person);
    if (!personCounts) {
      personCounts = new Map();
      people.set(person, personCounts);
    }
    personCounts.set(reaction, (personCounts.get(reaction) ?? 0) + count);
  }

  const reactions = [...reactionTotals.keys()].sort(
    (a, b) => reactionTotals.get(b) - reactionTotals.get(a),
  );
  const sortedPeople = [...people].map(([person, counts]) => {
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    return { person, counts, total };
  });
  sortedPeople.sort((a, b) => b.total - a.total);

  return {
    reactions,
    people: sortedPeople.map(({ person, counts, total }) => ({
      person,
      total,
      counts: reactions.map((reaction) => counts.get(reaction) ?? 0),
    })),
  };
}
