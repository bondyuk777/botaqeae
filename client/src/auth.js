'use strict';

var AUTH_STORAGE_KEY = "mmio_user";
var authMode = "login"; // "login" | "register"

// ===== Утилиты =====
function escapeHtml(str) {
    if (str === undefined || str === null) return "";
    return String(str).replace(/[&<>"']/g, function (c) {
        switch (c) {
            case "&": return "&amp;";
            case "<": return "&lt;";
            case ">": return "&gt;";
            case '"': return "&quot;";
            case "'": return "&#39;";
        }
        return c;
    });
}

// Правая карточка аккаунта
function getAccountCard() {
    return document.querySelector(".menuColumn.rightColumn .menuCard");
}

// Кнопки Sign In / Create Account
function findAuthButtons() {
    var buttons = document.querySelectorAll(".menuColumn.rightColumn .menuButton");
    var signInBtn = null;
    var createAccountBtn = null;

    buttons.forEach(function (btn) {
        var text = (btn.textContent || btn.innerText || "").trim().toLowerCase();
        if (text === "sign in") {
            signInBtn = btn;
        } else if (text === "create account") {
            createAccountBtn = btn;
        }
    });

    return { signInBtn: signInBtn, createAccountBtn: createAccountBtn };
}

// span в нижнем infoBox
function findAccountStatusSpan() {
    var infoBoxSpan = document.querySelector(".menuColumn.rightColumn .infoBox span");
    return infoBoxSpan || null;
}

// ===== Отрисовка UI аккаунта =====

function renderAccountLoggedIn(user) {
    var card = getAccountCard();
    if (!card) return;

    var header = card.querySelector(".menuHeader");
    var menuText = card.querySelector(".menuText");
    var btnGroup = card.querySelector(".buttonGroup");
    var infoBoxSpan = findAccountStatusSpan();

    if (header) header.textContent = "Account";

    if (menuText) {
        menuText.textContent = "You are signed in. Your progress will be saved.";
    }

    if (btnGroup) {
        btnGroup.style.display = "none";
    }

    if (infoBoxSpan) {
        infoBoxSpan.textContent = "Account logged in";
    }

    var infoBlock = card.querySelector("#accountInfoBlock");
    if (!infoBlock) {
        infoBlock = document.createElement("div");
        infoBlock.id = "accountInfoBlock";
        infoBlock.style.marginBottom = "10px";
        infoBlock.style.padding = "8px 10px";
        infoBlock.style.borderRadius = "6px";
        infoBlock.style.background = "rgba(0,0,0,0.35)";
        infoBlock.style.fontSize = "13px";
        infoBlock.style.textAlign = "center";

        if (menuText && menuText.parentNode) {
            menuText.parentNode.insertBefore(infoBlock, menuText);
        } else {
            card.insertBefore(infoBlock, card.firstChild);
        }
    }

    var safeNick = escapeHtml(user.nickname);
    var safeId = escapeHtml(user.id || "");

    infoBlock.innerHTML =
        '<div style="margin-bottom:4px;font-size:14px;">Logged in</div>' +
        '<div style="margin-bottom:4px;">Nickname: ' +
        '<span style="color:#7ee559;">' + safeNick + '</span>' +
        '</div>' +
        '<div style="margin-bottom:2px;">ID:</div>' +
        '<input type="text" id="accountIdField" ' +
        'value="' + safeId + '" readonly ' +
        'style="' +
        'width:100%;' +
        'text-align:center;' +
        'border:none;' +
        'outline:none;' +
        'border-radius:4px;' +
        'padding:4px 6px;' +
        'background:rgba(0,0,0,0.6);' +
        'color:#ffd54f;' +
        'font-size:12px;' +
        'user-select:text;' +
        '-webkit-user-select:text;' +
        '" />';

    var idInput = infoBlock.querySelector("#accountIdField");
    if (idInput) {
        var selectAll = function () {
            try {
                idInput.focus();
                idInput.select();
            } catch (e) { }
        };
        idInput.addEventListener("focus", selectAll);
        idInput.addEventListener("click", selectAll);
    }

    var nameInput = document.getElementById("nameInput");
    if (nameInput && !nameInput.value) {
        nameInput.value = user.nickname;
    }
}

function renderAccountLoggedOut() {
    var card = getAccountCard();
    if (!card) return;

    var header = card.querySelector(".menuHeader");
    var menuText = card.querySelector(".menuText");
    var btnGroup = card.querySelector(".buttonGroup");
    var infoBoxSpan = findAccountStatusSpan();
    var infoBlock = card.querySelector("#accountInfoBlock");

    if (header) {
        header.textContent = "Welcome to MooMoo.io";
    }
    if (menuText) {
        menuText.textContent =
            "Sign in to save your progress, track statistics, and unlock exclusive features.";
    }
    if (btnGroup) {
        btnGroup.style.display = "flex";
    }
    if (infoBoxSpan) {
        infoBoxSpan.textContent = "Guest mode: Play without an account";
    }
    if (infoBlock) {
        infoBlock.remove();
    }
}

function updateAccountUI(user) {
    if (user && user.nickname && user.id) {
        renderAccountLoggedIn(user);
    } else {
        renderAccountLoggedOut();
    }
}

// ===== Модальное окно =====

