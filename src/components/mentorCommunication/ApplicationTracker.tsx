"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";

// Status color utility function
function getStatusColorClasses(status: string | null): { bg: string; text: string; border: string } {
  if (!status) {
    return { bg: "", text: "", border: "" };
  }
  
  const normalizedStatus = status.toLowerCase().trim();
  
  if (normalizedStatus === "applied") {
    return {
      bg: "bg-[#F4E2D4]",
      text: "text-[#734C23]",
      border: "border-[#CAAE92]",
    };
  } else if (normalizedStatus === "interview") {
    return {
      bg: "bg-yellow-100",
      text: "text-yellow-800",
      border: "border-yellow-400",
    };
  } else if (normalizedStatus === "offer") {
    return {
      bg: "bg-green-100",
      text: "text-green-700",
      border: "border-green-400",
    };
  } else if (normalizedStatus === "rejected") {
    return {
      bg: "bg-red-100",
      text: "text-red-700",
      border: "border-red-400",
    };
  }
  
  return { bg: "", text: "", border: "" };
}

interface Column {
  _id: string;
  key: string;
  name: string;
  type: "text" | "longtext" | "date" | "select" | "number" | "checkbox";
  required?: boolean;
  options?: string[];
  width?: number;
  order: number;
}

interface Row {
  id: string;
  boardId: string;
  conversationId: string;
  createdBy: string;
  cells: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
}

interface Board {
  id: string;
  conversationId: string;
  columns: Column[];
  createdAt: string;
  updatedAt: string;
}

interface ApplicationTrackerProps {
  conversationId: string;
}

