#!/usr/bin/env npx tsx
/**
 * MS4 Contact Enrichment Script
 *
 * Reads md_ms4_contacts.xlsx (all 4 sheets), extracts domains from Website
 * columns, queries Hunter.io for email contacts, preserves existing data,
 * and writes enriched results to a combined CSV + updated XLSX.
 *
 * Usage:
 *   npx tsx scripts/ms4-contacts/enrich.ts <input-file> [--dry-run] [--sheet <name>]
 *
 * Output:
 *   scripts/ms4-contacts/output/enriched-<timestamp>.csv
 *   scripts/ms4-contacts/output/enriched-<timestamp>.xlsx
 */

import fs from 'fs';
import path from 'path';

// ── Load .env ───────────────────────────────────────────────────────────

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) process.env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
}

const APOLLO_KEY = process.env.APOLLO_API_KEY ?? '';
const HUNTER_KEY = process.env.HUNTER_API_KEY ?? '';

// ── Types ───────────────────────────────────────────────────────────────

interface SheetRow {
  sheet: string;
  organization: string;
  phase: string;
  type: string;         // County, Municipal, State, Federal, MDE
  department: string;
  existingContact: string;
  existingTitle: string;
  existingPhone: string;
  existingEmail: string;
  domain: string;       // extracted from Website/Dept Website column
  linkedinUrl: string;
  population: string;
  permitStatus: string;
  notes: string;
}

