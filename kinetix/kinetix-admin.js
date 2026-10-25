(function() {
    'use strict';

    var themeToggle = document.getElementById('adminThemeToggle');
    var root = document.documentElement;

    function applyTheme(theme, persist) {
        var isLight = theme === 'light';
        if (isLight) root.setAttribute('data-theme', 'light');
        else root.removeAttribute('data-theme');
        if (themeToggle) {
            themeToggle.setAttribute('aria-checked', isLight ? 'true' : 'false');
            var next = isLight ? 'Switch to dark mode' : 'Switch to light mode';
            themeToggle.setAttribute('aria-label', next);
            themeToggle.title = next;
        }
        if (persist) {
            try {
                localStorage.setItem('kinetix-theme', isLight ? 'light' : 'dark');
            } catch (error) {
                console.error('Unable to save Kinetix theme preference:', error);
            }
        }
    }

    applyTheme(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark', false);
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            applyTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true);
        });
    }
    window.addEventListener('storage', function(event) {
        if (event.key === 'kinetix-theme') applyTheme(event.newValue === 'light' ? 'light' : 'dark', false);
    });

    var announcementList = document.querySelector('#mainContent .announcements-section #announcementsList');
    var announcementPanel = document.getElementById('adminLoginPanel');
    var dashboard = document.getElementById('adminDashboard');

    function apiRequest(path, options) {
        options = options || {};
        options.credentials = 'same-origin';
        options.headers = options.headers || {};
        if (options.body) options.headers['Content-Type'] = 'application/json';
        if (options.method && options.method !== 'GET') options.headers['X-Kinetix-Admin'] = 'true';
        return fetch('/api/' + path, options).then(async function(response) {
            if (response.status === 204) return null;
            var result;
            try {
                result = await response.json();
            } catch (error) {
                if (!response.ok) {
                    throw new Error('The server returned HTTP ' + response.status + ' without a JSON error. Start the Kinetix backend and open the site from its address.');
                }
                throw new Error('The server returned an unreadable response (HTTP ' + response.status + ').');
            }
            if (!response.ok) throw new Error(result.error || result.detail || 'The request failed.');
            return result;
        });
    }

    function formatDate(value) {
        var date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
    }

    function formatStockAvailability(stock) {
        if (stock === 0) return 'Out of stock';
        if (stock === 1) return '1 available';
        return stock + ' available';
    }

    // Public homepage content
    function renderPublicAnnouncements(items) {
        if (!announcementList) return;
        announcementList.replaceChildren();
        if (!items.length) {
            var empty = document.createElement('p');
            empty.className = 'announcements-empty';
            empty.textContent = 'There are no announcements right now. Check back soon.';
            announcementList.appendChild(empty);
            return;
        }

        items.forEach(function(item) {
            var card = document.createElement('article');
            card.className = 'announcement-card';
            var heading = document.createElement('div');
            heading.className = 'announcement-card-heading';
            var title = document.createElement('h3');
            title.textContent = item.title;
            var date = document.createElement('time');
            date.textContent = formatDate(item.createdAt);
            date.dateTime = item.createdAt;
            heading.appendChild(title);
            heading.appendChild(date);
            var body = document.createElement('p');
            body.textContent = item.body;
            card.appendChild(heading);
            card.appendChild(body);
            announcementList.appendChild(card);
        });
    }

    function loadPublicContent() {
        if (announcementList) {
            apiRequest('announcements').then(renderPublicAnnouncements).catch(function(error) {
                var message = document.createElement('p');
                message.className = 'announcements-empty';
                message.textContent = 'Announcements are unavailable right now.';
                announcementList.replaceChildren(message);
                console.error('Unable to load Kinetix announcements:', error);
            });
        }

        var productCards = Array.prototype.slice.call(document.querySelectorAll('.product-card'));
        apiRequest('products').then(function(products) {
            products.forEach(function(product) {
                var buttons = Array.prototype.slice.call(document.querySelectorAll('.add-to-cart[data-product="' + product.id + '"]'));
                buttons.forEach(function(button) {
                    button.dataset.price = product.price;
                    if (product.id !== 'soya-pop') button.dataset.stock = product.stock;
                });
                document.querySelectorAll('.product-carousel-item[data-product="' + product.id + '"]').forEach(function(item) {
                    if (product.id === 'soya-pop' && item.dataset.flavor !== product.flavor) return;
                    item.dataset.price = product.price;
                    item.dataset.stock = product.stock;
                });
            });
            productCards.forEach(function(card) {
                var button = card.querySelector('.add-to-cart');
                if (!button) return;
                var flavorPicker = card.querySelector('.product-flavor-picker select');
                var product = products.find(function(item) {
                    return item.id === button.dataset.product &&
                        (item.id !== 'soya-pop' || item.flavor === (flavorPicker ? flavorPicker.value : 'Original'));
                });
                if (!product) return;
                var price = card.querySelector('.product-price');
                var stock = card.querySelector('.product-inventory');
                if (!stock) {
                    stock = document.createElement('p');
                    stock.className = 'product-inventory';
                    card.appendChild(stock);
                }
                button.dataset.price = product.price;
                button.dataset.stock = product.stock;
                if (price) price.textContent = '₱' + Number(product.price).toFixed(2);
                stock.textContent = formatStockAvailability(product.stock);
                stock.classList.toggle('is-sold-out', product.stock === 0);
            });
            var activeCarouselItem = document.querySelector('.product-carousel-item.is-current');
            var carouselPrice = document.getElementById('productCarouselPrice');
            if (activeCarouselItem && carouselPrice) {
                carouselPrice.textContent = '₱' + Number(activeCarouselItem.dataset.price).toFixed(2);
            }
            document.dispatchEvent(new Event('kinetix:inventory-loaded'));
        }).catch(function(error) {
            console.error('Unable to load Kinetix product inventory:', error);
        });
    }

    loadPublicContent();
    document.addEventListener('kinetix:inventory-updated', loadPublicContent);
    if (!announcementPanel || !dashboard) return;

    // Admin dashboard
    var loginForm = document.getElementById('adminLoginForm');
    var loginMessage = document.getElementById('loginMessage');
    var dashboardMessage = document.getElementById('dashboardMessage');
    var inventoryList = document.getElementById('inventoryList');
    var announcementForm = document.getElementById('announcementForm');
    var announcementAdminList = document.getElementById('announcementAdminList');
    var announcementId = document.getElementById('announcementId');
    var announcementTitle = document.getElementById('announcementTitle');
    var announcementBody = document.getElementById('announcementBody');
    var announcementPublished = document.getElementById('announcementPublished');
    var announcementSubmit = document.getElementById('announcementSubmit');
    var announcementCancel = document.getElementById('announcementCancel');
    var inventoryPanel = document.getElementById('inventoryPanel');
    var announcementsPanel = document.getElementById('announcementsPanel');
    var visitorsPanel = document.getElementById('visitorsPanel');
    var inventoryTab = document.getElementById('inventoryTab');
    var announcementsTab = document.getElementById('announcementsTab');
    var visitorsTab = document.getElementById('visitorsTab');
    var visitorCount = document.getElementById('visitorCount');
    var registrationsTab = document.getElementById('registrationsTab');
    var registrationsPanel = document.getElementById('registrationsPanel');
    var registrationsList = document.getElementById('registrationsList');
    var ordersTab = document.getElementById('ordersTab');
    var ordersPanel = document.getElementById('ordersPanel');
    var ordersList = document.getElementById('ordersList');

    function setDashboardMessage(text) {
        dashboardMessage.textContent = text || '';
    }

    function setDashboardView(view) {
        var showInventory = view === 'inventory';
        var showVisitors = view === 'visitors';
        var showRegistrations = view === 'registrations';
        var showOrders = view === 'orders';
        inventoryPanel.hidden = !showInventory;
        announcementsPanel.hidden = showInventory || showVisitors || showOrders || showRegistrations;
        visitorsPanel.hidden = !showVisitors;
        registrationsPanel.hidden = !showRegistrations;
        ordersPanel.hidden = !showOrders;
        [inventoryTab, announcementsTab, registrationsTab, visitorsTab, ordersTab].forEach(function(tab) {
            var isCurrent = (tab === inventoryTab && showInventory) ||
                (tab === announcementsTab && !showInventory && !showVisitors && !showOrders && !showRegistrations) ||
                (tab === registrationsTab && showRegistrations) ||
                (tab === visitorsTab && showVisitors) ||
                (tab === ordersTab && showOrders);
            tab.classList.toggle('is-active', isCurrent);
            if (isCurrent) {
                tab.setAttribute('aria-current', 'page');
            } else {
                tab.removeAttribute('aria-current');
            }
        });
    }

    inventoryTab.addEventListener('click', function() {
        setDashboardView('inventory');
    });
    announcementsTab.addEventListener('click', function() {
        setDashboardView('announcements');
    });
    visitorsTab.addEventListener('click', function() {
        setDashboardView('visitors');
        loadVisitorCount();
    });
    registrationsTab.addEventListener('click', function() {
        setDashboardView('registrations');
        loadAdminRegistrations();
    });
    ordersTab.addEventListener('click', function() {
        setDashboardView('orders');
        loadAdminOrders();
    });

    function showDashboard() {
        announcementPanel.hidden = true;
        dashboard.hidden = false;
        setDashboardView('inventory');
        return Promise.all([loadInventory(), loadAdminAnnouncements(), loadVisitorCount(), loadAdminOrders(), loadAdminRegistrations()]);
    }

    function loadVisitorCount() {
        visitorCount.textContent = 'Loading…';
        return apiRequest('admin/visitors').then(function(result) {
            visitorCount.textContent = Number(result.count).toLocaleString();
        }).catch(function(error) {
            visitorCount.textContent = 'Unavailable';
            setDashboardMessage(error.message);
        });
    }

    document.getElementById('refreshVisitors').addEventListener('click', loadVisitorCount);
    document.getElementById('refreshOrders').addEventListener('click', loadAdminOrders);
    document.getElementById('refreshRegistrations').addEventListener('click', loadAdminRegistrations);

    function loadAdminRegistrations() {
        registrationsList.replaceChildren();
        var loading = document.createElement('p');
        loading.className = 'empty-state';
        loading.textContent = 'Loading registrations…';
        registrationsList.appendChild(loading);
        return apiRequest('admin/registrations').then(function(items) {
            registrationsList.replaceChildren();
            if (!items.length) {
                var empty = document.createElement('p');
                empty.className = 'empty-state';
                empty.textContent = 'No event registrations yet.';
                registrationsList.appendChild(empty);
                return;
            }

            items.forEach(function(item) {
                var card = document.createElement('article');
                card.className = 'admin-order-row';
                var header = document.createElement('div');
                header.className = 'admin-order-heading';
                var heading = document.createElement('h3');
                heading.textContent = item.name;
                var date = document.createElement('time');
                date.dateTime = item.createdAt;
                date.textContent = new Date(item.createdAt).toLocaleString();
                header.appendChild(heading);
                header.appendChild(date);
                card.appendChild(header);

                var code = document.createElement('p');
                code.className = 'admin-order-customer';
                code.textContent = 'Registration code: ' + item.code;
                card.appendChild(code);

                var contact = document.createElement('p');
                contact.className = 'admin-order-meta';
                contact.textContent = item.email + ' · ' + item.phone;
                card.appendChild(contact);

                var school = document.createElement('p');
                school.className = 'admin-order-meta';
                school.textContent = 'School / organization: ' + (item.school || 'Not provided');
                card.appendChild(school);

                var details = document.createElement('p');
                details.className = 'admin-order-meta';
                details.textContent = 'Event: ' + item.event + ' · Category: ' + item.category;
                card.appendChild(details);
                registrationsList.appendChild(card);
            });
        }).catch(function(error) {
            registrationsList.replaceChildren();
            var message = document.createElement('p');
            message.className = 'empty-state';
            message.textContent = error.message;
            registrationsList.appendChild(message);
            setDashboardMessage(error.message);
        });
    }

    function loadAdminOrders() {
        ordersList.replaceChildren();
        var loading = document.createElement('p');
        loading.className = 'empty-state';
        loading.textContent = 'Loading orders…';
        ordersList.appendChild(loading);
        return apiRequest('admin/orders').then(function(items) {
            ordersList.replaceChildren();
            if (!items.length) {
                var empty = document.createElement('p');
                empty.className = 'empty-state';
                empty.textContent = 'No customer orders yet.';
                ordersList.appendChild(empty);
                return;
            }
            items.forEach(function(item) {
                var card = document.createElement('article');
                card.className = 'admin-order-row';
                var header = document.createElement('div');
                header.className = 'admin-order-heading';
                var heading = document.createElement('h3');
                heading.textContent = item.orderNumber;
                var date = document.createElement('time');
                date.dateTime = item.createdAt;
                date.textContent = new Date(item.createdAt).toLocaleString();
                header.appendChild(heading);
                header.appendChild(date);
                card.appendChild(header);

                var customer = document.createElement('p');
                customer.className = 'admin-order-customer';
                customer.textContent = item.customer.name + ' · ' + item.customer.phone + ' · ' + item.customer.email;
                card.appendChild(customer);

                var destination = document.createElement('p');
                destination.className = 'admin-order-meta';
                destination.textContent = item.customer.place + ' · ' + item.payment;
                card.appendChild(destination);

                var lines = document.createElement('ul');
                lines.className = 'admin-order-items';
                item.items.forEach(function(line) {
                    var row = document.createElement('li');
                    var description = document.createElement('span');
                    description.textContent = line.name + ' × ' + line.quantity;
                    var amount = document.createElement('strong');
                    amount.textContent = '₱' + Number(line.total).toFixed(2);
                    row.appendChild(description);
                    row.appendChild(amount);
                    lines.appendChild(row);
                });
                card.appendChild(lines);

                var total = document.createElement('p');
                total.className = 'admin-order-total';
                total.textContent = 'Total: ₱' + Number(item.total).toFixed(2);
                card.appendChild(total);
                if (item.notes) {
                    var notes = document.createElement('p');
                    notes.className = 'admin-order-notes';
                    notes.textContent = 'Notes: ' + item.notes;
                    card.appendChild(notes);
                }
                ordersList.appendChild(card);
            });
        }).catch(function(error) {
            ordersList.replaceChildren();
            var message = document.createElement('p');
            message.className = 'empty-state';
            message.textContent = error.message;
            ordersList.appendChild(message);
            setDashboardMessage(error.message);
        });
    }

    function loadInventory() {
        return apiRequest('products').then(function(products) {
            inventoryList.replaceChildren();
            products.forEach(function(product) {
                var row = document.createElement('form');
                row.className = 'inventory-row';
                row.dataset.productId = product.id;
                var name = document.createElement('strong');
                name.className = 'inventory-name';
                name.textContent = product.name + (product.flavor ? ' - ' + product.flavor : '');
                var fields = document.createElement('div');
                fields.className = 'inventory-fields';
                var stockLabel = document.createElement('label');
                stockLabel.textContent = 'Stock quantity';
                var stockInput = document.createElement('input');
                stockInput.type = 'number';
                stockInput.min = '0';
                stockInput.max = '1000000';
                stockInput.step = '1';
                stockInput.required = true;
                stockInput.value = product.stock;
                stockLabel.appendChild(stockInput);
                var priceLabel = document.createElement('label');
                priceLabel.textContent = 'Unit price (₱)';
                var priceInput = document.createElement('input');
                priceInput.type = 'number';
                priceInput.min = '0';
                priceInput.max = '1000000';
                priceInput.step = '0.01';
                priceInput.required = true;
                priceInput.value = Number(product.price).toFixed(2);
                priceLabel.appendChild(priceInput);
                var saveButton = document.createElement('button');
                saveButton.type = 'submit';
                saveButton.className = 'admin-button admin-button-primary';
                saveButton.textContent = 'Save';
                fields.appendChild(stockLabel);
                fields.appendChild(priceLabel);
                fields.appendChild(saveButton);
                row.appendChild(name);
                row.appendChild(fields);
                row.addEventListener('submit', function(event) {
                    event.preventDefault();
                    var stock = Number(stockInput.value);
                    var price = Number(priceInput.value);
                    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000 ||
                        !Number.isFinite(price) || price < 0 || price > 1000000) {
                        setDashboardMessage('Enter a whole-number stock quantity and a valid price from 0 to 1,000,000.');
                        return;
                    }
                    saveButton.disabled = true;
                    apiRequest('admin/products/' + encodeURIComponent(product.id), {
                        method: 'PUT',
                        body: JSON.stringify({ stock: stock, price: price, flavor: product.flavor || null })
                    }).then(function() {
                        setDashboardMessage(name.textContent + ' inventory saved.');
                        loadPublicContent();
                    }).catch(function(error) {
                        setDashboardMessage(error.message);
                    }).finally(function() {
                        saveButton.disabled = false;
                    });
                });
                inventoryList.appendChild(row);
            });
        }).catch(function(error) {
            inventoryList.replaceChildren();
            setDashboardMessage(error.message);
        });
    }

    function resetAnnouncementForm() {
        announcementForm.reset();
        announcementId.value = '';
        announcementPublished.checked = true;
        announcementSubmit.textContent = 'Publish announcement';
        announcementCancel.hidden = true;
    }

    function loadAdminAnnouncements() {
        return apiRequest('admin/announcements').then(function(items) {
            announcementAdminList.replaceChildren();
            if (!items.length) {
                var empty = document.createElement('p');
                empty.className = 'empty-state';
                empty.textContent = 'No announcements yet.';
                announcementAdminList.appendChild(empty);
                return;
            }

            items.forEach(function(item) {
                var row = document.createElement('article');
                row.className = 'announcement-row';
                var copy = document.createElement('div');
                copy.className = 'announcement-copy';
                var title = document.createElement('h3');
                title.textContent = item.title;
                var body = document.createElement('p');
                body.textContent = item.body;
                var meta = document.createElement('span');
                meta.className = 'announcement-meta';
                meta.textContent = (item.published ? 'Published' : 'Draft') + ' · ' + formatDate(item.createdAt);
                copy.appendChild(title);
                copy.appendChild(body);
                copy.appendChild(meta);
                var actions = document.createElement('div');
                actions.className = 'announcement-actions';
                var editButton = document.createElement('button');
                editButton.type = 'button';
                editButton.className = 'admin-button admin-button-quiet';
                editButton.textContent = 'Edit';
                editButton.addEventListener('click', function() {
                    announcementId.value = item.id;
                    announcementTitle.value = item.title;
                    announcementBody.value = item.body;
                    announcementPublished.checked = item.published;
                    announcementSubmit.textContent = 'Save changes';
                    announcementCancel.hidden = false;
                    announcementTitle.focus();
                    window.scrollTo({ top: announcementForm.offsetTop, behavior: 'smooth' });
                });
                var deleteButton = document.createElement('button');
                deleteButton.type = 'button';
                deleteButton.className = 'admin-button admin-button-danger';
                deleteButton.textContent = 'Delete';
                deleteButton.addEventListener('click', function() {
                    if (!window.confirm('Delete this announcement?')) return;
                    apiRequest('admin/announcements/' + encodeURIComponent(item.id), { method: 'DELETE' })
                        .then(function() {
                            setDashboardMessage('Announcement deleted.');
                            return loadAdminAnnouncements();
                        })
                        .then(loadPublicContent)
                        .catch(function(error) { setDashboardMessage(error.message); });
                });
                actions.appendChild(editButton);
                actions.appendChild(deleteButton);
                row.appendChild(copy);
                row.appendChild(actions);
                announcementAdminList.appendChild(row);
            });
        }).catch(function(error) {
            announcementAdminList.replaceChildren();
            setDashboardMessage(error.message);
        });
    }

    loginForm.addEventListener('submit', function(event) {
        event.preventDefault();
        loginMessage.textContent = '';
        apiRequest('admin/login', {
            method: 'POST',
            headers: {},
            body: JSON.stringify({
                username: document.getElementById('adminUsername').value,
                password: document.getElementById('adminPassword').value
            })
        }).then(showDashboard).catch(function(error) {
            loginMessage.textContent = error.message;
        });
    });

    document.getElementById('adminLogout').addEventListener('click', function() {
        apiRequest('admin/logout', { method: 'POST' }).then(function() {
            dashboard.hidden = true;
            announcementPanel.hidden = false;
            loginForm.reset();
            loginMessage.textContent = 'You have signed out.';
        }).catch(function(error) {
            setDashboardMessage(error.message);
        });
    });

    announcementForm.addEventListener('submit', function(event) {
        event.preventDefault();
        setDashboardMessage('');
        var id = announcementId.value;
        var endpoint = 'admin/announcements' + (id ? '/' + encodeURIComponent(id) : '');
        apiRequest(endpoint, {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify({
                title: announcementTitle.value,
                body: announcementBody.value,
                published: announcementPublished.checked
            })
        }).then(function() {
            resetAnnouncementForm();
            setDashboardMessage(id ? 'Announcement updated.' : 'Announcement saved.');
            return loadAdminAnnouncements();
        }).then(loadPublicContent).catch(function(error) {
            setDashboardMessage(error.message);
        });
    });

    announcementCancel.addEventListener('click', resetAnnouncementForm);

    apiRequest('admin/session').then(showDashboard).catch(function(error) {
        if (error.message !== 'Admin login required.') loginMessage.textContent = error.message;
    });
})();
