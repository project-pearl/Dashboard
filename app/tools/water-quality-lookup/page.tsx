import LocationReportCard from '@/components/LocationReportCard';

export const metadata = {
  title: 'Water Quality Lookup | PEARL Dashboard',
  description: 'Search any US location to get a unified water quality report from 14+ federal data sources.',
};

export default function WaterQualityLookupPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold mb-2">Water Quality Lookup</h1>
        <p className="text-muted-foreground mb-6">
          Enter any US location — ZIP code, address, coordinates, or state — to generate a
          comprehensive water quality report from 14+ federal data sources.
        </p>
        <LocationReportCard />
      </div>
    </main>
  );
}
