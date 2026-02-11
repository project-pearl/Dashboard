export interface RemovalDisplayInfo {
  text: string;
  color: string;
  bgColor: string;
  shortText: string;
}

export function calculateRemovalDisplay(
  paramKey: string,
  influentValue: number,
  effluentValue: number,
  efficiency: number
): RemovalDisplayInfo {
  if (paramKey === 'DO') {
    const isPositive = efficiency > 0;
    return {
      text: `${isPositive ? '+' : ''}${efficiency.toFixed(1)}% improvement`,
      shortText: `${isPositive ? '+' : ''}${efficiency.toFixed(1)}%`,
      color: isPositive ? 'text-green-700' : 'text-red-700',
      bgColor: isPositive ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'
    };
  }

  if (paramKey === 'salinity') {
    const diff = Math.abs(influentValue - effluentValue);
    return {
      text: `${diff.toFixed(2)} ppt change`,
      shortText: `${diff.toFixed(1)} ppt Δ`,
      color: 'text-slate-700',
      bgColor: 'bg-slate-100 border-slate-300'
    };
  }

  const status = efficiency >= 80 ? 'excellent' : efficiency >= 60 ? 'good' : 'needs-improvement';
  return {
    text: `${efficiency.toFixed(1)}% removal`,
    shortText: `${efficiency.toFixed(1)}% ↓`,
    color: status === 'excellent' ? 'text-green-700' : status === 'good' ? 'text-yellow-700' : 'text-red-700',
    bgColor: status === 'excellent' ? 'bg-green-100 border-green-300' : status === 'good' ? 'bg-yellow-100 border-yellow-300' : 'bg-red-100 border-red-300'
  };
}
