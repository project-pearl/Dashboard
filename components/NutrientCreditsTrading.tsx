'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp,
  DollarSign,
  Download,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Leaf,
  Droplets
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { createBrandedPDF, PDFContentSection } from '@/lib/brandedPdfGenerator';

interface StormEvent {
  id: string;
  name: string;
  date: Date;
  duration: string;
  rainfall: string;
  influent: any;
  effluent: any;
  removalEfficiencies: {
    TN: number;
    TP: number;
    TSS: number;
    turbidity: number;
    DO: number;
    salinity: number;
  };
}

interface NutrientCreditsTradingProps {
  stormEvents: StormEvent[];
  influentData: any;
  effluentData: any;
  removalEfficiencies: {
    TN: number;
    TP: number;
    TSS: number;
    turbidity: number;
    DO: number;
    salinity: number;
  };
  timeRange: {
    start: Date;
    end: Date;
  };
}

interface CreditCalculation {
  parameter: string;
  influentLoad: number;
  effluentLoad: number;
  loadReduction: number;
  removalEfficiency: number;
  creditsGenerated: number;
  unit: string;
}

interface MockTradingOffer {
  id: string;
  seller: string;
  nutrient: string;
  credits: number;
  pricePerCredit: number;
  totalPrice: number;
  location: string;
  bmpType: string;
}

