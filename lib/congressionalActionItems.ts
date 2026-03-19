/**
 * Congressional Action Items Generator
 *
 * Transforms real congressional cache data into actionable items for
 * Federal Management Center briefing actions section.
 */

import { getAdvocacyCache, type CachedBill, type CachedHearing, type CachedCommentPeriod } from './advocacyCache';
import { getAllCongressBills, type CongressBill } from './congressCache';

export interface CongressionalActionItem {
  id: string;
  priority: 'High' | 'Medium' | 'Low';
  item: string;
  detail: string;
  color: string;
  type: 'bill' | 'hearing' | 'comment' | 'deadline';
  url?: string;
  daysUntil?: number;
}

/**
 * Generates dynamic congressional action items based on real data
 */
export function generateCongressionalActionItems(): CongressionalActionItem[] {
  const actionItems: CongressionalActionItem[] = [];

  // Get real data from caches
  const advocacyData = getAdvocacyCache();
  const congressBills = getAllCongressBills();

  if (!advocacyData && congressBills.length === 0) {
    // Fallback to mock data if no real data available
    return [
      {
        id: 'fallback-1',
        priority: 'High',
        item: 'Congressional cache data not available - contact system administrator',
        detail: 'Real congressional data feed requires Congress.gov API key configuration.',
        color: 'text-amber-700 bg-amber-50 border-amber-200',
        type: 'deadline'
      }
    ];
  }

  // Process advocacy cache data
  if (advocacyData) {
    // Urgent comment periods (< 14 days)
    const urgentComments = advocacyData.commentPeriods
      .filter(c => c.daysRemaining <= 14 && c.daysRemaining >= 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 2);

    urgentComments.forEach((comment, idx) => {
      const isVeryUrgent = comment.daysRemaining <= 7;
      actionItems.push({
        id: `comment-${idx}`,
        priority: isVeryUrgent ? 'High' : 'Medium',
        item: `${comment.agency} comment period closing in ${comment.daysRemaining} days: "${comment.title.substring(0, 60)}..."`,
        detail: `Comment period for ${comment.type.toLowerCase()} closes ${comment.closeDate}. Docket: ${comment.docketId}. Federal agencies should coordinate response through appropriate channels.`,
        color: isVeryUrgent ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200',
        type: 'comment',
        url: comment.url,
        daysUntil: comment.daysRemaining
      });
    });

    // Upcoming hearings (next 30 days)
    const upcomingHearings = advocacyData.hearings
      .filter(h => {
        const hearingDate = new Date(h.date);
        const now = new Date();
        const diffDays = Math.ceil((hearingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 30;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 2);

    upcomingHearings.forEach((hearing, idx) => {
      const hearingDate = new Date(hearing.date);
      const daysUntil = Math.ceil((hearingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      const isImminent = daysUntil <= 7;

      actionItems.push({
        id: `hearing-${idx}`,
        priority: isImminent ? 'High' : 'Medium',
        item: `${hearing.committee} ${hearing.type.toLowerCase()} in ${daysUntil} days: "${hearing.title.substring(0, 50)}..."`,
        detail: `Scheduled for ${hearing.date} at ${hearing.location}. Prepare briefing materials and coordinate testimony if EPA participation required.`,
        color: isImminent ? 'text-red-700 bg-red-50 border-red-200' : 'text-amber-700 bg-amber-50 border-amber-200',
        type: 'hearing',
        url: hearing.url,
        daysUntil
      });
    });

    // High-relevance active bills
    const activeBills = advocacyData.bills
      .filter(b => b.relevance === 'high')
      .filter(b => !b.status.toLowerCase().includes('enacted') && !b.status.toLowerCase().includes('vetoed'))
      .sort((a, b) => new Date(b.statusDate).getTime() - new Date(a.statusDate).getTime())
      .slice(0, 2);

    activeBills.forEach((bill, idx) => {
      const recentAction = new Date(bill.statusDate) > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

      actionItems.push({
        id: `bill-${idx}`,
        priority: recentAction ? 'Medium' : 'Low',
        item: `${bill.bill} - Active water quality legislation: "${bill.title.substring(0, 50)}..."`,
        detail: `Latest action (${bill.statusDate}): ${bill.status}. Chamber: ${bill.chamber}. Monitor for markup, committee action, or floor consideration.`,
        color: recentAction ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-700 bg-slate-50 border-slate-200',
        type: 'bill',
        url: bill.url
      });
    });
  }

  // Process congress cache bills (alternative/additional source)
  if (congressBills.length > 0 && actionItems.length < 3) {
    const recentBills = congressBills
      .filter(b => b.waterRelated)
      .filter(b => b.status !== 'enacted' && b.status !== 'vetoed')
      .sort((a, b) => new Date(b.latestActionDate).getTime() - new Date(a.latestActionDate).getTime())
      .slice(0, 2);

    recentBills.forEach((bill, idx) => {
      if (actionItems.some(item => item.item.includes(bill.billNumber))) return; // Avoid duplicates

      const isRecent = new Date(bill.latestActionDate) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      actionItems.push({
        id: `congress-${idx}`,
        priority: isRecent ? 'Medium' : 'Low',
        item: `${bill.billType} ${bill.billNumber} - ${bill.sponsor} (${bill.sponsorParty}-${bill.sponsorState}): "${bill.title.substring(0, 45)}..."`,
        detail: `Status: ${bill.status}. Latest action (${bill.latestActionDate}): ${bill.latestAction}. Subjects: ${bill.subjects.slice(0, 3).join(', ')}.`,
        color: isRecent ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-700 bg-slate-50 border-slate-200',
        type: 'bill',
        url: bill.url
      });
    });
  }

  // If no real data generated meaningful action items, provide informational item
  if (actionItems.length === 0) {
    actionItems.push({
      id: 'no-active',
      priority: 'Low',
      item: 'No urgent congressional action items at this time',
      detail: 'All water-related legislation, hearings, and comment periods are within normal timeframes. Continue monitoring for emerging issues.',
      color: 'text-green-700 bg-green-50 border-green-200',
      type: 'deadline'
    });
  }

  // Sort by priority and limit to top 3-4 items
  const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
  return actionItems
    .sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority])
    .slice(0, 4);
}

/**
 * Gets summary stats for congressional activity
 */
export function getCongressionalActivitySummary() {
  const advocacyData = getAdvocacyCache();
  const congressBills = getAllCongressBills();

  if (!advocacyData && congressBills.length === 0) {
    return {
      activeBills: 0,
      upcomingHearings: 0,
      urgentComments: 0,
      lastUpdated: null
    };
  }

  const urgentComments = advocacyData?.commentPeriods.filter(c => c.daysRemaining <= 14 && c.daysRemaining >= 0).length || 0;
  const upcomingHearings = advocacyData?.hearings.filter(h => {
    const hearingDate = new Date(h.date);
    const diffDays = Math.ceil((hearingDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).length || 0;

  const activeBills = (advocacyData?.bills.filter(b =>
    !b.status.toLowerCase().includes('enacted') &&
    !b.status.toLowerCase().includes('vetoed')
  ).length || 0) + congressBills.filter(b =>
    b.waterRelated && b.status !== 'enacted' && b.status !== 'vetoed'
  ).length;

  return {
    activeBills,
    upcomingHearings,
    urgentComments,
    lastUpdated: advocacyData?.meta.built || null
  };
}