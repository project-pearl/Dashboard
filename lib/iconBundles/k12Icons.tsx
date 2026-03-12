'use client';

import { BookOpen, Gamepad2, Heart } from 'lucide-react';

const k12IconMap = { BookOpen, Gamepad2, Heart };

export function k12Icons({ iconName, className }: { iconName: string; className?: string }) {
  const IconComponent = k12IconMap[iconName as keyof typeof k12IconMap];
  return IconComponent ? <IconComponent className={className} aria-hidden="true" /> : null;
}