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

export default function PrivacyPage() {
  return (
    <div style={s.root}>
      <header style={s.header}>
        <span style={s.logo}>FieldQuote</span>
        <a href='/' style={s.back}>← Back to App</a>
      </header>
      <div style={s.body}>
        <h1 style={s.h1}>Privacy Policy</h1>
        <div style={s.updated}>Last updated: June 13, 2026</div>

        <p style={s.p}>
          MVP Solutions ("we," "us," or "our") operates the FieldQuote platform. This Privacy Policy explains how we collect,
          use, and protect your information when you use FieldQuote. By using the service, you agree to the practices described here.
        </p>

        <h2 style={s.h2}>1. Information We Collect</h2>
        <p style={s.p}><strong style={{ color: '#e0cfaa' }}>Account Information:</strong> When you sign up, we collect your email address and password (hashed — never stored in plain text).</p>
        <p style={s.p}><strong style={{ color: '#e0cfaa' }}>Business Profile:</strong> Company name, contractor names, and your company logo (if uploaded).</p>
        <p style={s.p}><strong style={{ color: '#e0cfaa' }}>Work Data:</strong> Quotes, invoices, client names, addresses, job details, services, pricing, add-ons, notes, schedule dates, and payment records you create within FieldQuote.</p>
        <p style={s.p}><strong style={{ color: '#e0cfaa' }}>Job Photos:</strong> Images you upload to client records are stored in secure cloud storage.</p>
        <p style={s.p}><strong style={{ color: '#e0cfaa' }}>Mileage Logs:</strong> Trip origin, destination, mileage, date, and purpose entered by you or your team members.</p>
        <p style={s.p}><strong style={{ color: '#e0cfaa' }}>Digital Signatures:</strong> Signature images and signer name/timestamp when clients sign documents via your signature link.</p>
        <p style={s.p}><strong style={{ color: '#e0cfaa' }}>Billing Information:</strong> Subscription status and billing history. Payment card details are handled entirely by Stripe and are never stored on our servers.</p>
        <p style={s.p}><strong style={{ color: '#e0cfaa' }}>Team Member Data:</strong> Email addresses of team members you invite and their activity within your account.</p>

        <h2 style={s.h2}>2. How We Use Your Information</h2>
        <ul style={s.ul}>
          <li>To provide, operate, and improve the FieldQuote service</li>
          <li>To authenticate your identity and maintain your account</li>
          <li>To process subscription payments through Stripe</li>
          <li>To send transactional emails (email confirmation, team invitations, password reset)</li>
          <li>To generate the documents, reports, and exports you request within the app</li>
          <li>To provide customer support when you contact us</li>
          <li>To detect and prevent fraud, abuse, or security incidents</li>
        </ul>
        <p style={s.p}>We do not sell your personal information or work data to third parties. We do not use your data for advertising.</p>

        <h2 style={s.h2}>3. Data Storage and Security</h2>
        <p style={s.p}>
          FieldQuote is built on <strong style={{ color: '#e0cfaa' }}>Supabase</strong>, a secure cloud database platform. Your data is stored
          in encrypted databases with row-level security policies that ensure each account can only access its own data.
          All data is transmitted over HTTPS/TLS.
        </p>
        <p style={s.p}>
          Job photos and company logos are stored in Supabase Storage with access controls. Digital signatures are stored
          in the database and are only accessible to the account owner.
        </p>
        <p style={s.p}>
          While we implement industry-standard security measures, no system is 100% secure. We cannot guarantee absolute
          security of your data and encourage you to use a strong, unique password.
        </p>

        <h2 style={s.h2}>4. Third-Party Services</h2>
        <p style={s.p}>FieldQuote integrates with the following third-party services:</p>
        <ul style={s.ul}>
          <li><strong style={{ color: '#e0cfaa' }}>Supabase</strong> — database, authentication, and file storage (<a href='https://supabase.com/privacy' style={{ color: GOLD }} target='_blank' rel='noopener noreferrer'>Privacy Policy</a>)</li>
          <li><strong style={{ color: '#e0cfaa' }}>Stripe</strong> — subscription billing and payment processing (<a href='https://stripe.com/privacy' style={{ color: GOLD }} target='_blank' rel='noopener noreferrer'>Privacy Policy</a>)</li>
        </ul>
        <p style={s.p}>These providers have their own privacy policies and data handling practices. We share only the minimum data necessary to provide their services.</p>

        <h2 style={s.h2}>5. Team Members</h2>
        <p style={s.p}>
          If you invite team members to your FieldQuote account, their email addresses are stored in our database. They will receive
          an invitation email sent through Supabase. Team member activity (documents created, mileage logged) is visible to the
          account owner. Team members can only access data belonging to the account they joined.
        </p>

        <h2 style={s.h2}>6. Data Retention</h2>
        <p style={s.p}>
          We retain your data for as long as your account is active. If you cancel your account, your data is retained for up to
          30 days to allow for recovery, after which it may be permanently deleted. You may request earlier deletion by contacting us.
        </p>

        <h2 style={s.h2}>7. Your Rights</h2>
        <p style={s.p}>Depending on your location, you may have the right to:</p>
        <ul style={s.ul}>
          <li>Access a copy of the personal data we hold about you</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your account and associated data</li>
          <li>Object to or restrict certain processing of your data</li>
          <li>Export your data in a portable format</li>
        </ul>
        <p style={s.p}>To exercise any of these rights, contact us at the address below.</p>

        <h2 style={s.h2}>8. Cookies</h2>
        <p style={s.p}>
          FieldQuote uses minimal browser storage. Authentication tokens are stored in your browser's local storage by Supabase
          to keep you logged in. We do not use third-party tracking cookies or advertising cookies.
        </p>

        <h2 style={s.h2}>9. Children's Privacy</h2>
        <p style={s.p}>
          FieldQuote is not intended for use by anyone under the age of 18. We do not knowingly collect personal information
          from minors. If you believe a minor has created an account, please contact us immediately.
        </p>

        <h2 style={s.h2}>10. Changes to This Policy</h2>
        <p style={s.p}>
          We may update this Privacy Policy from time to time. We will notify you of significant changes via email or an in-app
          notice. Continued use of FieldQuote after changes take effect constitutes acceptance of the updated policy.
        </p>

        <div style={s.contact}>
          <div style={{ color: GOLD, fontWeight: 700, marginBottom: 8 }}>Contact Us</div>
          <p style={{ ...s.p, marginBottom: 0 }}>
            For privacy questions, data requests, or to report a concern, contact MVP Solutions at{' '}
            <a href='mailto:davidamorales1979@gmail.com' style={{ color: GOLD }}>davidamorales1979@gmail.com</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
