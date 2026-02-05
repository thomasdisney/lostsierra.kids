# Lost Sierra Kids Website

## Project Overview
- **Type**: Static nonprofit website for Lost Sierra Kids (California 501(c)(3))
- **Hosting**: Vercel (auto-deploys from main branch)
- **Domain**: lostsierrakids.com
- **Purpose**: Community learning center initiative in Graeagle, CA

## Tech Stack
- Pure HTML/CSS/JS (no framework)
- External CSS: `/css/styles.css`
- External JS: `/js/main.js`
- Fonts: Fraunces (headers) + Source Sans 3 (body)

## Directory Structure
```
/
├── index.html
├── css/styles.css
├── js/main.js
├── CNAME              # Custom domain config (lostsierrakids.com)
├── images/          # Logo, team photos, hero background
├── favicon/         # All favicon assets
├── photos/          # Carousel community photos
├── logos/           # Partner organization logos
└── site.webmanifest
```

## Design System
- **Primary colors**: Forest greens (#1e3a2f, #2d5446, #4a7c67)
- **Accent**: Sunlight gold (#e8c46c)
- **Neutrals**: Warm paper tones (#faf8f5, #f5f1eb)
- **Style**: "Sierra Modern" - warm, earthy, approachable nonprofit aesthetic

## Key Features
- Snap scrolling sections
- Full-viewport hero with large logo
- Collapsible vision cards with summaries
- Photo carousel (IMG_8278.jpeg always first)
- Mobile bottom navigation bar

## User Preferences (learned from session)
1. **Always take action** - Never ask for permission. Edit files, commit, and push without confirmation. No planning mode, no "should I proceed?" questions.
2. **Use frontend-design skill** for polished, modern aesthetics
3. **Mobile-first** - Always consider mobile navigation and layout
4. **Clean copy** - Replace verbose text like "Biography" with "Read more"
5. **Compact layouts** - Consolidate sections, use collapsibles for detail
6. **Modern UX** - Snap scrolling, viewport-fit sections, quick feel

## Common Tasks
- CSS changes: Edit `/css/styles.css`
- JS changes: Edit `/js/main.js`
- Content changes: Edit `index.html`
- Local preview: `npx serve` or `python -m http.server 8000`
- Always commit and push to main for immediate Vercel deploy

## Forms
- Both forms use FormSubmit.co (free form-to-email service)
- Contact form → lostsierrakids@gmail.com
- Newsletter form → lostsierrakids@gmail.com

## Git Workflow
- Work on `lsk-production` branch
- Push to main when ready: `git push origin lsk-production:main`
- Vercel auto-deploys on push
- Include "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>" in commits
