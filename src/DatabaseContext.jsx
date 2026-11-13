import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { CONTACTS_SQL, runQuery } from "./queries.js";

const DatabaseContext = createContext(null);
let sqlPromise;

function getSql() {
  sqlPromise ??= initSqlJs({ locateFile: () => sqlWasmUrl });
  return sqlPromise;
}

export function DatabaseProvider({ children }) {
  const [database, setDatabase] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [contactsMap, setContactsMap] = useState(null);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState("");

  const loadFile = useCallback(async (file) => {
    setError("");

    if (file.name !== "chat.db") {
      setError("Choose the file named chat.db.");
      return false;
    }

    setIsLoading(true);
    try {
      const SQL = await getSql();
      const bytes = new Uint8Array(await file.arrayBuffer());

      if (bytes.length < 20) {
        throw new Error("This file is too small to be a valid iMessage database.");
      }

      bytes[18] = 1;
      bytes[19] = 1;
      const nextDatabase = new SQL.Database(bytes);
      setDatabase(nextDatabase);
      return true;
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? `Could not open chat.db: ${loadError.message}`
          : "Could not open chat.db. Choose a valid copy of your iMessage database.",
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadContactsFile = useCallback(async (file) => {
    setContactsError("");

    if (file.name !== "AddressBook-v22.abcddb") {
      setContactsError(
        "Choose AddressBook-v22.abcddb, not its -wal or -shm file.",
      );
      return false;
    }

    setContactsLoading(true);
    let contactsDatabase;
    try {
      const SQL = await getSql();
      const bytes = new Uint8Array(await file.arrayBuffer());

      if (bytes.length < 20) {
        throw new Error("the file is too small to be a valid Contacts database");
      }

      bytes[18] = 1;
      bytes[19] = 1;
      contactsDatabase = new SQL.Database(bytes);
      const rows = runQuery(contactsDatabase, CONTACTS_SQL);
      const nextContacts = new Map(
        rows
          .filter((row) => row.clean && row.name)
          .map((row) => [String(row.clean), String(row.name)]),
      );
      setContactsMap(nextContacts);
      return true;
    } catch (loadError) {
      setContactsError(
        `Could not open contacts. Make sure you picked AddressBook-v22.abcddb and not the -wal or -shm file.${
          loadError instanceof Error ? ` ${loadError.message}` : ""
        }`,
      );
      return false;
    } finally {
      contactsDatabase?.close();
      setContactsLoading(false);
    }
  }, []);

  const removeContacts = useCallback(() => {
    setContactsMap(null);
    setContactsError("");
  }, []);

  useEffect(
    () => () => {
      database?.close();
    },
    [database],
  );

  const value = useMemo(
    () => ({
      database,
      isLoading,
      error,
      loadFile,
      contactsMap,
      contactsCount: contactsMap?.size ?? 0,
      contactsLoading,
      contactsError,
      loadContactsFile,
      removeContacts,
    }),
    [
      database,
      isLoading,
      error,
      loadFile,
      contactsMap,
      contactsLoading,
      contactsError,
      loadContactsFile,
      removeContacts,
    ],
  );

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error("useDatabase must be used within a DatabaseProvider.");
  }
  return context;
}
