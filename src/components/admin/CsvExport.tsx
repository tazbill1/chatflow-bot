import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CsvExportProps {
  data: Record<string, any>[];
  filename: string;
  columns: { key: string; label: string }[];
}

export function CsvExport({ data, filename, columns }: CsvExportProps) {
  const handleExport = () => {
    if (data.length === 0) return;

    const header = columns.map((c) => c.label).join(",");
    const rows = data.map((row) =>
      columns.map((c) => {
        const val = row[c.key];
        const str = val == null ? "" : String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    );

    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleExport} disabled={data.length === 0}>
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </Button>
  );
}
