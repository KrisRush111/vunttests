const SERVER_URL = 'сервертут';
        
        let userData = null; 
        let wallpaperState = {
            enabled: false,
            selectedWallpaper: 'default',
            blur: 10,
            brightness: 80
        };

        
        const VIRTUAL_USER = {
            platform_user_id: '777777',
            nickname: 'Николай Семенов',
            avatar_background: '#40a7e3',
            has_avatar: false,
            identity: 'Ученик',
            main_school_name: 'Школа №72',
            class_number: '7',
            class_letter: 'А',
            specialization: 'Физико-математический',
            course: 'Основная программа',
            subject1: 'Математика',
            subject2: 'Физика'
        };

        function checkAuthorization() {
            
            const sessionUser = sessionStorage.getItem('userData');
            if (sessionUser) {
                try {
                    userData = JSON.parse(sessionUser);
                    if (userData && userData.platform_user_id) {
                        return true;
                    }
                } catch (error) {
                    console.error('Error parsing session user data:', error);
                }
            }
            
            
            const rememberedUser = localStorage.getItem('rememberedUser');
            if (rememberedUser) {
                try {
                    userData = JSON.parse(rememberedUser);
                    if (userData && userData.platform_user_id) {
                        
                        sessionStorage.setItem('userData', rememberedUser);
                        return true;
                    }
                } catch (error) {
                    console.error('Error parsing remembered user:', error);
                    localStorage.removeItem('rememberedUser');
                }
            }


            const isLocalFile = window.location.protocol === 'file:';
            if (isLocalFile) {
                console.log('Developer mode: using virtual account');
                userData = VIRTUAL_USER;
          
                sessionStorage.setItem('userData', JSON.stringify(userData));
                
          
                if (!localStorage.getItem('vuntgram_wallpaper')) {
                    wallpaperState = {
                        enabled: true,
                        selectedWallpaper: 'default',
                        blur: 0,
                        brightness: 100
                    };
                    localStorage.setItem('vuntgram_wallpaper', JSON.stringify(wallpaperState));
                }
                return true;
            }
            
            
            console.log('No valid user data found, redirecting to login');
            window.location.href = 'index.html';
            return false;
        }

        const messageBox = document.getElementById('messageBox'); 
        const avatarInput = document.getElementById('avatar-input');
        const soonMessage = document.getElementById('soonMessage');

       
        const profileAvatarMobile = document.getElementById('profile-avatar');
        const profileNicknameMobile = document.getElementById('profile-nickname');
        const profileIdMobile = document.getElementById('profile-id');
        const mainSchoolMobile = document.getElementById('main-school');
        const userClassMobile = document.getElementById('user-class');
        const userRoleMobile = document.getElementById('user-role');
        const additionalSchoolMobile = document.getElementById('additional-school');
        const userSpecializationMobile = document.getElementById('user-specialization');
        const userCourseMobile = document.getElementById('user-course');
        const additionalSchoolContainerMobile = document.getElementById('additional-school-container');
        const specializationContainerMobile = document.getElementById('specialization-container');
        const courseContainerMobile = document.getElementById('course-container');
        const mobileProfileContainer = document.querySelector('.profile-container.mobile-only'); 
        const mobileSettingsView = document.querySelector('.mobile-settings-view'); 
        const mobileBottomNav = document.querySelector('.bottom-nav.mobile-only-nav');

        
        const desktopSidebar = document.querySelector('.desktop-sidebar');
        const desktopContent = document.querySelector('.desktop-content');
        const desktopPlaceholder = document.getElementById('desktopPlaceholder');
        const profileModalDesktop = document.getElementById('profileModalDesktop');
        const desktopProfileAvatar = document.getElementById('desktop-profile-avatar');
        const desktopProfileNickname = document.getElementById('desktop-profile-nickname');
        const desktopProfileId = document.getElementById('desktop-profile-id');
        const desktopMainSchool = document.getElementById('desktop-main-school');
        const desktopUserClass = document.getElementById('desktop-user-class');
        const desktopUserRole = document.getElementById('desktop-user-role');
        const desktopAdditionalSchool = document.getElementById('desktop-additional-school');
        const desktopUserSpecialization = document.getElementById('desktop-user-specialization');
        const desktopUserCourse = document.getElementById('desktop-user-course');
        const desktopAdditionalSchoolContainer = document.getElementById('desktop-additional-school-container');
        const desktopSpecializationContainer = document.getElementById('desktop-specialization-container');
        const desktopCourseContainer = document.getElementById('desktop-course-container');
        const sidebarProfileAvatar = document.getElementById('sidebar-profile-avatar');
        const sidebarProfileNickname = document.getElementById('sidebar-profile-nickname');
        const sidebarProfileId = document.getElementById('sidebar-profile-id'); 
        const desktopBottomNav = document.querySelector('.bottom-nav.desktop-only-nav');
        const searchInputDesktop = document.getElementById('searchInputDesktop'); 
        const desktopSidebarHeader = document.getElementById('desktopSidebarHeader');

        
        const mobileSidebarHeader = document.getElementById('mobileSidebarHeader');
        const mobileSidebarProfileAvatar = document.getElementById('mobile-sidebar-profile-avatar');
        const mobileSidebarProfileNickname = document.getElementById('mobile-sidebar-profile-nickname');
        const mobileSidebarProfileId = document.getElementById('mobile-sidebar-profile-id');
        const searchInputMobile = document.getElementById('searchInputMobile');

        
        const privacyModule = document.getElementById('privacyModule'); 
        const appearanceModule = document.getElementById('appearanceModule'); 
        const profileModalMobile = document.getElementById('profileModalMobile'); 
        const privacyModuleMobile = document.getElementById('privacyModuleMobile'); 
        const appearanceModuleMobile = document.getElementById('appearanceModuleMobile'); 

       
        const avatarModal = document.getElementById('avatarModal');
        const avatarModalImage = document.getElementById('avatarModalImage');
        const avatarModalClose = document.querySelector('.avatar-modal-close');
        const changeAvatarBtn = document.getElementById('changeAvatarBtn');
        const deleteAvatarBtn = document.getElementById('deleteAvatarBtn');

   
        const myProfileBtn = document.getElementById('myProfileBtn'); 
        const privacyBtn = document.getElementById('privacyBtn'); 
        const appearanceBtn = document.getElementById('appearanceBtn'); 
        const faqBtn = document.getElementById('faqBtn'); 

        const myProfileBtnMobile = document.getElementById('myProfileBtnMobile'); 
        const privacyBtnMobile = document.getElementById('privacyBtnMobile'); 
        const appearanceBtnMobile = document.getElementById('appearanceBtnMobile'); 
        const faqBtnMobile = document.getElementById('faqBtnMobile'); 

        const profileModalMobileBackBtn = document.getElementById('profileModalMobileBackBtn');
        const privacyModuleMobileBackBtn = document.getElementById('privacyModuleMobileBackBtn');
        const appearanceModuleMobileBackBtn = document.getElementById('appearanceModuleMobileBackBtn');


                
        const logoutBtn = document.getElementById('logoutBtn');
        const logoutBtnMobile = document.getElementById('logoutBtnMobile');
        const logoutModal = document.getElementById('logoutModal');
        const logoutCancel = document.getElementById('logoutCancel');
        const logoutConfirm = document.getElementById('logoutConfirm');









