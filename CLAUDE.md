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
1. **Bias for action** - Push directly to prod, skip planning mode
2. **Use frontend-design skill** for polished, modern aesthetics
3. **Mobile-first** - Always consider mobile navigation and layout
4. **Clean copy** - Replace verbose text like "Biography" with "Read more"
5. **Compact layouts** - Consolidate sections, use collapsibles for detail
6. **Modern UX** - Snap scrolling, viewport-fit sections, quick feel

## Common Tasks
- CSS changes: Edit `/css/styles.css`
- JS changes: Edit `/js/main.js`
- Content changes: Edit `index.html`
- Always commit and push to main for immediate Vercel deploy

## Git Workflow
- Single main branch
- Commit directly to main
- Vercel auto-deploys on push
- Include "Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>" in commits
