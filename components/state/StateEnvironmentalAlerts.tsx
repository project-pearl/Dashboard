'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Flame, CloudRain, Wind, Thermometer, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

interface EnvironmentalAlert {
  id: string;
  type: 'air_quality' | 'wildfire' | 'flood' | 'severe_weather' | 'drought' | 'contamination';
  severity: 'low' | 'moderate' | 'high' | 'extreme';
  title: string;
  description: string;
  affectedAreas: string[];
  issuedAt: string;
  expiresAt: string;
  source: string;
}

interface StateEnvironmentalAlertsProps {
  stateAbbr: string;
}

export function StateEnvironmentalAlerts({ stateAbbr }: StateEnvironmentalAlertsProps) {
  const [alerts, setAlerts] = useState<EnvironmentalAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);

        // Mock real-time alerts based on state
        const mockAlerts: EnvironmentalAlert[] = [];

        // California - fire-prone
        if (stateAbbr === 'CA') {
          mockAlerts.push({
            id: '1',
            type: 'wildfire',
            severity: 'high',
            title: 'Red Flag Warning',
            description: 'Critical fire weather conditions with high winds and low humidity',
            affectedAreas: ['Los Angeles County', 'Orange County', 'Ventura County'],
            issuedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
            source: 'National Weather Service'
          });
        }

        // Florida - hurricane/flood prone
        if (stateAbbr === 'FL') {
          mockAlerts.push({
            id: '2',
            type: 'severe_weather',
            severity: 'moderate',
            title: 'Coastal Flood Advisory',
            description: 'Minor coastal flooding expected during high tide cycles',
            affectedAreas: ['Miami-Dade', 'Broward', 'Palm Beach'],
            issuedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
            source: 'National Hurricane Center'
          });
        }

        // Texas - multiple hazards
        if (stateAbbr === 'TX') {
          mockAlerts.push({
            id: '3',
            type: 'air_quality',
            severity: 'moderate',
            title: 'Ozone Action Day',
            description: 'Elevated ozone levels expected, sensitive groups should limit outdoor activities',
            affectedAreas: ['Dallas-Fort Worth', 'Houston Metro'],
            issuedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
            source: 'Texas Commission on Environmental Quality'
          });
        }

        // Add a contamination alert for any state
        if (Math.random() > 0.7) {
          mockAlerts.push({
            id: '4',
            type: 'contamination',
            severity: 'high',
            title: 'Drinking Water Advisory',
            description: 'Elevated bacteria levels detected, boil water before consumption',
            affectedAreas: ['Jefferson County Water District'],
            issuedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            source: 'State Health Department'
          });
        }

        await new Promise(resolve => setTimeout(resolve, 600));
        setAlerts(mockAlerts);
      } catch (error) {
        console.error('Error fetching environmental alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [stateAbbr]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Environmental Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-slate-200 rounded"></div>
            <div className="h-16 bg-slate-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getIcon = (type: EnvironmentalAlert['type']) => {
    switch (type) {
      case 'wildfire': return <Flame className="h-4 w-4" />;
      case 'flood': return <CloudRain className="h-4 w-4" />;
      case 'air_quality': return <Wind className="h-4 w-4" />;
      case 'severe_weather': return <Thermometer className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: EnvironmentalAlert['severity']) => {
    switch (severity) {
      case 'extreme': return 'border-red-500 bg-red-50 text-red-800';
      case 'high': return 'border-orange-500 bg-orange-50 text-orange-800';
      case 'moderate': return 'border-yellow-500 bg-yellow-50 text-yellow-800';
      case 'low': return 'border-blue-500 bg-blue-50 text-blue-800';
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes}m remaining`;
    }
    return `${diffHours}h remaining`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Environmental Alerts ({stateAbbr})
          </div>
          <Badge variant="outline" className="text-xs">
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <div className="text-green-600 mb-2">✅</div>
            <div>No active environmental alerts</div>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Alert key={alert.id} className={getSeverityColor(alert.severity)}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(alert.type)}
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-semibold text-sm">{alert.title}</div>
                      <Badge variant="secondary" className="text-xs uppercase">
                        {alert.severity}
                      </Badge>
                    </div>
                    <AlertDescription className="text-xs mb-2">
                      {alert.description}
                    </AlertDescription>
                    <div className="text-xs space-y-1">
                      <div>
                        <strong>Areas:</strong> {alert.affectedAreas.join(', ')}
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {getTimeRemaining(alert.expiresAt)}
                        </div>
                        <div>Source: {alert.source}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        )}

        <div className="mt-4 pt-3 border-t text-xs text-muted-foreground text-center">
          Auto-refreshes every 5 minutes • {new Date().toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
}