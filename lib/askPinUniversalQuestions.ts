// ── Role-specific suggested questions for Ask PIN Universal ──────────────────

export const UNIVERSAL_SUGGESTED_QUESTIONS: Record<string, string[]> = {
  Federal: [
    'What do I need to know right now?',
    'Which states need immediate attention?',
    'What are the biggest compliance gaps nationally?',
    'What trends should I brief leadership on?',
  ],
  'Federal+Military': [
    'Are there threats to any installations?',
    'What PFAS issues affect bases?',
    'What CISA advisories affect water infrastructure?',
    'What is the compliance posture across installations?',
  ],
  State: [
    'What changed in my state since yesterday?',
    'What are my biggest compliance risks?',
    'Which systems have new violations?',
    'What TMDL deadlines are approaching?',
  ],
  MS4: [
    'What permit deadlines are approaching?',
    'What is my compliance status?',
    'Are there new impairments in my jurisdiction?',
    'What BMP inspections are overdue?',
  ],
  Local: [
    'What should I brief the council about?',
    'What funding is available?',
    'Have any permits changed status?',
    'What are the key water quality issues in my area?',
  ],
  K12: [
    'How clean is the water near our school?',
    'How can students help protect water?',
    'What cool water facts should I know?',
    'What science experiments can we do with water data?',
  ],
  College: [
    'What data anomalies are worth investigating?',
    'What research questions does the data suggest?',
    'How does data quality vary across monitoring networks?',
    'What statistical trends are emerging?',
  ],
  Researcher: [
    'What statistical anomalies appear in recent data?',
    'What data quality issues should I be aware of?',
    'What patterns are emerging across monitoring sites?',
    'How do current conditions compare to historical baselines?',
  ],
  Corporate: [
    'What is my portfolio water risk exposure?',
    'What regulatory changes affect operations?',
    'What ESG metrics should I report on?',
    'Are there supply chain water risks emerging?',
  ],
  NGO: [
    'Which communities face the greatest water burdens?',
    'What advocacy opportunities exist?',
    'Where are environmental justice concerns highest?',
    'What public health risks are linked to water quality?',
  ],
  Utility: [
    'What is the current compliance status?',
    'Are there source water concerns?',
    'What infrastructure issues need attention?',
    'What regulatory deadlines are approaching?',
  ],
  Biotech: [
    'What contamination risks affect our supply?',
    'How does water quality compare to GMP requirements?',
    'Are there emerging contaminants near our facilities?',
    'What regulatory changes affect water purity standards?',
  ],
  Investor: [
    'What water risks affect my portfolio?',
    'What infrastructure investment opportunities exist?',
    'Which utilities face the most regulatory pressure?',
    'What are the ESG water metrics trending?',
  ],
  Agriculture: [
    'What is the irrigation water quality status?',
    'Are there nutrient runoff concerns?',
    'What nonpoint source issues affect my region?',
    'What best management practices are recommended?',
  ],
  Lab: [
    'What QA/QC issues are flagged in recent data?',
    'Are there method compliance concerns?',
    'What data validation alerts are active?',
    'How do lab results compare across networks?',
  ],
  Pearl: [
    'What is system health status?',
    'Which cron jobs have recent failures?',
    'Are any data sources degraded or offline?',
    'What is the current cache build status?',
  ],
  Temp: [
    'What is the national water quality overview?',
    'What are the biggest water quality concerns?',
    'How does water quality monitoring work?',
    'What data sources does this dashboard use?',
  ],
};
