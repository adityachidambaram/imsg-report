export const GROUP_CHATS_SQL = `
  SELECT chat.display_name AS name,
       GROUP_CONCAT(DISTINCT chat.ROWID) AS ids,
       COUNT(*) AS msgs
FROM chat
JOIN chat_message_join ON chat_message_join.chat_id = chat.ROWID
WHERE chat.style = 43 AND chat.display_name != ''
GROUP BY chat.display_name
ORDER BY msgs DESC
`;

export const TOP_TEXTERS_SQL = `
  WITH tempTable AS (
    SELECT CASE WHEN message.is_from_me = 1 THEN 'me' ELSE handle.id END AS sender
    FROM message
    JOIN chat_message_join ON chat_message_join.message_id = message.ROWID
    LEFT JOIN handle ON handle.ROWID = message.handle_id
    WHERE chat_message_join.chat_id = ?
      AND COALESCE(message.associated_message_type, 0) NOT BETWEEN 2000 AND 2006
  )
  SELECT sender, COUNT(*) AS msgs
  FROM tempTable
  GROUP BY sender
  ORDER BY msgs DESC
`;

export const LAST_MESSAGE_DATE_SQL = `
  SELECT MAX(message.date) AS latest_date
  FROM message
  JOIN chat_message_join ON chat_message_join.message_id = message.ROWID
  WHERE chat_message_join.chat_id IN (__CHAT_IDS__)
    AND COALESCE(message.associated_message_type, 0) NOT BETWEEN 2000 AND 2006
`;

export const REACTIONS_GIVEN_SQL = `
SELECT
  CASE WHEN m.is_from_me = 1 THEN 'me' ELSE h.id END AS person,
  CASE m.associated_message_type
    WHEN 2000 THEN '❤️'
    WHEN 2001 THEN '👍'
    WHEN 2002 THEN '👎'
    WHEN 2003 THEN 'Haha'
    WHEN 2004 THEN '‼️'
    WHEN 2005 THEN '❓'
    WHEN 2006 THEN m.associated_message_emoji
  END AS reaction,
  COUNT(*) AS count
FROM message m
JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
LEFT JOIN handle h ON h.ROWID = m.handle_id
WHERE cmj.chat_id IN (__CHAT_IDS__)
  AND m.associated_message_type BETWEEN 2000 AND 2006
GROUP BY person, reaction
ORDER BY person, count DESC
`;

export const REACTIONS_RECEIVED_SQL = `
SELECT
  CASE WHEN t.is_from_me = 1 THEN 'me' ELSE h.id END AS person,
  CASE m.associated_message_type
    WHEN 2000 THEN '❤️'
    WHEN 2001 THEN '👍'
    WHEN 2002 THEN '👎'
    WHEN 2003 THEN 'Haha'
    WHEN 2004 THEN '‼️'
    WHEN 2005 THEN '❓'
    WHEN 2006 THEN m.associated_message_emoji
  END AS reaction,
  COUNT(*) AS count
FROM message m
JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
JOIN message t ON t.guid = substr(m.associated_message_guid, -36)
LEFT JOIN handle h ON h.ROWID = t.handle_id
WHERE cmj.chat_id IN (__CHAT_IDS__)
  AND m.associated_message_type BETWEEN 2000 AND 2006
GROUP BY person, reaction
ORDER BY person, count DESC
`;

export const CONTACTS_SQL = `
SELECT clean, MIN(name) AS name
FROM (
  SELECT substr(
           replace(replace(replace(replace(replace(p.ZFULLNUMBER, ' ', ''), '(', ''), ')', ''), '-', ''), '+', ''),
           -10
         ) AS clean,
         TRIM(COALESCE(r.ZFIRSTNAME, '') || ' ' || COALESCE(r.ZLASTNAME, '')) AS name
  FROM ZABCDPHONENUMBER p
  JOIN ZABCDRECORD r ON r.Z_PK = p.ZOWNER
)
WHERE name != ''
GROUP BY clean
`;

export function runQuery(db, sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}
