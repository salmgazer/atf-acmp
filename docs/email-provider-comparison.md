# Email Provider Comparison: Mailchimp vs Resend vs AWS SES

This document compares three email providers for the AI Challenge Management Platform (ACMP) to help decide which solution best fits our needs.

## Overview

| | **Mailchimp Transactional** | **Resend** | **AWS SES** |
|---|---|---|---|
| **Type** | Managed email service | Developer-focused email API | Infrastructure email service |
| **Best For** | Teams wanting full-featured UI | Modern developer experience | Maximum cost efficiency |
| **Pricing Model** | Block-based (25k/block) | Flat monthly + overage | Pay per email |

---

## Expected Email Volume

Based on 25,000 participants, our estimated email usage:

| Email Type | First Month | Monthly (Ongoing) | Final Month |
|------------|-------------|-------------------|-------------|
| Welcome/Onboarding | 25,000 | - | - |
| Password Resets | 1,250 | 500 | 500 |
| Magic Links (Mentors/Orgs) | 300 | 500 | 500 |
| Team Invitations | 5,000 | 1,000 | - |
| Session Confirmations | - | 2,000 | 1,000 |
| Certificate Delivery | - | - | 25,000 |
| Other Notifications | 3,000 | 5,000 | 2,000 |
| **Total** | **~35,000** | **~10,000** | **~29,000** |

*Notes:*
- *Announcements will be handled via in-app forums, not email*
- *Certificates are also downloadable directly from the platform*

---

## Cost Comparison

### Mailchimp Transactional

- **$20 per block** (1 block = 25,000 emails)
- **Requires Standard plan** ($20/month prerequisite)
- Unused emails do not roll over

### Resend

- **Free Plan:** 3,000 emails/month (100/day limit)
- **Pro Plan ($20/mo):** 50,000 emails/month
- **Pro Plan ($35/mo):** 100,000 emails/month
- **Overage:** $0.90 per 1,000 emails beyond plan limit

### AWS SES

- **$0.10 per 1,000 emails**
- No monthly minimum
- Pay only for what you send
- SNS notifications for bounces/complaints: Free tier covers this volume

### Cost Breakdown

Assuming a 6-month program:

| Period | Emails | Mailchimp | Resend | AWS SES |
|--------|--------|-----------|--------|---------|
| Month 1 (Onboarding) | 35,000 | $60 | $20 | $3.50 |
| Month 2 | 10,000 | $40 | $20 | $1.00 |
| Month 3 | 10,000 | $40 | $20 | $1.00 |
| Month 4 | 10,000 | $40 | $20 | $1.00 |
| Month 5 | 10,000 | $40 | $20 | $1.00 |
| Month 6 (Certificates) | 29,000 | $60 | $20 | $2.90 |
| **6-Month Total** | **~104,000** | **$280** | **$120** | **$10.40** |

*Note: Resend Pro ($20/mo) covers up to 50k emails/month. Our volumes fit within this tier.*

*For annual comparison (assuming 2 cohorts per year):*

| | Mailchimp | Resend | AWS SES |
|---|-----------|--------|---------|
| **Annual Cost** | ~$560 | ~$240 | ~$21 |
| **Savings vs Mailchimp** | - | **$320/year** | **$539/year** |

---

## Feature Comparison

| Feature | Mailchimp | Resend | AWS SES |
|---------|-----------|--------|---------|
| **Setup Time** | 15 minutes | 15-30 minutes | 30-60 minutes |
| **Visual Dashboard** | ✅ Comprehensive | ✅ Modern & clean | ⚠️ Basic aggregate stats |
| **Individual Email History** | ✅ Searchable | ✅ Searchable | ❌ Not available |
| **Template Editor** | ✅ Drag-and-drop | ❌ Code only (React Email) | ❌ Code only (HTML) |
| **Bounce Handling** | ✅ Automatic | ✅ Automatic | ⚠️ Manual (via SNS) |
| **Complaint Handling** | ✅ Automatic | ✅ Automatic | ⚠️ Manual (via SNS) |
| **Deliverability** | ✅ Excellent | ✅ Excellent | ✅ Excellent |
| **API Quality** | ✅ Good REST API | ✅ Excellent REST API | ✅ Good REST & SMTP |
| **Webhooks** | ✅ Easy setup | ✅ Easy setup | ⚠️ Via SNS (more setup) |
| **Developer Experience** | ✅ Good | ✅ Excellent | ✅ Good |
| **Scalability** | ✅ High | ✅ High | ✅ Very High |
| **AWS Integration** | ❌ Separate service | ❌ Separate service | ✅ Native |

---

## Dashboard & Monitoring

### Mailchimp Transactional

Provides a full-featured dashboard including:
- Individual email status and timeline
- Search emails by recipient
- Open and click tracking
- Delivery, bounce, and complaint reports
- Visual graphs and analytics
- Export capabilities

### Resend

Provides a modern, developer-friendly dashboard:
- Individual email status and delivery timeline
- Search emails by recipient
- Open and click tracking
- Delivery, bounce, and complaint reports
- Clean, minimal interface
- Real-time webhook events

