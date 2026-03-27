"use client";

import { useMemo, useState } from "react";
import { X, Upload, FileSpreadsheet, AlertCircle, Loader2 } from "lucide-react";
import { useLeadStore, type LeadInput } from "@/store/leads";
import CustomSelect from "@/components/CustomSelect";

type LeadField =
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "company"
  | "jobTitle"
  | "linkedIn"
  | "notes";

type ColumnMap = Record<LeadField, string>;

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  onImportedLeadIds?: (leadIds: string[]) => Promise<void> | void;
}

const EMPTY_MAP: ColumnMap = {
  firstName: "",
  lastName: "",
  fullName: "",
  email: "",
  company: "",
  jobTitle: "",
  linkedIn: "",
  notes: "",
};

const FIELD_LABELS: Record<LeadField, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  fullName: "Full Name",
  email: "Email",
  company: "Company",
  jobTitle: "Job Title",
  linkedIn: "LinkedIn",
  notes: "Notes",
};

const COLUMN_ALIASES: Record<LeadField, string[]> = {
  firstName: ["firstname", "first", "first_name", "givenname", "given_name"],
  lastName: ["lastname", "last", "last_name", "surname", "familyname", "family_name"],
  fullName: ["name", "fullname", "full_name", "contactname", "contact_name"],
  email: ["email", "emailaddress", "email_address", "workemail", "work_email"],
  company: ["company", "companyname", "company_name", "organization", "org"],
  jobTitle: ["jobtitle", "job_title", "title", "role", "position"],
  linkedIn: ["linkedin", "linkedinurl", "linkedin_url", "linkedinprofile", "linkedin_profile"],
  notes: ["notes", "note", "description", "comment", "comments"],
};

