'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Download,
  Copy,
  CheckCircle2,
  Sparkles,
  BookOpen,
  BarChart3,
  FlaskConical,
  AlertCircle
} from 'lucide-react';
import { WaterQualityData } from '@/lib/types';
import {
  generateManuscriptSection,
  generateMarkdownReport,
  ManuscriptTopic,
  ManuscriptSection
} from '@/lib/manuscriptGenerator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ManuscriptGeneratorProps {
  data: WaterQualityData;
  regionName: string;
  removalEfficiencies?: Record<string, number>;
  isEJArea?: boolean;
}

const topicOptions: { value: ManuscriptTopic; label: string; description: string; icon: any }[] = [
  {
    value: 'stormwater-nutrient-loading',
    label: 'Stormwater Nutrient Loading',
    description: 'TN, TP loading analysis and regulatory context',
    icon: Sparkles
  },
  {
    value: 'bmp-removal-efficiency',
    label: 'BMP Removal Efficiency',
    description: 'Treatment performance and pollutant reduction',
    icon: BarChart3
  },
  {
    value: 'algal-bloom-risk',
    label: 'Algal Bloom Risk Assessment',
    description: 'Eutrophication risk and HAB probability',
    icon: AlertCircle
  },
  {
    value: 'temporal-trends',
    label: 'Temporal Trends Analysis',
    description: 'Long-term trends and seasonal patterns',
    icon: BarChart3
  },
  {
    value: 'ej-water-quality',
    label: 'Environmental Justice',
    description: 'Water quality disparities and equity analysis',
    icon: FlaskConical
  }
];

