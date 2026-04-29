// src/services/slack/index.ts
export { slackService, default } from "./slackService";
export { userSlackPreferencesService } from "./userSlackPreferencesService";
export { webhookService } from "./webhookService";
export {
  findRecruitIntegration,
  findRecruitChannel,
  buildNewRecruitMessage,
  buildNpnReceivedMessage,
  checkNotificationSent,
  sendRecruitNotification,
  autoPostRecruitNotification,
} from "./recruitNotificationService";
