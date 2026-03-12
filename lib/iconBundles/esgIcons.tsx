'use client';

import { Factory, Leaf, TrendingUp } from 'lucide-react';

const esgIconMap = { Factory, Leaf, TrendingUp };

export function esgIcons({ iconName, className }: { iconName: string; className?: string }) {
  const IconComponent = esgIconMap[iconName as keyof typeof esgIconMap];
  return IconComponent ? <IconComponent className={className} aria-hidden="true" /> : null;
}