export default function ApplicationTracker({ conversationId }: ApplicationTrackerProps) {
  const [board, setBoard] = useState<Board | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnKey: string } | null>(null);
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const sortedColumns = board?.columns.sort((a, b) => a.order - b.order) || [];

  const fetchBoard = useCallback(async () => {
    try {
      const data = await apiClient.get<Board>(
        `/mentor-communication/conversations/${conversationId}/applications/board`
      );
      setBoard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load board");
    }
  }, [conversationId]);

  const fetchRows = useCallback(async (pageNum: number = 1) => {
    try {
      const data = await apiClient.get<{
        rows: Row[];
        pagination: { page: number; limit: number; hasMore: boolean };
      }>(`/mentor-communication/conversations/${conversationId}/applications/rows?page=${pageNum}&limit=50`);
      
      if (pageNum === 1) {
        setRows(data.rows);
      } else {
        setRows((prev) => [...prev, ...data.rows]);
      }
      setHasMore(data.pagination.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rows");
    }
  }, [conversationId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        await fetchBoard();
        await fetchRows(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchBoard, fetchRows]);

  const handleAddRow = async (cells: Record<string, string | number | boolean | null>) => {
    try {
      setError(null);
      // Filter out undefined/empty values but keep at least one cell
      const filteredCells: Record<string, string | number | boolean | null> = {};
      for (const [key, value] of Object.entries(cells)) {
        if (value !== undefined && value !== null && value !== "") {
          filteredCells[key] = value;
        }
      }

      // Ensure at least one cell exists
      if (Object.keys(filteredCells).length === 0) {
        setError("At least one field must be filled");
        return;
      }

      const data = await apiClient.post<Row>(
        `/mentor-communication/conversations/${conversationId}/applications/rows`,
        { cells: filteredCells }
      );
      setRows((prev) => [data, ...prev]);
      setShowAddModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add row");
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!confirm("Are you sure you want to delete this application?")) {
      return;
    }

    try {
      await apiClient.delete(
        `/mentor-communication/conversations/${conversationId}/applications/rows/${rowId}`
      );
      setRows((prev) => prev.filter((r) => r.id !== rowId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete row");
    }
  };

  const handleCellChange = (rowId: string, columnKey: string, value: string | number | boolean | null) => {
    // Update local state optimistically
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, cells: { ...row.cells, [columnKey]: value } }
          : row
      )
    );

    // Clear existing timeout for this cell
    const timeoutKey = `${rowId}-${columnKey}`;
    if (saveTimeoutRef.current[timeoutKey]) {
      clearTimeout(saveTimeoutRef.current[timeoutKey]);
    }

    // Set saving state
    setSavingCells((prev) => new Set(prev).add(timeoutKey));

    // Debounce save
    saveTimeoutRef.current[timeoutKey] = setTimeout(async () => {
      try {
        await apiClient.patch<Row>(
          `/mentor-communication/conversations/${conversationId}/applications/rows/${rowId}`,
          { cells: { [columnKey]: value } }
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save cell");
        // Revert on error (refetch row)
        fetchRows(page);
      } finally {
        setSavingCells((prev) => {
          const next = new Set(prev);
          next.delete(timeoutKey);
          return next;
        });
        delete saveTimeoutRef.current[timeoutKey];
      }
    }, 500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600">Loading application tracker...</p>
      </div>
    );
  }

  if (error && !board) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 rounded-lg border border-gray-200 bg-white shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {showColumnSettings ? "Hide" : "Columns"}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-[#734C23] rounded-lg hover:bg-[#9C6A45]"
          >
            + Add
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-800 text-xs flex-shrink-0 mb-2">
          {error}
        </div>
      )}

      {/* Add Application Modal */}
      {showAddModal && board && (
        <AddApplicationModal
          columns={sortedColumns}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddRow}
        />
      )}

      {/* Column Settings Panel */}
      {showColumnSettings && (
        <div className="flex-shrink-0 mb-2">
          <ColumnSettingsPanel
            conversationId={conversationId}
            columns={sortedColumns}
            onColumnsUpdated={fetchBoard}
            onClose={() => setShowColumnSettings(false)}
          />
        </div>
      )}

      {/* Table - Full-size scrollable */}
      <div className="flex-1 min-h-0 border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-3">No applications yet.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-[#734C23] rounded-lg hover:bg-[#9C6A45]"
              >
                Add your first application
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-auto h-full">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {sortedColumns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                      style={{ width: col.width || "auto", minWidth: 100 }}
                    >
                      {col.name}
                      {col.required && <span className="text-red-500 ml-1">*</span>}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-20">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    {sortedColumns.map((col) => {
                      const cellKey = `${row.id}-${col.key}`;
                      const isSaving = savingCells.has(cellKey);
                      const value = row.cells[col.key] ?? null;
                      const isStatusColumn = col.key.toLowerCase() === "status" || col.name.toLowerCase() === "status";
                      const statusColors = isStatusColumn ? getStatusColorClasses(value as string) : null;
                      
                      const isCurrentlyEditing = editingCell?.rowId === row.id && editingCell?.columnKey === col.key;
                      
                      return (
                        <td 
                          key={col.key} 
                          className="px-4 py-3 whitespace-nowrap text-sm text-gray-900"
                        >
                          <CellEditor
                            column={col}
                            value={value}
                            isSaving={isSaving}
                            onChange={(newValue) => handleCellChange(row.id, col.key, newValue)}
                            onFocus={() => setEditingCell({ rowId: row.id, columnKey: col.key })}
                            onBlur={() => setEditingCell(null)}
                            isEditing={isCurrentlyEditing}
                            isStatusColumn={isStatusColumn}
                          />
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleDeleteRow(row.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="Delete row"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center flex-shrink-0 mt-2">
          <button
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              fetchRows(nextPage);
            }}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}

// Cell Editor Component
interface CellEditorProps {
  column: Column;
  value: string | number | boolean | null;
  isSaving: boolean;
  onChange: (value: string | number | boolean | null) => void;
  onFocus: () => void;
  onBlur: () => void;
  isEditing: boolean;
  isStatusColumn?: boolean;
}