export function NutrientCreditsTrading({
  stormEvents,
  influentData,
  effluentData,
  removalEfficiencies,
  timeRange
}: NutrientCreditsTradingProps) {
  const [sellAmount, setSellAmount] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [isGenerating, setIsGenerating] = useState(false);

  const mockTradingOffers: MockTradingOffer[] = [
    {
      id: 'offer-1',
      seller: 'Eastern Shore Agricultural Co-op',
      nutrient: 'TN',
      credits: 1500,
      pricePerCredit: 45,
      totalPrice: 67500,
      location: 'Eastern Shore, MD',
      bmpType: 'Cover Crops + Riparian Buffers'
    },
    {
      id: 'offer-2',
      seller: 'Patuxent River Wetland Trust',
      nutrient: 'TP',
      credits: 850,
      pricePerCredit: 68,
      totalPrice: 57800,
      location: 'Patuxent Watershed, MD',
      bmpType: 'Constructed Wetland'
    },
    {
      id: 'offer-3',
      seller: 'Montgomery County Stormwater',
      nutrient: 'TN',
      credits: 2200,
      pricePerCredit: 50,
      totalPrice: 110000,
      location: 'Upper Potomac, MD',
      bmpType: 'Urban Bioretention Network'
    },
    {
      id: 'offer-4',
      seller: 'Anacostia Watershed Society',
      nutrient: 'TP',
      credits: 600,
      pricePerCredit: 72,
      totalPrice: 43200,
      location: 'Anacostia River, DC/MD',
      bmpType: 'Stream Restoration'
    }
  ];

  const creditCalculations = useMemo(() => {
    const calculations: CreditCalculation[] = [];

    const avgStormVolumeGallons = 250000;
    const conversionFactor = 8.34;

    const calculateLoad = (concentrationMgL: number, volumeGallons: number) => {
      return (concentrationMgL * volumeGallons * conversionFactor) / 1000000;
    };

    const tnInfluentLoad = calculateLoad(influentData.parameters.TN.value, avgStormVolumeGallons);
    const tnEffluentLoad = calculateLoad(effluentData.parameters.TN.value, avgStormVolumeGallons);
    const tnReduction = tnInfluentLoad - tnEffluentLoad;

    calculations.push({
      parameter: 'Total Nitrogen (TN)',
      influentLoad: tnInfluentLoad,
      effluentLoad: tnEffluentLoad,
      loadReduction: tnReduction,
      removalEfficiency: removalEfficiencies.TN,
      creditsGenerated: Math.round(tnReduction * stormEvents.length * 10) / 10,
      unit: 'lb/year'
    });

    const tpInfluentLoad = calculateLoad(influentData.parameters.TP.value, avgStormVolumeGallons);
    const tpEffluentLoad = calculateLoad(effluentData.parameters.TP.value, avgStormVolumeGallons);
    const tpReduction = tpInfluentLoad - tpEffluentLoad;

    calculations.push({
      parameter: 'Total Phosphorus (TP)',
      influentLoad: tpInfluentLoad,
      effluentLoad: tpEffluentLoad,
      loadReduction: tpReduction,
      removalEfficiency: removalEfficiencies.TP,
      creditsGenerated: Math.round(tpReduction * stormEvents.length * 10) / 10,
      unit: 'lb/year'
    });

    const tssInfluentLoad = calculateLoad(influentData.parameters.TSS.value, avgStormVolumeGallons);
    const tssEffluentLoad = calculateLoad(effluentData.parameters.TSS.value, avgStormVolumeGallons);
    const tssReduction = tssInfluentLoad - tssEffluentLoad;

    calculations.push({
      parameter: 'Total Suspended Solids (TSS)',
      influentLoad: tssInfluentLoad,
      effluentLoad: tssEffluentLoad,
      loadReduction: tssReduction,
      removalEfficiency: removalEfficiencies.TSS,
      creditsGenerated: Math.round(tssReduction * stormEvents.length * 10) / 10,
      unit: 'lb/year'
    });

    return calculations;
  }, [influentData, effluentData, removalEfficiencies, stormEvents.length]);

  const creditBank = useMemo(() => {
    const totalTNCredits = creditCalculations.find(c => c.parameter.includes('TN'))?.creditsGenerated || 0;
    const totalTPCredits = creditCalculations.find(c => c.parameter.includes('TP'))?.creditsGenerated || 0;
    const totalTSSCredits = creditCalculations.find(c => c.parameter.includes('TSS'))?.creditsGenerated || 0;

    const monthlyTN = totalTNCredits / 12;
    const monthlyTP = totalTPCredits / 12;

    return {
      tn: {
        total: totalTNCredits,
        thisMonth: Math.round(monthlyTN * 10) / 10,
        thisYear: totalTNCredits,
        sellable: Math.round(totalTNCredits * 0.8 * 10) / 10,
        marketValue: Math.round(totalTNCredits * 0.8 * 50)
      },
      tp: {
        total: totalTPCredits,
        thisMonth: Math.round(monthlyTP * 10) / 10,
        thisYear: totalTPCredits,
        sellable: Math.round(totalTPCredits * 0.8 * 10) / 10,
        marketValue: Math.round(totalTPCredits * 0.8 * 75)
      },
      tss: {
        total: totalTSSCredits,
        thisMonth: Math.round((totalTSSCredits / 12) * 10) / 10,
        thisYear: totalTSSCredits
      }
    };
  }, [creditCalculations]);

  const exportCreditReport = async () => {
    setIsGenerating(true);
    try {
      const sections: PDFContentSection[] = [
        {
          content: [
            `Generated: ${new Date().toLocaleString()}`,
            `Reporting Period: ${timeRange.start.toLocaleDateString()} - ${timeRange.end.toLocaleDateString()}`,
            `Number of Storm Events: ${stormEvents.length}`
          ]
        },
        {
          title: 'NUTRIENT LOAD REDUCTIONS & CREDIT GENERATION',
          content: ['Pollutant removal performance and credit generation summary:'],
          table: {
            headers: ['Parameter', 'Influent Load', 'Effluent Load', 'Load Reduction', 'Removal %', 'Credits', 'Unit'],
            rows: creditCalculations.map(calc => [
              calc.parameter,
              calc.influentLoad.toFixed(2),
              calc.effluentLoad.toFixed(2),
              calc.loadReduction.toFixed(2),
              `${calc.removalEfficiency.toFixed(1)}%`,
              calc.creditsGenerated.toFixed(1),
              calc.unit
            ])
          }
        },
        {
          title: 'CREDIT BANK SUMMARY',
          content: ['Accumulated nutrient credits and estimated market value:'],
          table: {
            headers: ['Nutrient', 'Total Credits', 'This Month', 'This Year', 'Sellable', 'Market Value'],
            rows: [
              ['Total Nitrogen (TN)', creditBank.tn.total.toFixed(1), creditBank.tn.thisMonth.toFixed(1),
               creditBank.tn.thisYear.toFixed(1), creditBank.tn.sellable.toFixed(1),
               `$${creditBank.tn.marketValue.toLocaleString()}`],
              ['Total Phosphorus (TP)', creditBank.tp.total.toFixed(1), creditBank.tp.thisMonth.toFixed(1),
               creditBank.tp.thisYear.toFixed(1), creditBank.tp.sellable.toFixed(1),
               `$${creditBank.tp.marketValue.toLocaleString()}`],
              ['Total Suspended Solids', creditBank.tss.total.toFixed(1), creditBank.tss.thisMonth.toFixed(1),
               creditBank.tss.thisYear.toFixed(1), 'N/A', 'N/A']
            ]
          }
        },
        {
          title: 'COMPLIANCE NOTES',
          content: [
            'This report documents nutrient load reductions for Chesapeake Bay TMDL compliance.',
            '',
            'Credits calculated using approved MS4 BMP performance monitoring methodology.',
            '',
            'Credit conversion: 1 lb nutrient removed = 1 credit (subject to state trading platform verification).'
          ]
        },
        {
          title: 'DISCLAIMER',
          content: [
            'This is a simulation for demonstration purposes. Actual nutrient credit trading requires:',
            '',
            '• Registration with state trading platform (e.g., Maryland Nutrient Trading Tool)',
            '• Third-party verification of BMP performance',
            '• Annual certification and reporting to regulatory authority',
            '• Compliance with watershed-specific trading ratios and geographic constraints'
          ]
        }
      ];

      const pdf = await createBrandedPDF('NUTRIENT CREDIT GENERATION REPORT', sections);
      pdf.download(`nutrient-credit-report-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSellCredits = () => {
    alert('Credit sell order submitted!\n\nIn production, this would connect to your state\'s nutrient trading platform (e.g., Maryland Nutrient Trading Tool, Virginia Nutrient Credit Exchange) to list your credits for sale.');
  };

  const handleBuyCredits = (offer: MockTradingOffer) => {
    alert(`Purchase initiated for ${offer.credits} ${offer.nutrient} credits from ${offer.seller}.\n\nIn production, this would process through the state trading platform with escrow and verification.`);
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-300">
        <Leaf className="h-5 w-5 text-green-600" />
        <AlertTitle className="text-green-900 font-bold">Chesapeake Bay Nutrient Credits & Trading</AlertTitle>
        <AlertDescription className="text-green-800">
          Track nutrient load reductions for Chesapeake Bay TMDL and MS4 compliance. Generate tradeable credits
          from verified BMP performance. Future integration with Maryland Nutrient Trading Tool and Virginia Nutrient Credit Exchange.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Credit Overview</TabsTrigger>
          <TabsTrigger value="trading">Trading Marketplace</TabsTrigger>
          <TabsTrigger value="calculations">Load Calculations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {(removalEfficiencies.TN < 60 || removalEfficiencies.TP < 60) && (
            <Alert className="bg-amber-50 border-amber-300">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900">Low Removal Efficiency Alert</AlertTitle>
              <AlertDescription className="text-amber-800">
                {removalEfficiencies.TN < 60 && (
                  <div>Total Nitrogen removal is below 60% ({removalEfficiencies.TN.toFixed(1)}%) - generating fewer TN credits than target.</div>
                )}
                {removalEfficiencies.TP < 60 && (
                  <div>Total Phosphorus removal is below 60% ({removalEfficiencies.TP.toFixed(1)}%) - generating fewer TP credits than target.</div>
                )}
                <div className="mt-2">Consider BMP maintenance or optimization to improve credit generation rates.</div>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Leaf className="h-5 w-5 text-green-600" />
                  Total Nitrogen (TN) Credits
                </CardTitle>
                <CardDescription>Chesapeake Bay TMDL Credit Bank</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Balance:</span>
                    <span className="text-3xl font-bold text-green-700">{creditBank.tn.total.toFixed(1)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-xs text-muted-foreground mb-1">This Month</div>
                      <div className="text-xl font-bold text-green-600 flex items-center gap-1">
                        <ArrowUpRight className="h-4 w-4" />
                        {creditBank.tn.thisMonth.toFixed(1)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-xs text-muted-foreground mb-1">This Year</div>
                      <div className="text-xl font-bold text-green-600 flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        {creditBank.tn.thisYear.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-100 rounded-lg p-3 border border-green-300">
                    <div className="text-sm font-semibold text-green-900 mb-1">Sellable Credits</div>
                    <div className="text-2xl font-bold text-green-700">{creditBank.tn.sellable.toFixed(1)} credits</div>
                    <div className="text-sm text-green-700 mt-1">
                      Est. Value: <span className="font-bold">${creditBank.tn.marketValue.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-green-600 mt-2">@ $50/credit market rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-blue-600" />
                  Total Phosphorus (TP) Credits
                </CardTitle>
                <CardDescription>Chesapeake Bay TMDL Credit Bank</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Balance:</span>
                    <span className="text-3xl font-bold text-blue-700">{creditBank.tp.total.toFixed(1)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-xs text-muted-foreground mb-1">This Month</div>
                      <div className="text-xl font-bold text-blue-600 flex items-center gap-1">
                        <ArrowUpRight className="h-4 w-4" />
                        {creditBank.tp.thisMonth.toFixed(1)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="text-xs text-muted-foreground mb-1">This Year</div>
                      <div className="text-xl font-bold text-blue-600 flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        {creditBank.tp.thisYear.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-100 rounded-lg p-3 border border-blue-300">
                    <div className="text-sm font-semibold text-blue-900 mb-1">Sellable Credits</div>
                    <div className="text-2xl font-bold text-blue-700">{creditBank.tp.sellable.toFixed(1)} credits</div>
                    <div className="text-sm text-blue-700 mt-1">
                      Est. Value: <span className="font-bold">${creditBank.tp.marketValue.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-blue-600 mt-2">@ $75/credit market rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-600" />
                Credit Bank Summary
              </CardTitle>
              <CardDescription>All nutrient and sediment reductions tracked</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nutrient</TableHead>
                    <TableHead className="text-right">Total Credits</TableHead>
                    <TableHead className="text-right">This Month</TableHead>
                    <TableHead className="text-right">This Year</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Total Nitrogen (TN)</TableCell>
                    <TableCell className="text-right font-bold text-green-700">{creditBank.tn.total.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{creditBank.tn.thisMonth.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{creditBank.tn.thisYear.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Tradeable</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Total Phosphorus (TP)</TableCell>
                    <TableCell className="text-right font-bold text-blue-700">{creditBank.tp.total.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{creditBank.tp.thisMonth.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{creditBank.tp.thisYear.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Tradeable</Badge>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Total Suspended Solids (TSS)</TableCell>
                    <TableCell className="text-right font-bold text-slate-700">{creditBank.tss.total.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{creditBank.tss.thisMonth.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{creditBank.tss.thisYear.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">Tracked Only</Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  Total potential market value: <span className="font-bold text-slate-900">${(creditBank.tn.marketValue + creditBank.tp.marketValue).toLocaleString()}</span>
                </div>
                <Button onClick={exportCreditReport} variant="outline" className="gap-2" disabled={isGenerating}>
                  <Download className="h-4 w-4" />
                  {isGenerating ? 'Generating PDF...' : 'Export Credit Report (PDF)'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trading" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-2 border-green-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownRight className="h-5 w-5 text-green-600" />
                  Sell Your Credits
                </CardTitle>
                <CardDescription>List credits for sale on the trading platform</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nutrient-type">Nutrient Type</Label>
                    <select id="nutrient-type" className="w-full border rounded-md px-3 py-2">
                      <option>Total Nitrogen (TN) - {creditBank.tn.sellable.toFixed(1)} available</option>
                      <option>Total Phosphorus (TP) - {creditBank.tp.sellable.toFixed(1)} available</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sell-amount">Amount (credits)</Label>
                    <Input
                      id="sell-amount"
                      type="number"
                      placeholder="0.0"
                      value={sellAmount}
                      onChange={(e) => setSellAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sell-price">Price per Credit ($)</Label>
                    <Input
                      id="sell-price"
                      type="number"
                      placeholder="50.00"
                      value={sellPrice}
                      onChange={(e) => setSellPrice(e.target.value)}
                    />
                    <div className="text-xs text-muted-foreground">
                      Market rate: TN ~$50/credit, TP ~$75/credit
                    </div>
                  </div>
                  {sellAmount && sellPrice && (
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <div className="text-sm text-green-900">Total Sale Value:</div>
                      <div className="text-2xl font-bold text-green-700">
                        ${(parseFloat(sellAmount) * parseFloat(sellPrice)).toLocaleString()}
                      </div>
                    </div>
                  )}
                  <Button onClick={handleSellCredits} className="w-full bg-green-600 hover:bg-green-700">
                    <DollarSign className="h-4 w-4 mr-2" />
                    List Credits for Sale
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpRight className="h-5 w-5 text-blue-600" />
                  Available Credits to Buy
                </CardTitle>
                <CardDescription>Purchase credits from other verified BMPs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {mockTradingOffers.map((offer) => (
                    <Card key={offer.id} className="border hover:border-blue-300 transition-colors">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-sm">{offer.seller}</div>
                            <div className="text-xs text-muted-foreground">{offer.location}</div>
                          </div>
                          <Badge variant="outline" className={offer.nutrient === 'TN' ? 'bg-green-50' : 'bg-blue-50'}>
                            {offer.nutrient}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          BMP: {offer.bmpType}
                        </div>
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <div className="text-lg font-bold">{offer.credits.toLocaleString()} credits</div>
                            <div className="text-xs text-muted-foreground">
                              ${offer.pricePerCredit}/credit
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-blue-700">
                              ${offer.totalPrice.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">total</div>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleBuyCredits(offer)}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          Purchase Credits
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Alert className="bg-amber-50 border-amber-300">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900">Chesapeake Bay Trading Platform Integration</AlertTitle>
            <AlertDescription className="text-amber-800">
              This is a demonstration interface. Actual nutrient credit trading in the Chesapeake Bay watershed requires:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Registration with Maryland Nutrient Trading Tool or Virginia Nutrient Credit Exchange</li>
                <li>Third-party verification of BMP performance monitoring data</li>
                <li>Compliance with state-specific trading ratios and geographic constraints</li>
                <li>Annual certification and reporting to Maryland Department of Environment or Virginia DEQ</li>
              </ul>
              <div className="mt-2">
                Contact your state environmental agency for Chesapeake Bay TMDL credit program details.
              </div>
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="calculations" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle>Nutrient Load Reduction Calculations</CardTitle>
              <CardDescription>
                Detailed load calculations based on storm event monitoring data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parameter</TableHead>
                    <TableHead className="text-right">Influent Load (lb/event)</TableHead>
                    <TableHead className="text-right">Effluent Load (lb/event)</TableHead>
                    <TableHead className="text-right">Load Reduction (lb/event)</TableHead>
                    <TableHead className="text-right">Removal %</TableHead>
                    <TableHead className="text-right">Credits Generated (lb/year)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creditCalculations.map((calc, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{calc.parameter}</TableCell>
                      <TableCell className="text-right">{calc.influentLoad.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{calc.effluentLoad.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold text-green-700">
                        {calc.loadReduction.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={calc.removalEfficiency >= 80 ? 'default' : 'secondary'}>
                          {calc.removalEfficiency.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-700">
                        {calc.creditsGenerated.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-2 bg-slate-50">
            <CardHeader>
              <CardTitle className="text-lg">Calculation Methodology</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="font-semibold text-slate-900 mb-1">Load Calculation Formula:</div>
                <div className="bg-white rounded p-2 border font-mono text-xs">
                  Load (lb) = Concentration (mg/L) × Volume (gallons) × 8.34 × 10⁻⁶
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-900 mb-1">Credit Conversion:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  <li>1 lb of nutrient removed = 1 credit (standard MS4 methodology)</li>
                  <li>Annual credits = Load reduction per event × Number of events per year</li>
                  <li>Currently tracking {stormEvents.length} storm events</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-slate-900 mb-1">Assumptions:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  <li>Average storm event volume: 250,000 gallons</li>
                  <li>Calculations based on verified influent/effluent sampling</li>
                  <li>Credits subject to state verification and trading ratio adjustments</li>
                  <li>Geographic trading constraints may apply (watershed-specific)</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-slate-900 mb-1">Compliance Standards:</div>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  <li>Chesapeake Bay TMDL nutrient reduction targets</li>
                  <li>MS4 permit BMP performance monitoring requirements</li>
                  <li>State-specific nutrient trading program rules</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
