'use client';

import { Map, Building2, Droplets, CloudRain } from 'lucide-react';

const stateIconMap = { Map, Building2, Droplets, CloudRain };

export function stateIcons({ iconName, className }: { iconName: string; className?: string }) {
  const IconComponent = stateIconMap[iconName as keyof typeof stateIconMap];
  return IconComponent ? <IconComponent className={className} aria-hidden="true" /> : null;
}