const WALLPAPERS = [
    {
        id: 'default',
        name: 'Системные',
        url: 'фон.webp',
        isDefault: true
    },
    {
        id: 'wall1',
        name: 'Фиолетовые',
        url: 'фон3.webp'
    },
    {
        id: 'wall6',
        name: 'фиолетово-розовые',
        url: 'фон8.webp'
    },
    {
        id: 'wall2',
        name: 'Светлые',
        url: 'фон4.webp'
    },
    {
        id: 'wall5',
        name: 'сине-зелёные',
        url: 'фон7.webp'
    },
    {
        id: 'wall3',
        name: 'зелёно-розовые',
        url: 'фон5.webp'
    },
    {
        id: 'wall4',
        name: 'Темные',
        url: 'фон6.webp'
    },
    {
        id: 'wall7',
        name: 'жёлто-зелёные',
        url: 'фон9.webp'
    }
];


function initializeWallpaperSystem() {
    loadWallpaperSettings();
    createWallpaperGrids(); 
    applyWallpaper();
    updateDesktopPlaceholderWallpaper();
    setupWallpaperEventListeners();
    setupWallpaperBroadcastListener();
    
   
    setTimeout(() => {
        const messages = document.querySelectorAll('.chat-preview-message');
        messages.forEach((message, index) => {
            message.style.animationDelay = `${index * 0.1}s`;
        });
    }, 100);
    
   
    const selectedWallpaper = WALLPAPERS.find(w => w.id === wallpaperState.selectedWallpaper);
    if (selectedWallpaper) {
        const previewContainers = document.querySelectorAll('.chat-preview-messages');
        previewContainers.forEach(container => {
            container.style.backgroundImage = wallpaperState.selectedWallpaper === 'default' ? 'none' : `url('${selectedWallpaper.url}')`;
            container.style.backgroundSize = 'cover';
            container.style.backgroundPosition = 'center';
            container.style.backgroundColor = wallpaperState.selectedWallpaper === 'default' ? 'var(--telegram-secondary-bg)' : '';
        });
        
      
        const wallpaperNameElements = document.querySelectorAll('#selectedWallpaperName, #selectedWallpaperNameDesktop');
        wallpaperNameElements.forEach(el => {
            if (el) el.textContent = selectedWallpaper.name;
        });
    }
    
    setTimeout(() => {
        updateWallpaperSelectionUI(wallpaperState.selectedWallpaper);
        updateWallpaperControls();
    }, 100);
}




function updateChatPreviewWallpaper() {
    const selectedWallpaper = WALLPAPERS.find(w => w.id === wallpaperState.selectedWallpaper);
    if (selectedWallpaper) {
        const previewContainers = document.querySelectorAll('.chat-preview-messages');
        previewContainers.forEach(container => {
            
            container.style.backgroundImage = `url('${selectedWallpaper.url}')`;
            container.style.backgroundSize = 'cover';
            container.style.backgroundPosition = 'center';
            container.style.backgroundColor = '';
            
          
            console.log('Wallpaper applied:', selectedWallpaper.url, 'isDefault:', wallpaperState.selectedWallpaper === 'default');
        });
        
        
        const wallpaperNameElements = document.querySelectorAll('#selectedWallpaperName, #selectedWallpaperNameDesktop');
        wallpaperNameElements.forEach(el => {
            if (el) el.textContent = selectedWallpaper.name;
        });
    }
}



function loadWallpaperSettings() {
    const saved = localStorage.getItem('vuntgram_wallpaper');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            wallpaperState = {
                enabled: parsed.enabled || false,
                selectedWallpaper: parsed.selectedWallpaper || 'default',
            };
            
            
            const wallpaperNameElements = document.querySelectorAll('#selectedWallpaperName, #selectedWallpaperNameDesktop');
            wallpaperNameElements.forEach(el => {
                if (el) {
                    const wallpaper = WALLPAPERS.find(w => w.id === wallpaperState.selectedWallpaper);
                    el.textContent = wallpaper?.name || 'Системные';
                }
            });
            
            
            updateChatPreviewWallpaper();
            
        } catch (e) {
            console.error('Error loading wallpaper settings:', e);
            saveWallpaperSettings();
        }
    }
}