export function ManuscriptGenerator({
  data,
  regionName,
  removalEfficiencies,
  isEJArea
}: ManuscriptGeneratorProps) {
  const [selectedTopic, setSelectedTopic] = useState<ManuscriptTopic | null>(null);
  const [manuscript, setManuscript] = useState<ManuscriptSection | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleGenerate = () => {
    if (!selectedTopic) return;

    setIsGenerating(true);
    setTimeout(() => {
      const generated = generateManuscriptSection(
        selectedTopic,
        data,
        regionName,
        removalEfficiencies,
        isEJArea
      );
      setManuscript(generated);
      setIsGenerating(false);
    }, 800);
  };

  const handleDownload = () => {
    if (!manuscript || !selectedTopic) return;

    const markdown = generateMarkdownReport(selectedTopic, manuscript, regionName);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const topicLabel = topicOptions.find(t => t.value === selectedTopic)?.label || 'manuscript';
    a.download = `${topicLabel.replace(/\s/g, '-')}-${regionName.replace(/\s/g, '-')}-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = (content: string, section: string) => {
    navigator.clipboard.writeText(content);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleCopyAll = () => {
    if (!manuscript || !selectedTopic) return;
    const markdown = generateMarkdownReport(selectedTopic, manuscript, regionName);
    navigator.clipboard.writeText(markdown);
    setCopiedSection('all');
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-6">
      <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-purple-900">
            <div className="h-12 w-12 rounded-lg bg-purple-600 flex items-center justify-center">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              One-Click Manuscript Generator
              <CardDescription className="text-sm mt-1">
                Generate publication-ready Methods, Results, and Discussion sections
              </CardDescription>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-purple-900">Select Research Topic</label>
            <Select
              value={selectedTopic || undefined}
              onValueChange={(value) => {
                setSelectedTopic(value as ManuscriptTopic);
                setManuscript(null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a manuscript topic..." />
              </SelectTrigger>
              <SelectContent>
                {topicOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <div>
                          <div className="font-semibold">{option.label}</div>
                          <div className="text-xs text-slate-600">{option.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {selectedTopic && !manuscript && (
            <Alert className="border-purple-300 bg-purple-50">
              <BookOpen className="h-4 w-4 text-purple-700" />
              <AlertDescription className="text-sm text-purple-900">
                <span className="font-semibold">Ready to generate:</span>{' '}
                {topicOptions.find(t => t.value === selectedTopic)?.label}. This will create
                Methods, Results, and Discussion sections with statistics, figures, and citations.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleGenerate}
              disabled={!selectedTopic || isGenerating}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Manuscript Section
                </>
              )}
            </Button>
            {manuscript && (
              <>
                <Button onClick={handleDownload} variant="outline" className="border-purple-600 text-purple-600">
                  <Download className="h-4 w-4 mr-2" />
                  Download (.md)
                </Button>
                <Button onClick={handleCopyAll} variant="outline" className="border-purple-600 text-purple-600">
                  {copiedSection === 'all' ? (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copy All
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {manuscript && (
        <Card className="border-2 border-slate-300">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center justify-between">
              <span>Generated Manuscript Section</span>
              <Badge className="bg-green-600">{topicOptions.find(t => t.value === selectedTopic)?.label}</Badge>
            </CardTitle>
            <CardDescription>
              Publication-ready content with n={manuscript.statistics.n} samples from {regionName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="methods" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="methods">Methods</TabsTrigger>
                <TabsTrigger value="results">Results</TabsTrigger>
                <TabsTrigger value="discussion">Discussion</TabsTrigger>
                <TabsTrigger value="figures">Figures & Citations</TabsTrigger>
              </TabsList>

              <TabsContent value="methods" className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold text-slate-900">Methods Section</h3>
                  <Button
                    onClick={() => handleCopy(manuscript.methods, 'methods')}
                    variant="outline"
                    size="sm"
                  >
                    {copiedSection === 'methods' ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {manuscript.methods}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="results" className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold text-slate-900">Results Section</h3>
                  <Button
                    onClick={() => handleCopy(manuscript.results, 'results')}
                    variant="outline"
                    size="sm"
                  >
                    {copiedSection === 'results' ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {manuscript.results}
                  </div>
                </div>

                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-sm text-blue-900">Statistical Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-blue-900">Sample Size</div>
                        <div className="text-lg font-bold text-blue-700">n = {manuscript.statistics.n}</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-xs font-semibold text-blue-900">Parameters</div>
                        <div className="text-lg font-bold text-blue-700">{Object.keys(manuscript.statistics.mean).length}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-blue-800">
                      <span className="font-semibold">Key Means:</span>{' '}
                      {Object.entries(manuscript.statistics.mean).slice(0, 3).map(([k, v], idx) => (
                        <span key={k}>
                          {k}: {v.toFixed(2)}
                          {idx < 2 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="discussion" className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold text-slate-900">Discussion Section</h3>
                  <Button
                    onClick={() => handleCopy(manuscript.discussion, 'discussion')}
                    variant="outline"
                    size="sm"
                  >
                    {copiedSection === 'discussion' ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 max-h-96 overflow-y-auto">
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {manuscript.discussion}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="figures" className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">Suggested Figures</h3>
                  <div className="space-y-3">
                    {manuscript.figures.map((figure, idx) => (
                      <Card key={figure.id} className="border-slate-200">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-bold text-slate-900">Figure {idx + 1}: {figure.title}</div>
                              <Badge variant="outline" className="mt-1">
                                {figure.type} - {figure.exportFormat.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed mt-2">
                            {figure.caption}
                          </p>
                          <Alert className="mt-3 border-blue-200 bg-blue-50">
                            <AlertCircle className="h-4 w-4 text-blue-700" />
                            <AlertDescription className="text-xs text-blue-900">
                              Export current charts/data as {figure.exportFormat.toUpperCase()} from Project Pearl visualizations
                            </AlertDescription>
                          </Alert>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">References</h3>
                  <Card className="border-slate-200 bg-slate-50">
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        {manuscript.citations.map((citation, idx) => (
                          <div key={idx} className="text-xs text-slate-700 leading-relaxed">
                            {idx + 1}. {citation}
                          </div>
                        ))}
                      </div>
                      <Button
                        onClick={() => handleCopy(manuscript.citations.join('\n\n'), 'citations')}
                        variant="outline"
                        size="sm"
                        className="mt-3"
                      >
                        {copiedSection === 'citations' ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copy Citations
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <Card className="border-2 border-slate-300 bg-slate-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-slate-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold">Disclaimer:</span> Generated manuscript sections are based on
              monitoring data from Project Pearl. All content should be reviewed and adapted by qualified
              researchers. Statistics are calculated from available data and should be verified independently.
              Citations are representative examples; verify applicability to your specific study context.
              Data are preliminary and subject to quality assurance review.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
