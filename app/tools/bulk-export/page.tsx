export const metadata = {
  title: 'Bulk Data Export | PIN Dashboard',
  description: 'Export large datasets from PIN data sources in CSV, JSON, or GeoJSON formats.',
};

export default function BulkExportPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-2">Bulk Data Export</h1>
        <p className="text-muted-foreground mb-6">
          Export large datasets from PIN&apos;s 14+ federal data sources. Select a data source,
          geographic scope, and date range to generate downloadable files in CSV, JSON, or GeoJSON format.
        </p>
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
          Bulk export interface coming soon. For now, use the Data Export Hub within each role dashboard.
        </div>
      </div>
    </main>
  );
}
