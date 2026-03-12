'use client';

import { FlaskConical, Microscope, Beaker } from 'lucide-react';

const biotechIconMap = { FlaskConical, Microscope, Beaker };

export function biotechIcons({ iconName, className }: { iconName: string; className?: string }) {
  const IconComponent = biotechIconMap[iconName as keyof typeof biotechIconMap];
  return IconComponent ? <IconComponent className={className} aria-hidden="true" /> : null;
}