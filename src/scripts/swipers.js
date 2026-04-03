import Swiper from 'swiper';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

// ── Team Swiper ──────────────────────────────────────────────
export function initTeamSwiper() {
    const el = document.querySelector('.team-carousel .swiper');
    if (!el) return;

    const THRESHOLD = 4;

    const swiper = new Swiper(el, {
        modules: [Navigation, Pagination],

        slidesPerView: 1,
        spaceBetween: 24,
        centeredSlides: false,
        centerInsufficientSlides: true,
        grabCursor: true,
        speed: 500,

        breakpoints: {
            768: {
                slidesPerView: 2,
            },
            1024: {
                slidesPerView: 'auto',
            },
        },

        navigation: {
            prevEl: '.team-btn-prev',
            nextEl: '.team-btn-next',
        },

        pagination: {
            el: '.swiper-pagination-team',
            clickable: true,
            type: 'bullets',
        },

        keyboard: {
            enabled: true,
            onlyInViewport: true,
        },

        on: {
            init(sw) {
                sw.el.classList.add('swiper-loaded');
                const hide = sw.slides.length < THRESHOLD;
                const navWrap = document.querySelector('.team-nav');
                const pag = document.querySelector('.swiper-pagination-team');
                if (navWrap) navWrap.style.visibility = hide ? 'hidden' : '';
                if (pag) pag.style.visibility = hide ? 'hidden' : '';
            },
        },
    });

    return swiper;
}
