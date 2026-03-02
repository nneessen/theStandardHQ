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
];
