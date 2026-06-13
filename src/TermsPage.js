import React from 'react'

const NAVY = '#0a1628'
const GOLD = '#c9a84c'

const s = {
  root: { minHeight: '100vh', background: NAVY, color: '#c8d8e8', fontFamily: 'system-ui, sans-serif', padding: '0 0 60px' },
  header: { background: '#071827', borderBottom: `2px solid ${GOLD}`, padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { color: GOLD, fontWeight: 700, fontSize: 22, letterSpacing: 1 },
  back: { color: '#9fb0c6', fontSize: 13, textDecoration: 'none', border: '1px solid #334', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', background: 'transparent' },
  body: { maxWidth: 780, margin: '0 auto', padding: '40px 24px' },
  h1: { color: GOLD, fontSize: 28, fontWeight: 700, marginBottom: 6 },
  updated: { color: '#7f98b0', fontSize: 12, marginBottom: 36 },
  h2: { color: GOLD, fontSize: 16, fontWeight: 700, marginTop: 32, marginBottom: 8, borderBottom: `1px solid ${GOLD}33`, paddingBottom: 6 },
  p: { color: '#c8d8e8', fontSize: 14, lineHeight: 1.8, marginBottom: 14 },
  ul: { color: '#c8d8e8', fontSize: 14, lineHeight: 1.8, paddingLeft: 20, marginBottom: 14 },
  contact: { marginTop: 40, padding: 20, background: '#071827', borderRadius: 10, border: `1px solid ${GOLD}33` },
}

export default function TermsPage() {
  return (
    <div style={s.root}>
      <header style={s.header}>
        <span style={s.logo}>FieldQuote</span>
        <a href='/' style={s.back}>← Back to App</a>
      </header>
      <div style={s.body}>
        <h1 style={s.h1}>Terms of Service</h1>
        <div style={s.updated}>Last updated: June 13, 2026</div>

        <p style={s.p}>
          These Terms of Service ("Terms") govern your access to and use of FieldQuote, a quoting and invoicing platform
          operated by <strong style={{ color: '#e0cfaa' }}>MVP Solutions</strong> ("we," "us," or "our"). By creating an account
          or using FieldQuote, you agree to be bound by these Terms.
        </p>

        <h2 style={s.h2}>1. Acceptance of Terms</h2>
        <p style={s.p}>
          By accessing or using FieldQuote, you confirm that you are at least 18 years old, have the legal authority to enter
          into this agreement, and agree to comply with these Terms and all applicable laws and regulations.
        </p>

        <h2 style={s.h2}>2. Description of Service</h2>
        <p style={s.p}>
          FieldQuote is a software-as-a-service (SaaS) platform designed for plumbing and contracting professionals. It provides
          tools for creating quotes and invoices, tracking jobs, managing clients, recording mileage, and related business functions.
        </p>

        <h2 style={s.h2}>3. User Accounts</h2>
        <p style={s.p}>You are responsible for:</p>
        <ul style={s.ul}>
          <li>Maintaining the confidentiality of your account credentials</li>
          <li>All activity that occurs under your account</li>
          <li>Ensuring that all information you provide is accurate and up to date</li>
          <li>Notifying us immediately of any unauthorized use of your account</li>
        </ul>
        <p style={s.p}>
          You may invite team members to your account. Team members operate under your account and you remain responsible
          for their activity within FieldQuote.
        </p>

        <h2 style={s.h2}>4. Subscription and Payment</h2>
        <p style={s.p}>
          FieldQuote is offered on a subscription basis at $29/month following a free trial period. By subscribing, you authorize
          us to charge your payment method on a recurring monthly basis. All payments are processed securely through Stripe.
        </p>
        <ul style={s.ul}>
          <li>Your free trial begins on the date you create your account — no credit card required</li>
          <li>After the trial, full access requires an active paid subscription</li>
          <li>You may cancel your subscription at any time through the billing portal in Settings</li>
          <li>Cancellation takes effect at the end of the current billing period — no refunds for partial months</li>
          <li>Team members added to your account do not require their own subscription</li>
        </ul>

        <h2 style={s.h2}>5. Acceptable Use</h2>
        <p style={s.p}>You agree not to:</p>
        <ul style={s.ul}>
          <li>Use FieldQuote for any unlawful purpose or in violation of any regulations</li>
          <li>Attempt to gain unauthorized access to any part of the service or its related systems</li>
          <li>Upload malicious code, viruses, or any harmful content</li>
          <li>Resell, sublicense, or commercialize access to FieldQuote without our written consent</li>
          <li>Use automated tools to scrape or extract data from the platform</li>
        </ul>

        <h2 style={s.h2}>6. Data and Content</h2>
        <p style={s.p}>
          You retain ownership of all data and content you input into FieldQuote, including client information, quotes, invoices,
          photos, and documents. You grant MVP Solutions a limited license to store and process this data solely to provide the service.
        </p>
        <p style={s.p}>
          We will not sell your data to third parties. Upon account termination, you may request a copy of your data within 30 days.
          After that period, data may be permanently deleted.
        </p>

        <h2 style={s.h2}>7. Intellectual Property</h2>
        <p style={s.p}>
          FieldQuote, its software, design, logos, and all related intellectual property are owned by MVP Solutions. Nothing in these
          Terms grants you any ownership rights in FieldQuote or its underlying technology. The FieldQuote name and logo may not
          be used without our prior written permission.
        </p>

        <h2 style={s.h2}>8. Disclaimers</h2>
        <p style={s.p}>
          FieldQuote is provided "as is" without warranty of any kind. We do not guarantee that the service will be error-free,
          uninterrupted, or suitable for any particular purpose. Mileage deduction estimates are provided for convenience only and
          should be verified with a qualified tax professional — they do not constitute tax advice.
        </p>

        <h2 style={s.h2}>9. Limitation of Liability</h2>
        <p style={s.p}>
          To the maximum extent permitted by law, MVP Solutions shall not be liable for any indirect, incidental, special, consequential,
          or punitive damages arising from your use of FieldQuote. Our total liability to you for any claims under these Terms shall not
          exceed the amount you paid us in the 12 months preceding the claim.
        </p>

        <h2 style={s.h2}>10. Termination</h2>
        <p style={s.p}>
          We reserve the right to suspend or terminate your account at our discretion if you violate these Terms. You may cancel
          your account at any time through the app settings. Upon termination, your right to use the service ceases immediately.
        </p>

        <h2 style={s.h2}>11. Changes to Terms</h2>
        <p style={s.p}>
          We may update these Terms from time to time. We will notify you of material changes via email or a notice within the app.
          Continued use of FieldQuote after changes become effective constitutes acceptance of the updated Terms.
        </p>

        <h2 style={s.h2}>12. Governing Law</h2>
        <p style={s.p}>
          These Terms are governed by the laws of the State of Texas, without regard to conflict of law principles. Any disputes
          shall be resolved in the courts of Texas.
        </p>

        <div style={s.contact}>
          <div style={{ color: GOLD, fontWeight: 700, marginBottom: 8 }}>Contact Us</div>
          <p style={{ ...s.p, marginBottom: 0 }}>
            If you have questions about these Terms, please contact MVP Solutions at{' '}
            <a href='mailto:davidamorales1979@gmail.com' style={{ color: GOLD }}>davidamorales1979@gmail.com</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
