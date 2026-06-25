export {
  socialTemplateService,
  type SocialTemplate,
  type CreateSocialTemplateInput,
} from "./socialTemplateService";
export {
  readFileAsDataUrl,
  uploadAgentPhoto,
  uploadGeneratedPost,
  uploadCarouselSlides,
  uploadScheduledPost,
  removeScheduledPost,
  removeAgentPhoto,
  type UploadedAgentPhoto,
} from "./spotlightAssetService";
export {
  publishToInstagram,
  type PublishResult,
  type PublishMediaType,
  type PublishOptions,
} from "./instagramPublishService";
export {
  schedulePost,
  cancelScheduledPost,
  getScheduledPosts,
  type SchedulePostInput,
} from "./scheduledPostService";
export {
  generateSocialCaption,
  type CaptionContext,
} from "./socialCaptionService";
export {
  generateMarketingCopy,
  type MarketingCopyRequest,
  type MarketingCopyResult,
  type MarketingCopyVariant,
} from "./socialMarketingCopyService";
export {
  socialDeckService,
  type DeckSlideSpec,
  type DeckSpec,
  type DeckSummary,
  type LoadedDeck,
  type SaveDeckInput,
} from "./socialDeckService";