### AWS SES

Provides basic aggregate statistics:
- Total sends, bounces, complaints (numbers only)
- Reputation dashboard
- Suppression list management
- Daily/weekly graphs

**Does NOT provide:**
- Individual email history
- Search by recipient
- Email content viewer
- Delivery timeline per email

*To get individual email tracking with SES, additional setup is required (SNS + CloudWatch or custom logging), adding development time and minor costs.*

---

## Pros and Cons

### Mailchimp Transactional

**Pros:**
- Easy setup with minimal technical knowledge
- Comprehensive dashboard for monitoring
- Automatic handling of bounces and complaints
- Visual template editor for non-developers
- Good documentation and support

**Cons:**
- Requires Standard/Premium plan ($20/month minimum)
- Block-based pricing (may pay for unused emails)
- Most expensive option
- Unused emails don't roll over month-to-month

### Resend

**Pros:**
- Modern, clean dashboard with individual email tracking
- Excellent developer experience and API
- Automatic bounce/complaint handling
- Straightforward pricing (flat monthly fee)
- Quick setup with good documentation
- Middle-ground pricing between Mailchimp and SES

**Cons:**
- No visual template editor (code-based templates only)
- Newer service (launched 2023) with less track record
- Free tier limited to 100 emails/day
- No native AWS integration

### AWS SES

**Pros:**
- Extremely cost-effective (lowest cost option)
- Pay only for actual usage
- Scales easily to millions of emails
- Native integration with AWS services
- Full control over email infrastructure

**Cons:**
- More initial setup required (DNS verification, sandbox exit)
- No built-in individual email tracking
- Bounce/complaint handling requires additional setup
- No visual template editor
- Basic dashboard compared to others

---

## Implementation Effort & Cost

### Mailchimp Transactional

| Task | Time | Cost |
|------|------|------|
| Account setup | 10 min | Included |
| Domain verification | 15 min | Included |
| API integration | 30 min | Included |
| Bounce/complaint setup | Automatic | Included |
| Basic monitoring | Included | Included |
| **Total** | **~1 hour** | **No additional setup cost** |

### Resend

| Task | Time | Cost |
|------|------|------|
| Account setup | 10 min | Included |
| Domain verification | 15 min | Included |
| API integration | 30 min | Included |
| Bounce/complaint setup | Automatic | Included |
| Webhook configuration | 15 min | Included |
| **Total** | **~1 hour** | **No additional setup cost** |

### AWS SES

| Task | Time |
|------|------|
| Account setup & configuration | 30 min |
| Domain verification (DNS records) | 30 min |
| Request production access | 15 min + approval wait |
| Bounce/complaint handling (SNS) | 45 min |
| CloudWatch monitoring setup | 30 min |
| Application integration & testing | 30 min |
| **Total Setup Time** | **~3 hours** |
| **One-time Setup Fee** | **$150** |

*AWS SES requires professional setup to ensure proper deliverability, bounce handling, and monitoring.*

### Total Cost of Ownership Comparison

| | Mailchimp | Resend | AWS SES |
|---|-----------|--------|---------|
| Setup/Implementation | $0 | $0 | $150 |
| Service Cost (6-month cycle) | $280 | $120 | $10 |
| **Year 1 Total** | **$280** | **$120** | **$160** |
| **Year 2 Total** | **$280** | **$120** | **$10** |
| **2-Year Total** | **$560** | **$240** | **$170** |

---

## Recommendation

### Choose Mailchimp Transactional if:
- You want zero implementation cost upfront
- Non-technical team members need to monitor emails
- You want a visual dashboard with drag-and-drop template editor
- You prefer an established provider with extensive track record
- Budget predictability is preferred over long-term savings

### Choose Resend if:
- You want a modern, clean dashboard with individual email tracking
- You prefer straightforward, predictable monthly pricing
- Your team is comfortable with code-based email templates
- You want quick setup with excellent developer experience
- You want a balance between features and cost

### Choose AWS SES if:
- You want the lowest long-term operational costs
- You're already using AWS infrastructure
- You're comfortable with a one-time setup investment
- You plan to run multiple program cycles (savings compound over time)
- Technical team can manage email operations going forward

---

## Summary

| Option | Setup Cost | Year 1 Cost | Year 2 Cost | 2-Year Total | Best For |
|--------|------------|-------------|-------------|--------------|----------|
| **Mailchimp** | $0 | $280 | $280 | **$560** | Non-technical teams, visual tools |
| **Resend** | $0 | $120 | $120 | **$240** | Developer experience, modern UI |
| **AWS SES** | $150 | $160 | $10 | **$170** | Maximum long-term savings |

### Key Takeaways

- **Mailchimp** offers the most comprehensive UI and easiest setup, but is the most expensive option
- **Resend** provides an excellent middle ground with good developer experience, modern dashboard, and moderate cost
- **AWS SES** has the lowest ongoing costs but requires more initial setup investment

All three providers offer excellent deliverability and can handle the expected email volume reliably.

---

## Questions?

If you have questions about any of these options or need clarification on specific features, please let us know before making a final decision.
