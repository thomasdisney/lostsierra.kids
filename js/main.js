/**
 * Lost Sierra Kids - Main JavaScript
 * Handles photo carousel, partner logos, and utilities
 */

document.addEventListener('DOMContentLoaded', () => {
  // Update copyright year
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Initialize components
  initPhotoCarousel();
  initPartnerLogos();
  initBulletinBoard();
});

/* ==========================================================================
   Photo Carousel
   ========================================================================== */

function initPhotoCarousel() {
  const carousel = document.querySelector('.photo-carousel');
  if (!carousel) return;

  const slidesContainer = carousel.querySelector('.carousel-slides');
  const buttons = carousel.querySelectorAll('.carousel-button');
  const status = carousel.querySelector('.carousel-status');
  const photoExtensions = /(jpe?g|png|gif|webp|avif)$/i;

  let slides = [];
  let currentIndex = 0;

  const fallbackPhotos = [
    'photos/20250508_112555.jpg',
    'photos/20250522_113224.jpg',
    'photos/20250626_113105.jpg',
    'photos/20250626_113922.jpg',
    'photos/IMG_8278.jpeg',
    'photos/IMG_8502.jpeg',
    'photos/IMG_8504.jpeg',
    'photos/IMG_8792.jpeg',
    'photos/IMG_8795.jpeg',
    'photos/IMG_8796.jpeg',
    'photos/IMG_8798.jpeg',
    'photos/IMG_8800.jpeg',
    'photos/image000000_20251024_123233.jpg',
    'photos/image000000_20251024_123428.jpg',
    'photos/received_844504624631456.jpeg',
  ];

  function updateSlide() {
    if (!slidesContainer) return;

    if (!slides.length) {
      slidesContainer.style.transform = 'translateX(0)';
      buttons.forEach((btn) => btn.setAttribute('disabled', 'disabled'));
      if (status) status.textContent = 'Photos coming soon';
      return;
    }

    buttons.forEach((btn) => btn.removeAttribute('disabled'));
    slidesContainer.style.transform = `translateX(-${currentIndex * 100}%)`;

    if (status) {
      status.textContent = `${currentIndex + 1} of ${slides.length}`;
    }
  }

  function shuffle(list) {
    const array = [...list];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Put featured photo first, shuffle the rest
  function orderPhotos(sources) {
    const featuredPhoto = 'photos/IMG_8278.jpeg';
    const hasFeatured = sources.some(src => src.toLowerCase().includes('img_8278'));

    if (!hasFeatured) {
      return shuffle(sources);
    }

    const featured = sources.find(src => src.toLowerCase().includes('img_8278'));
    const rest = sources.filter(src => !src.toLowerCase().includes('img_8278'));
    return [featured, ...shuffle(rest)];
  }

  function renderSlides(photoSources, allSources) {
    if (!slidesContainer) return;

    slidesContainer.innerHTML = '';
    slides = photoSources.map((src, index) => {
      const slide = document.createElement('div');
      slide.className = 'carousel-slide';

      const img = document.createElement('img');
      img.src = src;
      img.loading = index === 0 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.alt = 'Lost Sierra Kids community photo';

      img.onerror = () => {
        if (!Array.isArray(allSources) || !allSources.length) return;

        const attempts = parseInt(img.dataset.errorAttempts || '0', 10) + 1;
        img.dataset.errorAttempts = attempts.toString();

        if (attempts > allSources.length) return;

        let replacement = null;
        for (let i = 0; i < allSources.length; i++) {
          const candidate = allSources[Math.floor(Math.random() * allSources.length)];
          const candidateUrl = new URL(candidate, window.location.href).href;
          if (candidate && candidateUrl !== img.src) {
            replacement = candidate;
            break;
          }
        }

        if (replacement) {
          img.src = replacement;
        } else {
          slide.remove();
          slides = slides.filter((item) => item !== slide);
          currentIndex = Math.min(currentIndex, slides.length - 1);
          updateSlide();
        }
      };

      slide.appendChild(img);
      slidesContainer.appendChild(slide);
      return slide;
    });

    currentIndex = 0;
    updateSlide();
  }

  async function fetchPhotoManifest() {
    try {
      const response = await fetch('photos/photos.json', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) return data;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function normalizeSources(...lists) {
    const deduped = [];
    const seen = new Set();

    lists.forEach((list) => {
      if (!Array.isArray(list)) return;

      list.forEach((src) => {
        if (!src) return;
        const cleaned = src.toString().trim();
        if (!cleaned) return;

        const prefixed = cleaned.startsWith('photos/') ? cleaned : `photos/${cleaned.replace(/^\/?/, '')}`;
        const extension = prefixed.split('.').pop() || '';

        if (!photoExtensions.test(extension) || seen.has(prefixed)) return;

        seen.add(prefixed);
        deduped.push(prefixed);
      });
    });

    return deduped;
  }

  async function fetchDirectoryListing() {
    try {
      const response = await fetch('photos/');
      if (response.ok) {
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const anchors = Array.from(doc.querySelectorAll('a'));

        const files = anchors
          .map((a) => decodeURIComponent(a.getAttribute('href') || ''))
          .filter((href) => photoExtensions.test(href))
          .map((href) => `photos/${href.replace(/^\/?/, '')}`);

        if (files.length) return files;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  async function loadImages(sources) {
    const checks = await Promise.all(
      sources.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve(src);
            img.onerror = () => resolve(null);
          })
      )
    );
    return checks.filter(Boolean);
  }

  async function loadPhotos() {
    if (status) status.textContent = 'Loading photos...';

    const fromManifest = await fetchPhotoManifest();
    const fromListing = await fetchDirectoryListing();
    const normalized = normalizeSources(fromManifest, fromListing);
    const sources = normalized.length ? normalized : normalizeSources(fallbackPhotos);
    const ordered = orderPhotos(sources);
    const loaded = await loadImages(ordered);

    renderSlides(loaded, ordered);

    if (status && loaded.length) {
      status.textContent = `1 of ${loaded.length}`;
    }
  }

  // Event listeners
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      if (!slides.length) return;

      const direction = button.dataset.direction;
      if (direction === 'next') {
        currentIndex = (currentIndex + 1) % slides.length;
      } else if (direction === 'prev') {
        currentIndex = (currentIndex - 1 + slides.length) % slides.length;
      }

      updateSlide();
    });
  });

  // Keyboard navigation
  carousel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      currentIndex = (currentIndex - 1 + slides.length) % slides.length;
      updateSlide();
    } else if (e.key === 'ArrowRight') {
      currentIndex = (currentIndex + 1) % slides.length;
      updateSlide();
    }
  });

  loadPhotos();
}