interface EnrichedContact {
  sheet: string;
  organization: string;
  phase: string;
  type: string;
  department: string;
  name: string;
  title: string;
  email: string;
  emailVerified: string;
  emailConfidence: string;
  phone: string;
  linkedin: string;
  domain: string;
  population: string;
  source: string;       // Existing, Hunter, Apollo
  needsEnrichment: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/** Extract bare domain from URL string */
function extractDomain(url: string): string {
  if (!url) return '';
  try {
    const cleaned = url.startsWith('http') ? url : `https://${url}`;
    return new URL(cleaned).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

// ── Read All Sheets ─────────────────────────────────────────────────────

function readAllSheets(filePath: string): SheetRow[] {
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(filePath);
  const all: SheetRow[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const records: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    for (const row of records) {
      const keys = Object.keys(row);

      // Detect org name column
      const orgKey = keys.find(k => /^(jurisdiction|municipality|entity|name)$/i.test(k.trim()));
      const org = String(row[orgKey ?? keys[0]] ?? '').trim();
      if (!org) continue;

      // Detect other columns flexibly
      const get = (patterns: RegExp) => {
        const k = keys.find(k2 => patterns.test(k2.trim()));
        return k ? String(row[k] ?? '').trim() : '';
      };

      const websiteUrl = get(/^(department website|website|ms4 page)$/i);
      const domain = extractDomain(websiteUrl);

      // Determine type from sheet name
      let type = '';
      if (sheetName.includes('Counties')) type = 'County';
      else if (sheetName.includes('Municipal')) type = 'Municipal';
      else if (sheetName.includes('State & Federal')) type = get(/^type$/i) || 'State/Federal';
      else if (sheetName.includes('MDE')) type = 'MDE';

      all.push({
        sheet: sheetName,
        organization: org,
        phase: get(/^phase$/i),
        type,
        department: get(/^(lead department|division)$/i),
        existingContact: get(/^(director.*key contact|key contact|name)$/i),
        existingTitle: get(/^title$/i),
        existingPhone: get(/^phone$/i),
        existingEmail: get(/^email$/i),
        domain,
        linkedinUrl: get(/linkedin/i),
        population: get(/^population/i),
        permitStatus: get(/^permit status$/i),
        notes: get(/^notes$/i),
      });
    }
  }

  return all;
}

// ── Hunter.io API ───────────────────────────────────────────────────────

async function hunterDomainSearch(domain: string, orgName: string): Promise<{
  emails: Array<{ name: string; title: string; email: string; verified: string; confidence: string; phone: string; linkedin: string }>;
  organization: string;
  webmail: boolean;
}> {
  if (!HUNTER_KEY || !domain) return { emails: [], organization: '', webmail: false };

  // First try without department filter to get more results
  const url = new URL('https://api.hunter.io/v2/domain-search');
  url.searchParams.set('domain', domain);
  url.searchParams.set('api_key', HUNTER_KEY);
  url.searchParams.set('limit', '10');

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) {
      console.error(`  Hunter: Rate limited. Waiting 10s...`);
      await sleep(10000);
      return hunterDomainSearch(domain, orgName); // retry once
    }
    console.error(`  Hunter domain search failed (${res.status}): ${text.slice(0, 100)}`);
    return { emails: [], organization: '', webmail: false };
  }

  const json = await res.json();
  const data = json.data ?? {};
  const emails = (data.emails ?? []).map((e: any) => ({
    name: [e.first_name, e.last_name].filter(Boolean).join(' '),
    title: e.position ?? e.department ?? '',
    email: e.value ?? '',
    verified: e.verification?.status ?? '',
    confidence: String(e.confidence ?? ''),
    phone: e.phone_number ?? '',
    linkedin: e.linkedin ?? '',
  }));

  return {
    emails,
    organization: data.organization ?? orgName,
    webmail: data.webmail ?? false,
  };
}

async function hunterEmailFinder(domain: string, firstName: string, lastName: string): Promise<{
  email: string; verified: string; confidence: string;
} | null> {
  if (!HUNTER_KEY || !domain || !firstName) return null;

  const url = new URL('https://api.hunter.io/v2/email-finder');
  url.searchParams.set('domain', domain);
  url.searchParams.set('first_name', firstName);
  url.searchParams.set('last_name', lastName);
  url.searchParams.set('api_key', HUNTER_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const json = await res.json();
  const d = json.data;
  if (!d?.email) return null;

  return {
    email: d.email,
    verified: d.verification?.status ?? '',
    confidence: String(d.score ?? ''),
  };
}

async function hunterVerifyEmail(email: string): Promise<{ status: string; score: number }> {
  if (!HUNTER_KEY || !email) return { status: '', score: 0 };

  const url = new URL('https://api.hunter.io/v2/email-verifier');
  url.searchParams.set('email', email);
  url.searchParams.set('api_key', HUNTER_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) return { status: 'error', score: 0 };

  const json = await res.json();
  return {
    status: json.data?.status ?? 'unknown',
    score: json.data?.score ?? 0,
  };
}

// ── Apollo.io API ───────────────────────────────────────────────────────

async function apolloSearchOrg(orgName: string): Promise<Array<{
  name: string; title: string; email: string; verified: string; phone: string; linkedin: string;
}>> {
  if (!APOLLO_KEY) return [];

  const orgRes = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    body: JSON.stringify({
      api_key: APOLLO_KEY,
      q_organization_name: orgName,
      organization_locations: ['Maryland'],
      page: 1,
      per_page: 1,
    }),
  });

  if (!orgRes.ok) return [];
  const orgData = await orgRes.json();
  const org = orgData.organizations?.[0] ?? orgData.accounts?.[0];
  if (!org) return [];

  const domain = org.primary_domain || '';

  const peopleRes = await fetch('https://api.apollo.io/v1/mixed_people/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
    body: JSON.stringify({
      api_key: APOLLO_KEY,
      q_organization_domains: domain ? [domain] : undefined,
      q_organization_name: !domain ? orgName : undefined,
      person_titles: ['stormwater', 'MS4', 'environmental', 'public works', 'watershed', 'water resources'],
      page: 1,
      per_page: 5,
    }),
  });

  if (!peopleRes.ok) return [];
  const peopleData = await peopleRes.json();

  return (peopleData.people ?? []).map((p: any) => ({
    name: [p.first_name, p.last_name].filter(Boolean).join(' '),
    title: p.title ?? '',
    email: p.email ?? '',
    verified: p.email_status === 'verified' ? 'valid' : p.email_status ?? '',
    phone: p.phone_numbers?.[0]?.sanitized_number ?? '',
    linkedin: p.linkedin_url ?? '',
  }));
}

