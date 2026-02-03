// DispatchHub — RingCentral Integration
// Drop-in replacement for twilio.ts
// Handles: inbound call recording/transcription, outbound auto-callback, SMS
//
// SETUP:
// 1. Go to https://developers.ringcentral.com → Create App
// 2. App Type: "REST API App" with Server/Web permissions
// 3. Permissions needed: ReadMessages, SMS, InternalMessages, ReadCallLog,
//    ReadCallRecording, RingOut, SubscriptionWebhook
// 4. Generate a JWT credential for your user
// 5. Add RC_CLIENT_ID, RC_CLIENT_SECRET, RC_SERVER_URL, RC_JWT,
//    RC_PHONE_NUMBER to .env.local

import { SDK } from '@ringcentral/sdk';

// ── SINGLETON SDK INSTANCE ──────────────────────────────────

let rcsdk: SDK | null = null;

function getSDK(): SDK {
  if (!rcsdk) {
    rcsdk = new SDK({
      server: process.env.RC_SERVER_URL!,     // 'https://platform.ringcentral.com' for production
      clientId: process.env.RC_CLIENT_ID!,
      clientSecret: process.env.RC_CLIENT_SECRET!,
    });
  }
  return rcsdk;
}

async function getPlatform() {
  const sdk = getSDK();
  const platform = sdk.platform();

  // Check if already logged in
  const isLoggedIn = await platform.loggedIn();
  if (!isLoggedIn) {
    await platform.login({ jwt: process.env.RC_JWT! });
  }

  return platform;
}


// ── OUTBOUND CALL (Auto-Callback via RingOut) ───────────────
// RingOut places a call FROM your RC number TO the customer
// The dispatcher's phone rings first, then connects to customer
// For fully automated (no dispatcher pickup), use the IVR approach below

export interface RingOutResult {
  id: string;
  status: string;
}

export async function placeConfirmationCall(
  toNumber: string,
  fromNumber?: string
): Promise<RingOutResult> {
  const platform = await getPlatform();

  const resp = await platform.post(
    '/restapi/v1.0/account/~/extension/~/ring-out',
    {
      from: { phoneNumber: fromNumber || process.env.RC_PHONE_NUMBER! },
      to: { phoneNumber: toNumber },
      playPrompt: true,   // Play connecting prompt
      callerId: { phoneNumber: process.env.RC_PHONE_NUMBER! },
    }
  );

  const data = await resp.json();
  return {
    id: data.id,
    status: data.status?.callStatus || 'Unknown',
  };
}

// Check RingOut call status
export async function getRingOutStatus(ringOutId: string): Promise<string> {
  const platform = await getPlatform();
  const resp = await platform.get(
    `/restapi/v1.0/account/~/extension/~/ring-out/${ringOutId}`
  );
  const data = await resp.json();
  return data.status?.callStatus || 'Unknown';
}


// ── SMS ─────────────────────────────────────────────────────

export interface SmsResult {
  id: string;
  messageStatus: string;
}

export async function sendSms(
  toNumber: string,
  text: string,
  fromNumber?: string
): Promise<SmsResult> {
  const platform = await getPlatform();

  const resp = await platform.post(
    '/restapi/v1.0/account/~/extension/~/sms',
    {
      from: { phoneNumber: fromNumber || process.env.RC_PHONE_NUMBER! },
      to: [{ phoneNumber: toNumber }],
      text,
    }
  );

  const data = await resp.json();
  return {
    id: data.id,
    messageStatus: data.messageStatus,
  };
}


// ── CALL LOG + RECORDINGS ───────────────────────────────────
// Fetch recent inbound call recordings for intake processing

export interface CallRecord {
  id: string;
  direction: 'Inbound' | 'Outbound';
  from: string;
  to: string;
  startTime: string;
  duration: number;
  recordingId?: string;
  recordingUrl?: string;
}

export async function getRecentInboundCalls(
  sinceDate?: Date,
  limit: number = 20
): Promise<CallRecord[]> {
  const platform = await getPlatform();

  const params: Record<string, any> = {
    direction: 'Inbound',
    type: 'Voice',
    view: 'Detailed',
    withRecording: true,
    perPage: limit,
  };

  if (sinceDate) {
    params.dateFrom = sinceDate.toISOString();
  }

  const resp = await platform.get(
    '/restapi/v1.0/account/~/extension/~/call-log',
    params
  );

  const data = await resp.json();

  return (data.records || []).map((rec: any) => ({
    id: rec.id,
    direction: rec.direction,
    from: rec.from?.phoneNumber || rec.from?.name || '',
    to: rec.to?.phoneNumber || rec.to?.name || '',
    startTime: rec.startTime,
    duration: rec.duration,
    recordingId: rec.recording?.id,
    recordingUrl: rec.recording?.contentUri,
  }));
}

// Download a call recording as audio buffer
export async function getRecordingContent(recordingId: string): Promise<Buffer> {
  const platform = await getPlatform();

  const resp = await platform.get(
    `/restapi/v1.0/account/~/recording/${recordingId}/content`
  );

  const ab = await (resp as unknown as { arrayBuffer(): Promise<ArrayBuffer> }).arrayBuffer();
  return Buffer.from(ab);
}

// Get recording URL (authenticated — needs token in header)
export async function getRecordingUrl(recordingId: string): Promise<string> {
  const platform = await getPlatform();
  const tokenData = await platform.auth().data();
  const accessToken = tokenData.access_token;

  // RingCentral recording URLs require auth token as query param or header
  return `/restapi/v1.0/account/~/recording/${recordingId}/content?access_token=${accessToken}`;
}


// ── WEBHOOK SUBSCRIPTION ────────────────────────────────────
// Subscribe to inbound call/SMS events so RC pushes to your webhook
// Call this once during app startup

export async function subscribeToInboundEvents(webhookUrl: string) {
  const platform = await getPlatform();

  const resp = await platform.post('/restapi/v1.0/subscription', {
    eventFilters: [
      '/restapi/v1.0/account/~/extension/~/message-store/instant?type=SMS',
      '/restapi/v1.0/account/~/extension/~/message-store/instant?type=VoiceMail',
      '/restapi/v1.0/account/~/extension/~/telephony/sessions',
    ],
    deliveryMode: {
      transportType: 'WebHook',
      address: webhookUrl,
    },
    expiresIn: 630720000, // Max: ~20 years (RC will still expire and need renewal)
  });

  const data = await resp.json();
  return {
    subscriptionId: data.id,
    expiresAt: data.expirationTime,
    status: data.status,
  };
}


// ── MESSAGE STORE (Read incoming SMS) ───────────────────────
// For polling-based intake (alternative to webhooks)

export interface InboundSms {
  id: string;
  from: string;
  text: string;
  receivedAt: string;
}

export async function getUnreadSmsMessages(limit: number = 20): Promise<InboundSms[]> {
  const platform = await getPlatform();

  const resp = await platform.get(
    '/restapi/v1.0/account/~/extension/~/message-store',
    {
      messageType: 'SMS',
      direction: 'Inbound',
      readStatus: 'Unread',
      perPage: limit,
    }
  );

  const data = await resp.json();

  return (data.records || []).map((msg: any) => ({
    id: msg.id,
    from: msg.from?.phoneNumber || '',
    text: msg.subject || '',
    receivedAt: msg.creationTime,
  }));
}

// Mark SMS as read after processing
export async function markMessageAsRead(messageId: string) {
  const platform = await getPlatform();
  await platform.put(
    `/restapi/v1.0/account/~/extension/~/message-store/${messageId}`,
    { readStatus: 'Read' }
  );
}
