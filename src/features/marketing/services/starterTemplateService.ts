import type { StarterTemplate } from "../types/marketing.types";
import type { EmailBlock } from "@/types/email.types";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Modern Newsletter
// ─────────────────────────────────────────────────────────────────────────────
const modernNewsletterBlocks: EmailBlock[] = [
  {
    id: "a1b2c3d4-0001-4000-8000-000000000001",
    type: "header",
    content: {
      type: "header",
      title: "The Monthly Brief",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#0f172a",
      textColor: "#f8fafc",
      padding: "24px 32px",
      alignment: "center",
      fontSize: "22px",
      fontWeight: "700",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000002",
    type: "image",
    content: {
      type: "image",
      src: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&q=80",
      alt: "Newsletter hero image",
      width: 100,
    },
    styles: {
      padding: "0",
    },
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000003",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: {},
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000004",
    type: "text",
    content: {
      type: "text",
      html: "<h2 style=\"font-size:18px;font-weight:600;margin:0 0 8px 0;color:#0f172a;\">What's new this month</h2><p style=\"color:#475569;line-height:1.6;\">Welcome back to our monthly roundup. Here's everything you need to know about what's been happening and what's coming up.</p>",
    },
    styles: {
      padding: "0 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000005",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: {},
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000006",
    type: "columns",
    content: {
      type: "columns",
      columnCount: 2,
      gap: 16,
      columns: [
        {
          blocks: [
            {
              id: "a1b2c3d4-0001-4000-8000-000000000007",
              type: "text",
              content: {
                type: "text",
                html: '<h3 style="font-size:14px;font-weight:600;color:#0f172a;margin:0 0 6px 0;">Industry Insights</h3><p style="font-size:13px;color:#475569;line-height:1.6;margin:0;">Market trends indicate strong growth in Q1. Our team has been tracking the key indicators that matter most to your business.</p>',
              },
              styles: {
                backgroundColor: "#f8fafc",
                padding: "16px",
                borderRadius: "6px",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "a1b2c3d4-0001-4000-8000-000000000008",
              type: "text",
              content: {
                type: "text",
                html: '<h3 style="font-size:14px;font-weight:600;color:#0f172a;margin:0 0 6px 0;">Team Updates</h3><p style="font-size:13px;color:#475569;line-height:1.6;margin:0;">Three new team members joined this month. We\'re expanding our support hours and launching new tools to better serve you.</p>',
              },
              styles: {
                backgroundColor: "#f8fafc",
                padding: "16px",
                borderRadius: "6px",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
      ],
    },
    styles: {
      padding: "0 32px",
    },
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000009",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: {},
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000010",
    type: "button",
    content: {
      type: "button",
      text: "Read the Full Story",
      url: "#",
      buttonColor: "#0f172a",
      textColor: "#ffffff",
      variant: "solid",
    },
    styles: {
      padding: "0 32px 0 32px",
      alignment: "center",
      borderRadius: "6px",
    },
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000011",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: {},
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000012",
    type: "divider",
    content: {
      type: "divider",
      color: "#e2e8f0",
      thickness: 1,
      style: "solid",
    },
    styles: {},
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000013",
    type: "social",
    content: {
      type: "social",
      iconSize: 20,
      iconStyle: "filled",
      links: [
        { platform: "facebook", url: "#", enabled: true },
        { platform: "twitter", url: "#", enabled: true },
        { platform: "instagram", url: "#", enabled: true },
      ],
    },
    styles: {
      padding: "16px 32px",
      alignment: "center",
    },
  },
  {
    id: "a1b2c3d4-0001-4000-8000-000000000014",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company. 123 Main Street, Suite 100, New York, NY 10001\nYou received this email because you subscribed to our newsletter.",
      showUnsubscribe: true,
    },
    styles: {
      backgroundColor: "#f8fafc",
      textColor: "#94a3b8",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. Product Announcement
// ─────────────────────────────────────────────────────────────────────────────
const productAnnouncementBlocks: EmailBlock[] = [
  {
    id: "b2c3d4e5-0002-4000-8000-000000000001",
    type: "header",
    content: {
      type: "header",
      title: "Introducing Something New",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#6366f1",
      textColor: "#ffffff",
      padding: "32px",
      alignment: "center",
      fontSize: "24px",
      fontWeight: "700",
      fontFamily: "'Poppins', sans-serif",
    },
  },
  {
    id: "b2c3d4e5-0002-4000-8000-000000000002",
    type: "text",
    content: {
      type: "text",
      html: '<p style="text-align:center;font-size:15px;color:#4338ca;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin:0;">Now available</p>',
    },
    styles: {
      backgroundColor: "#eef2ff",
      padding: "12px 32px",
    },
  },
  {
    id: "b2c3d4e5-0002-4000-8000-000000000003",
    type: "text",
    content: {
      type: "text",
      html: "<p style=\"text-align:center;font-size:14px;color:#4b5563;line-height:1.7;margin:0;\">We've been working hard behind the scenes to build something truly special. Today we're thrilled to share it with you.</p>",
    },
    styles: {
      padding: "24px 32px 8px 32px",
      fontFamily: "'Poppins', sans-serif",
    },
  },
  {
    id: "b2c3d4e5-0002-4000-8000-000000000004",
    type: "spacer",
    content: { type: "spacer", height: 16 },
    styles: {},
  },
  {
    id: "b2c3d4e5-0002-4000-8000-000000000005",
    type: "text",
    content: {
      type: "text",
      html: '<table style="width:100%;border-collapse:collapse;"><tr><td style="padding:10px 12px;"><span style="font-size:18px;">⚡</span></td><td style="padding:10px 12px;"><strong style="font-size:13px;color:#1e293b;">Lightning Fast</strong><br/><span style="font-size:12px;color:#64748b;">Built for speed from the ground up. Experience performance like never before.</span></td></tr><tr><td style="padding:10px 12px;"><span style="font-size:18px;">🔒</span></td><td style="padding:10px 12px;"><strong style="font-size:13px;color:#1e293b;">Enterprise Security</strong><br/><span style="font-size:12px;color:#64748b;">Bank-grade encryption and compliance baked in from day one.</span></td></tr><tr><td style="padding:10px 12px;"><span style="font-size:18px;">📊</span></td><td style="padding:10px 12px;"><strong style="font-size:13px;color:#1e293b;">Real-Time Analytics</strong><br/><span style="font-size:12px;color:#64748b;">Make data-driven decisions with live dashboards and intelligent reporting.</span></td></tr></table>',
    },
    styles: {
      backgroundColor: "#f8fafc",
      padding: "16px 24px",
      borderRadius: "8px",
      fontFamily: "'Poppins', sans-serif",
    },
  },
  {
    id: "b2c3d4e5-0002-4000-8000-000000000006",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: {},
  },
  {
    id: "b2c3d4e5-0002-4000-8000-000000000007",
    type: "button",
    content: {
      type: "button",
      text: "Learn More",
      url: "#",
      buttonColor: "#6366f1",
      textColor: "#ffffff",
      variant: "solid",
    },
    styles: {
      alignment: "center",
      padding: "0 32px",
      borderRadius: "8px",
    },
  },
  {
    id: "b2c3d4e5-0002-4000-8000-000000000008",
    type: "spacer",
    content: { type: "spacer", height: 32 },
    styles: {},
  },
  {
    id: "b2c3d4e5-0002-4000-8000-000000000009",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · Unsubscribe from product announcements",
      showUnsubscribe: false,
    },
    styles: {
      textColor: "#9ca3af",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Poppins', sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. Event Invitation
// ─────────────────────────────────────────────────────────────────────────────
const eventInvitationBlocks: EmailBlock[] = [
  {
    id: "c3d4e5f6-0003-4000-8000-000000000001",
    type: "header",
    content: {
      type: "header",
      title: "You're Invited",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#065f46",
      textColor: "#ecfdf5",
      padding: "32px",
      alignment: "center",
      fontSize: "26px",
      fontWeight: "700",
      fontFamily: "'Playfair Display', Georgia, serif",
    },
  },
  {
    id: "c3d4e5f6-0003-4000-8000-000000000002",
    type: "text",
    content: {
      type: "text",
      html: '<p style="text-align:center;font-size:22px;font-weight:700;color:#065f46;margin:0 0 4px 0;">Annual Leadership Summit 2026</p><p style="text-align:center;font-size:14px;color:#6b7280;margin:0;">An exclusive evening for top performers and industry leaders</p>',
    },
    styles: {
      padding: "28px 32px 12px 32px",
      fontFamily: "'Playfair Display', Georgia, serif",
    },
  },
  {
    id: "c3d4e5f6-0003-4000-8000-000000000003",
    type: "divider",
    content: {
      type: "divider",
      color: "#d1fae5",
      thickness: 2,
      style: "solid",
    },
    styles: { padding: "0 32px" },
  },
  {
    id: "c3d4e5f6-0003-4000-8000-000000000004",
    type: "text",
    content: {
      type: "text",
      html: '<table style="width:100%;"><tr><td style="width:50%;padding:16px 8px 16px 0;"><p style="margin:0 0 2px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;">Date</p><p style="margin:0;font-size:14px;font-weight:600;color:#111827;">Thursday, April 24, 2026</p></td><td style="width:50%;padding:16px 0 16px 8px;"><p style="margin:0 0 2px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;">Time</p><p style="margin:0;font-size:14px;font-weight:600;color:#111827;">6:00 PM – 9:00 PM EST</p></td></tr><tr><td style="padding:0 8px 16px 0;"><p style="margin:0 0 2px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;">Location</p><p style="margin:0;font-size:14px;font-weight:600;color:#111827;">The Grand Pavilion</p><p style="margin:0;font-size:12px;color:#4b5563;">450 Park Avenue, New York</p></td><td style="padding:0 0 16px 8px;"><p style="margin:0 0 2px 0;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;">Dress Code</p><p style="margin:0;font-size:14px;font-weight:600;color:#111827;">Business Formal</p></td></tr></table>',
    },
    styles: {
      padding: "16px 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "c3d4e5f6-0003-4000-8000-000000000005",
    type: "quote",
    content: {
      type: "quote",
      text: "Join us for an evening of insights, networking, and recognition. Dinner, keynote speakers, and awards ceremony included.",
      accentColor: "#059669",
    },
    styles: {
      padding: "0 32px 16px 32px",
      fontFamily: "'Playfair Display', Georgia, serif",
    },
  },
  {
    id: "c3d4e5f6-0003-4000-8000-000000000006",
    type: "button",
    content: {
      type: "button",
      text: "RSVP Now — Reserve Your Seat",
      url: "#",
      buttonColor: "#065f46",
      textColor: "#ffffff",
      variant: "solid",
      fullWidth: false,
    },
    styles: {
      alignment: "center",
      padding: "0 32px 8px 32px",
      borderRadius: "6px",
    },
  },
  {
    id: "c3d4e5f6-0003-4000-8000-000000000007",
    type: "text",
    content: {
      type: "text",
      html: '<p style="text-align:center;font-size:12px;color:#9ca3af;margin:0;">RSVP deadline: April 17, 2026 · Seats are limited</p>',
    },
    styles: {
      padding: "8px 32px 24px 32px",
    },
  },
  {
    id: "c3d4e5f6-0003-4000-8000-000000000008",
    type: "footer",
    content: {
      type: "footer",
      text: "Questions? Reply to this email or call (212) 555-0100\n© 2026 Your Company · 123 Main Street, New York, NY 10001",
      showUnsubscribe: true,
    },
    styles: {
      backgroundColor: "#f0fdf4",
      textColor: "#6b7280",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 4. Welcome / Onboarding
// ─────────────────────────────────────────────────────────────────────────────
const welcomeOnboardingBlocks: EmailBlock[] = [
  {
    id: "d4e5f6a7-0004-4000-8000-000000000001",
    type: "header",
    content: {
      type: "header",
      title: "Welcome aboard, {{first_name}}!",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#1d4ed8",
      textColor: "#eff6ff",
      padding: "28px 32px",
      alignment: "center",
      fontSize: "22px",
      fontWeight: "700",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "d4e5f6a7-0004-4000-8000-000000000002",
    type: "text",
    content: {
      type: "text",
      html: '<p style="font-size:14px;color:#374151;line-height:1.7;margin:0;">We\'re thrilled to have you here. Your account is set up and ready to go. Follow the three steps below to hit the ground running.</p>',
    },
    styles: {
      padding: "24px 32px 16px 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "d4e5f6a7-0004-4000-8000-000000000003",
    type: "text",
    content: {
      type: "text",
      html: '<table style="width:100%;border-collapse:collapse;"><tr><td style="vertical-align:top;padding:14px 12px;border-bottom:1px solid #e5e7eb;"><div style="width:28px;height:28px;border-radius:50%;background:#1d4ed8;color:#fff;font-weight:700;font-size:13px;display:inline-flex;align-items:center;justify-content:center;float:left;margin-right:12px;">1</div><div style="overflow:hidden;"><strong style="font-size:13px;color:#111827;">Complete your profile</strong><br/><span style="font-size:12px;color:#6b7280;">Add your photo, contact info, and preferences so your team can connect with you easily.</span></div></td></tr><tr><td style="vertical-align:top;padding:14px 12px;border-bottom:1px solid #e5e7eb;"><div style="width:28px;height:28px;border-radius:50%;background:#1d4ed8;color:#fff;font-weight:700;font-size:13px;display:inline-flex;align-items:center;justify-content:center;float:left;margin-right:12px;">2</div><div style="overflow:hidden;"><strong style="font-size:13px;color:#111827;">Explore the dashboard</strong><br/><span style="font-size:12px;color:#6b7280;">Familiarize yourself with your new workspace. Check out the KPI tracker and reporting tools.</span></div></td></tr><tr><td style="vertical-align:top;padding:14px 12px;"><div style="width:28px;height:28px;border-radius:50%;background:#1d4ed8;color:#fff;font-weight:700;font-size:13px;display:inline-flex;align-items:center;justify-content:center;float:left;margin-right:12px;">3</div><div style="overflow:hidden;"><strong style="font-size:13px;color:#111827;">Schedule your onboarding call</strong><br/><span style="font-size:12px;color:#6b7280;">Book a 30-minute session with your dedicated success manager to map out your first 90 days.</span></div></td></tr></table>',
    },
    styles: {
      backgroundColor: "#f8fafc",
      padding: "8px 24px",
      borderRadius: "8px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "d4e5f6a7-0004-4000-8000-000000000004",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: {},
  },
  {
    id: "d4e5f6a7-0004-4000-8000-000000000005",
    type: "button",
    content: {
      type: "button",
      text: "Log In to Your Account",
      url: "#",
      buttonColor: "#1d4ed8",
      textColor: "#ffffff",
      variant: "solid",
    },
    styles: {
      alignment: "center",
      padding: "0 32px",
      borderRadius: "6px",
    },
  },
  {
    id: "d4e5f6a7-0004-4000-8000-000000000006",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: {},
  },
  {
    id: "d4e5f6a7-0004-4000-8000-000000000007",
    type: "footer",
    content: {
      type: "footer",
      text: "You're receiving this because you created an account.\n© 2026 Your Company · 123 Main Street, New York, NY 10001",
      showUnsubscribe: true,
    },
    styles: {
      textColor: "#9ca3af",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 5. Monthly Recap
// ─────────────────────────────────────────────────────────────────────────────
const monthlyRecapBlocks: EmailBlock[] = [
  {
    id: "e5f6a7b8-0005-4000-8000-000000000001",
    type: "header",
    content: {
      type: "header",
      title: "March 2026 Performance Recap",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#111827",
      textColor: "#f9fafb",
      padding: "24px 32px",
      alignment: "left",
      fontSize: "20px",
      fontWeight: "700",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e5f6a7b8-0005-4000-8000-000000000002",
    type: "text",
    content: {
      type: "text",
      html: '<p style="font-size:13px;color:#6b7280;margin:0;">Here\'s a summary of key metrics and milestones for the month.</p>',
    },
    styles: {
      backgroundColor: "#111827",
      padding: "0 32px 20px 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e5f6a7b8-0005-4000-8000-000000000003",
    type: "columns",
    content: {
      type: "columns",
      columnCount: 3,
      gap: 12,
      columns: [
        {
          blocks: [
            {
              id: "e5f6a7b8-0005-4000-8000-000000000004",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0 0 2px 0;font-size:22px;font-weight:700;color:#111827;">$847K</p><p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Total Revenue</p><p style="margin:4px 0 0 0;font-size:12px;color:#16a34a;">↑ 12.4%</p>',
              },
              styles: {
                backgroundColor: "#f0fdf4",
                padding: "16px",
                borderRadius: "8px",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "e5f6a7b8-0005-4000-8000-000000000005",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0 0 2px 0;font-size:22px;font-weight:700;color:#111827;">143</p><p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">New Policies</p><p style="margin:4px 0 0 0;font-size:12px;color:#16a34a;">↑ 8.7%</p>',
              },
              styles: {
                backgroundColor: "#eff6ff",
                padding: "16px",
                borderRadius: "8px",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "e5f6a7b8-0005-4000-8000-000000000006",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0 0 2px 0;font-size:22px;font-weight:700;color:#111827;">94%</p><p style="margin:0;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;">Retention Rate</p><p style="margin:4px 0 0 0;font-size:12px;color:#dc2626;">↓ 1.2%</p>',
              },
              styles: {
                backgroundColor: "#fff7ed",
                padding: "16px",
                borderRadius: "8px",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
      ],
    },
    styles: {
      padding: "20px 24px",
    },
  },
  {
    id: "e5f6a7b8-0005-4000-8000-000000000007",
    type: "text",
    content: {
      type: "text",
      html: '<h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 8px 0;">Highlights</h3><ul style="margin:0;padding-left:18px;color:#374151;font-size:13px;line-height:1.8;"><li>Top agent <strong>Sarah Johnson</strong> closed 28 policies — a new monthly record.</li><li>New carrier partnership with Horizon Life finalized and onboarding begins April 1.</li><li>Customer satisfaction score reached 4.8 / 5.0 across all product lines.</li></ul>',
    },
    styles: {
      padding: "0 32px 16px 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e5f6a7b8-0005-4000-8000-000000000008",
    type: "text",
    content: {
      type: "text",
      html: '<h3 style="font-size:14px;font-weight:600;color:#111827;margin:0 0 8px 0;">Upcoming Dates</h3><table style="width:100%;border-collapse:collapse;font-size:13px;"><tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#374151;">Apr 1</td><td style="padding:8px 0;color:#374151;">Horizon Life onboarding kickoff</td></tr><tr style="border-bottom:1px solid #e5e7eb;"><td style="padding:8px 0;color:#374151;">Apr 10</td><td style="padding:8px 0;color:#374151;">Q1 all-hands meeting — 10:00 AM EST</td></tr><tr><td style="padding:8px 0;color:#374151;">Apr 24</td><td style="padding:8px 0;color:#374151;">Annual Leadership Summit</td></tr></table>',
    },
    styles: {
      padding: "0 32px 24px 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e5f6a7b8-0005-4000-8000-000000000009",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · Monthly performance digest\nYou're receiving this as a team member.",
      showUnsubscribe: false,
    },
    styles: {
      backgroundColor: "#f8fafc",
      textColor: "#9ca3af",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 6. Re-engagement
// ─────────────────────────────────────────────────────────────────────────────
const reEngagementBlocks: EmailBlock[] = [
  {
    id: "f6a7b8c9-0006-4000-8000-000000000001",
    type: "header",
    content: {
      type: "header",
      title: "We miss you, {{first_name}}",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#7c3aed",
      textColor: "#faf5ff",
      padding: "32px",
      alignment: "center",
      fontSize: "24px",
      fontWeight: "700",
      fontFamily: "'Montserrat', Arial, sans-serif",
    },
  },
  {
    id: "f6a7b8c9-0006-4000-8000-000000000002",
    type: "text",
    content: {
      type: "text",
      html: "<p style=\"text-align:center;font-size:14px;color:#4b5563;line-height:1.7;margin:0;\">It's been a while since we've seen you. We've made some big improvements since your last visit — and we want to make sure you're not missing out.</p>",
    },
    styles: {
      padding: "24px 32px 16px 32px",
      fontFamily: "'Montserrat', Arial, sans-serif",
    },
  },
  {
    id: "f6a7b8c9-0006-4000-8000-000000000003",
    type: "columns",
    content: {
      type: "columns",
      columnCount: 2,
      gap: 16,
      columns: [
        {
          blocks: [
            {
              id: "f6a7b8c9-0006-4000-8000-000000000004",
              type: "text",
              content: {
                type: "text",
                html: '<p style="font-size:20px;margin:0 0 6px 0;">🚀</p><p style="font-size:13px;font-weight:600;color:#1e1b4b;margin:0 0 4px 0;">New Features</p><p style="font-size:12px;color:#6b7280;margin:0;">We\'ve launched 14 new features based on customer feedback you may not have seen yet.</p>',
              },
              styles: {
                backgroundColor: "#f5f3ff",
                padding: "16px",
                borderRadius: "8px",
                alignment: "center",
                fontFamily: "'Montserrat', Arial, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "f6a7b8c9-0006-4000-8000-000000000005",
              type: "text",
              content: {
                type: "text",
                html: '<p style="font-size:20px;margin:0 0 6px 0;">💡</p><p style="font-size:13px;font-weight:600;color:#1e1b4b;margin:0 0 4px 0;">Smarter Tools</p><p style="font-size:12px;color:#6b7280;margin:0;">Our AI-powered insights now save teams an average of 6 hours per week on manual reporting.</p>',
              },
              styles: {
                backgroundColor: "#f5f3ff",
                padding: "16px",
                borderRadius: "8px",
                alignment: "center",
                fontFamily: "'Montserrat', Arial, sans-serif",
              },
            },
          ],
        },
      ],
    },
    styles: {
      padding: "0 24px 16px 24px",
    },
  },
  {
    id: "f6a7b8c9-0006-4000-8000-000000000006",
    type: "text",
    content: {
      type: "text",
      html: '<p style="text-align:center;font-size:13px;font-weight:600;color:#7c3aed;background:#f5f3ff;border-radius:6px;padding:12px;margin:0;">Special offer: Use code <strong>COMEBACK20</strong> for 20% off your next month</p>',
    },
    styles: {
      padding: "0 32px 20px 32px",
      fontFamily: "'Montserrat', Arial, sans-serif",
    },
  },
  {
    id: "f6a7b8c9-0006-4000-8000-000000000007",
    type: "button",
    content: {
      type: "button",
      text: "Come Back & Explore",
      url: "#",
      buttonColor: "#7c3aed",
      textColor: "#ffffff",
      variant: "solid",
    },
    styles: {
      alignment: "center",
      padding: "0 32px",
      borderRadius: "8px",
    },
  },
  {
    id: "f6a7b8c9-0006-4000-8000-000000000008",
    type: "spacer",
    content: { type: "spacer", height: 28 },
    styles: {},
  },
  {
    id: "f6a7b8c9-0006-4000-8000-000000000009",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · You're receiving this because you have an account with us.",
      showUnsubscribe: true,
    },
    styles: {
      textColor: "#9ca3af",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Montserrat', Arial, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 7. Promotion / Sale
// ─────────────────────────────────────────────────────────────────────────────
const promotionBlocks: EmailBlock[] = [
  {
    id: "a7b8c9d0-0007-4000-8000-000000000001",
    type: "text",
    content: {
      type: "text",
      html: '<p style="text-align:center;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#ffffff;margin:0;">Limited Time Offer — Ends Sunday</p>',
    },
    styles: {
      backgroundColor: "#dc2626",
      padding: "10px 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "a7b8c9d0-0007-4000-8000-000000000002",
    type: "header",
    content: {
      type: "header",
      title: "30% Off Everything",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#fff7ed",
      textColor: "#7c2d12",
      padding: "32px 32px 8px 32px",
      alignment: "center",
      fontSize: "30px",
      fontWeight: "700",
      fontFamily: "'Poppins', sans-serif",
    },
  },
  {
    id: "a7b8c9d0-0007-4000-8000-000000000003",
    type: "text",
    content: {
      type: "text",
      html: '<p style="text-align:center;font-size:14px;color:#92400e;margin:0;">Use code <strong style="font-size:16px;color:#dc2626;">SPRING30</strong> at checkout</p>',
    },
    styles: {
      backgroundColor: "#fff7ed",
      padding: "0 32px 24px 32px",
      fontFamily: "'Poppins', sans-serif",
    },
  },
  {
    id: "a7b8c9d0-0007-4000-8000-000000000004",
    type: "columns",
    content: {
      type: "columns",
      columnCount: 2,
      gap: 12,
      columns: [
        {
          blocks: [
            {
              id: "a7b8c9d0-0007-4000-8000-000000000005",
              type: "text",
              content: {
                type: "text",
                html: '<p style="font-size:13px;font-weight:600;color:#111827;margin:0 0 4px 0;">Starter Plan</p><p style="margin:0 0 4px 0;"><span style="font-size:22px;font-weight:700;color:#dc2626;">$69</span><span style="font-size:12px;color:#6b7280;text-decoration:line-through;margin-left:4px;">$99</span></p><p style="font-size:12px;color:#6b7280;margin:0;">Up to 5 users · Core features · Email support</p>',
              },
              styles: {
                backgroundColor: "#ffffff",
                padding: "16px",
                borderRadius: "8px",
                borderWidth: "1px",
                borderColor: "#e5e7eb",
                borderStyle: "solid",
                fontFamily: "'Poppins', sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "a7b8c9d0-0007-4000-8000-000000000006",
              type: "text",
              content: {
                type: "text",
                html: '<p style="font-size:13px;font-weight:600;color:#111827;margin:0 0 4px 0;">Pro Plan <span style="font-size:10px;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;margin-left:4px;">Most Popular</span></p><p style="margin:0 0 4px 0;"><span style="font-size:22px;font-weight:700;color:#dc2626;">$139</span><span style="font-size:12px;color:#6b7280;text-decoration:line-through;margin-left:4px;">$199</span></p><p style="font-size:12px;color:#6b7280;margin:0;">Unlimited users · All features · Priority support</p>',
              },
              styles: {
                backgroundColor: "#fff7ed",
                padding: "16px",
                borderRadius: "8px",
                borderWidth: "2px",
                borderColor: "#dc2626",
                borderStyle: "solid",
                fontFamily: "'Poppins', sans-serif",
              },
            },
          ],
        },
      ],
    },
    styles: {
      padding: "20px 24px",
    },
  },
  {
    id: "a7b8c9d0-0007-4000-8000-000000000007",
    type: "button",
    content: {
      type: "button",
      text: "Shop Now — Save 30%",
      url: "#",
      buttonColor: "#dc2626",
      textColor: "#ffffff",
      variant: "solid",
      fullWidth: false,
    },
    styles: {
      alignment: "center",
      padding: "0 32px 8px 32px",
      borderRadius: "6px",
    },
  },
  {
    id: "a7b8c9d0-0007-4000-8000-000000000008",
    type: "text",
    content: {
      type: "text",
      html: '<p style="text-align:center;font-size:12px;color:#9ca3af;margin:0;">Offer valid through Sunday, March 8, 2026 at 11:59 PM EST. Cannot be combined with other offers.</p>',
    },
    styles: {
      padding: "8px 32px 24px 32px",
      fontFamily: "'Poppins', sans-serif",
    },
  },
  {
    id: "a7b8c9d0-0007-4000-8000-000000000009",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · 123 Main Street, Suite 100, New York, NY 10001",
      showUnsubscribe: true,
    },
    styles: {
      textColor: "#9ca3af",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Poppins', sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 8. Plain Professional
// ─────────────────────────────────────────────────────────────────────────────
const plainProfessionalBlocks: EmailBlock[] = [
  {
    id: "b8c9d0e1-0008-4000-8000-000000000001",
    type: "header",
    content: {
      type: "header",
      title: "Your Company",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#ffffff",
      textColor: "#111827",
      padding: "24px 32px 12px 32px",
      alignment: "left",
      fontSize: "16px",
      fontWeight: "700",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      borderWidth: "0 0 2px 0",
      borderColor: "#e5e7eb",
      borderStyle: "solid",
    },
  },
  {
    id: "b8c9d0e1-0008-4000-8000-000000000002",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: {},
  },
  {
    id: "b8c9d0e1-0008-4000-8000-000000000003",
    type: "text",
    content: {
      type: "text",
      html: '<p style="font-size:14px;color:#111827;margin:0 0 12px 0;">Hi {{first_name}},</p><p style="font-size:13px;color:#374151;line-height:1.7;margin:0 0 12px 0;">I wanted to reach out personally with an update that I think you\'ll find valuable. Over the past quarter, our team has been focused on delivering improvements that directly impact your day-to-day workflow.</p><p style="font-size:13px;color:#374151;line-height:1.7;margin:0 0 12px 0;">We\'ve streamlined the reporting process, reduced manual data entry by 40%, and introduced a new commission reconciliation tool that many of your peers are already using.</p><p style="font-size:13px;color:#374151;line-height:1.7;margin:0;">If you have any questions or would like a walkthrough of the new features, I\'d be happy to set up a call at your convenience.</p>',
    },
    styles: {
      padding: "0 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "b8c9d0e1-0008-4000-8000-000000000004",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: {},
  },
  {
    id: "b8c9d0e1-0008-4000-8000-000000000005",
    type: "text",
    content: {
      type: "text",
      html: '<p style="font-size:13px;color:#374151;margin:0 0 4px 0;">Best regards,</p><p style="font-size:13px;font-weight:600;color:#111827;margin:0 0 2px 0;">{{sender_name}}</p><p style="font-size:12px;color:#6b7280;margin:0;">{{sender_title}} · Your Company</p>',
    },
    styles: {
      padding: "0 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "b8c9d0e1-0008-4000-8000-000000000006",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: {},
  },
  {
    id: "b8c9d0e1-0008-4000-8000-000000000007",
    type: "button",
    content: {
      type: "button",
      text: "View What's New",
      url: "#",
      buttonColor: "#374151",
      textColor: "#ffffff",
      variant: "outline",
    },
    styles: {
      alignment: "left",
      padding: "0 32px",
      borderRadius: "4px",
    },
  },
  {
    id: "b8c9d0e1-0008-4000-8000-000000000008",
    type: "spacer",
    content: { type: "spacer", height: 32 },
    styles: {},
  },
  {
    id: "b8c9d0e1-0008-4000-8000-000000000009",
    type: "divider",
    content: {
      type: "divider",
      color: "#e5e7eb",
      thickness: 1,
      style: "solid",
    },
    styles: {},
  },
  {
    id: "b8c9d0e1-0008-4000-8000-000000000010",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · 123 Main Street, Suite 100, New York, NY 10001",
      showUnsubscribe: true,
    },
    styles: {
      textColor: "#9ca3af",
      padding: "16px 32px",
      alignment: "left",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 9. AI SMS Bot — Launch Announcement
// ─────────────────────────────────────────────────────────────────────────────
const smsBotLaunchBlocks: EmailBlock[] = [
  {
    id: "c9d0e1f2-0009-4000-8000-000000000001",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;color:#22c55e;text-transform:uppercase;">NEW FEATURE</p>',
    },
    styles: {
      backgroundColor: "#18181b",
      padding: "14px 32px 10px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "c9d0e1f2-0009-4000-8000-000000000002",
    type: "header",
    content: {
      type: "header",
      title: "Your Leads Are Getting Texted Back in Seconds",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#fafafa",
      padding: "20px 32px 12px",
      alignment: "left",
      fontSize: "28px",
      fontWeight: "700",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      letterSpacing: "-0.02em",
    },
  },
  {
    id: "c9d0e1f2-0009-4000-8000-000000000003",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0;font-size:14px;line-height:1.6;color:#a1a1aa;">AI SMS Chat Bot is now active on your account. Every new lead gets an instant, personalized text within seconds — 24/7, 365 days a year. No more missed opportunities sitting in your CRM overnight.</p>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px 20px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "c9d0e1f2-0009-4000-8000-000000000004",
    type: "divider",
    content: {
      type: "divider",
      color: "#22c55e",
      thickness: 3,
      style: "solid",
    },
    styles: { padding: "0 32px" },
  },
  {
    id: "c9d0e1f2-0009-4000-8000-000000000005",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "c9d0e1f2-0009-4000-8000-000000000006",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0 0 14px;font-size:11px;font-weight:600;letter-spacing:0.12em;color:#71717a;text-transform:uppercase;">HOW IT WORKS</p><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="padding:12px 0;border-bottom:1px solid #27272a;vertical-align:top;width:40px;"><span style="font-size:22px;font-weight:700;color:#22c55e;">01</span></td><td style="padding:12px 0 12px 16px;border-bottom:1px solid #27272a;vertical-align:top;"><span style="font-size:13px;font-weight:600;color:#fafafa;">New lead enters your CRM</span><br/><span style="font-size:12px;color:#71717a;">Bot sends a personalized text in under 30 seconds — before the lead forgets they inquired.</span></td></tr><tr><td style="padding:12px 0;border-bottom:1px solid #27272a;vertical-align:top;width:40px;"><span style="font-size:22px;font-weight:700;color:#22c55e;">02</span></td><td style="padding:12px 0 12px 16px;border-bottom:1px solid #27272a;vertical-align:top;"><span style="font-size:13px;font-weight:600;color:#fafafa;">Lead replies</span><br/><span style="font-size:12px;color:#71717a;">Bot handles objections, qualifies interest, and steers the conversation toward a booked appointment.</span></td></tr><tr><td style="padding:12px 0;vertical-align:top;width:40px;"><span style="font-size:22px;font-weight:700;color:#22c55e;">03</span></td><td style="padding:12px 0 12px 16px;vertical-align:top;"><span style="font-size:13px;font-weight:600;color:#fafafa;">Appointment booked</span><br/><span style="font-size:12px;color:#71717a;">You get notified. Calendar is updated. Lead shows up ready to buy — all without you lifting a finger.</span></td></tr></table>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "c9d0e1f2-0009-4000-8000-000000000007",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "c9d0e1f2-0009-4000-8000-000000000008",
    type: "columns",
    content: {
      type: "columns",
      columnCount: 2,
      gap: 12,
      columns: [
        {
          blocks: [
            {
              id: "c9d0e1f2-0009-4000-8000-000000000009",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0;font-size:28px;font-weight:700;color:#22c55e;line-height:1;">< 30s</p><p style="margin:6px 0 0;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#71717a;text-transform:uppercase;">AVG RESPONSE TIME</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "20px",
                borderRadius: "2px",
                alignment: "center",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "c9d0e1f2-0009-4000-8000-000000000010",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0;font-size:28px;font-weight:700;color:#22c55e;line-height:1;">24/7</p><p style="margin:6px 0 0;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#71717a;text-transform:uppercase;">ALWAYS-ON AVAILABILITY</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "20px",
                borderRadius: "2px",
                alignment: "center",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
      ],
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
    },
  },
  {
    id: "c9d0e1f2-0009-4000-8000-000000000011",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "c9d0e1f2-0009-4000-8000-000000000012",
    type: "button",
    content: {
      type: "button",
      text: "View Your Bot Dashboard",
      url: "#",
      buttonColor: "#22c55e",
      textColor: "#09090b",
      variant: "solid",
      fullWidth: true,
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: "600",
      fontSize: "14px",
    },
  },
  {
    id: "c9d0e1f2-0009-4000-8000-000000000013",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0;font-size:12px;color:#71717a;text-align:center;">Your bot is already active. No setup required.</p>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "12px 32px 8px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "c9d0e1f2-0009-4000-8000-000000000014",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · Powered by AI SMS Chat Bot",
      showUnsubscribe: true,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#52525b",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 10. AI SMS Bot — ROI Showcase
// ─────────────────────────────────────────────────────────────────────────────
const smsBotRoiBlocks: EmailBlock[] = [
  {
    id: "d0e1f2a3-0010-4000-8000-000000000001",
    type: "header",
    content: {
      type: "header",
      title: "Your AI Bot Results This Month",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#fafafa",
      padding: "24px 32px 8px",
      alignment: "left",
      fontSize: "24px",
      fontWeight: "700",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      letterSpacing: "-0.02em",
    },
  },
  {
    id: "d0e1f2a3-0010-4000-8000-000000000002",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0;font-size:12px;color:#71717a;">Performance Report — March 2026</p>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px 16px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "d0e1f2a3-0010-4000-8000-000000000003",
    type: "divider",
    content: {
      type: "divider",
      color: "#27272a",
      thickness: 1,
      style: "solid",
    },
    styles: { padding: "0 32px", backgroundColor: "#09090b" },
  },
  {
    id: "d0e1f2a3-0010-4000-8000-000000000004",
    type: "spacer",
    content: { type: "spacer", height: 16 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "d0e1f2a3-0010-4000-8000-000000000005",
    type: "columns",
    content: {
      type: "columns",
      columnCount: 3,
      gap: 10,
      columns: [
        {
          blocks: [
            {
              id: "d0e1f2a3-0010-4000-8000-000000000006",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0;font-size:30px;font-weight:700;color:#22c55e;line-height:1;">847</p><p style="margin:4px 0 2px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#a1a1aa;text-transform:uppercase;">Leads Contacted</p><p style="margin:0;font-size:11px;font-weight:600;color:#22c55e;">↑ 34%</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                alignment: "center",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "d0e1f2a3-0010-4000-8000-000000000007",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0;font-size:30px;font-weight:700;color:#22c55e;line-height:1;">73%</p><p style="margin:4px 0 2px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#a1a1aa;text-transform:uppercase;">Response Rate</p><p style="margin:0;font-size:11px;font-weight:600;color:#22c55e;">↑ 12%</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                alignment: "center",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "d0e1f2a3-0010-4000-8000-000000000008",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0;font-size:30px;font-weight:700;color:#22c55e;line-height:1;">142</p><p style="margin:4px 0 2px;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#a1a1aa;text-transform:uppercase;">Appts Booked</p><p style="margin:0;font-size:11px;font-weight:600;color:#22c55e;">↑ 28%</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                alignment: "center",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
      ],
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
    },
  },
  {
    id: "d0e1f2a3-0010-4000-8000-000000000009",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "d0e1f2a3-0010-4000-8000-000000000010",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:0.12em;color:#71717a;text-transform:uppercase;">ATTRIBUTION BREAKDOWN</p><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr style="border-bottom:2px solid #27272a;"><td style="padding:8px 0;font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.05em;">Lead Source</td><td style="padding:8px 0;font-size:11px;font-weight:600;color:#a1a1aa;text-align:right;">Contacted</td><td style="padding:8px 0;font-size:11px;font-weight:600;color:#a1a1aa;text-align:right;">Replied</td><td style="padding:8px 0;font-size:11px;font-weight:600;color:#a1a1aa;text-align:right;">Booked</td></tr><tr style="border-bottom:1px solid #1c1c1f;"><td style="padding:8px 0;font-size:12px;color:#d4d4d8;">Facebook Ads</td><td style="padding:8px 0;font-size:12px;color:#d4d4d8;text-align:right;">312</td><td style="padding:8px 0;font-size:12px;color:#d4d4d8;text-align:right;">228</td><td style="padding:8px 0;font-size:12px;color:#22c55e;font-weight:600;text-align:right;">52</td></tr><tr style="border-bottom:1px solid #1c1c1f;"><td style="padding:8px 0;font-size:12px;color:#d4d4d8;">Google Leads</td><td style="padding:8px 0;font-size:12px;color:#d4d4d8;text-align:right;">245</td><td style="padding:8px 0;font-size:12px;color:#d4d4d8;text-align:right;">189</td><td style="padding:8px 0;font-size:12px;color:#22c55e;font-weight:600;text-align:right;">48</td></tr><tr style="border-bottom:1px solid #1c1c1f;"><td style="padding:8px 0;font-size:12px;color:#d4d4d8;">Referrals</td><td style="padding:8px 0;font-size:12px;color:#d4d4d8;text-align:right;">180</td><td style="padding:8px 0;font-size:12px;color:#d4d4d8;text-align:right;">156</td><td style="padding:8px 0;font-size:12px;color:#22c55e;font-weight:600;text-align:right;">32</td></tr><tr><td style="padding:8px 0;font-size:12px;color:#d4d4d8;">Website</td><td style="padding:8px 0;font-size:12px;color:#d4d4d8;text-align:right;">110</td><td style="padding:8px 0;font-size:12px;color:#d4d4d8;text-align:right;">74</td><td style="padding:8px 0;font-size:12px;color:#22c55e;font-weight:600;text-align:right;">10</td></tr></table>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "d0e1f2a3-0010-4000-8000-000000000011",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "d0e1f2a3-0010-4000-8000-000000000012",
    type: "quote",
    content: {
      type: "quote",
      text: "The bot booked 142 appointments this month that would have otherwise gone unanswered. At an average policy value of $2,400, that's $340,800 in pipeline.",
      accentColor: "#22c55e",
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#d4d4d8",
      padding: "0 32px",
      fontSize: "13px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "d0e1f2a3-0010-4000-8000-000000000013",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "d0e1f2a3-0010-4000-8000-000000000014",
    type: "button",
    content: {
      type: "button",
      text: "Open Full Analytics",
      url: "#",
      buttonColor: "#22c55e",
      textColor: "#09090b",
      variant: "solid",
      fullWidth: true,
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: "600",
      fontSize: "14px",
    },
  },
  {
    id: "d0e1f2a3-0010-4000-8000-000000000015",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · AI SMS Bot Monthly Report",
      showUnsubscribe: true,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#52525b",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 11. AI SMS Bot — Feature Deep-Dive
// ─────────────────────────────────────────────────────────────────────────────
const smsBotFeaturesBlocks: EmailBlock[] = [
  {
    id: "e1f2a3b4-0011-4000-8000-000000000001",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;color:#22c55e;text-transform:uppercase;">PRODUCT GUIDE</p>',
    },
    styles: {
      backgroundColor: "#18181b",
      padding: "14px 32px 10px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000002",
    type: "header",
    content: {
      type: "header",
      title: "Everything Your AI SMS Bot Can Do",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#fafafa",
      padding: "20px 32px 20px",
      alignment: "left",
      fontSize: "26px",
      fontWeight: "700",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      letterSpacing: "-0.02em",
    },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000003",
    type: "divider",
    content: {
      type: "divider",
      color: "#22c55e",
      thickness: 3,
      style: "solid",
    },
    styles: { padding: "0 32px", backgroundColor: "#09090b" },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000004",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000005",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#22c55e;text-transform:uppercase;">OBJECTION HANDLING</p><p style="margin:0;font-size:13px;line-height:1.6;color:#d4d4d8;">Handles "I\'m not interested", "I already have insurance", "Call me later" and 40+ more objections. Turns cold responses into booked appointments with natural, multi-turn conversations.</p>',
    },
    styles: {
      backgroundColor: "#18181b",
      padding: "16px 20px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000006",
    type: "spacer",
    content: { type: "spacer", height: 8 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000007",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#22c55e;text-transform:uppercase;">REAL CALENDAR INTEGRATION</p><p style="margin:0;font-size:13px;line-height:1.6;color:#d4d4d8;">Real-time sync with Calendly and Google Calendar. Books directly into your available slots. No double-bookings. Leads pick from your actual availability — not fake time windows.</p>',
    },
    styles: {
      backgroundColor: "#18181b",
      padding: "16px 20px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000008",
    type: "spacer",
    content: { type: "spacer", height: 8 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000009",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#22c55e;text-transform:uppercase;">COMPLIANCE FIRST</p><p style="margin:0;font-size:13px;line-height:1.6;color:#d4d4d8;">Never quotes prices or coverage details over SMS. Enforces business hours by timezone. TCPA-aware messaging patterns. Full conversation audit trail for every interaction.</p>',
    },
    styles: {
      backgroundColor: "#18181b",
      padding: "16px 20px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000010",
    type: "spacer",
    content: { type: "spacer", height: 8 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000011",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#22c55e;text-transform:uppercase;">LEAD SOURCE TARGETING</p><p style="margin:0;font-size:13px;line-height:1.6;color:#d4d4d8;">Filter which leads the bot contacts by source. Run different engagement strategies for Facebook vs Google vs referral leads. Full attribution tracking tells you exactly which sources convert.</p>',
    },
    styles: {
      backgroundColor: "#18181b",
      padding: "16px 20px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000012",
    type: "spacer",
    content: { type: "spacer", height: 8 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000013",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#22c55e;text-transform:uppercase;">SMART FOLLOW-UP SEQUENCES</p><p style="margin:0;font-size:13px;line-height:1.6;color:#d4d4d8;">Multi-turn sequences that re-engage leads who went cold. Automatic escalation timing based on conversation history. Business hour enforcement ensures messages never land at 2 AM.</p>',
    },
    styles: {
      backgroundColor: "#18181b",
      padding: "16px 20px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000014",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000015",
    type: "button",
    content: {
      type: "button",
      text: "Configure Your Bot",
      url: "#",
      buttonColor: "#22c55e",
      textColor: "#09090b",
      variant: "solid",
      fullWidth: true,
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: "600",
      fontSize: "14px",
    },
  },
  {
    id: "e1f2a3b4-0011-4000-8000-000000000016",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · AI SMS Bot Product Guide",
      showUnsubscribe: true,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#52525b",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 12. Voice Agent — Launch Announcement
// ─────────────────────────────────────────────────────────────────────────────
const voiceAgentLaunchBlocks: EmailBlock[] = [
  {
    id: "f2a3b4c5-0012-4000-8000-000000000001",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;color:#3b82f6;text-transform:uppercase;">NOW LIVE</p>',
    },
    styles: {
      backgroundColor: "#18181b",
      padding: "14px 32px 10px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "f2a3b4c5-0012-4000-8000-000000000002",
    type: "header",
    content: {
      type: "header",
      title: "Your Phone Lines Never Go to Voicemail Again",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#fafafa",
      padding: "20px 32px 12px",
      alignment: "left",
      fontSize: "26px",
      fontWeight: "700",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      letterSpacing: "-0.02em",
    },
  },
  {
    id: "f2a3b4c5-0012-4000-8000-000000000003",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0;font-size:14px;line-height:1.6;color:#a1a1aa;">AI Voice Agent is handling your inbound calls 24/7. Natural voice, real conversations, instant scheduling. Every missed call was a missed sale — not anymore.</p>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px 20px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "f2a3b4c5-0012-4000-8000-000000000004",
    type: "divider",
    content: {
      type: "divider",
      color: "#3b82f6",
      thickness: 3,
      style: "solid",
    },
    styles: { padding: "0 32px" },
  },
  {
    id: "f2a3b4c5-0012-4000-8000-000000000005",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "f2a3b4c5-0012-4000-8000-000000000006",
    type: "columns",
    content: {
      type: "columns",
      columnCount: 2,
      gap: 10,
      columns: [
        {
          blocks: [
            {
              id: "f2a3b4c5-0012-4000-8000-000000000007",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0 0 8px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#3b82f6;text-transform:uppercase;">INBOUND COVERAGE</p><p style="margin:0;font-size:13px;line-height:1.5;color:#d4d4d8;">Answers every call. Greets callers by name when possible. Captures intent, qualifies the lead, and books appointments — or transfers to a live agent on demand.</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "f2a3b4c5-0012-4000-8000-000000000008",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0 0 8px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#3b82f6;text-transform:uppercase;">MISSED APPT RECOVERY</p><p style="margin:0;font-size:13px;line-height:1.5;color:#d4d4d8;">Automatically calls leads who no-showed. Reschedules into your next available slot within minutes. Recovers revenue you would otherwise lose permanently.</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
      ],
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
    },
  },
  {
    id: "f2a3b4c5-0012-4000-8000-000000000009",
    type: "spacer",
    content: { type: "spacer", height: 10 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "f2a3b4c5-0012-4000-8000-000000000010",
    type: "columns",
    content: {
      type: "columns",
      columnCount: 2,
      gap: 10,
      columns: [
        {
          blocks: [
            {
              id: "f2a3b4c5-0012-4000-8000-000000000011",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0 0 8px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#3b82f6;text-transform:uppercase;">QUOTED LEAD FOLLOW-UP</p><p style="margin:0;font-size:13px;line-height:1.5;color:#d4d4d8;">Calls leads who received a quote but never responded. Re-engages with full context from their original conversation. Turns stale quotes into closed deals.</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "f2a3b4c5-0012-4000-8000-000000000012",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0 0 8px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#3b82f6;text-transform:uppercase;">HUMAN HANDOFF</p><p style="margin:0;font-size:13px;line-height:1.5;color:#d4d4d8;">When a caller asks for a real person, the agent transfers immediately to your configured number. You get the full transcript and context before picking up.</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
      ],
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
    },
  },
  {
    id: "f2a3b4c5-0012-4000-8000-000000000013",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "f2a3b4c5-0012-4000-8000-000000000014",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0;font-size:12px;color:#71717a;text-align:center;letter-spacing:0.03em;">100+ voice options &nbsp;·&nbsp; Call recording &amp; transcripts &nbsp;·&nbsp; Hard minute capping</p>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "12px 32px",
      borderWidth: "0 0 2px 0",
      borderColor: "#3b82f6",
      borderStyle: "solid",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "f2a3b4c5-0012-4000-8000-000000000015",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "f2a3b4c5-0012-4000-8000-000000000016",
    type: "button",
    content: {
      type: "button",
      text: "Explore Voice Agent Settings",
      url: "#",
      buttonColor: "#3b82f6",
      textColor: "#ffffff",
      variant: "solid",
      fullWidth: true,
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: "600",
      fontSize: "14px",
    },
  },
  {
    id: "f2a3b4c5-0012-4000-8000-000000000017",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · Powered by AI Voice Agent",
      showUnsubscribe: true,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#52525b",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 13. Voice Agent — Use Cases
// ─────────────────────────────────────────────────────────────────────────────
const voiceAgentUseCasesBlocks: EmailBlock[] = [
  {
    id: "a3b4c5d6-0013-4000-8000-000000000001",
    type: "header",
    content: {
      type: "header",
      title: "Three Ways Voice AI Is Closing More Deals",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#fafafa",
      padding: "24px 32px 16px",
      alignment: "left",
      fontSize: "26px",
      fontWeight: "700",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      letterSpacing: "-0.02em",
    },
  },
  {
    id: "a3b4c5d6-0013-4000-8000-000000000002",
    type: "divider",
    content: {
      type: "divider",
      color: "#3b82f6",
      thickness: 3,
      style: "solid",
    },
    styles: { padding: "0 32px", backgroundColor: "#09090b" },
  },
  {
    id: "a3b4c5d6-0013-4000-8000-000000000003",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "a3b4c5d6-0013-4000-8000-000000000004",
    type: "text",
    content: {
      type: "text",
      html: '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="vertical-align:top;width:60px;padding:0 16px 0 0;"><span style="font-size:36px;font-weight:700;color:#3b82f6;line-height:1;">01</span></td><td style="vertical-align:top;"><p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#71717a;text-transform:uppercase;">MISSED APPOINTMENT RECOVERY</p><p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#d4d4d8;">A lead no-shows their 2pm appointment. By 2:05pm, Voice Agent has called them, confirmed their interest, and rescheduled for tomorrow at 10am. No staff time required.</p><p style="margin:0;font-size:12px;font-weight:600;color:#3b82f6;">Average recovery rate: 38%</p></td></tr></table>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px 20px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "a3b4c5d6-0013-4000-8000-000000000005",
    type: "divider",
    content: {
      type: "divider",
      color: "#27272a",
      thickness: 1,
      style: "solid",
    },
    styles: { padding: "0 32px", backgroundColor: "#09090b" },
  },
  {
    id: "a3b4c5d6-0013-4000-8000-000000000006",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "a3b4c5d6-0013-4000-8000-000000000007",
    type: "text",
    content: {
      type: "text",
      html: '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="vertical-align:top;width:60px;padding:0 16px 0 0;"><span style="font-size:36px;font-weight:700;color:#3b82f6;line-height:1;">02</span></td><td style="vertical-align:top;"><p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#71717a;text-transform:uppercase;">AFTER-HOURS INBOUND</p><p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#d4d4d8;">It\'s 8:47pm. A prospect calls about the life insurance quote they received. Voice Agent answers, pulls up their quote context, answers questions, and books a follow-up for 9am tomorrow.</p><p style="margin:0;font-size:12px;font-weight:600;color:#3b82f6;">47% of insurance calls happen outside business hours</p></td></tr></table>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px 20px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "a3b4c5d6-0013-4000-8000-000000000008",
    type: "divider",
    content: {
      type: "divider",
      color: "#27272a",
      thickness: 1,
      style: "solid",
    },
    styles: { padding: "0 32px", backgroundColor: "#09090b" },
  },
  {
    id: "a3b4c5d6-0013-4000-8000-000000000009",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "a3b4c5d6-0013-4000-8000-000000000010",
    type: "text",
    content: {
      type: "text",
      html: '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="vertical-align:top;width:60px;padding:0 16px 0 0;"><span style="font-size:36px;font-weight:700;color:#3b82f6;line-height:1;">03</span></td><td style="vertical-align:top;"><p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#71717a;text-transform:uppercase;">QUOTED LEAD RE-ENGAGEMENT</p><p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#d4d4d8;">A lead received an auto quote 3 days ago but never responded. Voice Agent calls them, references their specific quote, handles the "I need to think about it" objection, and books a meeting.</p><p style="margin:0;font-size:12px;font-weight:600;color:#3b82f6;">Quoted leads contacted within 72hrs close 2.3x more often</p></td></tr></table>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "a3b4c5d6-0013-4000-8000-000000000011",
    type: "spacer",
    content: { type: "spacer", height: 28 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "a3b4c5d6-0013-4000-8000-000000000012",
    type: "button",
    content: {
      type: "button",
      text: "Activate Voice Agent",
      url: "#",
      buttonColor: "#3b82f6",
      textColor: "#ffffff",
      variant: "solid",
      fullWidth: true,
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: "600",
      fontSize: "14px",
    },
  },
  {
    id: "a3b4c5d6-0013-4000-8000-000000000013",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · AI Voice Agent Use Cases",
      showUnsubscribe: true,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#52525b",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 14. Voice Agent — ROI Showcase
// ─────────────────────────────────────────────────────────────────────────────
const voiceAgentRoiBlocks: EmailBlock[] = [
  {
    id: "b4c5d6e7-0014-4000-8000-000000000001",
    type: "header",
    content: {
      type: "header",
      title: "Voice Agent Impact Report",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#fafafa",
      padding: "24px 32px 8px",
      alignment: "left",
      fontSize: "24px",
      fontWeight: "700",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      letterSpacing: "-0.02em",
    },
  },
  {
    id: "b4c5d6e7-0014-4000-8000-000000000002",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0;font-size:12px;color:#71717a;">Monthly Performance Summary</p>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px 16px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "b4c5d6e7-0014-4000-8000-000000000003",
    type: "divider",
    content: {
      type: "divider",
      color: "#27272a",
      thickness: 1,
      style: "solid",
    },
    styles: { padding: "0 32px", backgroundColor: "#09090b" },
  },
  {
    id: "b4c5d6e7-0014-4000-8000-000000000004",
    type: "spacer",
    content: { type: "spacer", height: 16 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "b4c5d6e7-0014-4000-8000-000000000005",
    type: "columns",
    content: {
      type: "columns",
      columnCount: 3,
      gap: 10,
      columns: [
        {
          blocks: [
            {
              id: "b4c5d6e7-0014-4000-8000-000000000006",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0;font-size:30px;font-weight:700;color:#3b82f6;line-height:1;">1,247</p><p style="margin:4px 0 0;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#a1a1aa;text-transform:uppercase;">Calls Handled</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                alignment: "center",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "b4c5d6e7-0014-4000-8000-000000000007",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0;font-size:30px;font-weight:700;color:#3b82f6;line-height:1;">38%</p><p style="margin:4px 0 0;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#a1a1aa;text-transform:uppercase;">No-Show Recovery</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                alignment: "center",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "b4c5d6e7-0014-4000-8000-000000000008",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0;font-size:30px;font-weight:700;color:#3b82f6;line-height:1;">$89K</p><p style="margin:4px 0 0;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#a1a1aa;text-transform:uppercase;">Pipeline Recovered</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                alignment: "center",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
      ],
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
    },
  },
  {
    id: "b4c5d6e7-0014-4000-8000-000000000009",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "b4c5d6e7-0014-4000-8000-000000000010",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:0.12em;color:#71717a;text-transform:uppercase;">BEFORE vs AFTER</p><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr style="border-bottom:2px solid #27272a;"><td style="padding:8px 0;font-size:11px;font-weight:600;color:#a1a1aa;text-transform:uppercase;letter-spacing:0.05em;">Metric</td><td style="padding:8px 0;font-size:11px;font-weight:600;color:#a1a1aa;text-align:right;">Before</td><td style="padding:8px 0;font-size:11px;font-weight:600;color:#a1a1aa;text-align:right;">After</td><td style="padding:8px 0;font-size:11px;font-weight:600;color:#a1a1aa;text-align:right;">Change</td></tr><tr style="border-bottom:1px solid #1c1c1f;"><td style="padding:8px 0;font-size:12px;color:#d4d4d8;">Missed calls / day</td><td style="padding:8px 0;font-size:12px;color:#71717a;text-align:right;">12</td><td style="padding:8px 0;font-size:12px;color:#d4d4d8;text-align:right;">0</td><td style="padding:8px 0;font-size:12px;font-weight:600;color:#22c55e;text-align:right;">-100%</td></tr><tr style="border-bottom:1px solid #1c1c1f;"><td style="padding:8px 0;font-size:12px;color:#d4d4d8;">Avg response time</td><td style="padding:8px 0;font-size:12px;color:#71717a;text-align:right;">4.2 hrs</td><td style="padding:8px 0;font-size:12px;color:#d4d4d8;text-align:right;">Instant</td><td style="padding:8px 0;font-size:12px;font-weight:600;color:#22c55e;text-align:right;">—</td></tr><tr style="border-bottom:1px solid #1c1c1f;"><td style="padding:8px 0;font-size:12px;color:#d4d4d8;">After-hours coverage</td><td style="padding:8px 0;font-size:12px;color:#71717a;text-align:right;">None</td><td style="padding:8px 0;font-size:12px;color:#d4d4d8;text-align:right;">24/7</td><td style="padding:8px 0;font-size:12px;font-weight:600;color:#3b82f6;text-align:right;">New</td></tr><tr><td style="padding:8px 0;font-size:12px;color:#d4d4d8;">No-show reschedule rate</td><td style="padding:8px 0;font-size:12px;color:#71717a;text-align:right;">8%</td><td style="padding:8px 0;font-size:12px;color:#d4d4d8;text-align:right;">38%</td><td style="padding:8px 0;font-size:12px;font-weight:600;color:#22c55e;text-align:right;">+375%</td></tr></table>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "b4c5d6e7-0014-4000-8000-000000000011",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "b4c5d6e7-0014-4000-8000-000000000012",
    type: "quote",
    content: {
      type: "quote",
      text: "We recovered 89 appointments from no-shows alone. That's $213,600 in annual premium that was walking out the door.",
      accentColor: "#3b82f6",
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#d4d4d8",
      padding: "0 32px",
      fontSize: "13px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "b4c5d6e7-0014-4000-8000-000000000013",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "b4c5d6e7-0014-4000-8000-000000000014",
    type: "button",
    content: {
      type: "button",
      text: "View Full Call Analytics",
      url: "#",
      buttonColor: "#3b82f6",
      textColor: "#ffffff",
      variant: "solid",
      fullWidth: true,
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: "600",
      fontSize: "14px",
    },
  },
  {
    id: "b4c5d6e7-0014-4000-8000-000000000015",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · Voice Agent Impact Report",
      showUnsubscribe: true,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#52525b",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 15. Channel Orchestrator — Launch
// ─────────────────────────────────────────────────────────────────────────────
const orchestratorLaunchBlocks: EmailBlock[] = [
  {
    id: "c5d6e7f8-0015-4000-8000-000000000001",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;color:#a855f7;text-transform:uppercase;">INTELLIGENCE LAYER</p>',
    },
    styles: {
      backgroundColor: "#18181b",
      padding: "14px 32px 10px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "c5d6e7f8-0015-4000-8000-000000000002",
    type: "header",
    content: {
      type: "header",
      title: "One Brain Controlling Every Touchpoint",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#fafafa",
      padding: "20px 32px 12px",
      alignment: "left",
      fontSize: "26px",
      fontWeight: "700",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      letterSpacing: "-0.02em",
    },
  },
  {
    id: "c5d6e7f8-0015-4000-8000-000000000003",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0;font-size:14px;line-height:1.6;color:#a1a1aa;">Channel Orchestrator decides whether to text or call each lead — and when. No more manual follow-up decisions. No more leads slipping through the cracks.</p>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px 20px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "c5d6e7f8-0015-4000-8000-000000000004",
    type: "divider",
    content: {
      type: "divider",
      color: "#a855f7",
      thickness: 3,
      style: "solid",
    },
    styles: { padding: "0 32px" },
  },
  {
    id: "c5d6e7f8-0015-4000-8000-000000000005",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "c5d6e7f8-0015-4000-8000-000000000006",
    type: "text",
    content: {
      type: "text",
      html: '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="background:#18181b;border-left:4px solid #a855f7;padding:14px 16px;border-radius:2px;"><p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#a855f7;text-transform:uppercase;">STEP 1</p><p style="margin:0;font-size:13px;font-weight:600;color:#fafafa;">Lead Enters Your CRM</p><p style="margin:4px 0 0;font-size:12px;color:#71717a;">New lead from any source — Facebook, Google, referral, website form.</p></td></tr><tr><td style="padding:6px 0 6px 20px;"><span style="font-size:16px;color:#52525b;">↓</span></td></tr><tr><td style="background:#18181b;border-left:4px solid #a855f7;padding:14px 16px;border-radius:2px;"><p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#a855f7;text-transform:uppercase;">STEP 2</p><p style="margin:0;font-size:13px;font-weight:600;color:#fafafa;">Orchestrator Evaluates</p><p style="margin:4px 0 0;font-size:12px;color:#71717a;">Checks lead source, status, time of day, conversation history, and your custom rules.</p></td></tr><tr><td style="padding:6px 0 6px 20px;"><span style="font-size:16px;color:#52525b;">↓</span></td></tr><tr><td style="background:#18181b;border-left:4px solid #a855f7;padding:14px 16px;border-radius:2px;"><p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#a855f7;text-transform:uppercase;">STEP 3</p><p style="margin:0;font-size:13px;font-weight:600;color:#fafafa;">Routes to Best Channel</p><p style="margin:4px 0 0;font-size:12px;color:#71717a;">SMS or Voice — right channel, right time, right message. Escalates automatically if needed.</p></td></tr></table>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "c5d6e7f8-0015-4000-8000-000000000007",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "c5d6e7f8-0015-4000-8000-000000000008",
    type: "columns",
    content: {
      type: "columns",
      columnCount: 2,
      gap: 10,
      columns: [
        {
          blocks: [
            {
              id: "c5d6e7f8-0015-4000-8000-000000000009",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0 0 8px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#a855f7;text-transform:uppercase;">SMART ESCALATION</p><p style="margin:0;font-size:13px;line-height:1.5;color:#d4d4d8;">Starts with SMS. If no response in your configured window, automatically escalates to a voice call. Configurable per lead source and status.</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "c5d6e7f8-0015-4000-8000-000000000010",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0 0 8px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#a855f7;text-transform:uppercase;">TIME WINDOWS</p><p style="margin:0;font-size:13px;line-height:1.5;color:#d4d4d8;">Respects business hours by timezone. Never texts at midnight. Knows when each lead\'s market is awake and queues outreach accordingly.</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
      ],
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
    },
  },
  {
    id: "c5d6e7f8-0015-4000-8000-000000000011",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "c5d6e7f8-0015-4000-8000-000000000012",
    type: "button",
    content: {
      type: "button",
      text: "Configure Routing Rules",
      url: "#",
      buttonColor: "#a855f7",
      textColor: "#ffffff",
      variant: "solid",
      fullWidth: true,
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: "600",
      fontSize: "14px",
    },
  },
  {
    id: "c5d6e7f8-0015-4000-8000-000000000013",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · Powered by Channel Orchestrator",
      showUnsubscribe: true,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#52525b",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 16. Channel Orchestrator — Workflow Showcase
// ─────────────────────────────────────────────────────────────────────────────
const orchestratorWorkflowBlocks: EmailBlock[] = [
  {
    id: "d6e7f8a9-0016-4000-8000-000000000001",
    type: "header",
    content: {
      type: "header",
      title: "See the Orchestrator in Action",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#fafafa",
      padding: "24px 32px 16px",
      alignment: "left",
      fontSize: "26px",
      fontWeight: "700",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      letterSpacing: "-0.02em",
    },
  },
  {
    id: "d6e7f8a9-0016-4000-8000-000000000002",
    type: "divider",
    content: {
      type: "divider",
      color: "#a855f7",
      thickness: 3,
      style: "solid",
    },
    styles: { padding: "0 32px", backgroundColor: "#09090b" },
  },
  {
    id: "d6e7f8a9-0016-4000-8000-000000000003",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "d6e7f8a9-0016-4000-8000-000000000004",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0;font-size:11px;font-weight:600;letter-spacing:0.15em;color:#a855f7;text-transform:uppercase;">SCENARIO: QUOTED LEAD GOES COLD</p>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px 16px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "d6e7f8a9-0016-4000-8000-000000000005",
    type: "text",
    content: {
      type: "text",
      html: '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="border-left:3px solid #52525b;padding:10px 0 10px 16px;"><span style="font-size:11px;font-weight:700;color:#71717a;">Day 0</span><br/><span style="font-size:13px;color:#d4d4d8;">Lead receives auto quote via email. No response.</span></td></tr><tr><td style="border-left:3px solid #a855f7;padding:10px 0 10px 16px;background:#18181b1a;"><span style="font-size:11px;font-weight:700;color:#a855f7;">Day 1</span><br/><span style="font-size:13px;color:#d4d4d8;">Orchestrator triggers SMS: "Hi Sarah, I saw you got a quote for your auto coverage. Have a few minutes to go over it?"</span></td></tr><tr><td style="border-left:3px solid #a855f7;padding:10px 0 10px 16px;"><span style="font-size:11px;font-weight:700;color:#a855f7;">Day 1 +4h</span><br/><span style="font-size:13px;color:#d4d4d8;">No reply. Orchestrator queues voice call for next business morning.</span></td></tr><tr><td style="border-left:3px solid #22c55e;padding:10px 0 10px 16px;background:#18181b1a;"><span style="font-size:11px;font-weight:700;color:#22c55e;">Day 2 · 9:01am</span><br/><span style="font-size:13px;color:#d4d4d8;">Voice Agent calls Sarah. She had questions about deductibles. Agent answers them, books appointment for Thursday 2pm.</span></td></tr><tr><td style="border-left:3px solid #22c55e;padding:10px 0 10px 16px;"><span style="font-size:11px;font-weight:700;color:#22c55e;">Day 2 · 9:03am</span><br/><span style="font-size:13px;color:#d4d4d8;">CRM status auto-updated to "Appointment Set". Transcript written to lead notes. Custom fields populated with call outcome.</span></td></tr></table>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "d6e7f8a9-0016-4000-8000-000000000006",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "d6e7f8a9-0016-4000-8000-000000000007",
    type: "text",
    content: {
      type: "text",
      html: '<div style="border-left:4px solid #22c55e;background:#18181b;padding:14px 16px;border-radius:2px;"><p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#22c55e;text-transform:uppercase;">OUTCOME</p><p style="margin:0;font-size:13px;line-height:1.5;color:#d4d4d8;">Lead converted from cold quote to booked appointment in 26 hours with zero human effort. CRM fully updated. Agent prepared with full context before the meeting.</p></div>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "d6e7f8a9-0016-4000-8000-000000000008",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "d6e7f8a9-0016-4000-8000-000000000009",
    type: "button",
    content: {
      type: "button",
      text: "Build Your First Rule",
      url: "#",
      buttonColor: "#a855f7",
      textColor: "#ffffff",
      variant: "solid",
      fullWidth: true,
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: "600",
      fontSize: "14px",
    },
  },
  {
    id: "d6e7f8a9-0016-4000-8000-000000000010",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · Channel Orchestrator Workflow",
      showUnsubscribe: true,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#52525b",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 17. Channel Orchestrator — Integration Highlight
// ─────────────────────────────────────────────────────────────────────────────
const orchestratorIntegrationBlocks: EmailBlock[] = [
  {
    id: "e7f8a9b0-0017-4000-8000-000000000001",
    type: "header",
    content: {
      type: "header",
      title: "Your CRM Runs Itself Now",
      showLogo: false,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#fafafa",
      padding: "24px 32px 12px",
      alignment: "left",
      fontSize: "28px",
      fontWeight: "700",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      letterSpacing: "-0.02em",
    },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000002",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0;font-size:14px;line-height:1.6;color:#a1a1aa;">Every call outcome, every text conversation, every status change — automatically synced to your CRM. Zero manual data entry. Zero missed updates.</p>',
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px 20px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000003",
    type: "divider",
    content: {
      type: "divider",
      color: "#a855f7",
      thickness: 3,
      style: "solid",
    },
    styles: { padding: "0 32px" },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000004",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000005",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#a855f7;text-transform:uppercase;">AUTO-STATUS UPDATES</p><p style="margin:0;font-size:13px;line-height:1.6;color:#d4d4d8;">Call outcomes automatically move leads through your pipeline. "Appointment Set", "Not Interested", "Call Back Later" — the CRM reflects reality in real time, not when someone remembers to update it.</p>',
    },
    styles: {
      backgroundColor: "#18181b",
      padding: "16px 20px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000006",
    type: "spacer",
    content: { type: "spacer", height: 8 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000007",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#a855f7;text-transform:uppercase;">TRANSCRIPT WRITEBACK</p><p style="margin:0;font-size:13px;line-height:1.6;color:#d4d4d8;">Every voice conversation is transcribed and written to the lead\'s notes in your CRM. Full context for when you pick up the conversation — no asking "what did we discuss last time?"</p>',
    },
    styles: {
      backgroundColor: "#18181b",
      padding: "16px 20px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000008",
    type: "spacer",
    content: { type: "spacer", height: 8 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000009",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#a855f7;text-transform:uppercase;">CUSTOM FIELD MAPPING</p><p style="margin:0;font-size:13px;line-height:1.6;color:#d4d4d8;">Call duration, disposition, next action date, quote interest level — all mapped to your CRM\'s custom fields automatically. Build reports and smart views without manual tagging.</p>',
    },
    styles: {
      backgroundColor: "#18181b",
      padding: "16px 20px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000010",
    type: "spacer",
    content: { type: "spacer", height: 8 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000011",
    type: "text",
    content: {
      type: "text",
      html: '<p style="margin:0 0 6px;font-size:10px;font-weight:600;letter-spacing:0.12em;color:#a855f7;text-transform:uppercase;">CONVERSATION HISTORY AWARE</p><p style="margin:0;font-size:13px;line-height:1.6;color:#d4d4d8;">The orchestrator knows what\'s already been said. Won\'t re-contact a lead that booked yesterday. Won\'t call someone the bot texted an hour ago. Intelligent cooldowns prevent over-contacting.</p>',
    },
    styles: {
      backgroundColor: "#18181b",
      padding: "16px 20px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000012",
    type: "spacer",
    content: { type: "spacer", height: 20 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000013",
    type: "columns",
    content: {
      type: "columns",
      columnCount: 3,
      gap: 10,
      columns: [
        {
          blocks: [
            {
              id: "e7f8a9b0-0017-4000-8000-000000000014",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0;font-size:28px;font-weight:700;color:#a855f7;line-height:1;">0</p><p style="margin:4px 0 0;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#a1a1aa;text-transform:uppercase;">Manual Entries</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                alignment: "center",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "e7f8a9b0-0017-4000-8000-000000000015",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0;font-size:28px;font-weight:700;color:#a855f7;line-height:1;">100%</p><p style="margin:4px 0 0;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#a1a1aa;text-transform:uppercase;">Calls Logged</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                alignment: "center",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
        {
          blocks: [
            {
              id: "e7f8a9b0-0017-4000-8000-000000000016",
              type: "text",
              content: {
                type: "text",
                html: '<p style="margin:0;font-size:28px;font-weight:700;color:#a855f7;line-height:1;">< 5s</p><p style="margin:4px 0 0;font-size:10px;font-weight:600;letter-spacing:0.1em;color:#a1a1aa;text-transform:uppercase;">Sync Delay</p>',
              },
              styles: {
                backgroundColor: "#18181b",
                padding: "16px",
                borderRadius: "2px",
                alignment: "center",
                fontFamily:
                  "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              },
            },
          ],
        },
      ],
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
    },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000017",
    type: "spacer",
    content: { type: "spacer", height: 24 },
    styles: { backgroundColor: "#09090b" },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000018",
    type: "button",
    content: {
      type: "button",
      text: "Set Up Post-Call Actions",
      url: "#",
      buttonColor: "#a855f7",
      textColor: "#ffffff",
      variant: "solid",
      fullWidth: true,
    },
    styles: {
      backgroundColor: "#09090b",
      padding: "0 32px",
      borderRadius: "2px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      fontWeight: "600",
      fontSize: "14px",
    },
  },
  {
    id: "e7f8a9b0-0017-4000-8000-000000000019",
    type: "footer",
    content: {
      type: "footer",
      text: "© 2026 Your Company · Channel Orchestrator Integrations",
      showUnsubscribe: true,
    },
    styles: {
      backgroundColor: "#09090b",
      textColor: "#52525b",
      padding: "16px 32px",
      alignment: "center",
      fontSize: "11px",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Exported collection
// ─────────────────────────────────────────────────────────────────────────────
export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "starter-modern-newsletter",
    name: "Modern Newsletter",
    description:
      "Hero image, two-column content section, CTA button, and social footer. Great for regular updates.",
    category: "newsletter",
    thumbnail: "",
    blocks: modernNewsletterBlocks,
  },
  {
    id: "starter-product-announcement",
    name: "Product Announcement",
    description:
      "Bold header with accent color, feature highlights list, and a prominent 'Learn More' CTA.",
    category: "announcement",
    thumbnail: "",
    blocks: productAnnouncementBlocks,
  },
  {
    id: "starter-event-invitation",
    name: "Event Invitation",
    description:
      "Elegant event details layout with date, time, location, RSVP button, and deadline notice.",
    category: "event",
    thumbnail: "",
    blocks: eventInvitationBlocks,
  },
  {
    id: "starter-welcome-onboarding",
    name: "Welcome Onboarding",
    description:
      "Personalized greeting, numbered three-step getting started guide, and login CTA.",
    category: "onboarding",
    thumbnail: "",
    blocks: welcomeOnboardingBlocks,
  },
  {
    id: "starter-monthly-recap",
    name: "Monthly Recap",
    description:
      "KPI stat cards, highlights list, and upcoming dates table. Ideal for team performance digests.",
    category: "recap",
    thumbnail: "",
    blocks: monthlyRecapBlocks,
  },
  {
    id: "starter-re-engagement",
    name: "Re-engagement",
    description:
      "'We miss you' header, value proposition columns, and a special offer promo code.",
    category: "retention",
    thumbnail: "",
    blocks: reEngagementBlocks,
  },
  {
    id: "starter-promotion",
    name: "Promotion",
    description:
      "Urgency banner, discount badge, two-tier pricing grid, and a 'Shop Now' CTA with promo code.",
    category: "promotion",
    thumbnail: "",
    blocks: promotionBlocks,
  },
  {
    id: "starter-plain-professional",
    name: "Plain Professional",
    description:
      "Minimal branded header, conversational text body, personal sign-off, and subtle outline CTA.",
    category: "general",
    thumbnail: "",
    blocks: plainProfessionalBlocks,
  },
  // ── AI Product Templates ──────────────────────────────────────────────────
  {
    id: "starter-sms-bot-launch",
    name: "AI SMS Bot Launch",
    description:
      "Dark brutalist announcement for your AI SMS Chat Bot. 30-second response stats, three-step workflow, and 24/7 availability highlight.",
    category: "ai-product",
    thumbnail: "",
    blocks: smsBotLaunchBlocks,
  },
  {
    id: "starter-sms-bot-roi",
    name: "SMS Bot ROI Report",
    description:
      "Data-driven monthly performance report with KPI stat cards, lead source attribution table, and pipeline value calculation.",
    category: "ai-product",
    thumbnail: "",
    blocks: smsBotRoiBlocks,
  },
  {
    id: "starter-sms-bot-features",
    name: "SMS Bot Feature Guide",
    description:
      "Comprehensive capability deep-dive: objection handling, calendar sync, compliance, lead targeting, and smart follow-ups.",
    category: "ai-product",
    thumbnail: "",
    blocks: smsBotFeaturesBlocks,
  },
  {
    id: "starter-voice-agent-launch",
    name: "Voice Agent Launch",
    description:
      "Launch announcement for AI Voice Agent. Inbound coverage, missed appointment recovery, human handoff, and call features.",
    category: "ai-product",
    thumbnail: "",
    blocks: voiceAgentLaunchBlocks,
  },
  {
    id: "starter-voice-agent-use-cases",
    name: "Voice Agent Use Cases",
    description:
      "Three real-world scenarios with oversized numbers: missed appointment recovery, after-hours inbound, and quoted lead follow-up.",
    category: "ai-product",
    thumbnail: "",
    blocks: voiceAgentUseCasesBlocks,
  },
  {
    id: "starter-voice-agent-roi",
    name: "Voice Agent ROI Report",
    description:
      "Impact report with before/after metrics table, KPI stat cards, and recovered pipeline value quote.",
    category: "ai-product",
    thumbnail: "",
    blocks: voiceAgentRoiBlocks,
  },
  {
    id: "starter-orchestrator-launch",
    name: "Orchestrator Launch",
    description:
      "Channel Orchestrator announcement with three-step routing flow, smart escalation, and time window features.",
    category: "ai-product",
    thumbnail: "",
    blocks: orchestratorLaunchBlocks,
  },
  {
    id: "starter-orchestrator-workflow",
    name: "Orchestrator Workflow",
    description:
      "Step-by-step scenario timeline showing SMS-to-Voice escalation on a cold quoted lead, with outcome highlight.",
    category: "ai-product",
    thumbnail: "",
    blocks: orchestratorWorkflowBlocks,
  },
  {
    id: "starter-orchestrator-integrations",
    name: "Orchestrator Integrations",
    description:
      "CRM automation showcase: auto-status updates, transcript writeback, custom field mapping, and conversation awareness.",
    category: "ai-product",
    thumbnail: "",
    blocks: orchestratorIntegrationBlocks,
  },
];
