"use client";

import { ChevronRight } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";

export type Column<T> = {
  /** Stable key for React. */
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Extra classes for this column's cells (e.g. "whitespace-nowrap", "text-right"). */
  className?: string;
};

/**
 * Generic "entity table": declare columns, and optionally what a row expands into and its
 * actions. Every list in the dashboard (tools, loans, neighbors, audit log) uses this, so they
 * share one look and one behavior:
 *  - expandable rows: click the row or its chevron to open details inline beneath it;
 *    several can be open at once; links, buttons and inputs inside the row keep working
 *  - an actions column on the right
 *  - horizontal scroll on narrow screens instead of a squashed layout
 */
export function EntityTable<T>({
  rows,
  columns,
  rowKey,
  rowLabel,
  renderExpanded,
  renderActions,
  minWidth = 720,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Short name for the row, used in the expand button's accessible label. */
  rowLabel?: (row: T) => string;
  renderExpanded?: (row: T) => ReactNode;
  renderActions?: (row: T) => ReactNode;
  minWidth?: number;
  /** Visually hidden table caption for screen readers. */
  caption?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandable = Boolean(renderExpanded);
  const colCount = columns.length + (expandable ? 1 : 0) + (renderActions ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-black/5">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            {expandable && (
              <th className="w-10 px-2 py-3">
                <span className="sr-only">Expand</span>
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} scope="col" className="px-4 py-3 font-medium">
                {c.header}
              </th>
            ))}
            {renderActions && (
              <th className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const id = rowKey(row);
            const open = expanded.has(id);
            return (
              <Fragment key={id}>
                <tr
                  className={`${expandable ? "cursor-pointer" : ""} hover:bg-paper/60 ${open ? "bg-paper/60" : ""}`}
                  onClick={(e) => {
                    if (!expandable) return;
                    // Interactive elements inside the row keep their own behavior.
                    if ((e.target as HTMLElement).closest("a,button,input,select,textarea")) return;
                    toggle(id);
                  }}
                >
                  {expandable && (
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={`${open ? "Collapse" : "Expand"}${rowLabel ? ` ${rowLabel(row)}` : " row"}`}
                        onClick={() => toggle(id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-white hover:text-ink"
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                        />
                      </button>
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 ${c.className ?? ""}`}>
                      {c.cell(row)}
                    </td>
                  ))}
                  {renderActions && <td className="px-4 py-3 text-right">{renderActions(row)}</td>}
                </tr>
                {open && renderExpanded && (
                  <tr className="bg-paper/40">
                    <td colSpan={colCount} className="px-4 pb-4 pt-1">
                      {renderExpanded(row)}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
