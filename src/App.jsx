import { useEffect, useMemo, useRef, useState } from "react";
import { useDatabase } from "./DatabaseContext.jsx";
import {
  GROUP_CHATS_SQL,
  LAST_MESSAGE_DATE_SQL,
  REACTIONS_GIVEN_SQL,
  REACTIONS_RECEIVED_SQL,
  runQuery,
  TOP_TEXTERS_SQL,
} from "./queries.js";
import {
  isMainReaction,
  MAIN_REACTIONS,
  pivotReactions,
} from "./pivot.js";
import { applyNames, applyNamesToSenders } from "./names.js";

const TOP_RANKING_SIZE = 5;
const INITIAL_CUSTOM_REACTION_COUNT = 4;

function formatMessageDate(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;

  const secondsSinceAppleEpoch =
    timestamp > 1e14
      ? timestamp / 1e9
      : timestamp > 1e10
        ? timestamp / 1e3
        : timestamp;
  const date = new Date(Date.UTC(2001, 0, 1) + secondsSinceAppleEpoch * 1000);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="lock-icon"
    >
      <rect x="5" y="10" width="14" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </svg>
  );
}

function ReactionTable({ title, data, isPrinting }) {
  const [showAllPeople, setShowAllPeople] = useState(false);
  const [showAllReactions, setShowAllReactions] = useState(false);
  const [sort, setSort] = useState({ column: "total", direction: "desc" });
  const customReactions = data.reactions.filter(
    (reaction) => !isMainReaction(reaction),
  );
  const visibleCustomReactions = isPrinting
    ? customReactions.slice(0, INITIAL_CUSTOM_REACTION_COUNT)
    : showAllReactions
      ? customReactions
      : customReactions.slice(0, INITIAL_CUSTOM_REACTION_COUNT);
  const visibleReactions = [...MAIN_REACTIONS, ...visibleCustomReactions];
  const sortedPeople = [...data.people].sort((a, b) => {
    let comparison;
    if (sort.column === "person") {
      comparison = (a.person === "me" ? "You" : a.person).localeCompare(
        b.person === "me" ? "You" : b.person,
      );
    } else if (sort.column === "total") {
      comparison = a.total - b.total;
    } else {
      const reactionIndex = data.reactions.indexOf(sort.column);
      comparison =
        (a.counts[reactionIndex] ?? 0) - (b.counts[reactionIndex] ?? 0);
    }

    return (sort.direction === "asc" ? comparison : -comparison) ||
      a.person.localeCompare(b.person);
  });
  const visiblePeople = isPrinting || showAllPeople
    ? sortedPeople
    : sortedPeople.slice(0, TOP_RANKING_SIZE);

  function changeSort(column) {
    setSort((current) => ({
      column,
      direction:
        current.column === column && current.direction === "desc"
          ? "asc"
          : "desc",
    }));
  }

  function sortHeader(label, column) {
    const active = sort.column === column;
    const ariaSort = active
      ? sort.direction === "asc"
        ? "ascending"
        : "descending"
      : "none";
    return (
      <th
        scope="col"
        key={column}
        className={column === "person" ? "reaction-person-heading" : undefined}
        aria-sort={ariaSort}
      >
        <button
          type="button"
          className="reaction-sort-button"
          onClick={() => changeSort(column)}
        >
          {label}
          <span aria-hidden="true">
            {active ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}
          </span>
        </button>
      </th>
    );
  }

  if (!data.people.length) {
    return (
      <section className="reaction-panel" aria-label={title}>
        <h3>{title}</h3>
        <p className="reaction-empty">No reactions found.</p>
      </section>
    );
  }

  return (
    <section className="reaction-panel" aria-label={title}>
      <h3>{title}</h3>
      <div className="reaction-table-scroll" tabIndex={0}>
        <table className="reaction-table">
          <colgroup>
            <col className="reaction-rank-column" />
            <col className="reaction-person-column" />
            {visibleReactions.map((reaction) => (
              <col className="reaction-value-column" key={reaction} />
            ))}
            <col className="reaction-total-column" />
          </colgroup>
          <thead>
            <tr>
              <th className="reaction-rank-heading" scope="col">
                #
              </th>
              {sortHeader("Person", "person")}
              {visibleReactions.map((reaction) => sortHeader(reaction, reaction))}
              {sortHeader("Total", "total")}
            </tr>
          </thead>
          <tbody>
            {visiblePeople.map((row, index) => (
              <tr key={row.person}>
                <td className="reaction-rank">
                  <span>{index + 1}</span>
                </td>
                <th className="reaction-person" scope="row">
                  {row.person === "me" ? "You" : row.person}
                </th>
                {visibleReactions.map((reaction) => {
                  const reactionIndex = data.reactions.indexOf(reaction);
                  return (
                    <td key={`${row.person}-${reaction}`}>
                      {row.counts[reactionIndex]}
                    </td>
                  );
                })}
                <td className="reaction-total">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.people.length > TOP_RANKING_SIZE && (
        <button
          type="button"
          className="reaction-expand-button"
          aria-expanded={showAllPeople}
          onClick={() => setShowAllPeople((expanded) => !expanded)}
        >
          {showAllPeople
            ? `Show top ${TOP_RANKING_SIZE}`
            : `See all ${data.people.length} people`}
          <span aria-hidden="true">{showAllPeople ? " ↑" : " ↓"}</span>
        </button>
      )}
      {customReactions.length > INITIAL_CUSTOM_REACTION_COUNT && (
        <button
          type="button"
          className="reaction-expand-button"
          aria-expanded={showAllReactions}
          onClick={() => setShowAllReactions((expanded) => !expanded)}
        >
          {showAllReactions
            ? `Show top ${INITIAL_CUSTOM_REACTION_COUNT} other emojis`
            : `See all ${customReactions.length} other emojis`}
          <span aria-hidden="true">{showAllReactions ? " ↑" : " ↓"}</span>
        </button>
      )}
    </section>
  );
}

function ReactionRateTable({ data, messageCounts, isPrinting }) {
  const [selectedReactions, setSelectedReactions] = useState([]);
  const [showAllReactions, setShowAllReactions] = useState(false);
  const [showAllPeople, setShowAllPeople] = useState(false);
  const [sort, setSort] = useState({ reaction: null, direction: "desc" });
  const customReactions = data.reactions.filter(
    (reaction) => !isMainReaction(reaction),
  );
  const topCustomReactions = customReactions.slice(
    0,
    INITIAL_CUSTOM_REACTION_COUNT,
  );
  const visibleCustomReactions = showAllReactions
    ? customReactions
    : [
        ...topCustomReactions,
        ...selectedReactions.filter(
          (reaction) =>
            !isMainReaction(reaction) &&
            !topCustomReactions.includes(reaction),
        ),
      ];
  const availableReactions = [...MAIN_REACTIONS, ...visibleCustomReactions];
  const activeSortReaction = selectedReactions.includes(sort.reaction)
    ? sort.reaction
    : selectedReactions[0];
  const activeSortDirection = selectedReactions.includes(sort.reaction)
    ? sort.direction
    : "desc";
  const sortIndex = selectedReactions.indexOf(activeSortReaction);
  const reactionRows = new Map(
    data.people.map((person) => [person.person, person]),
  );
  const people = [...new Set([...messageCounts.keys(), ...reactionRows.keys()])]
    .map((person) => {
      const messageTotal = messageCounts.get(person) ?? 0;
      const reactionRow = reactionRows.get(person);
      const reactions = new Map(
        data.reactions.map((reaction, index) => [
          reaction,
          reactionRow?.counts[index] ?? 0,
        ]),
      );
      return {
        person,
        rates: selectedReactions.map((reaction) =>
          messageTotal > 0 ? (reactions.get(reaction) ?? 0) / messageTotal : null,
        ),
      };
    });
  const sortedPeople = selectedReactions.length
    ? people.sort((a, b) => {
        const aRate = a.rates[sortIndex];
        const bRate = b.rates[sortIndex];
        if (aRate === null || bRate === null) {
          if (aRate !== bRate) return aRate === null ? 1 : -1;
        } else if (aRate !== bRate) {
          return activeSortDirection === "asc"
            ? aRate - bRate
            : bRate - aRate;
        }
        return a.person.localeCompare(b.person);
      })
    : [];
  const visiblePeople = isPrinting || showAllPeople
    ? sortedPeople
    : sortedPeople.slice(0, TOP_RANKING_SIZE);

  function toggleReaction(reaction) {
    setSelectedReactions((current) =>
      current.includes(reaction)
        ? current.filter((selected) => selected !== reaction)
        : [...current, reaction],
    );
  }

  function changeSort(reaction) {
    setSort((current) => ({
      reaction,
      direction:
        current.reaction === reaction && current.direction === "desc"
          ? "asc"
          : "desc",
    }));
  }

  return (
    <section
      className="reaction-panel reaction-rate-panel"
      aria-labelledby="reaction-rate-title"
    >
      <h3 id="reaction-rate-title">Reactions per message</h3>
      <div className="reaction-rate-content">
        <p className="reaction-rate-copy">
          Select one or more reactions received to compare each person’s
          reactions per message sent.
        </p>
        <div
          className="reaction-picker"
          role="group"
          aria-label="Choose reactions for rate rankings"
        >
          {availableReactions.map((reaction) => (
            <button
              key={reaction}
              type="button"
              className={`reaction-emoji-toggle${selectedReactions.includes(reaction) ? " is-selected" : ""}`}
              aria-label={`Toggle ${reaction} reaction rate`}
              aria-pressed={selectedReactions.includes(reaction)}
              onClick={() => toggleReaction(reaction)}
            >
              {reaction}
            </button>
          ))}
        </div>
        {customReactions.length > INITIAL_CUSTOM_REACTION_COUNT && (
          <button
            type="button"
            className="reaction-expand-button reaction-rate-expand-button"
            aria-expanded={showAllReactions}
            onClick={() => setShowAllReactions((expanded) => !expanded)}
          >
            {showAllReactions
              ? `Show top ${INITIAL_CUSTOM_REACTION_COUNT} other emojis`
              : `See all ${customReactions.length} other emojis`}
            <span aria-hidden="true">{showAllReactions ? " ↑" : " ↓"}</span>
          </button>
        )}
        {selectedReactions.length ? (
          <>
            <p className="reaction-rate-caption">
              Sorted by {activeSortReaction}. Rate = reactions received ÷
              messages sent.
            </p>
            <div
              className="reaction-table-scroll reaction-rate-table-wrap"
              tabIndex={0}
            >
              <table className="reaction-table reaction-rate-table">
                <colgroup>
                  <col className="reaction-rank-column" />
                  <col className="reaction-person-column" />
                  {selectedReactions.map((reaction) => (
                    <col className="reaction-value-column" key={reaction} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th className="reaction-rank-heading" scope="col">
                      #
                    </th>
                    <th className="reaction-person-heading" scope="col">
                      Person
                    </th>
                    {selectedReactions.map((reaction) => (
                      <th
                        key={reaction}
                        scope="col"
                        aria-sort={
                          activeSortReaction === reaction
                            ? activeSortDirection === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button
                          type="button"
                          className="reaction-sort-button"
                          aria-label={`Rank by ${reaction} reactions per message`}
                          onClick={() => changeSort(reaction)}
                        >
                          {reaction}
                          /msg
                          <span aria-hidden="true">
                            {activeSortReaction === reaction
                              ? activeSortDirection === "asc"
                                ? " ↑"
                                : " ↓"
                              : ""}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiblePeople.map((person, index) => (
                    <tr key={person.person}>
                      <td className="reaction-rank">
                        <span>{index + 1}</span>
                      </td>
                      <th className="reaction-person" scope="row">
                        {person.person === "me"
                          ? "You"
                          : person.person}
                      </th>
                      {person.rates.map((rate, rateIndex) => (
                        <td
                          key={`${person.person}-${selectedReactions[rateIndex]}`}
                        >
                          {rate === null ? "—" : rate.toFixed(3)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sortedPeople.length > TOP_RANKING_SIZE && (
              <button
                type="button"
                className="reaction-expand-button reaction-rate-expand-button"
                aria-expanded={showAllPeople}
                onClick={() => setShowAllPeople((expanded) => !expanded)}
              >
                {showAllPeople
                  ? `Show top ${TOP_RANKING_SIZE}`
                  : `See all ${sortedPeople.length} people`}
                <span aria-hidden="true">{showAllPeople ? " ↑" : " ↓"}</span>
              </button>
            )}
          </>
        ) : (
          <p className="reaction-rate-empty">
            Choose an emoji to see its reaction-rate ranking.
          </p>
        )}
      </div>
    </section>
  );
}

function TexterPrintTable({ texters }) {
  return (
    <section className="reaction-panel pdf-only pdf-texters-panel">
      <h3>Who texts the most?</h3>
      {texters.length ? (
        <div className="reaction-table-scroll">
          <table className="reaction-table texter-pdf-table">
            <colgroup>
              <col className="reaction-rank-column" />
              <col className="reaction-person-column" />
              <col className="reaction-total-column" />
            </colgroup>
            <thead>
              <tr>
                <th className="reaction-rank-heading" scope="col">#</th>
                <th className="reaction-person-heading" scope="col">Person</th>
                <th scope="col">Messages</th>
              </tr>
            </thead>
            <tbody>
              {texters.map((texter, index) => (
                <tr key={texter.sender}>
                  <td className="reaction-rank">
                    <span>{index + 1}</span>
                  </td>
                  <th className="reaction-person" scope="row">
                    {texter.sender === "me" ? "You" : texter.sender}
                  </th>
                  <td className="reaction-total">
                    {Number(texter.msgs).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="reaction-empty">No messages found in this chat.</p>
      )}
    </section>
  );
}

function ContactsPicker({
  contactsCount,
  contactsError,
  contactsLoading,
  contactsMap,
  loadContactsFile,
  removeContacts,
  compact = false,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  async function handleFile(file) {
    if (file) await loadContactsFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  }

  return (
    <section
      className={`contacts-upload${compact ? " contacts-upload-compact" : ""}${isDragging ? " is-dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
      aria-label="Optional Contacts database"
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".abcddb"
        aria-label="Choose AddressBook-v22.abcddb"
        aria-hidden="true"
        tabIndex={-1}
        disabled={contactsLoading}
        onChange={(event) => void handleFile(event.target.files[0])}
      />
      {!compact && (
        <div className="upload-icon-wrap">
          <svg
            aria-hidden="true"
            viewBox="0 0 32 32"
            fill="none"
            className="upload-icon"
          >
            <path d="M16 21V7m0 0-5 5m5-5 5 5" />
            <path d="M7 19v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
          </svg>
        </div>
      )}
      {contactsMap ? (
        <div className="contacts-loaded">
          <p role="status">
            <span aria-hidden="true">✓</span>{" "}
            {compact
              ? `Contacts loaded: ${contactsCount} names`
              : "Received"}
          </p>
          <button
            type="button"
            className="contacts-replace-button"
            disabled={contactsLoading}
            onClick={() => inputRef.current?.click()}
          >
            Replace
          </button>
          {compact && (
            <button
              type="button"
              className="contacts-remove-button"
              onClick={removeContacts}
            >
              Remove
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="contacts-upload-copy">
            <strong>
              Add your contacts <span>(optional)</span>
            </strong>
            {!compact && (
              <p>See names instead of phone numbers. Drop the file here or choose it.</p>
            )}
          </div>
          <button
            type="button"
            className={compact ? "contacts-compact-button" : "contacts-choose-button"}
            disabled={contactsLoading}
            onClick={() => inputRef.current?.click()}
          >
            {contactsLoading ? "Loading…" : compact ? "Add contacts" : "Choose contacts file"}
          </button>
        </>
      )}
      {!compact && (
        <p className="contacts-file-hint">Choose AddressBook-v22.abcddb</p>
      )}
      {contactsError && (
        <p className="contacts-error" role="alert">
          {contactsError}
        </p>
      )}
    </section>
  );
}

function ChatDatabasePicker({ database, isLoading, error, loadFile }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  async function handleFile(file) {
    if (file) await loadFile(file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  }

  return (
    <section
      className={`upload-card${isDragging ? " is-dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
      aria-label="Load your iMessage database"
    >
      <div className="upload-icon-wrap">
        <svg
          aria-hidden="true"
          viewBox="0 0 32 32"
          fill="none"
          className="upload-icon"
        >
          <path d="M16 21V7m0 0-5 5m5-5 5 5" />
          <path d="M7 19v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
        </svg>
      </div>
      <h2>{database ? "chat.db received" : "Add your chat.db"}</h2>
      <p className="upload-copy">
        {isLoading
          ? "Opening your database locally…"
          : database
            ? "Your message database is ready."
            : "Drop the file here, or choose it from your Desktop."}
      </p>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".db"
        aria-label="Choose chat.db"
        aria-hidden="true"
        tabIndex={-1}
        disabled={isLoading}
        onChange={(event) => void handleFile(event.target.files[0])}
      />
      {database ? (
        <div className="upload-completion">
          <span className="received-button">
            <span aria-hidden="true">✓</span> Received
          </span>
          <button
            className="replace-file-button"
            type="button"
            disabled={isLoading}
            onClick={() => inputRef.current?.click()}
          >
            Replace
          </button>
        </div>
      ) : (
        <button
          className="choose-button"
          type="button"
          disabled={isLoading}
          onClick={() => inputRef.current?.click()}
        >
          {isLoading ? "Opening…" : "Choose chat.db"}
          {!isLoading && <span aria-hidden="true">↗</span>}
        </button>
      )}
      <p className="file-hint">Only a file named chat.db is accepted</p>
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function ChatDetail({ db, chat, contactsMap, onBack }) {
  const [showAllTexters, setShowAllTexters] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [isPrinting, setIsPrinting] = useState(false);
  const [reactionResult, setReactionResult] = useState({
    status: "loading",
    given: null,
    received: null,
    error: "",
  });
  const reactionIds = useMemo(
    () =>
      chat.ids
        .split(",")
        .map((id) => String(id).trim())
        .filter((id) => /^\d+$/.test(id))
        .map(Number)
        .filter(Number.isSafeInteger),
    [chat.ids],
  );
  const messageDateResult = useMemo(() => {
    try {
      if (!reactionIds.length) {
        throw new Error("This group chat does not have any valid chat IDs.");
      }

      const placeholders = reactionIds.map(() => "?").join(", ");
      const sql = LAST_MESSAGE_DATE_SQL.replace(
        "__CHAT_IDS__",
        placeholders,
      );
      const row = runQuery(db, sql, reactionIds)[0];
      const date = formatMessageDate(row?.latest_date);
      if (!date) {
        throw new Error("No non-reaction message date was found.");
      }
      return { date, error: "" };
    } catch (dateError) {
      return {
        date: "date unavailable",
        error:
          dateError instanceof Error
            ? dateError.message
            : "Could not determine the last message date.",
      };
    }
  }, [db, reactionIds]);
  const texterResult = useMemo(() => {
    try {
      const countsBySender = new Map();
      for (const chatId of reactionIds) {
        for (const row of runQuery(db, TOP_TEXTERS_SQL, [chatId])) {
          countsBySender.set(
            row.sender,
            (countsBySender.get(row.sender) ?? 0) + Number(row.msgs),
          );
        }
      }

      const texters = [...countsBySender].map(([sender, msgs]) => ({
        sender,
        msgs,
      }));
      const namedTexters = contactsMap
        ? applyNamesToSenders(texters, contactsMap)
        : texters;
      const identifiedTexters = namedTexters.filter((texter) =>
        String(texter.sender ?? "").trim().length > 0,
      );

      return {
        texters: identifiedTexters.sort((a, b) => b.msgs - a.msgs),
        error: "",
      };
    } catch (queryError) {
      return {
        texters: [],
        error:
          queryError instanceof Error
            ? queryError.message
            : "Could not load message counts.",
      };
    }
  }, [db, reactionIds, contactsMap]);
  const messageCounts = useMemo(
    () =>
      new Map(
        texterResult.texters.map((texter) => [
          texter.sender,
          texter.msgs,
        ]),
      ),
    [texterResult.texters],
  );
  const visibleTexters = texterResult.texters.slice(0, TOP_RANKING_SIZE);
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "people", label: "People" },
    { id: "reactions", label: "Reactions" },
  ];

  useEffect(() => {
    let cancelled = false;
    setReactionResult({
      status: "loading",
      given: null,
      received: null,
      error: "",
    });

    const timeoutId = setTimeout(() => {
      try {
        if (!reactionIds.length) {
          throw new Error("This group chat does not have any valid chat IDs.");
        }

        const placeholders = reactionIds.map(() => "?").join(", ");
        const givenSql = REACTIONS_GIVEN_SQL.replace(
          "__CHAT_IDS__",
          placeholders,
        );
        const receivedSql = REACTIONS_RECEIVED_SQL.replace(
          "__CHAT_IDS__",
          placeholders,
        );
        const givenRows = runQuery(db, givenSql, reactionIds);
        const receivedRows = runQuery(db, receivedSql, reactionIds);
        const namedGivenRows = contactsMap
          ? applyNames(givenRows, contactsMap)
          : givenRows;
        const namedReceivedRows = contactsMap
          ? applyNames(receivedRows, contactsMap)
          : receivedRows;
        const given = pivotReactions(namedGivenRows);
        const received = pivotReactions(namedReceivedRows);

        if (!cancelled) {
          setReactionResult({ status: "ready", given, received, error: "" });
        }
      } catch (queryError) {
        if (!cancelled) {
          setReactionResult({
            status: "error",
            given: null,
            received: null,
            error:
              queryError instanceof Error
                ? queryError.message
                : "Could not load reaction statistics.",
          });
        }
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [db, reactionIds, contactsMap]);

  useEffect(() => {
    if (!isPrinting) return;

    const finishPrinting = () => setIsPrinting(false);
    window.addEventListener("afterprint", finishPrinting);
    const timeoutId = window.setTimeout(() => window.print(), 100);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("afterprint", finishPrinting);
    };
  }, [isPrinting]);

  return (
    <section className="chat-detail">
      <button className="back-button" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> All group chats
      </button>
      <h1 className="pdf-report-title pdf-only">
        {chat.name} as of {messageDateResult.date} stats
      </h1>
      <span className="section-index">GROUP CHAT</span>
      <h1 className="detail-title">{chat.name}</h1>
      <p className="detail-copy">
        {chat.msgs} messages · {reactionIds.length} chats with this name
      </p>
      {messageDateResult.error && (
        <p className="message-date-error" role="status">
          Could not determine the last message date: {messageDateResult.error}
        </p>
      )}
      <nav className="detail-tabs" role="tablist" aria-label="Group chat sections">
        {tabs.map((tab) => (
          <button
            id={`chat-tab-${tab.id}`}
            key={tab.id}
            className={`detail-tab${activeTab === tab.id ? " is-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`chat-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const currentIndex = tabs.findIndex((item) => item.id === activeTab);
              const direction = event.key === "ArrowRight" ? 1 : -1;
              const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
              setActiveTab(nextTab.id);
              document.getElementById(`chat-tab-${nextTab.id}`)?.focus();
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <section
        className="chat-tab-panel"
        id="chat-panel-overview"
        role="tabpanel"
        aria-labelledby="chat-tab-overview"
        hidden={activeTab !== "overview"}
      >
          <div className="overview-metrics">
            <div className="overview-metric">
              <span className="section-index">MESSAGES</span>
              <strong>{Number(chat.msgs).toLocaleString()}</strong>
              <span>in this group</span>
            </div>
            <div className="overview-metric">
              <span className="section-index">CONVERSATIONS</span>
              <strong>{reactionIds.length}</strong>
              <span>combined by name</span>
            </div>
          </div>
          <div className="overview-intro">
            <span className="section-index">CHAT REPORT</span>
            <h2>Explore the conversation</h2>
            <p>
              See who sends the most messages, then explore the reactions this
              group shares.
            </p>
          </div>
      </section>

      <section
        className="chat-tab-panel"
        id="chat-panel-people"
        role="tabpanel"
        aria-labelledby="chat-tab-people"
        hidden={activeTab !== "people"}
      >
      <section className="texters-widget" aria-labelledby="texters-title">
        <button
          className="texters-widget-toggle"
          type="button"
          disabled={
            texterResult.texters.length <= TOP_RANKING_SIZE ||
            Boolean(texterResult.error)
          }
          aria-expanded={showAllTexters}
          aria-controls={showAllTexters ? "texter-list" : undefined}
          onClick={() => setShowAllTexters((expanded) => !expanded)}
        >
          <span className="texters-widget-heading">
            <span className="section-index">CHAT STATS</span>
            <span className="texters-widget-title" id="texters-title">
              Who texts the most?
            </span>
            <span className="texters-widget-action">
              {texterResult.error || !texterResult.texters.length
                ? "No rankings"
                : texterResult.texters.length <= TOP_RANKING_SIZE
                  ? "All texters shown"
                : showAllTexters
                  ? `Show top ${TOP_RANKING_SIZE}`
                  : "See everyone"}
              {texterResult.texters.length > TOP_RANKING_SIZE && (
                <span aria-hidden="true">{showAllTexters ? "↑" : "↓"}</span>
              )}
            </span>
          </span>
        </button>
        {texterResult.error ? (
          <p className="texters-error" role="alert">
            Could not load texters: {texterResult.error}
          </p>
        ) : texterResult.texters.length ? (
          <ol className="texter-preview">
            {visibleTexters.map((texter, index) => (
              <li key={`${texter.sender}-${index}`}>
                <span className="texter-rank">{index + 1}</span>
                <span className="texter-sender">
                  {texter.sender === "me" ? "You" : texter.sender}
                </span>
                <span className="texter-count">{texter.msgs} messages</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="texters-empty">No messages found in this chat.</p>
        )}
        {showAllTexters && (
          texterResult.texters.length > TOP_RANKING_SIZE ? (
            <ol
              className="texter-list"
              id="texter-list"
              start={TOP_RANKING_SIZE + 1}
            >
              {texterResult.texters.slice(TOP_RANKING_SIZE).map((texter, index) => (
                <li key={`${texter.sender}-${index + TOP_RANKING_SIZE}`}>
                  <span className="texter-rank">
                    {index + TOP_RANKING_SIZE + 1}
                  </span>
                  <span className="texter-sender">
                    {texter.sender === "me" ? "You" : texter.sender}
                  </span>
                  <span className="texter-count">{texter.msgs} messages</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="texter-list texter-list-empty" id="texter-list">
              Everyone is already in the top five.
            </p>
          )
        )}
      </section>
      </section>
      <section
        className="chat-tab-panel"
        id="chat-panel-reactions"
        role="tabpanel"
        aria-labelledby="chat-tab-reactions"
        hidden={activeTab !== "reactions"}
      >
      <section className="reactions-widget" aria-labelledby="reactions-title">
        <div className="reactions-header">
          <div>
            <span className="section-index">CHAT STATS</span>
            <h2 className="reactions-title" id="reactions-title">
              Reactions
            </h2>
          </div>
          <button
            className="export-pdf-button"
            type="button"
            disabled={
              reactionResult.status !== "ready" || Boolean(texterResult.error)
            }
            onClick={() => setIsPrinting(true)}
          >
            Export PDF
          </button>
        </div>
        {reactionResult.status === "loading" ? (
          <p className="reaction-status" role="status">
            Loading reaction stats…
          </p>
        ) : reactionResult.status === "error" ? (
          <p className="reaction-error" role="alert">
            Could not load reaction stats: {reactionResult.error}
          </p>
        ) : (
          <>
            <TexterPrintTable texters={texterResult.texters} />
            <div className="reaction-tables">
              <ReactionTable
                title="Reactions given"
                data={reactionResult.given}
                isPrinting={isPrinting}
              />
              <ReactionTable
                title="Reactions received"
                data={reactionResult.received}
                isPrinting={isPrinting}
              />
            </div>
            <ReactionRateTable
              data={reactionResult.received}
              messageCounts={messageCounts}
              isPrinting={isPrinting}
            />
          </>
        )}
      </section>
      </section>
    </section>
  );
}

export default function App() {
  const inputRef = useRef(null);
  const [selectedChatName, setSelectedChatName] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [hasContinued, setHasContinued] = useState(false);
  const [showContactsPrompt, setShowContactsPrompt] = useState(false);
  const [continueError, setContinueError] = useState("");
  const {
    database,
    isLoading,
    error,
    loadFile,
    contactsMap,
    contactsCount,
    contactsLoading,
    contactsError,
    loadContactsFile,
    removeContacts,
  } = useDatabase();
  const queryResult = useMemo(() => {
    if (!database) return { groups: [], error: "" };
    try {
      return { groups: runQuery(database, GROUP_CHATS_SQL), error: "" };
    } catch (queryError) {
      return {
        groups: [],
        error:
          queryError instanceof Error
            ? queryError.message
            : "Could not read group chats from this database.",
      };
    }
  }, [database]);
  const selectedChat = queryResult.groups.find(
    (chat) => chat.name === selectedChatName,
  );
  const filteredGroups = queryResult.groups.filter((chat) =>
    chat.name.toLocaleLowerCase().includes(searchText.trim().toLocaleLowerCase()),
  );

  async function handleReplacementFile(file) {
    if (file && (await loadFile(file))) {
      setSelectedChatName(null);
      setHasContinued(false);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleContinue() {
    if (!database) {
      setContinueError("Add your chat.db to continue.");
      return;
    }
    setContinueError("");
    if (!contactsMap) {
      setShowContactsPrompt(true);
      return;
    }
    setHasContinued(true);
  }

  if (database && hasContinued) {
    return (
      <main className="page-shell app-shell">
        <header className="topbar">
          <a
            className="wordmark"
            href="/"
            aria-label="iMessage Report home"
            onClick={(event) => {
              event.preventDefault();
              setSelectedChatName(null);
            }}
          >
            <span className="wordmark-mark">i</span>
            <span>imsg report</span>
          </a>
          <div className="groups-actions">
            <ContactsPicker
              compact
              contactsCount={contactsCount}
              contactsError={contactsError}
              contactsLoading={contactsLoading}
              contactsMap={contactsMap}
              loadContactsFile={loadContactsFile}
              removeContacts={removeContacts}
            />
            <div className="privacy-chip">
              <LockIcon />
              <span>Private by design</span>
            </div>
            <input
              ref={inputRef}
              className="visually-hidden"
              type="file"
              accept=".db"
              aria-label="Choose another chat.db"
              aria-hidden="true"
              tabIndex={-1}
              disabled={isLoading}
              onChange={(event) =>
                void handleReplacementFile(event.target.files[0])
              }
            />
            <button
              className="change-file-button"
              type="button"
              disabled={isLoading}
              onClick={() => inputRef.current?.click()}
            >
              {isLoading ? "Opening…" : "Change file"}
            </button>
          </div>
        </header>

        {selectedChat ? (
          <ChatDetail
            key={selectedChat.ids}
            db={database}
            chat={selectedChat}
            contactsMap={contactsMap}
            onBack={() => setSelectedChatName(null)}
          />
        ) : (
          <section className="groups-page" aria-labelledby="groups-title">
            <span className="section-index">YOUR MESSAGES, ON YOUR DEVICE</span>
            <h1 className="groups-title" id="groups-title">
              Your group chats<span>.</span>
            </h1>
            <p className="groups-description">
              Pick a conversation to see what makes it yours.
            </p>

            {queryResult.error ? (
              <p className="groups-error" role="alert">
                Could not load group chats: {queryResult.error}
              </p>
            ) : queryResult.groups.length ? (
              <>
                <label className="group-search">
                  <svg
                    className="search-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="10.8" cy="10.8" r="6.8" />
                    <path d="m16 16 4 4" />
                  </svg>
                  <input
                    type="search"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search group chats"
                    aria-label="Search group chats"
                  />
                </label>
                {filteredGroups.length ? (
                  <div className="groups-grid">
                    {filteredGroups.map((chat) => (
                      <button
                        className="group-button"
                        type="button"
                        key={chat.ids}
                        onClick={() => setSelectedChatName(chat.name)}
                      >
                        <span className="group-avatar" aria-hidden="true">
                          {chat.name.trim().charAt(0).toUpperCase() || "?"}
                        </span>
                        <span className="group-info">
                          <span className="group-name">{chat.name}</span>
                          <span className="group-meta">
                            {chat.msgs} messages
                          </span>
                        </span>
                        <span className="group-arrow" aria-hidden="true">
                          →
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="no-search-results" role="status">
                    No group chats match “{searchText.trim()}”.
                  </p>
                )}
              </>
            ) : (
              <div className="empty-groups">
                <span className="section-index">NO CHATS TO SHOW</span>
                <h2>No group chats found</h2>
                <p>
                  This database doesn’t appear to have any chats with multiple
                  participants.
                </p>
              </div>
            )}
          </section>
        )}

        <footer className="footer">
          <span>Made for the group chats that feel like home.</span>
          <span>Everything stays yours.</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="iMessage Report home">
          <span className="wordmark-mark">i</span>
          <span>imsg report</span>
        </a>
        <div className="privacy-chip">
          <LockIcon />
          <span>Private by design</span>
        </div>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          YOUR GROUP CHATS, IN A NEW LIGHT
        </div>
        <h1 id="page-title">
          Groupchat,
          <br />
          <span>decoded.</span>
        </h1>
        <p className="intro">
          See the little things that make your group chats yours. Your messages
          never leave your computer.
        </p>

        <div className="file-intake-grid">
          <ChatDatabasePicker
            database={database}
            isLoading={isLoading}
            error={error}
            loadFile={loadFile}
          />
          <ContactsPicker
            contactsCount={contactsCount}
            contactsError={contactsError}
            contactsLoading={contactsLoading}
            contactsMap={contactsMap}
            loadContactsFile={loadContactsFile}
            removeContacts={removeContacts}
          />
        </div>

        <button
          className="continue-button"
          type="button"
          disabled={isLoading || contactsLoading}
          onClick={handleContinue}
        >
          Continue <span aria-hidden="true">→</span>
        </button>
        {continueError && (
          <p className="continue-error" role="alert">{continueError}</p>
        )}

        <div className="privacy-note">
          <LockIcon />
          <p>
            <strong>100% on your device.</strong> Nothing is uploaded or sent
            anywhere.
          </p>
        </div>
      </section>

      <section className="setup-instructions" aria-label="File instructions">
        <article className="setup-instruction-card">
          <span className="section-index">01 / REQUIRED</span>
          <h2>Find your chat.db</h2>
          <p>Make a copy of your Messages database to use here.</p>
          <ol className="setup-steps">
            <li>Open <strong>Finder</strong>.</li>
            <li>Press <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>G</kbd>.</li>
            <li>Go to <code>~/Library/Messages</code>.</li>
            <li>
              Hold <kbd>⌥</kbd> and drag <code>chat.db</code> to your Desktop
              to make a copy.
            </li>
          </ol>
          <p className="setup-tip">
            Quit Messages first to include your newest messages. Option-drag
            leaves the original untouched.
          </p>
        </article>
        <article className="setup-instruction-card">
          <span className="section-index">02 / OPTIONAL</span>
          <h2>Find your contacts</h2>
          <p>Use your contact names instead of phone numbers.</p>
          <ol className="setup-steps">
            <li>In Finder, press <kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>G</kbd>.</li>
            <li>
              Go to{" "}
              <code>~/Library/Application Support/AddressBook/Sources</code>.
            </li>
            <li>
              Open one of the folders with a long random name, choosing the one
              modified most recently (usually the largest).
            </li>
            <li>
              Hold <kbd>⌥</kbd> and drag <code>AddressBook-v22.abcddb</code> to
              your Desktop to make a copy.
            </li>
          </ol>
        </article>
      </section>

      {showContactsPrompt && (
        <div className="modal-backdrop">
          <section
            className="continue-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contacts-prompt-title"
          >
            <span className="section-index">OPTIONAL STEP</span>
            <h2 id="contacts-prompt-title">Continue without contacts?</h2>
            <p>
              Contacts aren’t required, but adding them makes it easier to view
              who’s who in your chat stats.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-secondary-button"
                onClick={() => setShowContactsPrompt(false)}
              >
                Add contacts
              </button>
              <button
                type="button"
                className="choose-button"
                onClick={() => {
                  setShowContactsPrompt(false);
                  setHasContinued(true);
                }}
              >
                Continue without contacts
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="footer">
        <span>Made for the group chats that feel like home.</span>
        <span>Everything stays yours.</span>
      </footer>
    </main>
  );
}
