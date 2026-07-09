// frontend\public\custom-scripts.js
// ==========================================
// SIDEBAR NAVIGATION FUNCTIONS
// ==========================================

function _isMobile() {
    return window.innerWidth <= 768;
}

function toggleSidebar() {
    // On mobile, delegate to toggleMobileSidebar so the correct
    // mobile-open class is toggled (not the desktop collapsed class).
    if (_isMobile()) {
        toggleMobileSidebar();
        return;
    }

    const sidebar = $('#mainSidebar');
    sidebar.toggleClass('collapsed');
    const isCollapsed = sidebar.hasClass('collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed);
    setTimeout(updateTooltips, 300);
}

function toggleMobileSidebar() {
    const sidebar = $('#mainSidebar');
    const overlay = $('#sidebarOverlay');
    const isOpen = sidebar.hasClass('mobile-open');
    if (isOpen) {
        sidebar.removeClass('mobile-open');
        overlay.removeClass('active');
    } else {
        sidebar.addClass('mobile-open');
        overlay.addClass('active');
    }
}

function closeMobileSidebar() {
    $('#mainSidebar').removeClass('mobile-open');
    $('#sidebarOverlay').removeClass('active');
}

function switchModule(moduleName) {
    $('.module-container').removeClass('active');
    $(`#module-${moduleName}`).addClass('active');
    $('.sidebar-menu-item').removeClass('active');
    $(`#menu-${moduleName}`).addClass('active');
    closeMobileSidebar();
    localStorage.setItem('currentModule', moduleName);
    if (typeof window.onModuleShown === 'function') {
        window.onModuleShown(moduleName);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateTooltips() {
    const sidebar = $('#mainSidebar');
    if (sidebar.hasClass('collapsed')) {
        $('#menu-carbon').attr('data-tooltip', 'Analisis Stok Karbon');
        $('#menu-disaster').attr('data-tooltip', 'Pemetaan Bencana');
    } else {
        $('.sidebar-menu-item').removeAttr('data-tooltip');
    }
}

// Initialize
$(document).ready(function () {
    console.log('🚀 Initializing sidebar...');

    const savedState = localStorage.getItem('sidebarCollapsed');
    if (savedState === null || savedState === 'true') {
        $('#mainSidebar').addClass('collapsed');
    } else {
        $('#mainSidebar').removeClass('collapsed');
    }

    const currentModule = localStorage.getItem('currentModule') || 'carbon';
    switchModule(currentModule);
    updateTooltips();

    // Overlay click: close sidebar
    $('#sidebarOverlay').on('click touchstart', function (e) {
        e.preventDefault();
        closeMobileSidebar();
    });
});

// Close mobile sidebar when tapping outside (click + touchstart).
// Check both the sidebar AND the toggle button (including their children)
// to avoid the bug where tapping the icon inside the button triggers this.
$(document).on('click touchstart', function (e) {
    const sidebar = $('#mainSidebar');
    const toggleBtn = $('.mobile-menu-toggle');

    if (!sidebar.hasClass('mobile-open')) return;

    const insideSidebar = sidebar.is(e.target) || sidebar.has(e.target).length > 0;
    const insideToggle = toggleBtn.is(e.target) || toggleBtn.has(e.target).length > 0;

    if (!insideSidebar && !insideToggle) {
        closeMobileSidebar();
    }
});

// Global functions
window.toggleSidebar = toggleSidebar;
window.toggleMobileSidebar = toggleMobileSidebar;
window.switchModule = switchModule;
