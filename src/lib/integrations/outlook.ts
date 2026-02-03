// DispatchHub — Microsoft Outlook Integration (Graph API)
// Polls dispatch inbox for new emails → AI parser → intake queue

// SETUP:
// 1. Register app in Azure AD portal
// 2. Grant Mail.Read permission
// 3. Add AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET to .env

import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';

let graphClient: Client | null = null;

function getClient(): Client {
  if (!graphClient) {
    const credential = new ClientSecretCredential(
      process.env.AZURE_TENANT_ID!,
      process.env.AZURE_CLIENT_ID!,
      process.env.AZURE_CLIENT_SECRET!
    );
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default'],
    });
    graphClient = Client.initWithMiddleware({ authProvider });
  }
  return graphClient;
}

export interface OutlookEmail {
  id: string;
  subject: string;
  body: string;
  from: string;
  receivedAt: string;
}

// ── Poll for new emails ─────────────────────────────────────
// Called by background worker on interval (e.g., every 60 seconds)

export async function pollNewEmails(sinceDate?: Date): Promise<OutlookEmail[]> {
  const client = getClient();
  const inbox = process.env.OUTLOOK_INBOX_USER || 'dispatch@company.com';

  let filter = "isRead eq false";
  if (sinceDate) {
    filter += ` and receivedDateTime ge ${sinceDate.toISOString()}`;
  }

  const messages = await client
    .api(`/users/${inbox}/messages`)
    .filter(filter)
    .orderby('receivedDateTime desc')
    .top(20)
    .select('id,subject,body,from,receivedDateTime')
    .get();

  return messages.value.map((msg: any) => ({
    id: msg.id,
    subject: msg.subject || '',
    body: msg.body?.content || '',
    from: msg.from?.emailAddress?.address || '',
    receivedAt: msg.receivedDateTime,
  }));
}

// ── Mark email as read ──────────────────────────────────────

export async function markAsRead(messageId: string) {
  const client = getClient();
  const inbox = process.env.OUTLOOK_INBOX_USER || 'dispatch@company.com';
  await client.api(`/users/${inbox}/messages/${messageId}`).patch({ isRead: true });
}

// ── Send confirmation email ─────────────────────────────────

export async function sendConfirmationEmail(to: string, subject: string, htmlBody: string) {
  const client = getClient();
  const sender = process.env.OUTLOOK_INBOX_USER || 'dispatch@company.com';

  await client.api(`/users/${sender}/sendMail`).post({
    message: {
      subject,
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: true,
  });
}
