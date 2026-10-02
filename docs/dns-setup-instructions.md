# DNS Records Setup for ACMP Subdomains

**Domain:** atfchallenge.org  
**Date:** August 10, 2026

---

## Overview

We need to set up custom subdomains for the ACMP application hosted on AWS. Please add the following DNS records in Vercel for the atfchallenge.org domain.

---

## Part 1: SSL Certificate Validation Records

These CNAME records are needed to validate our AWS SSL certificate. **Please add them first.**

| Type  | Name                                             | Value                                                                    |
|-------|--------------------------------------------------|--------------------------------------------------------------------------|
| CNAME | `_e4ae38a8e85a057f2e50b60d72fe8845`              | `_3c4975bf5d2a48e3323d0ade289d0646.wzccmgtwzk.acm-validations.aws.`      |
| CNAME | `_28e0bcbcb80c438cd934f789457d815a.app-staging`  | `_6cb50a19e12905eca8e7aa180fedb397.wzccmgtwzk.acm-validations.aws.`      |
| CNAME | `_61e31693bb3b3a13ed3519a2a2609cc6.api`          | `_32be05369263ecc4dd2649bacc514601.wzccmgtwzk.acm-validations.aws.`      |
| CNAME | `_7bf54ab79d49c3ec23a5efa22684da6f.app`          | `_2b3f9bf93cae9873b31ea8ae299c7321.wzccmgtwzk.acm-validations.aws.`      |
| CNAME | `_ced2f3ea5887fe4c352a441adb83b563.api-staging`  | `_78562d95ae4cd73b49ff538adcd638c0.wzccmgtwzk.acm-validations.aws.`      |

> **Note:** The first record validates both `atfchallenge.org` and `*.atfchallenge.org` (wildcard).

---

## Part 2: Application Subdomain Records

These CNAME records point our subdomains to the AWS load balancer:

| Type  | Name          | Value                                                                 |
|-------|---------------|-----------------------------------------------------------------------|
| CNAME | `app`         | `ecs-express-gateway-alb-897d68bc-3756785.eu-central-1.elb.amazonaws.com` |
| CNAME | `api`         | `ecs-express-gateway-alb-897d68bc-3756785.eu-central-1.elb.amazonaws.com` |
| CNAME | `app-staging` | `ecs-express-gateway-alb-897d68bc-3756785.eu-central-1.elb.amazonaws.com` |
| CNAME | `api-staging` | `ecs-express-gateway-alb-897d68bc-3756785.eu-central-1.elb.amazonaws.com` |

> **Note:** All four subdomains point to the same AWS load balancer. The load balancer uses host-header routing to direct traffic to the correct service.

---

## Final URLs After Setup

Once configured, we'll have:

| URL                              | Purpose              |
|----------------------------------|----------------------|
| `https://app.atfchallenge.org`         | Production frontend  |
| `https://api.atfchallenge.org`         | Production backend API |
| `https://app-staging.atfchallenge.org` | Staging frontend     |
| `https://api-staging.atfchallenge.org` | Staging backend API  |

---

## Timeline

1. Add **Part 1** records first (certificate validation)
2. Certificate validation usually takes **5-30 minutes** after DNS propagates
3. Add **Part 2** records (can be done at the same time or after)
4. Notify the development team once records are added so we can complete AWS configuration

---

## Questions?

Please reach out if you have any questions about these DNS records.