function ensureAuthModal() {
    var modal = document.getElementById("authModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "authModal";
    modal.style.position = "fixed";
    modal.style.left = "0";
    modal.style.top = "0";
    modal.style.right = "0";
    modal.style.bottom = "0";
    modal.style.background = "rgba(0,0,0,.6)";
    modal.style.display = "none";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = "9999";

    modal.innerHTML =
        '<div style="' +
        'background:#222;' +
        'color:#fff;' +
        'padding:20px;' +
        'border-radius:8px;' +
        'width:320px;' +
        'max-width:90%;' +
        'box-shadow:0 10px 25px rgba(0,0,0,.6);' +
        'font-family:\'Hammersmith One\', Arial, sans-serif;' +
        '">' +
        '<div id="authTitle" style="font-size:20px;margin-bottom:10px;text-align:center;">' +
        'Sign In' +
        '</div>' +
        '<form id="authForm">' +
        '<input id="authNickname"' +
        ' name="nickname"' +
        ' placeholder="Nickname"' +
        ' maxlength="15"' +
        ' style="width:100%;margin-bottom:8px;padding:6px 8px;border-radius:4px;border:none;outline:none;color:#111;">' +
        '<input id="authPassword"' +
        ' name="password"' +
        ' type="password"' +
        ' placeholder="Password"' +
        ' style="width:100%;margin-bottom:10px;padding:6px 8px;border-radius:4px;border:none;outline:none;color:#111;">' +
        '<button type="submit"' +
        ' class="menuButton primaryButton"' +
        ' style="width:100%;margin-bottom:8px;">' +
        'OK' +
        '</button>' +
        '</form>' +
        '<div id="authError"' +
        ' style="color:#ff7777;font-size:12px;min-height:16px;text-align:center;"></div>' +
        '<div id="authClose"' +
        ' style="margin-top:6px;font-size:12px;cursor:pointer;text-align:center;color:#ccc;">' +
        'Close' +
        '</div>' +
        '</div>';

    document.body.appendChild(modal);

    var authClose = modal.querySelector("#authClose");
    var authForm = modal.querySelector("#authForm");

    if (authClose) {
        authClose.addEventListener("click", closeAuth);
    }
    if (authForm) {
        authForm.addEventListener("submit", onAuthSubmit);
    }

    return modal;
}

function openAuth(mode) {
    authMode = mode || "login";
    var modal = ensureAuthModal();
    var title = modal.querySelector("#authTitle");
    var errorBox = modal.querySelector("#authError");

    if (title) {
        title.textContent = (authMode === "login") ? "Sign In" : "Create Account";
    }
    if (errorBox) {
        errorBox.textContent = "";
    }

    var form = modal.querySelector("#authForm");
    if (form) form.reset();

    modal.style.display = "flex";
}

function closeAuth() {
    var modal = document.getElementById("authModal");
    if (modal) modal.style.display = "none";
}

// === запрос к серверу и БД ===
function onAuthSubmit(e) {
    e.preventDefault();

    var modal = document.getElementById("authModal");
    if (!modal) return;

    var nicknameInput = modal.querySelector("#authNickname");
    var passwordInput = modal.querySelector("#authPassword");
    var errorBox = modal.querySelector("#authError");

    var nickname = nicknameInput ? nicknameInput.value.trim() : "";
    var password = passwordInput ? passwordInput.value : "";

    if (!nickname || !password) {
        if (errorBox) errorBox.textContent = "Fill in nickname and password.";
        return;
    }

    var url = (authMode === "login") ? "/api/auth/login" : "/api/auth/register";
    var payload = { nickname: nickname, password: password };

    if (errorBox) errorBox.textContent = "Please wait...";

    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
        .then(function (res) {
            return res.json().then(function (data) {
                return { ok: res.ok, data: data };
            });
        })
        .then(function (result) {
            if (!result.ok) {
                var msg = (result.data && result.data.error) || "Auth error";
                if (errorBox) errorBox.textContent = msg;
                return;
            }

            var srvUser = result.data && result.data.user;
            if (!srvUser || !srvUser.nickname || !srvUser.id) {
                if (errorBox) errorBox.textContent = "Invalid server response";
                return;
            }

            try {
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(srvUser));
            } catch (e2) {
                console.warn("Cannot save user to localStorage", e2);
            }

            updateAccountUI(srvUser);
            closeAuth();
        })
        .catch(function (err) {
            console.error("Auth request error:", err);
            if (errorBox) errorBox.textContent = "Connection error";
        });
}

// ===== Восстановление из localStorage =====

function restoreUserFromStorage() {
    try {
        var saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!saved) {
            updateAccountUI(null);
            return;
        }
        var user = JSON.parse(saved);
        if (user && user.nickname && user.id) {
            updateAccountUI(user);
        } else {
            updateAccountUI(null);
        }
    } catch (e) {
        console.warn("Failed to parse user from localStorage", e);
        updateAccountUI(null);
    }
}

// ===== Инициализация =====

document.addEventListener("DOMContentLoaded", function () {
    restoreUserFromStorage();

    var buttons = findAuthButtons();
    if (buttons.signInBtn) {
        buttons.signInBtn.style.cursor = "pointer";
        buttons.signInBtn.addEventListener("click", function (ev) {
            ev.preventDefault();
            openAuth("login");
        });
    }
    if (buttons.createAccountBtn) {
        buttons.createAccountBtn.style.cursor = "pointer";
        buttons.createAccountBtn.addEventListener("click", function (ev) {
            ev.preventDefault();
            openAuth("register");
        });
    }
});