function setupWallpaperButtons() {
    const wallpaperButtons = document.querySelectorAll('.wallpaper-btn');
    
    wallpaperButtons.forEach(btn => {
       
        btn.replaceWith(btn.cloneNode(true));
    });
    
   
    document.querySelectorAll('.wallpaper-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); 
            
            const wallpaperId = this.dataset.wallpaperId;
            const wallpaperUrl = this.dataset.wallpaperUrl;
            
            
            const wallpaperState = {
                enabled: true,
                selectedWallpaper: wallpaperId,
                blur: localStorage.getItem('wallpaperBlur') || 10,
                brightness: localStorage.getItem('wallpaperBrightness') || 80
            };
            
            localStorage.setItem('vuntgram_wallpaper', JSON.stringify(wallpaperState));
            
            
            document.body.style.backgroundImage = `url('${wallpaperUrl}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            
          
            wallpaperButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
     
            if (typeof BroadcastChannel !== 'undefined') {
                const channel = new BroadcastChannel('vuntgram_wallpaper');
                channel.postMessage({type: 'wallpaper_update'});
            }
        });
    });
}


document.addEventListener('DOMContentLoaded', function() {
    if (typeof initializeWallpaperSystem === 'function') {
        initializeWallpaperSystem();
    }
    setupWallpaperButtons();
});


function saveWallpaperSettings() {
    const settingsToSave = {
        enabled: wallpaperState.enabled,
        selectedWallpaper: wallpaperState.selectedWallpaper
    };
    
    localStorage.setItem('vuntgram_wallpaper', JSON.stringify(settingsToSave));
    sessionStorage.setItem('wallpaper_settings', JSON.stringify(settingsToSave));
    
    
    broadcastWallpaperUpdate();
}


function updateDesktopPlaceholderWallpaper() {
    const desktopPlaceholder = document.getElementById('desktopPlaceholder');
    if (!desktopPlaceholder) return;
   
    const isPlaceholderVisible = desktopPlaceholder.style.display !== 'none';
    
    if (wallpaperState.enabled && isPlaceholderVisible) {
        const selectedWallpaper = WALLPAPERS.find(w => w.id === wallpaperState.selectedWallpaper);
        if (selectedWallpaper) {
            desktopPlaceholder.classList.add('wallpaper-enabled');
            desktopPlaceholder.style.backgroundImage = `url('${selectedWallpaper.url}')`;
            desktopPlaceholder.style.filter = `brightness(${wallpaperState.brightness}%)`;
        }
    } else {
        desktopPlaceholder.classList.remove('wallpaper-enabled');
        desktopPlaceholder.style.backgroundImage = '';
        desktopPlaceholder.style.filter = '';
        desktopPlaceholder.style.backgroundColor = 'var(--telegram-secondary-bg)';
    }
}


function createWallpaperGrids() {
    const grids = ['wallpaperGridDesktop', 'wallpaperGridMobile'];
    
    grids.forEach(gridId => {
        const grid = document.getElementById(gridId);
        if (!grid) {
            console.warn(`Grid not found: ${gridId}`);
            return;
        }
        
        
        grid.innerHTML = '';
        
        
        WALLPAPERS.forEach(wallpaper => {
            const wallpaperItem = document.createElement('div');
            wallpaperItem.className = 'wallpaper-item';
            wallpaperItem.dataset.wallpaperId = wallpaper.id;
            
            
            if (wallpaper.id === wallpaperState.selectedWallpaper) {
                wallpaperItem.classList.add('selected');
            }
            
            
            wallpaperItem.innerHTML = `
                <div class="wallpaper-preview" style="background-image: url('${wallpaper.url}');"></div>
                <div class="wallpaper-label">${wallpaper.name}</div>
            `;
            
            
            if (wallpaper.id === wallpaperState.selectedWallpaper) {
                const checkmark = document.createElement('div');
                checkmark.className = 'wallpaper-checkmark';
                checkmark.innerHTML = '<i class="fas fa-check"></i>';
                wallpaperItem.appendChild(checkmark);
            }
            
            grid.appendChild(wallpaperItem);
        });
    });
    
    
    updateWallpaperControls();
}



function updateWallpaperControls() {
    ['wallpaperToggleDesktop', 'wallpaperToggleMobile'].forEach(toggleId => {
        const toggle = document.getElementById(toggleId);
        if (toggle) {
            toggle.checked = wallpaperState.enabled;
        }
    });
    
}


function setupWallpaperEventListeners() {

    document.querySelectorAll('.wallpaper-item').forEach(item => {
        item.replaceWith(item.cloneNode(true));
    });
    
    
    document.addEventListener('click', (e) => {
        const wallpaperItem = e.target.closest('.wallpaper-item');
        if (wallpaperItem) {
            e.preventDefault();
            e.stopPropagation();
            
            const wallpaperId = wallpaperItem.dataset.wallpaperId;
            console.log('Wallpaper item clicked:', wallpaperId);
            
            
            wallpaperItem.style.pointerEvents = 'none';
            setTimeout(() => {
                wallpaperItem.style.pointerEvents = '';
            }, 300);
            
            selectWallpaper(wallpaperId);
        }
    });
    
    
    document.addEventListener('touchstart', (e) => {
        const wallpaperItem = e.target.closest('.wallpaper-item');
        if (wallpaperItem) {
            
            wallpaperItem.style.transform = 'scale(0.95)';
        }
    });
    
    document.addEventListener('touchend', (e) => {
        const wallpaperItem = e.target.closest('.wallpaper-item');
        if (wallpaperItem) {
            wallpaperItem.style.transform = '';
        }
    });
    
    
    ['wallpaperToggleDesktop', 'wallpaperToggleMobile'].forEach(toggleId => {
        const toggle = document.getElementById(toggleId);
        if (toggle) {
            toggle.removeEventListener('change', toggleChangeHandler);
            

            const toggleChangeHandler = (e) => {
                wallpaperState.enabled = e.target.checked;
                saveWallpaperSettings();
                applyWallpaper();
                updateDesktopPlaceholderWallpaper();
            };
            
            toggle.addEventListener('change', toggleChangeHandler);
        }
    });
    

}


function selectWallpaper(wallpaperId) {
    const wallpaper = WALLPAPERS.find(w => w.id === wallpaperId);
    if (!wallpaper) return;
    
    wallpaperState.selectedWallpaper = wallpaperId;
    wallpaperState.enabled = true;
    
    
    const previewContainers = document.querySelectorAll('.chat-preview-messages');
    previewContainers.forEach(container => {
        container.style.backgroundImage = wallpaperId === 'default' ? 'none' : `url('${wallpaper.url}')`;
        container.style.backgroundSize = 'cover';
        container.style.backgroundPosition = 'center';
        container.style.backgroundColor = wallpaperId === 'default' ? 'var(--telegram-secondary-bg)' : '';
    });
    
    
    const wallpaperNameElements = document.querySelectorAll('#selectedWallpaperName, #selectedWallpaperNameDesktop');
    wallpaperNameElements.forEach(el => {
        if (el) el.textContent = wallpaper.name;
    });
    

    updateChatPreviewWallpaper();

    
    updateWallpaperSelectionUI(wallpaperId);
    
    
    saveWallpaperSettings();
    applyWallpaper();
    
    
    updateWallpaperControls();
}



function updateWallpaperSelectionUI(selectedId) {
    
    document.querySelectorAll('.wallpaper-item').forEach(item => {
        item.classList.remove('selected');
        
        
        const existingCheckmark = item.querySelector('.wallpaper-checkmark');
        if (existingCheckmark) {
            existingCheckmark.remove();
        }
    });
    
    
    document.querySelectorAll(`[data-wallpaper-id="${selectedId}"]`).forEach(item => {
        item.classList.add('selected');
        
        
        const checkmark = document.createElement('div');
        checkmark.className = 'wallpaper-checkmark';
        checkmark.innerHTML = '<i class="fas fa-check"></i>';
        item.appendChild(checkmark);
    });
}



function applyWallpaper() {
    const selectedWallpaper = WALLPAPERS.find(w => w.id === wallpaperState.selectedWallpaper);
    const desktopPlaceholder = document.getElementById('desktopPlaceholder');
    
    if (!selectedWallpaper || !desktopPlaceholder) {
        console.error('Wallpaper or placeholder not found');
        return;
    }
    
    
    document.body.classList.remove('wallpaper-enabled');
    document.body.style.backgroundColor = 'var(--telegram-secondary-bg)'; 
    document.body.style.backgroundImage = '';
    document.body.style.filter = '';
    
    
    document.documentElement.style.setProperty('--wallpaper-url', 'none');
    
    
    if (wallpaperState.enabled) {
        desktopPlaceholder.classList.add('wallpaper-enabled');
        desktopPlaceholder.style.backgroundImage = `url('${selectedWallpaper.url}')`;
        desktopPlaceholder.style.backgroundColor = ''; 
    } else {
        desktopPlaceholder.classList.remove('wallpaper-enabled');
        desktopPlaceholder.style.backgroundImage = '';
        desktopPlaceholder.style.filter = '';
        
        desktopPlaceholder.style.backgroundColor = 'var(--telegram-secondary-bg)';
    }
    

    updateChatPreviewWallpaper();

    
    const modules = [
        profileModalDesktop,
        privacyModule,
        appearanceModule,
        profileModalMobile,
        privacyModuleMobile,
        appearanceModuleMobile,
        mobileSettingsView,
        desktopSidebar
    ];
    
    modules.forEach(module => {
        if (module) {
            module.style.backgroundColor = 'var(--telegram-secondary-bg)';
            module.style.backgroundImage = '';
            
            
            const content = module.querySelector('.desktop-module-content') || 
                           module.querySelector('.profile-modal-content');
            if (content) {
                content.style.backgroundColor = 'var(--telegram-secondary-bg)';
                content.style.backgroundImage = '';
            }
        }
    });
    
    
    broadcastWallpaperUpdate();
}
function hideAllDesktopModules() {
    const allModules = [profileModalDesktop, privacyModule, appearanceModule];
    allModules.forEach(mod => {
        if (mod) mod.classList.remove('visible');
    });
    desktopPlaceholder.style.display = 'flex'; 
    
    
    setTimeout(() => {
        updateDesktopPlaceholderWallpaper();
    }, 50);
}

function broadcastWallpaperUpdate() {
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel('vuntgram_wallpaper');
            channel.postMessage({
                type: 'wallpaper_update',
                data: {
                    enabled: wallpaperState.enabled,
                    selectedWallpaper: wallpaperState.selectedWallpaper
                }
            });
            channel.close();
        } catch (e) {
            console.error('BroadcastChannel error:', e);
        }
    }
}



function setupWallpaperBroadcastListener() {
    if (typeof BroadcastChannel !== 'undefined') {
        try {
            const channel = new BroadcastChannel('vuntgram_wallpaper');
            channel.addEventListener('message', (event) => {
                if (event.data.type === 'wallpaper_update') {
                    wallpaperState = {
                        enabled: event.data.data.enabled,
                        selectedWallpaper: event.data.data.selectedWallpaper,
                    };
                    updateWallpaperControls();
                    createWallpaperGrids();
                    applyWallpaper();
                    updateDesktopPlaceholderWallpaper();
                    updateChatPreviewWallpaper();
                }
            });
        } catch (e) {
            console.error('BroadcastChannel listener error:', e);
        }
    }
}





function updateAppearanceUI() {
    createWallpaperGrids();
    updateWallpaperControls();
    updateDesktopPlaceholderWallpaper();
    
    
    const messages = document.querySelectorAll('.chat-preview-message');
    messages.forEach((message, index) => {
        message.style.animationDelay = `${index * 0.1}s`;
    });
    
    
    const selectedWallpaper = WALLPAPERS.find(w => w.id === wallpaperState.selectedWallpaper);
    if (selectedWallpaper) {
        const previewContainers = document.querySelectorAll('.chat-preview-messages');
        previewContainers.forEach(container => {
            container.style.backgroundImage = wallpaperState.selectedWallpaper === 'default' ? 'none' : `url('${selectedWallpaper.url}')`;
            container.style.backgroundSize = 'cover';
            container.style.backgroundPosition = 'center';
            container.style.backgroundColor = wallpaperState.selectedWallpaper === 'default' ? 'var(--telegram-secondary-bg)' : '';
        });
        
        const wallpaperNameElements = document.querySelectorAll('#selectedWallpaperName, #selectedWallpaperNameDesktop');
        wallpaperNameElements.forEach(el => {
            if (el) el.textContent = selectedWallpaper.name;
        });
    }
}



document.addEventListener('DOMContentLoaded', () => {
    
    if (!checkAuthorization()) {
        return;
    }
    
    
    initializeLayout();
    loadProfileData();
    
    
    initializeWallpaperSystem();
    
    
    if (appearanceBtn) {
        appearanceBtn.addEventListener('click', updateAppearanceUI);
    }
    
    if (appearanceBtnMobile) {
        appearanceBtnMobile.addEventListener('click', updateAppearanceUI);
    }
});


window.addEventListener('resize', () => {
    const newIsDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (newIsDesktop !== isDesktop) {
        initializeLayout();
        updateProfileUI();
        createWallpaperGrids(); 
        updateDesktopPlaceholderWallpaper(); 
    }
});


        
const internalPages = ["chats.html", "profile.html", "contacts.html"];


localStorage.setItem("inside_site", "yes");


window.addEventListener("beforeunload", () => {
    localStorage.removeItem("inside_site");
});


        
        function showLogoutModal() {
            logoutModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function hideLogoutModal() {
            logoutModal.classList.remove('active');
            document.body.style.overflow = '';
        }

        function performLogout() {
            
            sessionStorage.removeItem('userData');
            localStorage.removeItem('rememberedUser');
            localStorage.removeItem('consentAccepted'); 
            
            
            window.location.href = 'index.html';
        }

        
        logoutBtn.addEventListener('click', showLogoutModal);
        logoutBtnMobile.addEventListener('click', showLogoutModal);
        logoutCancel.addEventListener('click', hideLogoutModal);
        logoutConfirm.addEventListener('click', performLogout);

        
        logoutModal.addEventListener('click', (e) => {
            if (e.target === logoutModal) {
                hideLogoutModal();
            }
        });

        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && logoutModal.classList.contains('active')) {
                hideLogoutModal();
            }
        });




        let isDesktop = window.matchMedia("(min-width: 768px)").matches;

        
        function getActiveElements() {
            if (isDesktop) {
                return {
                    profileAvatar: desktopProfileAvatar,
                    profileNickname: desktopProfileNickname,
                    profileId: desktopProfileId,
                    mainSchool: desktopMainSchool,
                    userClass: desktopUserClass,
                    userRole: desktopUserRole,
                    additionalSchool: desktopAdditionalSchool,
                    userSpecialization: desktopUserSpecialization,
                    userCourse: desktopUserCourse,
                    additionalSchoolContainer: desktopAdditionalSchoolContainer,
                    specializationContainer: desktopSpecializationContainer,
                    courseContainer: desktopCourseContainer
                };
            } else {
                return {
                    profileAvatar: profileAvatarMobile,
                    profileNickname: profileNicknameMobile,
                    profileId: profileIdMobile,
                    mainSchool: mainSchoolMobile,
                    userClass: userClassMobile,
                    userRole: userRoleMobile,
                    additionalSchool: additionalSchoolMobile,
                    userSpecialization: userSpecializationMobile,
                    userCourse: userCourseMobile,
                    additionalSchoolContainer: additionalSchoolContainerMobile,
                    specializationContainer: specializationContainerMobile,
                    courseContainer: courseContainerMobile
                };
            }
        }

       
        function showMessage(message, type = 'error') {
            
            if (!isDesktop) { 
                messageBox.textContent = message;
                messageBox.className = `message-box ${type}`;
                messageBox.style.display = 'block';
                setTimeout(() => {
                    messageBox.style.display = 'none';
                }, 5000);
            } else {
                console.log(`Message (${type}): ${message}`);
            }
        }

    
        
      
        

        function hideAllDesktopModules() {
            const allModules = [profileModalDesktop, privacyModule, appearanceModule];
            allModules.forEach(mod => {
                if (mod) mod.classList.remove('visible');
            });
            desktopPlaceholder.style.display = 'flex'; 
        }

        function showDesktopModule(moduleElement) {
            hideAllDesktopModules(); 
            desktopPlaceholder.style.display = 'none'; 
            if (moduleElement) {
                moduleElement.classList.add('visible');
                desktopContent.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }

        function hideAllMobileModals() {
            const allModals = [profileModalMobile, privacyModuleMobile, appearanceModuleMobile];
            allModals.forEach(modal => {
                if (modal) modal.classList.remove('visible');
            });
            mobileSettingsView.style.display = 'flex'; 

             document.querySelector('.bottom-nav.mobile-only-nav').style.display = 'flex';
        }

        function showMobileModal(modalElement) {
            hideAllMobileModals(); 
              document.querySelector('.bottom-nav.mobile-only-nav').style.display = 'none';
            mobileSettingsView.style.display = 'none'; 
            if (modalElement) {
                modalElement.classList.add('visible');
                modalElement.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }


        function adjustColor(hex, percent) {
            const num = parseInt(hex.replace("#", ""), 16);
            const amt = Math.round(2.55 * percent);
            const R = (num >> 16) + amt;
            const G = (num >> 8 & 0x00FF) + amt;
            const B = (num & 0x0000FF) + amt;
            
            return `#${
                (0x1000000 +
                (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
                (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
                (B < 255 ? (B < 1 ? 0 : B) : 255)
            ).toString(16).slice(1)}`;
        }

      
        function setAvatarBackground(element, color, letter) {
            element.textContent = letter;
            element.style.backgroundImage = '';
            element.style.backgroundColor = 'var(--telegram-bg)'; 
            
            if (color) {
                const lighterColor = adjustColor(color, 20);
                element.style.background = 
                    `linear-gradient(135deg, ${color}, ${lighterColor})`;
            } else {
                const avatarColors = [
                    ['#0088cc', '#40a7e3'],
                    ['#4CAF50', '#8BC34A'],
                    ['#FF5252', '#FF7B7B'],
                    ['#9C27B0', '#E040FB'],
                    ['#FFC107', '#FFD54F'],
                    ['#00BCD4', '#80DEEA'],
                    ['#FF9800', '#FFB74D'],
                ];
                const colorPair = avatarColors[Math.floor(Math.random() * avatarColors.length)];
                element.style.background = 
                    `linear-gradient(135deg, ${colorPair[0]}, ${colorPair[1]})`;
            }
        }

 
        function loadAvatar(element, userId) {
            const avatarUrl = `${SERVER_URL}/avatar/${userId}?t=${Date.now()}`;
            const img = new Image();
            
            img.onload = function() {
                element.style.backgroundImage = `url(${avatarUrl})`;
                element.style.backgroundSize = 'cover';
                element.style.backgroundPosition = 'center';
                element.textContent = '';
                element.style.backgroundColor = ''; 
                
                if (userData) {
                    userData.has_avatar = true;
                    sessionStorage.setItem('userData', JSON.stringify(userData));
                }
            };
            
            img.onerror = function() {
                console.error('Failed to load avatar from server, generating background.');
                if (userData) {
                    setAvatarBackground(
                        element,
                        userData.avatar_background,
                        userData.nickname?.charAt(0).toUpperCase() || '?'
                    );
                    userData.has_avatar = false;
                    sessionStorage.setItem('userData', JSON.stringify(userData));
                }
            };
            
            img.src = avatarUrl;
        }

   
     async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    avatarInput.value = '';

    if (!file.type.match('image.*')) {
        showMessage('Пожалуйста, выберите файл изображения (PNG, JPG, GIF).');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showMessage('Размер изображения не должен превышать 5MB.');
        return;
    }

    
    const localImageUrl = URL.createObjectURL(file);
    
    
    const avatarElements = [
        profileAvatarMobile, 
        sidebarProfileAvatar, 
        desktopProfileAvatar,
        mobileSidebarProfileAvatar
    ];
    
    avatarElements.forEach(element => {
        element.style.backgroundImage = `url(${localImageUrl})`;
        element.style.backgroundSize = 'cover';
        element.style.backgroundPosition = 'center';
        element.textContent = '';
        element.style.backgroundColor = '';
    });

    
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('platform_user_id', userData.platform_user_id);

    try {
        const response = await fetch(`${SERVER_URL}/upload_avatar`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Неизвестная ошибка загрузки.');
        }
        
        if (data.status !== 'success') {
            throw new Error(data.message || data.error || 'Ошибка загрузки.');
        }

        
        userData.has_avatar = true;
        userData.avatar_background = data.avatar_background || userData.avatar_background;
        sessionStorage.setItem('userData', JSON.stringify(userData));

        
        avatarElements.forEach(element => {
            element.style.backgroundImage = `url(${data.avatar_url}?t=${Date.now()})`;
        });
        
        URL.revokeObjectURL(localImageUrl);
        
        showMessage('Аватар успешно загружен!', 'success');

    } catch (error) {
        
        if (userData.has_avatar) {
            loadAvatar(profileAvatarMobile, userData.platform_user_id);
            loadAvatar(sidebarProfileAvatar, userData.platform_user_id);
            loadAvatar(desktopProfileAvatar, userData.platform_user_id);
            loadAvatar(mobileSidebarProfileAvatar, userData.platform_user_id);
        } else {
            const firstLetter = userData.nickname?.charAt(0).toUpperCase() || '?';
            setAvatarBackground(profileAvatarMobile, userData.avatar_background, firstLetter);
            setAvatarBackground(sidebarProfileAvatar, userData.avatar_background, firstLetter);
            setAvatarBackground(desktopProfileAvatar, userData.avatar_background, firstLetter);
            setAvatarBackground(mobileSidebarProfileAvatar, userData.avatar_background, firstLetter);
        }
        
        showMessage('Ошибка загрузки: ' + error.message);
        URL.revokeObjectURL(localImageUrl);
    }
}

   
        async function handleAvatarRemove() {
           
            try {
                const response = await fetch(`${SERVER_URL}/remove_avatar`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        platform_user_id: userData.platform_user_id
                    })
                });
                
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Неизвестная ошибка удаления.');
                }
                
                if (data.status !== 'success') {
                    throw new Error(data.message || data.error || 'Ошибка удаления.');
                }
                
                userData.has_avatar = false;
                userData.avatar_background = data.avatar_background || userData.avatar_background;
                sessionStorage.setItem('userData', JSON.stringify(userData));
                
                
                setAvatarBackground(
                    profileAvatarMobile,
                    userData.avatar_background,
                    userData.nickname.charAt(0).toUpperCase()
                );
                setAvatarBackground(
                    sidebarProfileAvatar,
                    userData.avatar_background,
                    userData.nickname.charAt(0).toUpperCase()
                );
                setAvatarBackground(
                    desktopProfileAvatar,
                    userData.avatar_background,
                    userData.nickname.charAt(0).toUpperCase()
                );
                setAvatarBackground(
                    mobileSidebarProfileAvatar,
                    userData.avatar_background,
                    userData.nickname.charAt(0).toUpperCase()
                );
                
                showMessage('Аватар успешно удален!', 'success');
            } catch (error) {
                showMessage('Ошибка удаления: ' + error.message);
            } finally {
               
            }
        }

    
        async function fetchUserData() {
            
            if (userData && userData.platform_user_id === 'dev_virtual_account') {
                return true;
            }
            try {
                const response = await fetch(`${SERVER_URL}/get_user_data`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        platform_user_id: userData.platform_user_id
                    }),
                    credentials: 'include'
                });

                const data = await response.json();

                if (data.status === 'success') {
                    userData = {
                        ...userData,
                        ...data.user,
                        has_avatar: data.user.has_avatar
                    };
                    sessionStorage.setItem('userData', JSON.stringify(userData));
                    return true;
                } else {
                    throw new Error(data.error || 'Ошибка загрузки данных');
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                return false;
            }
        }

     

function isNotSpecified(value) {
    if (!value || typeof value !== 'string') return true; 
    const lower = value.toLowerCase().trim();
    return lower === 'не указано' || lower === 'не указан' || lower === 'не ук' || lower === 'не укне ук' || lower === 'NULL';
}

function updateProfileUI() {
    const nickname = userData.nickname || '';
    const firstLetter = nickname.charAt(0).toUpperCase() || '?';
    const bgColor = userData.avatar_background;
    const platformId = userData.platform_user_id || 'Не указано';
    
    
    const isTeacher = userData.identity && 
                     userData.identity.toLowerCase().includes('учитель');
    
    
    const subject1 = userData.subject1;
    const subject2 = userData.subject2;
    
    
    let subjects = [];
    if (isTeacher) {
        
        if (subject1 && !isNotSpecified(subject1)) {
            subjects.push(subject1);
        }
        
        
        if (subject2 && !isNotSpecified(subject2)) {
            subjects.push(subject2);
        }
    }
    const subjectText = subjects.join(', ');

    
    if (userData.has_avatar) {
        loadAvatar(profileAvatarMobile, userData.platform_user_id);
    } else {
        setAvatarBackground(profileAvatarMobile, bgColor, firstLetter);
    }
    profileNicknameMobile.textContent = nickname || 'Не указано';
    profileIdMobile.textContent = `ID: ${platformId}`;
    
    
    
    if (isNotSpecified(userData.main_school_name)) {
        mainSchoolMobile.parentElement.style.display = 'none';
    } else {
        mainSchoolMobile.parentElement.style.display = 'flex';
        mainSchoolMobile.textContent = userData.main_school_name;
    }
    
    
    const classValue = (userData.class_number && userData.class_letter && !isNotSpecified(userData.class_number) && !isNotSpecified(userData.class_letter))
        ? `${userData.class_number}${userData.class_letter}`
        : null;
    if (!classValue) {
        userClassMobile.parentElement.style.display = 'none';
    } else {
        userClassMobile.parentElement.style.display = 'flex';
        userClassMobile.textContent = classValue;
    }
    
    
    if (isNotSpecified(userData.identity)) {
        userRoleMobile.parentElement.style.display = 'none';
    } else {
        userRoleMobile.parentElement.style.display = 'flex';
        userRoleMobile.textContent = userData.identity;
    }
    
    
    const additionalSchoolValueMobile = userData.additional_school_name;
    const hasAdditionalSchoolMobile = additionalSchoolValueMobile && !isNotSpecified(additionalSchoolValueMobile);
    if (!hasAdditionalSchoolMobile) {
        additionalSchoolContainerMobile.style.display = 'none';
    } else {
        additionalSchoolContainerMobile.style.display = 'flex';
        additionalSchoolMobile.textContent = additionalSchoolValueMobile;
    }
    
    
    if (isNotSpecified(userData.specialization)) {
        specializationContainerMobile.style.display = 'none';
    } else {
        specializationContainerMobile.style.display = 'flex';
        userSpecializationMobile.textContent = userData.specialization;
    }
    
    
    if (isNotSpecified(userData.course)) {
        courseContainerMobile.style.display = 'none';
    } else {
        courseContainerMobile.style.display = 'flex';
        userCourseMobile.textContent = userData.course;
    }

    
    if (isTeacher && subjectText) {
        
        let subjectContainerMobile = document.getElementById('subject-container');
        let userSubjectMobile = document.getElementById('user-subject');
        
        if (!subjectContainerMobile) {
            
            const courseContainer = document.getElementById('course-container');
            const subjectHTML = `
                <div id="subject-container" class="detail-item">
                    <div class="detail-label">Предмет</div>
                    <div id="user-subject" class="detail-value"></div>
                </div>
            `;
            courseContainer.insertAdjacentHTML('afterend', subjectHTML);
            subjectContainerMobile = document.getElementById('subject-container');
            userSubjectMobile = document.getElementById('user-subject');
        }
        
        userSubjectMobile.textContent = subjectText;
        subjectContainerMobile.style.display = 'flex';
    } else {
        
        const subjectContainerMobile = document.getElementById('subject-container');
        if (subjectContainerMobile) {
            subjectContainerMobile.style.display = 'none';
        }
    }

 
    if (userData.has_avatar) {
        loadAvatar(sidebarProfileAvatar, userData.platform_user_id);
    } else {
        setAvatarBackground(sidebarProfileAvatar, bgColor, firstLetter);
    }
    sidebarProfileNickname.textContent = nickname || 'Не указано';
    sidebarProfileId.textContent = `id: ${platformId}`; 


    if (userData.has_avatar) {
        loadAvatar(mobileSidebarProfileAvatar, userData.platform_user_id);
    } else {
        setAvatarBackground(mobileSidebarProfileAvatar, bgColor, firstLetter);
    }
    mobileSidebarProfileNickname.textContent = nickname || 'Не указано';
    mobileSidebarProfileId.textContent = `id: ${platformId}`; 

    if (userData.has_avatar) {
        loadAvatar(desktopProfileAvatar, userData.platform_user_id);
    } else {
        setAvatarBackground(desktopProfileAvatar, bgColor, firstLetter);
    }
    desktopProfileNickname.textContent = nickname || 'Не указано';
    desktopProfileId.textContent = `ID: ${platformId}`;
    
    
    
    if (isNotSpecified(userData.main_school_name)) {
        desktopMainSchool.parentElement.style.display = 'none';
    } else {
        desktopMainSchool.parentElement.style.display = 'flex';
        desktopMainSchool.textContent = userData.main_school_name;
    }
    
    
    const desktopClassValue = (userData.class_number && userData.class_letter && !isNotSpecified(userData.class_number) && !isNotSpecified(userData.class_letter))
        ? `${userData.class_number}${userData.class_letter}`
        : null;
    if (!desktopClassValue) {
        desktopUserClass.parentElement.style.display = 'none';
    } else {
        desktopUserClass.parentElement.style.display = 'flex';
        desktopUserClass.textContent = desktopClassValue;
    }
    
    
    if (isNotSpecified(userData.identity)) {
        desktopUserRole.parentElement.style.display = 'none';
    } else {
        desktopUserRole.parentElement.style.display = 'flex';
        desktopUserRole.textContent = userData.identity;
    }
    
    
    const additionalSchoolValueDesktop = userData.additional_school_name;
    const hasAdditionalSchoolDesktop = additionalSchoolValueDesktop && !isNotSpecified(additionalSchoolValueDesktop);
    if (!hasAdditionalSchoolDesktop) {
        desktopAdditionalSchoolContainer.style.display = 'none';
    } else {
        desktopAdditionalSchoolContainer.style.display = 'flex';
        desktopAdditionalSchool.textContent = additionalSchoolValueDesktop;
    }
    
    
    if (isNotSpecified(userData.specialization)) {
        desktopSpecializationContainer.style.display = 'none';
    } else {
        desktopSpecializationContainer.style.display = 'flex';
        desktopUserSpecialization.textContent = userData.specialization;
    }
    
    
    if (isNotSpecified(userData.course)) {
        desktopCourseContainer.style.display = 'none';
    } else {
        desktopCourseContainer.style.display = 'flex';
        desktopUserCourse.textContent = userData.course;
    }

    
    if (isTeacher && subjectText) {
        
        let desktopSubjectContainer = document.getElementById('desktop-subject-container');
        let desktopUserSubject = document.getElementById('desktop-user-subject');
        
        if (!desktopSubjectContainer) {
            
            const desktopCourseContainer = document.getElementById('desktop-course-container');
            const subjectHTML = `
                <div id="desktop-subject-container" class="detail-item">
                    <div class="detail-label">Предмет</div>
                    <div id="desktop-user-subject" class="detail-value"></div>
                </div>
            `;
            desktopCourseContainer.insertAdjacentHTML('afterend', subjectHTML);
            desktopSubjectContainer = document.getElementById('desktop-subject-container');
            desktopUserSubject = document.getElementById('desktop-user-subject');
        }
        
        desktopUserSubject.textContent = subjectText;
        desktopSubjectContainer.style.display = 'flex';
    } else {
        
        const desktopSubjectContainer = document.getElementById('desktop-subject-container');
        if (desktopSubjectContainer) {
            desktopSubjectContainer.style.display = 'none';
        }
    }
}

   
        function openAvatarModal(targetAvatarElement) {
            if (!userData.has_avatar) {
               
                avatarInput.click();
                return;
            }
            
            const avatarUrl = `${SERVER_URL}/avatar/${userData.platform_user_id}?t=${Date.now()}`;
            
            avatarModalImage.src = avatarUrl;
            avatarModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        function closeAvatarModal() {
            avatarModal.classList.remove('active');
            document.body.style.overflow = '';
        }

        
        function openDesktopProfile() {
            showDesktopModule(profileModalDesktop);
            updateProfileUI(); 
        }

        function openMobileProfile() {
            showMobileModal(profileModalMobile);
            updateProfileUI();
        }

       
        async function loadProfileData() {
            
            try {
                const dataUpdated = await fetchUserData();
                
                if (!dataUpdated) {
                    console.warn('Using cached data from sessionStorage');
                }
                
                updateProfileUI();
            } catch (error) {
                console.error('Profile loading error:', error);
                showMessage('Ошибка загрузки профиля. Пожалуйста, попробуйте войти снова.', 'error');
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 5000);
            } finally {
                
            }
        }

    
        function initializeLayout() {
            isDesktop = window.matchMedia("(min-width: 768px)").matches;
            
            
            if (typeof applyWallpaper === 'function') {
                applyWallpaper();
            }
            if (typeof updateDesktopPlaceholderWallpaper === 'function') {
                updateDesktopPlaceholderWallpaper();
            }

            if (isDesktop) {
                mobileSettingsView.style.display = 'none';
                mobileBottomNav.style.display = 'none';
                desktopSidebar.style.display = 'flex';
                desktopContent.style.display = 'flex';
                desktopPlaceholder.style.display = 'flex'; 
                hideAllDesktopModules(); 
                desktopBottomNav.style.display = 'flex';
                hideAllMobileModals(); 
                  document.querySelector('.mobile-settings-view').style.display = 'none';
            } else {
                 document.querySelector('.mobile-settings-view').style.display = 'flex';
                mobileSettingsView.style.display = 'flex';
                mobileBottomNav.style.display = 'flex';
                desktopSidebar.style.display = 'none';
                desktopContent.style.display = 'none';
                hideAllMobileModals(); 
            }
        }

        
        profileAvatarMobile.addEventListener('click', () => {
         
            openAvatarModal(profileAvatarMobile);
        });

        sidebarProfileAvatar.addEventListener('click', () => {
            if (isDesktop) {
                openAvatarModal(sidebarProfileAvatar);
            }
        });

        desktopProfileAvatar.addEventListener('click', () => {
            if (isDesktop) {
                openAvatarModal(desktopProfileAvatar);
            }
        });

        mobileSidebarProfileAvatar.addEventListener('click', () => {
            
            if (!isDesktop) {
                openAvatarModal(mobileSidebarProfileAvatar);
            }
        });

        avatarInput.addEventListener('change', handleAvatarUpload);

       
        avatarModalClose.addEventListener('click', closeAvatarModal);
        avatarModal.addEventListener('click', (e) => {
            if (e.target === avatarModal) {
                closeAvatarModal();
            }
        });

        changeAvatarBtn.addEventListener('click', () => {
            closeAvatarModal();
            avatarInput.click();
        });

        deleteAvatarBtn.addEventListener('click', () => {
            closeAvatarModal();
            if (confirm('Удалить аватар?')) {
                handleAvatarRemove();
            }
        });

 
        myProfileBtn.addEventListener('click', openDesktopProfile);
        privacyBtn.addEventListener('click', () => showDesktopModule(privacyModule));
        appearanceBtn.addEventListener('click', () => showDesktopModule(appearanceModule));
        faqBtn.addEventListener('click', () => {
            window.open('https://thevuntgram.vercel.app', '_blank'); 
        });
        desktopSidebarHeader.addEventListener('click', openDesktopProfile); 

     
        myProfileBtnMobile.addEventListener('click', openMobileProfile);
        privacyBtnMobile.addEventListener('click', () => showMobileModal(privacyModuleMobile));
        appearanceBtnMobile.addEventListener('click', () => showMobileModal(appearanceModuleMobile));
        faqBtnMobile.addEventListener('click', () => {
            window.open('https://thevuntgram.vercel.app', '_blank'); 
        });
        mobileSidebarHeader.addEventListener('click', openMobileProfile); 

   
        profileModalMobileBackBtn.addEventListener('click', hideAllMobileModals);
        privacyModuleMobileBackBtn.addEventListener('click', hideAllMobileModals);
        appearanceModuleMobileBackBtn.addEventListener('click', hideAllMobileModals);
      
        searchInputDesktop.addEventListener('input', (e) => {
            console.log('Desktop search input:', e.target.value);
        });

        searchInputMobile.addEventListener('input', (e) => {
            console.log('Mobile search input:', e.target.value);
        });

      
        window.addEventListener('DOMContentLoaded', () => {
            
            if (!checkAuthorization()) {
                return;
            }
            
            
            initializeLayout();
            loadProfileData();
        });

       
        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                if (!checkAuthorization()) {
                    return;
                }
                initializeLayout();
                loadProfileData();
            }
        });

   
        window.addEventListener('resize', () => {
            const newIsDesktop = window.matchMedia("(min-width: 768px)").matches;
            if (newIsDesktop !== isDesktop) {
                initializeLayout();
                updateProfileUI(); 
            }
        });






        
document.addEventListener('DOMContentLoaded', function() {
    
    if (checkAuthorization()) {
        
        setTimeout(() => {
            if (window.activityTracker && !window.activityTracker.isInitialized) {
                window.activityTracker.init();
            }
            
            
            updateUserActivityStatus();
        }, 1000);
    }
});


async function updateUserActivityStatus() {
    try {
        const userData = JSON.parse(sessionStorage.getItem('userData'));
        if (!userData || !userData.platform_user_id) return;
        
        
        if (userData.platform_user_id === 'dev_virtual_account') {
            updateProfileStatusUI(true);
            return;
        }

        
        const response = await fetch('https://vuntserver.onrender.com/update_activity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                platform_user_id: userData.platform_user_id,
                is_online: true,
                force_update: true
            }),
            credentials: 'include'
        });

        if (response.ok) {
            console.log('Profile: Activity status updated to online');
            
            
            updateProfileStatusUI(true);
        }
    } catch (error) {
        console.error('Profile: Error updating activity status:', error);
    }
}


function updateProfileStatusUI(isOnline) {
    const statusElements = document.querySelectorAll('.profile-status');
    statusElements.forEach(element => {
        if (isOnline) {
            element.innerHTML = '<span class="status-indicator"></span>В сети';
            element.style.color = 'var(--online-green)';
        } else {
            element.textContent = 'не в сети';
            element.style.color = 'var(--telegram-hint)';
        }
    });
}


document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        
        setTimeout(updateUserActivityStatus, 300);
    }
});


setInterval(updateUserActivityStatus, 20000);

window.addEventListener('beforeunload', function() {

    const userData = JSON.parse(sessionStorage.getItem('userData'));
    if (userData && userData.platform_user_id && navigator.sendBeacon) {
        const data = new Blob([JSON.stringify({
            platform_user_id: userData.platform_user_id,
            is_online: false
        })], {type: 'application/json'});
        
        navigator.sendBeacon('https://vuntserver.onrender.com/update_activity', data);
    }
});