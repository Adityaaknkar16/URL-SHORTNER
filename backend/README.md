# URL Shortener Pro

A full-stack URL shortening platform with enterprise features for link management, analytics, and sharing.

## ✨ Features

### Link Management
- **Custom Vanity Codes** — User-friendly aliases (e.g., `short.url/my-resume`)
- **Expiry Dates & Click Limits** — Set when links expire or stop working after X clicks
- **Password Protection** — Secure links with bcrypt-hashed passwords
- **Link Groups** — Organize and categorize URLs, with public shareable link collections
- **Bulk Shortening** — Generate up to 100 short links in one upload

### Analytics Dashboard
- **Real-time Click Tracking** — Every click logged with timestamp
- **Device & Browser Detection** — See Chrome vs Safari vs mobile breakdowns
- **Referrer Analysis** — Track where traffic is coming from
- **Click Trends** — Visualize clicks over time
- **Top Referrers** — Identify your best traffic sources

### Additional Features
- **QR Code Generation** — Auto-generate scannable QR codes for each link
- **Link Pausing** — Disable/enable links without deleting them
- **Public Shares** — Share read-only group links with others

## 🛠️ Tech Stack

**Frontend:** React (Vite) → Deployed on Vercel  
**Backend:** Node.js + Express → MongoDB with Mongoose  
**Security:** bcrypt password hashing, input validation, collision detection  
**Database:** MongoDB (Mongoose ODM)  

## 📊 Database Schema

Each shortened link stores:
- Link metadata (original URL, short code, vanity code, creation date)
- Security (password hash, active status)
- Limits (expiry date, max click count)
- Analytics (click events with device, browser, referrer, timestamp, user agent)
- Organization (groups, tags)
- QR code data

## 🚀 Quick Start

### Prerequisites
```
Node.js 16+, MongoDB, npm
```
