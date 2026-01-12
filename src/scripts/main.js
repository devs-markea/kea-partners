// Tu código JS aquí (el del menú)
console.log('main.js loaded!');

// MENÚ PRINCIPAL
const menuToggle = document.getElementById('menu-toggle');
const closeMenu = document.getElementById('close-menu');
const sideMenu = document.getElementById('side-menu');
const overlay = document.getElementById('overlay');

// Abrir menú
menuToggle?.addEventListener('click', () => {
    sideMenu.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
    menuToggle.classList.add('hidden');
});

// Cerrar menú
closeMenu?.addEventListener('click', () => {
    sideMenu.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
    menuToggle.classList.remove('hidden');
});

// Cerrar tocando el overlay
overlay?.addEventListener('click', () => {
    sideMenu.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
    menuToggle.classList.remove('hidden');
});

// Submenús con animación y rotación

const mainMenuBtn = document.querySelector('[data-mainmenu]');
const mainMenu = document.getElementById('main-menu');

if (mainMenuBtn && mainMenu) {
    mainMenuBtn.addEventListener('click', () => {
        mainMenu.classList.toggle('submenu-open');
        const icon = mainMenuBtn.querySelector('.submenu-icon');
        if (icon) icon.classList.toggle('rotate-180');
    });
}

// MENÚS TOPICS
const menuTopicsToggle = document.getElementById('menu-topics-toggle');
const closeTopicsMenu = document.getElementById('close-topics-menu');
const sideTopicsMenu = document.getElementById('side-topics-menu');
// const overlay = document.getElementById('overlay');

// Abrir menú
menuTopicsToggle?.addEventListener('click', () => {
    sideTopicsMenu.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
    menuToggle.classList.add('hidden');
});

// Cerrar menú
closeTopicsMenu?.addEventListener('click', () => {
    sideTopicsMenu.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
    menuToggle.classList.remove('hidden');
});

// Cerrar tocando el overlay
overlay?.addEventListener('click', () => {
    sideTopicsMenu.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
    menuToggle.classList.remove('hidden');
});

document.querySelectorAll('[data-submenu]').forEach(button => {
    button.addEventListener('click', () => {
        const submenuId = 'submenu-' + button.dataset.submenu;
        const submenu = document.getElementById(submenuId);
        const icon = button.querySelector('.submenu-icon');

        if (!submenu) return;
        submenu.classList.toggle('submenu-open');

        if (icon) icon.classList.toggle('rotate-180');

        if (button.dataset.submenu === 'menu-topics') {
            button.classList.toggle('font-medium');
        }
        if (button.dataset.submenu === 'menu-topics-content') {
            button.classList.toggle('font-medium');
        }
    });
});


