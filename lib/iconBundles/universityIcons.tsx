'use client';

import { GraduationCap, BookOpen, Search } from 'lucide-react';

const universityIconMap = { GraduationCap, BookOpen, Search };

export function universityIcons({ iconName, className }: { iconName: string; className?: string }) {
  const IconComponent = universityIconMap[iconName as keyof typeof universityIconMap];
  return IconComponent ? <IconComponent className={className} aria-hidden="true" /> : null;
}