function normalizeHeader(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cur.trim());
      cur = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur.trim());
      cur = "";
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  if (cur.length > 0 || row.length > 0) {
    row.push(cur.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  return { headers, rows: rows.slice(1) };
}

function splitFullName(name: string): { firstName: string; lastName: string } {
  const cleaned = name.trim();
  if (!cleaned) return { firstName: "", lastName: "" };
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "-" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function guessMap(headers: string[]): ColumnMap {
  const normalized = headers.map((h) => normalizeHeader(h));
  const map: ColumnMap = { ...EMPTY_MAP };

  (Object.keys(COLUMN_ALIASES) as LeadField[]).forEach((field) => {
    const aliases = COLUMN_ALIASES[field];
    const idx = normalized.findIndex((h) => aliases.includes(h));
    if (idx >= 0) map[field] = headers[idx];
  });

  return map;
}

export default function ImportLeadsCsvModal({
  open,
  onClose,
  title = "Import Leads from CSV",
  onImportedLeadIds,
}: Props) {
  const addLeadsBulk = useLeadStore((s) => s.addLeadsBulk);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [map, setMap] = useState<ColumnMap>(EMPTY_MAP);
  const [parsing, setParsing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importResult, setImportResult] = useState<{ inserted: number; duplicates: number } | null>(null);

  const fieldOrder: LeadField[] = [
    "email",
    "firstName",
    "lastName",
    "fullName",
    "company",
    "jobTitle",
    "linkedIn",
    "notes",
  ];

  const parsedLeads = useMemo(() => {
    if (rows.length === 0 || !map.email) {
      return { valid: [] as LeadInput[], invalidCount: rows.length };
    }

    const indexOf = (col: string) => (col ? headers.indexOf(col) : -1);
    const idx = {
      email: indexOf(map.email),
      firstName: indexOf(map.firstName),
      lastName: indexOf(map.lastName),
      fullName: indexOf(map.fullName),
      company: indexOf(map.company),
      jobTitle: indexOf(map.jobTitle),
      linkedIn: indexOf(map.linkedIn),
      notes: indexOf(map.notes),
    };

    const valid: LeadInput[] = [];
    let invalidCount = 0;
    const seen = new Set<string>();

    for (const row of rows) {
      const email = (idx.email >= 0 ? row[idx.email] : "").trim().toLowerCase();
      if (!email || !isValidEmail(email) || seen.has(email)) {
        invalidCount++;
        continue;
      }

      let firstName = (idx.firstName >= 0 ? row[idx.firstName] : "").trim();
      let lastName = (idx.lastName >= 0 ? row[idx.lastName] : "").trim();
      const fullName = (idx.fullName >= 0 ? row[idx.fullName] : "").trim();

      if ((!firstName || !lastName) && fullName) {
        const split = splitFullName(fullName);
        if (!firstName) firstName = split.firstName;
        if (!lastName) lastName = split.lastName;
      }

      if (!firstName) firstName = email.split("@")[0];
      if (!lastName) lastName = "-";

      valid.push({
        firstName,
        lastName,
        email,
        company: (idx.company >= 0 ? row[idx.company] : "").trim(),
        jobTitle: (idx.jobTitle >= 0 ? row[idx.jobTitle] : "").trim(),
        linkedIn: (idx.linkedIn >= 0 ? row[idx.linkedIn] : "").trim(),
        status: "new",
        notes: (idx.notes >= 0 ? row[idx.notes] : "").trim(),
      });
      seen.add(email);
    }

    return { valid, invalidCount };
  }, [headers, map, rows]);

  if (!open) return null;

  const reset = () => {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMap({ ...EMPTY_MAP });
    setParsing(false);
    setBusy(false);
    setError("");
    setImportResult(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const onFile = async (file: File) => {
    setError("");
    setParsing(true);
    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      if (parsed.headers.length === 0) {
        setError("Could not parse CSV headers.");
        setParsing(false);
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMap(guessMap(parsed.headers));
    } catch {
      setError("Failed to read CSV file.");
    } finally {
      setParsing(false);
    }
  };

  const runImport = async () => {
    if (!map.email) {
      setError("Please map the Email column before importing.");
      return;
    }
    if (parsedLeads.valid.length === 0) {
      setError("No valid rows found to import.");
      return;
    }

    setBusy(true);
    setError("");
    setImportResult(null);
    try {
      const res = await addLeadsBulk(parsedLeads.valid);
      if (onImportedLeadIds && res.leadIds.length > 0) {
        await onImportedLeadIds(res.leadIds);
      }
      if (res.inserted > 0) {
        if (res.duplicates > 0) {
          setImportResult({ inserted: res.inserted, duplicates: res.duplicates });
        } else {
          close();
        }
        return;
      }
      if (res.duplicates > 0) {
        setError(`All ${res.duplicates} lead${res.duplicates !== 1 ? "s" : ""} already exist. No new leads were imported.`);
      } else {
        setError("No leads were imported. Please check your CSV and try again.");
      }
    } catch {
      setError("Import failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[3px]" onClick={close} />
      <div className="animate-scale-up relative z-10 w-full max-w-[760px] rounded-[20px] border border-edge bg-surface p-7 shadow-lg">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-[20px] font-bold tracking-[-0.02em] text-ink">
              {title}
            </h2>
            <p className="mt-1 text-[13px] text-ink-mid">
              Upload, map columns, and bulk import valid rows.
            </p>
          </div>
          <button
            onClick={close}
            className="cursor-pointer rounded-[8px] p-1.5 text-ink-light transition-colors hover:bg-cream hover:text-ink-mid"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="rounded-[12px] border border-dashed border-edge-strong bg-cream p-4">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] bg-copper px-4 py-2 text-[13px] font-semibold text-white hover:bg-copper-hover">
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {parsing ? "Reading..." : "Choose CSV"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={busy || parsing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFile(file);
              }}
            />
          </label>
          {fileName && (
            <p className="mt-2 inline-flex items-center gap-2 text-[12px] text-ink-mid">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {fileName}
            </p>
          )}
        </div>

        {headers.length > 0 && (
          <>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fieldOrder.map((field) => (
                <div key={field}>
                  <label className="mb-[6px] block text-[12px] font-medium text-ink-mid">
                    {FIELD_LABELS[field]}
                    {field === "email" && <span className="ml-1 text-rose">*</span>}
                  </label>
                  <CustomSelect
                    value={map[field]}
                    onChange={(val) => setMap((m) => ({ ...m, [field]: val }))}
                    placeholder="Not mapped"
                    options={[
                      { value: "", label: "Not mapped" },
                      ...headers.map((h) => ({ value: h, label: h })),
                    ]}
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[10px] border border-edge bg-cream px-4 py-3 text-[12px] text-ink-mid">
              {parsedLeads.valid.length} valid row(s), {parsedLeads.invalidCount} invalid/duplicate row(s).
            </div>
          </>
        )}

        {importResult && (
          <div className="mt-4 rounded-[10px] border border-sage/30 bg-sage-light/40 px-4 py-3 text-[12px] text-ink-mid">
            <span className="font-semibold text-sage">{importResult.inserted} lead{importResult.inserted !== 1 ? "s" : ""} imported.</span>
            {" "}{importResult.duplicates} duplicate{importResult.duplicates !== 1 ? "s" : ""} skipped (already exist).
            <button onClick={close} className="ml-3 cursor-pointer font-semibold text-copper hover:underline">Done</button>
          </div>
        )}
        {error && (
          <p className="mt-4 inline-flex items-center gap-2 text-[12px] text-rose">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-edge pt-5">
          <button
            type="button"
            onClick={close}
            className="cursor-pointer rounded-[10px] border border-edge px-5 py-[10px] text-[13px] font-medium text-ink-mid transition-all hover:bg-cream hover:text-ink"
          >
            Close
          </button>
          <button
            type="button"
            onClick={runImport}
            disabled={busy || parsing || headers.length === 0}
            className="cursor-pointer inline-flex items-center gap-2 rounded-[10px] bg-copper px-5 py-[10px] text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-copper-hover disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? "Importing..." : "Import Leads"}
          </button>
        </div>
      </div>
    </div>
  );
}
