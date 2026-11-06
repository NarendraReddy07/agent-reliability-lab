
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Database, AlertCircle } from "lucide-react";

import api, { getApiError } from "../lib/api";

function getRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.agents)) return data.agents;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function formatCell(value) {
  if (value === null || value === undefined) return "—";

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export default function ResourcePage({
  title,
  description,
  endpoint,
  queryKey,
}) {
  const query = useQuery({
    queryKey: [queryKey],
    queryFn: async () => (await api.get(endpoint)).data,
  });

  const rows = getRows(query.data);
  const columns = rows.length > 0
    ? Object.keys(rows[0])
    : [];

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />
            WORKSPACE
          </div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        <button
          className="secondary-button"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw
            size={16}
            className={query.isFetching ? "spin" : ""}
          />
          Refresh
        </button>
      </section>

      <section className="panel resource-panel">
        <div className="panel-heading">
          <div>
            <h2>{title} records</h2>
            <p>
              {query.isLoading
                ? "Retrieving records..."
                : `${rows.length} records returned by the API`}
            </p>
          </div>

          <Database size={19} className="muted-icon" />
        </div>

        {query.isLoading ? (
          <div className="resource-loading">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-value" />
            <div className="skeleton skeleton-line" />
          </div>
        ) : query.error ? (
          <div className="error-panel">
            <AlertCircle size={21} />
            <div>
              <strong>Unable to load {title.toLowerCase()}</strong>
              <p>{getApiError(query.error)}</p>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <Database size={28} />
            <strong>No records found</strong>
            <span>
              There are currently no {title.toLowerCase()} records in the
              connected backend.
            </span>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>
                      {column.replaceAll("_", " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id ?? row.name ?? index}>
                    {columns.map((column) => (
                      <td key={column}>
                        <span className="resource-cell">
                          {formatCell(row[column])}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}