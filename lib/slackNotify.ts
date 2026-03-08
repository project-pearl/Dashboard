/**
 * Slack webhook notification for cron failures.
 * Fire-and-forget — never throws, never blocks the caller.
 */

interface CronFailurePayload {
  cronName: string;
  error: string;
  duration?: number;
}

export function notifySlackCronFailure({ cronName, error, duration }: CronFailurePayload): void {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const env = process.env.VERCEL_ENV || 'development';
  const ts = new Date().toISOString();

  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `Cron Failure: ${cronName}`, emoji: true },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Error:*\n\`${error.slice(0, 200)}\`` },
          { type: 'mrkdwn', text: `*Environment:*\n${env}` },
          ...(duration != null
            ? [{ type: 'mrkdwn', text: `*Duration:*\n${(duration / 1000).toFixed(1)}s` }]
            : []),
          { type: 'mrkdwn', text: `*Timestamp:*\n${ts}` },
        ],
      },
    ],
  };

  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    // Silent — webhook failure should never impact cron execution
  });
}
