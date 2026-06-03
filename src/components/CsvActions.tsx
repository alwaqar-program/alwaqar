import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { exportToCsv, importCsvToTable, CsvColumnDef } from '@/lib/csv-utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

interface CsvActionsProps<T extends Record<string, any>> {
  data: T[];
  columns: CsvColumnDef[];
  tableName: string;
  filename: string;
  onImportComplete: () => void;
}

export function CsvActions<T extends Record<string, any>>({
  data, columns, tableName, filename, onImportComplete,
}: CsvActionsProps<T>) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [resultDialog, setResultDialog] = useState<{ success: number; errors: string[] } | null>(null);

  const handleExport = () => {
    if (data.length === 0) {
      toast({ title: 'لا توجد بيانات للتصدير' });
      return;
    }
    exportToCsv(data, columns, filename);
    toast({ title: `تم تصدير ${data.length} سجل` });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await importCsvToTable(file, tableName, columns);
      setResultDialog(result);
      if (result.success > 0) onImportComplete();
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const downloadTemplate = () => {
    const BOM = '\uFEFF';
    const headers = columns.map(c => c.header).join(',');
    const blob = new Blob([BOM + headers + '\n'], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
          <Download size={14} /> تصدير CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importing} className="gap-1.5">
          <Upload size={14} /> {importing ? 'جارٍ الاستيراد...' : 'استيراد CSV'}
        </Button>
        <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
      </div>

      <Dialog open={!!resultDialog} onOpenChange={() => setResultDialog(null)}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-display">نتيجة الاستيراد</DialogTitle>
            <DialogDescription>ملخص عملية استيراد البيانات</DialogDescription>
          </DialogHeader>
          {resultDialog && (
            <div className="space-y-3 pt-2">
              <p className="text-sm">✅ تم استيراد <strong>{resultDialog.success}</strong> سجل بنجاح</p>
              {resultDialog.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-destructive">⚠️ أخطاء ({resultDialog.errors.length}):</p>
                  <div className="max-h-32 overflow-y-auto text-xs bg-muted p-2 rounded space-y-1">
                    {resultDialog.errors.map((err, i) => <p key={i}>{err}</p>)}
                  </div>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={downloadTemplate}>تحميل القالب الفارغ</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
