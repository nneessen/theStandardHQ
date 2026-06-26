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
  uploadScheduledCarousel,
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
  scheduleCarousel,
  cancelScheduledPost,
  getScheduledPosts,
  type SchedulePostInput,
  type ScheduleCarouselInput,
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
  composeCarousel,
  generateCarouselCaption,
  type ComposedSlide,
  type ComposeVariant,
  type ComposeView,
  type ComposeCarouselRequest,
  type ComposeCarouselResult,
  type CaptionSlideDescriptor,
  type GenerateCarouselCaptionRequest,
} from "./socialCarouselComposeService";
export {
  socialDeckService,
  type DeckSlideSpec,
  type DeckSpec,
  type DeckSummary,
  type LoadedDeck,
  type SaveDeckInput,
} from "./socialDeckService";