/* ==========================================================================
   Partner Logos
   ========================================================================== */

function initPartnerLogos() {
  const partnerSection = document.querySelector('.partners');
  const partnerGrid = document.querySelector('.partner-grid');
  if (!partnerSection || !partnerGrid) return;

  const partnerDescription = partnerSection.querySelector('p');
  const logoExtensions = /(jpe?g|png|gif|webp|avif|svg)$/i;

  function formatLogoAlt(filePath) {
    const base = (filePath.split('/').pop() || '').replace(/\.[^.]+$/, '');
    const cleaned = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned ? `${cleaned} logo` : 'Community partner logo';
  }

  async function fetchLogoManifest() {
    try {
      const response = await fetch('logos/logos.json', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) return data;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  async function fetchLogoListing() {
    try {
      const response = await fetch('logos/');
      if (response.ok) {
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const anchors = Array.from(doc.querySelectorAll('a'));

        const files = anchors
          .map((a) => decodeURIComponent(a.getAttribute('href') || ''))
          .filter((href) => logoExtensions.test(href))
          .map((href) => `logos/${href.replace(/^\/?/, '')}`);

        if (files.length) return files;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function normalizeLogos(...lists) {
    const seen = new Set();
    const normalized = [];

    lists.forEach((list) => {
      if (!Array.isArray(list)) return;

      list.forEach((item) => {
        const { src, alt } = typeof item === 'string' ? { src: item, alt: '' } : item || {};
        const trimmedSrc = (src || '').toString().trim();
        if (!trimmedSrc) return;

        const prefixed = trimmedSrc.startsWith('logos/') ? trimmedSrc : `logos/${trimmedSrc.replace(/^\/?/, '')}`;
        const extension = prefixed.split('.').pop() || '';

        if (!logoExtensions.test(extension) || seen.has(prefixed)) return;
        seen.add(prefixed);

        normalized.push({
          src: prefixed,
          alt: alt && alt.trim() ? alt : formatLogoAlt(prefixed),
        });
      });
    });

    return normalized;
  }

  async function renderPartners() {
    const manifest = await fetchLogoManifest();
    const listing = await fetchLogoListing();
    const logos = normalizeLogos(manifest, listing);

    const images = await Promise.all(
      logos.map(
        (logo) =>
          new Promise((resolve) => {
            const img = new Image();
            img.loading = 'lazy';
            img.decoding = 'async';
            img.src = logo.src;
            img.alt = logo.alt;
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
          })
      )
    );

    const validImages = images.filter(Boolean);

    if (!validImages.length) return;

    partnerGrid.innerHTML = '';
    validImages.forEach((img) => {
      img.setAttribute('role', 'listitem');
      partnerGrid.appendChild(img);
    });

    if (partnerDescription) {
      partnerDescription.textContent = 'Proudly supported by our community partners.';
    }

    partnerSection.hidden = false;
  }

  renderPartners();
}

/* ==========================================================================
   Bulletin Board
   ========================================================================== */

function initBulletinBoard() {
  const section = document.getElementById('bulletin-board');
  if (!section) return;

  const itemsContainer = section.querySelector('.cork-board__items');
  const lightbox = document.querySelector('.lightbox');
  const lightboxImg = lightbox ? lightbox.querySelector('img') : null;
  const imageExtensions = /(jpe?g|png|gif|webp|avif)$/i;
  const excludePattern = /^cork\./i;

  const GITHUB_API = 'https://api.github.com/repos/thomasdisney/lostsierra.kids/contents/bulletin-board';

  const fallbackImages = [
    'bulletin-board/image0.png',
    'bulletin-board/image1.png',
  ];

  async function fetchFromGitHub() {
    try {
      const response = await fetch(GITHUB_API, { cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json();
      if (!Array.isArray(data)) return null;

      return data
        .filter((file) => file.type === 'file' && imageExtensions.test(file.name) && !excludePattern.test(file.name))
        .map((file) => `bulletin-board/${file.name}`);
    } catch (e) { /* ignore */ }
    return null;
  }

  function dedupe(sources) {
    const seen = new Set();
    return sources.filter((src) => {
      if (seen.has(src)) return false;
      seen.add(src);
      return true;
    });
  }

  async function verifyImages(sources) {
    const results = await Promise.all(
      sources.map((src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = () => resolve(src);
          img.onerror = () => resolve(null);
        })
      )
    );
    return results.filter(Boolean);
  }

  // Lightbox logic
  function openLightbox(src) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = 'Bulletin board image';
    lightbox.hidden = false;
    requestAnimationFrame(() => lightbox.classList.add('active'));
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
      lightbox.hidden = true;
      if (lightboxImg) lightboxImg.src = '';
    }, 300);
  }

  if (lightbox) {
    lightbox.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
      }
    });
  }

  async function render() {
    const fromGitHub = await fetchFromGitHub();
    const sources = dedupe(fromGitHub || fallbackImages);
    const verified = await verifyImages(sources);

    if (!verified.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;

    if (itemsContainer) {
      itemsContainer.innerHTML = '';
      verified.forEach((src) => {
        const item = document.createElement('div');
        item.className = 'cork-board__item';

        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Bulletin board posting';
        img.loading = 'lazy';
        img.decoding = 'async';

        item.appendChild(img);
        item.addEventListener('click', () => openLightbox(src));
        itemsContainer.appendChild(item);
      });
    }
  }

  render();
}