function CellEditor({
  column,
  value,
  isSaving,
  onChange,
  onFocus,
  onBlur,
  isEditing,
  isStatusColumn = false,
}: CellEditorProps) {
  const statusColors = isStatusColumn ? getStatusColorClasses(value as string) : null;
  if (column.type === "checkbox") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="w-4 h-4 text-[#734C23] border-gray-300 rounded focus:ring-[#9C6A45]"
        />
        {isSaving && <span className="text-xs text-gray-400">Saving...</span>}
      </div>
    );
  }

  if (column.type === "select") {
    const statusColors = isStatusColumn ? getStatusColorClasses(value as string) : null;
    
    return (
      <div className="flex items-center gap-2">
        <select
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value || null)}
          onFocus={onFocus}
          onBlur={onBlur}
          className={`w-full text-sm border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#9C6A45] ${
            isStatusColumn && statusColors && value
              ? `${statusColors.bg} ${statusColors.text} ${statusColors.border} border-2 font-medium`
              : "border-gray-300"
          }`}
        >
          <option value="">-- Select --</option>
          {column.options?.map((opt) => {
            const optionColors = isStatusColumn ? getStatusColorClasses(opt) : null;
            return (
              <option 
                key={opt} 
                value={opt}
                className={optionColors ? `${optionColors.bg} ${optionColors.text}` : ""}
              >
                {opt}
              </option>
            );
          })}
        </select>
        {isSaving && <span className="text-xs text-gray-400">Saving...</span>}
      </div>
    );
  }

  if (column.type === "date") {
    const dateValue = value ? String(value).substring(0, 10) : "";
    return (
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dateValue}
          onChange={(e) => onChange(e.target.value || null)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#9C6A45]"
        />
        {isSaving && <span className="text-xs text-gray-400">Saving...</span>}
      </div>
    );
  }

  if (column.type === "number") {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value === null || value === undefined ? "" : Number(value)}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
          onFocus={onFocus}
          onBlur={onBlur}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#9C6A45]"
        />
        {isSaving && <span className="text-xs text-gray-400">Saving...</span>}
      </div>
    );
  }

  if (column.type === "longtext") {
    if (isEditing) {
      return (
        <div className="flex items-start gap-2">
          <textarea
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => onChange(e.target.value || null)}
            onFocus={onFocus}
            onBlur={onBlur}
            rows={3}
            className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#9C6A45]"
          />
          {isSaving && <span className="text-xs text-gray-400">Saving...</span>}
        </div>
      );
    }
    return (
      <div
        onClick={onFocus}
        className="cursor-pointer text-xs text-gray-900 min-h-[1.5rem]"
        title="Click to edit"
      >
        {value ? String(value).substring(0, 100) + (String(value).length > 100 ? "..." : "") : ""}
        {isSaving && <span className="text-xs text-gray-400 ml-2">Saving...</span>}
      </div>
    );
  }

  // Default: text
  // If it's a status column and not editing, show as badge
  if (isStatusColumn && !isEditing && value) {
    const statusColors = getStatusColorClasses(value as string);
    if (statusColors.bg) {
      return (
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium border ${statusColors.bg} ${statusColors.text} ${statusColors.border}`}>
            {String(value)}
          </span>
          {isSaving && <span className="text-xs text-gray-400">Saving...</span>}
        </div>
      );
    }
  }
  
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(e) => onChange(e.target.value || null)}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`w-full text-sm border rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#9C6A45] ${
          isStatusColumn && statusColors && statusColors.border ? `${statusColors.border} border-2` : "border-gray-300"
        }`}
      />
      {isSaving && <span className="text-xs text-gray-400">Saving...</span>}
    </div>
  );
}

// Column Settings Panel Component
interface ColumnSettingsPanelProps {
  conversationId: string;
  columns: Column[];
  onColumnsUpdated: () => void;
  onClose: () => void;
}

function ColumnSettingsPanel({
  conversationId,
  columns,
  onColumnsUpdated,
  onClose,
}: ColumnSettingsPanelProps) {
  const [localColumns, setLocalColumns] = useState<Column[]>(columns);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState<Column["type"]>("text");
  const [newColumnOptions, setNewColumnOptions] = useState<string>("");

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Validate columns before saving
      const keys = localColumns.map((col) => col.key);
      const uniqueKeys = new Set(keys);
      if (keys.length !== uniqueKeys.size) {
        setError("Column keys must be unique");
        setSaving(false);
        return;
      }

      await apiClient.patch(
        `/mentor-communication/conversations/${conversationId}/applications/columns`,
        { columns: localColumns }
      );
      onColumnsUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update columns");
    } finally {
      setSaving(false);
    }
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const newColumns = [...localColumns];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newColumns.length) return;
    
    [newColumns[index], newColumns[newIndex]] = [newColumns[newIndex], newColumns[index]];
    // Update order values
    newColumns.forEach((col, i) => {
      col.order = i;
    });
    setLocalColumns(newColumns);
  };

  const handleDelete = (index: number) => {
    if (!confirm("Are you sure you want to delete this column? This will remove data from all rows.")) {
      return;
    }
    const newColumns = localColumns.filter((_, i) => i !== index);
    newColumns.forEach((col, i) => {
      col.order = i;
    });
    setLocalColumns(newColumns);
  };

  const handleRename = (index: number, newName: string) => {
    const newColumns = [...localColumns];
    newColumns[index] = { ...newColumns[index], name: newName };
    setLocalColumns(newColumns);
    setEditingIndex(null);
  };

  const handleAddColumn = () => {
    if (!newColumnName.trim()) {
      setError("Column name is required");
      return;
    }
    const key = newColumnName.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now();
    const options = newColumnType === "select" && newColumnOptions.trim()
      ? newColumnOptions.split(",").map((opt) => opt.trim()).filter(Boolean)
      : undefined;
    
    if (newColumnType === "select" && (!options || options.length === 0)) {
      setError("Select columns must have at least one option");
      return;
    }

    // Check if key already exists
    if (localColumns.some((col) => col.key === key)) {
      setError("A column with this key already exists");
      return;
    }

    const newColumn: Column = {
      _id: `new_${Date.now()}`,
      key,
      name: newColumnName.trim(),
      type: newColumnType,
      required: false,
      options: options || [],
      order: localColumns.length,
    };

    setLocalColumns([...localColumns, newColumn]);
    setNewColumnName("");
    setNewColumnType("text");
    setNewColumnOptions("");
    setError(null);
  };

  const handleUpdateSelectOptions = (index: number, options: string[]) => {
    const newColumns = [...localColumns];
    newColumns[index] = { ...newColumns[index], options };
    setLocalColumns(newColumns);
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Customize Columns</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm">
          ✕
        </button>
      </div>
      {error && <div className="mb-3 text-xs text-red-600">{error}</div>}
      
      {/* Add New Column */}
      <div className="mb-3 p-2 border border-gray-200 rounded-lg bg-gray-50">
        <h4 className="text-xs font-medium mb-2">Add New Column</h4>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <input
              type="text"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="Column name"
              className="w-full text-xs border border-gray-300 rounded px-2 py-1"
            />
          </div>
          <select
            value={newColumnType}
            onChange={(e) => setNewColumnType(e.target.value as Column["type"])}
            className="text-xs border border-gray-300 rounded px-2 py-1"
          >
            <option value="text">Text</option>
            <option value="longtext">Long Text</option>
            <option value="date">Date</option>
            <option value="number">Number</option>
            <option value="checkbox">Checkbox</option>
            <option value="select">Select</option>
          </select>
          {newColumnType === "select" && (
            <input
              type="text"
              value={newColumnOptions}
              onChange={(e) => setNewColumnOptions(e.target.value)}
              placeholder="Options (comma-separated)"
              className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
            />
          )}
          <button
            onClick={handleAddColumn}
            className="px-2 py-1 text-xs font-medium text-white bg-[#734C23] rounded hover:bg-[#9C6A45]"
          >
            Add
          </button>
        </div>
      </div>

      {/* Existing Columns */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {localColumns.map((col, index) => (
          <div key={col.key} className="p-2 border border-gray-200 rounded">
            <div className="flex items-center gap-2 mb-2">
              {editingIndex === index ? (
                <input
                  type="text"
                  defaultValue={col.name}
                  onBlur={(e) => handleRename(index, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRename(index, e.currentTarget.value);
                    } else if (e.key === "Escape") {
                      setEditingIndex(null);
                    }
                  }}
                  autoFocus
                  className="flex-1 text-xs border border-gray-300 rounded px-2 py-1"
                />
              ) : (
                <>
                  <div className="flex-1">
                    <div className="text-xs font-medium">{col.name}</div>
                    <div className="text-xs text-gray-500">
                      {col.type} {col.required && "(required)"}
                      {col.type === "select" && col.options && col.options.length > 0 && (
                        <span className="ml-1">({col.options.join(", ")})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingIndex(index)}
                      className="px-1.5 py-0.5 text-xs bg-gray-100 rounded hover:bg-gray-200"
                      title="Rename"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleMove(index, "up")}
                      disabled={index === 0}
                      className="px-1.5 py-0.5 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMove(index, "down")}
                      disabled={index === localColumns.length - 1}
                      className="px-1.5 py-0.5 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                      title="Move down"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleDelete(index)}
                      className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
            {col.type === "select" && (
              <div className="mt-2">
                <input
                  type="text"
                  value={col.options?.join(", ") || ""}
                  onChange={(e) => {
                    const options = e.target.value.split(",").map((opt) => opt.trim()).filter(Boolean);
                    handleUpdateSelectOptions(index, options);
                  }}
                  placeholder="Options (comma-separated)"
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1"
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-xs font-medium text-white bg-[#734C23] rounded-lg hover:bg-[#9C6A45] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// Add Application Modal Component
interface AddApplicationModalProps {
  columns: Column[];
  onClose: () => void;
  onSubmit: (cells: Record<string, string | number | boolean | null>) => void;
}

function AddApplicationModal({ columns, onClose, onSubmit }: AddApplicationModalProps) {
  const [formData, setFormData] = useState<Record<string, string | number | boolean | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Initialize with defaults
  useEffect(() => {
    const defaults: Record<string, string | number | boolean | null> = {};
    for (const col of columns) {
      if (col.key === "status" && col.type === "select" && col.options && col.options.length > 0) {
        defaults[col.key] = col.options[0]; // Default to first option (usually "Applied")
      } else if (col.key === "dateApplied" || col.key === "appliedDate" || col.name.toLowerCase().includes("date")) {
        defaults[col.key] = new Date().toISOString().split("T")[0]; // Today's date
      } else {
        defaults[col.key] = null;
      }
    }
    setFormData(defaults);
  }, [columns]);

  const handleChange = (columnKey: string, value: string | number | boolean | null) => {
    setFormData((prev) => ({ ...prev, [columnKey]: value }));
    // Clear error for this field
    if (errors[columnKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[columnKey];
        return next;
      });
    }
  };

  // Handle ESC key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const newErrors: Record<string, string> = {};
    for (const col of columns) {
      if (col.required) {
        const value = formData[col.key];
        if (value === null || value === undefined || value === "") {
          newErrors[col.key] = `${col.name} is required`;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Filter out empty values
    const cells: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(formData)) {
      if (value !== null && value !== undefined && value !== "") {
        cells[key] = value;
      }
    }

    // Ensure at least one cell
    if (Object.keys(cells).length === 0) {
      setErrors({ _general: "At least one field must be filled" });
      return;
    }

    setSubmitting(true);
    onSubmit(cells);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-[#F8F5F2]/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#F8F5F2]/95 backdrop-blur-sm rounded-2xl shadow-xl border border-[#CAAE92]/20 max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col animate-in">
        <div className="p-6 border-b border-[#CAAE92]/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[#734C23]">Add Application</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#734C23] hover:bg-[#F4E2D4] hover:text-[#9C6A45] transition-all duration-200 focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto">
          {errors._general && (
            <div className="mb-4 p-2 bg-red-50 border border-red-200 text-red-800 text-sm rounded">
              {errors._general}
            </div>
          )}
          <div className="space-y-4">
            {columns.map((col) => {
              const value = formData[col.key] ?? null;
              const error = errors[col.key];
              const isStatusColumn = col.key.toLowerCase() === "status" || col.name.toLowerCase() === "status";
              const statusColors = isStatusColumn && value ? getStatusColorClasses(value as string) : null;
              
              return (
                <div key={col.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {col.name}
                    {col.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {col.type === "select" ? (
                    <select
                      value={value === null ? "" : String(value)}
                      onChange={(e) => handleChange(col.key, e.target.value || null)}
                      className={`w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9C6A45] ${
                        error 
                          ? "border-red-300" 
                          : isStatusColumn && statusColors
                            ? `${statusColors.bg} ${statusColors.text} ${statusColors.border} border-2 font-medium`
                            : "border-gray-300"
                      }`}
                    >
                      <option value="">-- Select --</option>
                      {col.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : col.type === "date" ? (
                    <input
                      type="date"
                      value={value ? String(value).substring(0, 10) : ""}
                      onChange={(e) => handleChange(col.key, e.target.value || null)}
                      className={`w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9C6A45] ${
                        error ? "border-red-300" : "border-gray-300"
                      }`}
                    />
                  ) : col.type === "number" ? (
                    <input
                      type="number"
                      value={value === null ? "" : Number(value)}
                      onChange={(e) => handleChange(col.key, e.target.value ? parseFloat(e.target.value) : null)}
                      className={`w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9C6A45] ${
                        error ? "border-red-300" : "border-gray-300"
                      }`}
                    />
                  ) : col.type === "checkbox" ? (
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(e) => handleChange(col.key, e.target.checked)}
                        className="w-4 h-4 text-[#734C23] border-gray-300 rounded focus:ring-[#9C6A45]"
                      />
                      <span className="ml-2 text-sm text-gray-600">Yes</span>
                    </div>
                  ) : col.type === "longtext" ? (
                    <textarea
                      value={value === null ? "" : String(value)}
                      onChange={(e) => handleChange(col.key, e.target.value || null)}
                      rows={3}
                      className={`w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9C6A45] ${
                        error ? "border-red-300" : "border-gray-300"
                      }`}
                    />
                  ) : (
                    <input
                      type="text"
                      value={value === null ? "" : String(value)}
                      onChange={(e) => handleChange(col.key, e.target.value || null)}
                      className={`w-full text-sm border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#9C6A45] ${
                        error ? "border-red-300" : "border-gray-300"
                      }`}
                    />
                  )}
                  {error && (
                    <p className="mt-1 text-xs text-red-600">{error}</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-6 pt-4 border-t border-[#CAAE92]/30 flex justify-between items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border-2 border-[#CAAE92] bg-transparent text-[#734C23] font-semibold hover:bg-[#F4E2D4]/50 hover:border-[#9C6A45] transition-all duration-200"
            >
              Return
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#734C23] to-[#9C6A45] text-white font-semibold hover:from-[#5A3A1A] hover:to-[#7D5538] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md focus:ring-2 focus:ring-[#9C6A45]/40 focus:ring-offset-2"
            >
              {submitting ? "Creating..." : "Create Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

