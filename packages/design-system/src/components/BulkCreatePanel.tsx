import { useState } from 'react';
import { cn } from '../utils/cn.js';
import { Button } from './Button.js';
import { Tabs, TabContent } from './Tabs.js';
import { Upload } from 'lucide-react';

export interface BulkCreatePanelProps {
  onDataParsed?: (data: any[]) => void;
  templateColumns: string[];
  className?: string;
  title?: string;
}

export function BulkCreatePanel({
  onDataParsed,
  templateColumns,
  className,
  title = 'Bulk Create',
}: BulkCreatePanelProps) {
  const [csvContent, setCsvContent] = useState('');
  const [pasteContent, setPasteContent] = useState('');

  const parseCsvContent = (content: string) => {
    const lines = content.trim().split('\n');
    const data = lines.map((line) => {
      const values = line.split(',').map((v) => v.trim());
      const row: any = {};
      templateColumns.forEach((col, idx) => {
        row[col] = values[idx] || '';
      });
      return row;
    });
    return data.filter((row) => Object.values(row).some((v) => v));
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setCsvContent(content);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = (content: string) => {
    const data = parseCsvContent(content);
    onDataParsed?.(data);
  };

  const csvTemplate = templateColumns.join(',');

  const tabs = [
    { id: 'csv', label: 'CSV File', badge: csvContent ? 1 : undefined },
    { id: 'paste', label: 'Paste Data', badge: pasteContent ? 1 : undefined },
  ];

  return (
    <div className={cn('rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6', className)}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>

      <Tabs tabs={tabs} defaultTabId="csv">
        <TabContent tabId="csv" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Upload CSV File
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-600 mb-2" />
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
                id="csv-input"
              />
              <label
                htmlFor="csv-input"
                className="text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
              >
                Click to upload CSV
              </label>
            </div>

            {csvContent && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-sm text-blue-700 dark:text-blue-300">
                ✓ CSV file loaded ({csvContent.split('\n').length} lines)
              </div>
            )}

            <div className="mt-4">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Expected format:</p>
              <code className="block p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                {csvTemplate}
              </code>
            </div>

            {csvContent && (
              <Button onClick={() => handleImport(csvContent)} className="w-full mt-4">
                Import {parseCsvContent(csvContent).length} Rows
              </Button>
            )}
          </div>
        </TabContent>

        <TabContent tabId="paste" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Paste CSV Data
            </label>
            <textarea
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder={`${csvTemplate}\nvalue1,value2,value3`}
              className="w-full h-40 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-mono"
            />

            {pasteContent && (
              <Button onClick={() => handleImport(pasteContent)} className="w-full mt-4">
                Import {parseCsvContent(pasteContent).length} Rows
              </Button>
            )}
          </div>
        </TabContent>
      </Tabs>
    </div>
  );
}