// ── CSV + XLSX Output ───────────────────────────────────────────────────

function toCsv(contacts: EnrichedContact[]): string {
  const headers = [
    'Sheet', 'Organization', 'Phase', 'Type', 'Department',
    'Name', 'Title', 'Email', 'Email Verified', 'Confidence',
    'Phone', 'LinkedIn', 'Domain', 'Population', 'Source', 'Needs Enrichment',
  ];

  const escape = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const rows = contacts.map(c => [
    c.sheet, c.organization, c.phase, c.type, c.department,
    c.name, c.title, c.email, c.emailVerified, c.emailConfidence,
    c.phone, c.linkedin, c.domain, c.population, c.source, c.needsEnrichment,
  ].map(escape).join(','));

  return [headers.join(','), ...rows].join('\n');
}

function writeXlsx(contacts: EnrichedContact[], outPath: string) {
  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();

  // Group by sheet
  const sheets = new Map<string, EnrichedContact[]>();
  for (const c of contacts) {
    const arr = sheets.get(c.sheet) ?? [];
    arr.push(c);
    sheets.set(c.sheet, arr);
  }

  for (const [sheetName, rows] of sheets) {
    const data = rows.map(c => ({
      Organization: c.organization,
      Phase: c.phase,
      Type: c.type,
      Department: c.department,
      Name: c.name,
      Title: c.title,
      Email: c.email,
      'Email Verified': c.emailVerified,
      Confidence: c.emailConfidence,
      Phone: c.phone,
      LinkedIn: c.linkedin,
      Domain: c.domain,
      Population: c.population,
      Source: c.source,
      'Needs Enrichment': c.needsEnrichment,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    // Auto-width columns
    const colWidths = Object.keys(data[0] ?? {}).map(k => ({
      wch: Math.max(k.length, ...data.map(r => String((r as any)[k] ?? '').length).slice(0, 20)) + 2,
    }));
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  }

  // Also add a combined "All Contacts" sheet
  const allData = contacts.map(c => ({
    Sheet: c.sheet,
    Organization: c.organization,
    Phase: c.phase,
    Type: c.type,
    Department: c.department,
    Name: c.name,
    Title: c.title,
    Email: c.email,
    'Email Verified': c.emailVerified,
    Confidence: c.emailConfidence,
    Phone: c.phone,
    LinkedIn: c.linkedin,
    Domain: c.domain,
    Source: c.source,
  }));
  const allWs = XLSX.utils.json_to_sheet(allData);
  XLSX.utils.book_append_sheet(wb, allWs, 'All Contacts');

  XLSX.writeFile(wb, outPath);
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const inputFile = args.find(a => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const sheetFilter = args.includes('--sheet') ? args[args.indexOf('--sheet') + 1] : null;

  if (!inputFile) {
    console.log(`
MS4 Contact Enrichment Tool
============================
Usage:  npx tsx scripts/ms4-contacts/enrich.ts <input-file> [--dry-run] [--sheet "Phase I - Counties"]

Reads all sheets from the MD MS4 contacts workbook, enriches missing contacts
via Hunter.io (domain search + email finder) and optionally Apollo.io.

Output: scripts/ms4-contacts/output/enriched-<timestamp>.csv + .xlsx
`);
    process.exit(0);
  }

  const resolvedInput = path.resolve(inputFile);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`File not found: ${resolvedInput}`);
    process.exit(1);
  }

  console.log(`Reading: ${resolvedInput}`);
  let rows = readAllSheets(resolvedInput);
  if (sheetFilter) {
    rows = rows.filter(r => r.sheet.includes(sheetFilter));
  }
  console.log(`Found ${rows.length} organizations across ${new Set(rows.map(r => r.sheet)).size} sheet(s)\n`);

  const needsEnrichment = rows.filter(r => !r.existingEmail);
  const alreadyHasData = rows.filter(r => !!r.existingEmail);
  console.log(`  Already have email: ${alreadyHasData.length}`);
  console.log(`  Needs enrichment:   ${needsEnrichment.length}`);

  if (!APOLLO_KEY && !HUNTER_KEY) {
    console.error('\nNo API keys configured. Add them to scripts/ms4-contacts/.env');
    process.exit(1);
  }

  console.log(`\nAPIs: ${APOLLO_KEY ? 'Apollo.io' : ''}${APOLLO_KEY && HUNTER_KEY ? ' + ' : ''}${HUNTER_KEY ? 'Hunter.io' : ''}`);
  if (dryRun) console.log('(DRY RUN — no API calls)\n');
  console.log('');

  const allContacts: EnrichedContact[] = [];
  let hunterSearches = 0;
  let hunterFinds = 0;
  let hunterVerifications = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    console.log(`[${i + 1}/${rows.length}] ${row.organization} (${row.sheet})`);

    // If existing data, preserve it
    if (row.existingEmail) {
      console.log(`  Existing: ${row.existingContact || '(no name)'} <${row.existingEmail}>`);

      // Optionally verify existing email
      let verified = '';
      if (!dryRun && HUNTER_KEY && row.existingEmail.includes('@')) {
        const v = await hunterVerifyEmail(row.existingEmail);
        verified = v.status;
        hunterVerifications++;
        console.log(`  Verify: ${verified} (score: ${v.score})`);
        await sleep(500);
      }

      allContacts.push({
        sheet: row.sheet,
        organization: row.organization,
        phase: row.phase,
        type: row.type,
        department: row.department,
        name: row.existingContact,
        title: row.existingTitle,
        email: row.existingEmail,
        emailVerified: verified || 'not checked',
        emailConfidence: '',
        phone: row.existingPhone,
        linkedin: row.linkedinUrl,
        domain: row.domain,
        population: row.population,
        source: 'Existing',
        needsEnrichment: 'No',
      });
      continue;
    }

    // Needs enrichment
    if (dryRun) {
      allContacts.push({
        sheet: row.sheet, organization: row.organization, phase: row.phase,
        type: row.type, department: row.department,
        name: '(dry run)', title: '', email: '', emailVerified: '', emailConfidence: '',
        phone: row.existingPhone, linkedin: row.linkedinUrl, domain: row.domain,
        population: row.population, source: 'dry-run', needsEnrichment: 'Yes',
      });
      continue;
    }

    let foundContacts = 0;

    // Hunter.io domain search
    if (HUNTER_KEY && row.domain) {
      const result = await hunterDomainSearch(row.domain, row.organization);
      hunterSearches++;

      if (result.webmail) {
        console.log(`  Hunter: ${row.domain} is a webmail domain, skipping`);
      } else if (result.emails.length > 0) {
        console.log(`  Hunter: ${result.emails.length} contacts found`);
        for (const e of result.emails) {
          allContacts.push({
            sheet: row.sheet, organization: row.organization, phase: row.phase,
            type: row.type, department: row.department,
            name: e.name, title: e.title, email: e.email,
            emailVerified: e.verified, emailConfidence: e.confidence,
            phone: e.phone || row.existingPhone, linkedin: e.linkedin || row.linkedinUrl,
            domain: row.domain, population: row.population,
            source: 'Hunter', needsEnrichment: 'Enriched',
          });
          foundContacts++;
          hunterFinds++;
        }
      } else {
        console.log(`  Hunter: No results for ${row.domain}`);
      }

      await sleep(1200); // Hunter free tier rate limit
    }

    // Try Hunter email-finder if we have an existing contact name but no email
    if (HUNTER_KEY && row.domain && row.existingContact && foundContacts === 0) {
      const nameParts = row.existingContact.replace(/\(.*\)/, '').trim().split(/\s+/);
      if (nameParts.length >= 2) {
        const found = await hunterEmailFinder(row.domain, nameParts[0], nameParts[nameParts.length - 1]);
        if (found) {
          console.log(`  Hunter email-finder: ${found.email} (${found.verified})`);
          allContacts.push({
            sheet: row.sheet, organization: row.organization, phase: row.phase,
            type: row.type, department: row.department,
            name: row.existingContact, title: row.existingTitle, email: found.email,
            emailVerified: found.verified, emailConfidence: found.confidence,
            phone: row.existingPhone, linkedin: row.linkedinUrl,
            domain: row.domain, population: row.population,
            source: 'Hunter (email-finder)', needsEnrichment: 'Enriched',
          });
          foundContacts++;
          hunterFinds++;
        }
        await sleep(1000);
      }
    }

    // Apollo fallback
    if (APOLLO_KEY && foundContacts === 0) {
      const people = await apolloSearchOrg(row.organization);
      if (people.length > 0) {
        console.log(`  Apollo: ${people.length} contacts found`);
        for (const p of people) {
          allContacts.push({
            sheet: row.sheet, organization: row.organization, phase: row.phase,
            type: row.type, department: row.department,
            name: p.name, title: p.title, email: p.email,
            emailVerified: p.verified, emailConfidence: '',
            phone: p.phone || row.existingPhone, linkedin: p.linkedin || row.linkedinUrl,
            domain: row.domain, population: row.population,
            source: 'Apollo', needsEnrichment: 'Enriched',
          });
          foundContacts++;
        }
      }
      await sleep(1000);
    }

    // If nothing found, add a stub row so we don't lose the org
    if (foundContacts === 0) {
      console.log(`  No contacts found — added as stub`);
      allContacts.push({
        sheet: row.sheet, organization: row.organization, phase: row.phase,
        type: row.type, department: row.department,
        name: row.existingContact, title: row.existingTitle, email: '',
        emailVerified: '', emailConfidence: '',
        phone: row.existingPhone, linkedin: row.linkedinUrl,
        domain: row.domain, population: row.population,
        source: 'None', needsEnrichment: 'Yes - Manual',
      });
    }
  }

  // Write output
  const outDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csvPath = path.join(outDir, `enriched-${timestamp}.csv`);
  const xlsxPath = path.join(outDir, `enriched-${timestamp}.xlsx`);

  fs.writeFileSync(csvPath, toCsv(allContacts), 'utf-8');
  writeXlsx(allContacts, xlsxPath);

  // Summary
  const withEmail = allContacts.filter(c => c.email).length;
  const verified = allContacts.filter(c => c.emailVerified === 'valid').length;
  const enriched = allContacts.filter(c => c.source !== 'Existing' && c.source !== 'None' && c.source !== 'dry-run').length;
  const manual = allContacts.filter(c => c.needsEnrichment === 'Yes - Manual').length;

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Done! ${allContacts.length} contact rows written to:`);
  console.log(`  CSV:  ${csvPath}`);
  console.log(`  XLSX: ${xlsxPath}`);
  console.log(`\nSummary:`);
  console.log(`  Organizations processed: ${rows.length}`);
  console.log(`  Existing contacts kept:  ${alreadyHasData.length}`);
  console.log(`  Newly enriched:          ${enriched}`);
  console.log(`  With email:              ${withEmail}`);
  console.log(`  Email verified:          ${verified}`);
  console.log(`  Still need manual:       ${manual}`);
  console.log(`\nHunter.io usage:`);
  console.log(`  Domain searches:  ${hunterSearches}`);
  console.log(`  Contacts found:   ${hunterFinds}`);
  console.log(`  Verifications:    ${hunterVerifications}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
