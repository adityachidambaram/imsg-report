export function normalizePhone(value) {
  const phone = String(value ?? "");
  if (phone.includes("@")) return null;
  return phone.replace(/\D/g, "").slice(-10);
}

export function applyNames(rows, nameMap) {
  const merged = new Map();

  for (const row of rows) {
    const phone = row.person === "me" ? null : normalizePhone(row.person);
    const person = (phone && nameMap?.get(phone)) || row.person;
    let reactions = merged.get(person);
    if (!reactions) {
      reactions = new Map();
      merged.set(person, reactions);
    }
    reactions.set(
      row.reaction,
      (reactions.get(row.reaction) ?? 0) + Number(row.count),
    );
  }

  return [...merged].flatMap(([person, reactions]) =>
    [...reactions].map(([reaction, count]) => ({ person, reaction, count })),
  );
}

export function applyNamesToSenders(rows, nameMap) {
  const countsBySender = new Map();

  for (const row of rows) {
    const phone = row.sender === "me" ? null : normalizePhone(row.sender);
    const sender = (phone && nameMap?.get(phone)) || row.sender;
    countsBySender.set(
      sender,
      (countsBySender.get(sender) ?? 0) + Number(row.msgs),
    );
  }

  return [...countsBySender].map(([sender, msgs]) => ({ sender, msgs }));
}
