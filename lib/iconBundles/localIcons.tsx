'use client';

import { Building2, Map, Users } from 'lucide-react';

const localIconMap = { Building2, Map, Users };

export function localIcons({ iconName, className }: { iconName: string; className?: string }) {
  const IconComponent = localIconMap[iconName as keyof typeof localIconMap];
  return IconComponent ? <IconComponent className={className} aria-hidden="true" /> : null;
}