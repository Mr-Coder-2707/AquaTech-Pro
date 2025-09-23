    // ======= CONFIG =======
    const STORE_WHATSAPP_NUMBER = '201557609572'; // Egyptian number format
    const CURRENCY = 'EGP';

    // Debug info
    console.log('Store WhatsApp Number:', STORE_WHATSAPP_NUMBER);
    console.log('User Agent:', navigator.userAgent);

    // Product catalog - will be loaded from JSON file
    let PRODUCTS = [];

    // ======= PRODUCT DATA LOADING =======
    async function loadProducts() {
      try {
        console.log('Loading products from JSON file...');
        const response = await fetch('./assets/products-db/products-data.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        PRODUCTS = data.products;
        console.log(`Loaded ${PRODUCTS.length} products successfully`);
        return true;
      } catch (error) {
        console.error('Error loading products:', error);
        // Fallback: show error message to user
        showLoadingError('فشل في تحميل المنتجات. يرجى المحاولة مرة أخرى.');
        return false;
      }
    }

    function showLoadingError(message) {
      const productsList = document.getElementById('products');
      if (productsList) {
        productsList.innerHTML = `
          <div style="grid-column: span 12; text-align: center; padding: 40px; color: var(--danger);">
            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <div style="font-size: 18px; margin-bottom: 16px;">${message}</div>
            <button onclick="location.reload()" style="padding: 12px 24px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">
              إعادة تحميل الصفحة
            </button>
          </div>
        `;
      }
    }
    // ======= STATE =======
    const cart = new Map(); // id -> { product, qty }
    let currentFilter = 'all';
    let searchTerm = '';
    let currentPreviewProduct = null;
    let orderSent = false; // Flag to track if an order was just completed
    let customerInfo = {}; // Store customer information

    // ======= HELPERS =======
    const fmt = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY, maximumFractionDigits: 2 }).format(n);

    // ======= URL PARAMETER HANDLING =======
    function getUrlParams() {
      const urlParams = new URLSearchParams(window.location.search);
      return {
        productId: urlParams.get('product'),
        shared: urlParams.get('shared') === 'true'
      };
    }

    function generateProductShareUrl(productId) {
      const baseUrl = window.location.origin + window.location.pathname;
      return `${baseUrl}?product=${productId}&shared=true`;
    }

    function updateUrlWithProduct(productId) {
      const newUrl = generateProductShareUrl(productId);
      window.history.pushState({ productId }, '', newUrl);
    }

    function clearUrlParams() {
      const baseUrl = window.location.origin + window.location.pathname;
      window.history.pushState({}, '', baseUrl);
    }

    // ======= PRODUCT SHARING FUNCTIONS =======
    async function copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        // Fallback for older browsers
        try {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          document.body.appendChild(textArea);
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          return successful;
        } catch (fallbackErr) {
          console.error('Failed to copy text to clipboard:', fallbackErr);
          return false;
        }
      }
    }

    function shareProduct(product) {
      const shareUrl = generateProductShareUrl(product.id);
      const shareText = `تحقق من هذا المنتج الرائع: ${product.name}\nالسعر: ${fmt(product.price)}\nمن متجر AquaTech Pro للسباكة\n${shareUrl}`;

      // Check if Web Share API is supported
      if (navigator.share) {
        navigator.share({
          title: `${product.name} - AquaTech Pro`,
          text: `تحقق من هذا المنتج: ${product.name} - السعر: ${fmt(product.price)}`,
          url: shareUrl
        }).catch(console.error);
      } else {
        // Show sharing options modal
        showSharingModal(product, shareUrl, shareText);
      }
    }

    function showSharingModal(product, shareUrl, shareText) {
      // Remove any existing sharing modal
      const existing = document.querySelector('.sharing-modal');
      if (existing) {
        existing.remove();
      }

      // Create enhanced sharing text with product details
      const enhancedShareText = `🔥 ${product.name}

📋 الوصف: ${product.description}
💰 السعر: ${fmt(product.price)}
🏪 من متجر: AquaTech Pro للسباكة
📱 للطلب عبر الواتساب: +201557609572

🔗 شاهد المنتج: ${shareUrl}`;

      // Create sharing modal
      const modal = document.createElement('div');
      modal.className = 'modal-overlay sharing-modal';
      modal.innerHTML = `
        <div class="modal sharing-options-modal">
          <div class="modal-header">
            <h3>📤 مشاركة المنتج</h3>
            <button class="modal-close" onclick="this.closest('.sharing-modal').remove()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="product-share-preview">
              <img src="${product.img}" alt="${product.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
              <div>
                <h4>${product.name}</h4>
                <div class="share-price">${fmt(product.price)}</div>
                <div class="share-category">${product.category}</div>
              </div>
            </div>
            <div class="share-info-box">
              <p><strong>💡 نصيحة:</strong> عند المشاركة على مواقع التواصل الاجتماعي، ستظهر صورة المنتج وتفاصيله تلقائياً!</p>
            </div>
            <div class="share-options">
              <button class="share-btn whatsapp" onclick="shareToWhatsApp('${encodeURIComponent(enhancedShareText)}')">
                <span>📱</span>
                <span>واتساب</span>
              </button>
              <button class="share-btn facebook" onclick="shareToFacebook('${encodeURIComponent(shareUrl)}')">
                <span>📘</span>
                <span>فيسبوك</span>
              </button>
              <button class="share-btn twitter" onclick="shareToTwitter('${encodeURIComponent(enhancedShareText)}')">
                <span>🐦</span>
                <span>تويتر</span>
              </button>
              <button class="share-btn telegram" onclick="shareToTelegram('${encodeURIComponent(enhancedShareText)}')">
                <span>✈️</span>
                <span>تيليجرام</span>
              </button>
              <button class="share-btn copy" onclick="copyProductLink('${shareUrl}', this)">
                <span>📋</span>
                <span>نسخ الرابط</span>
              </button>
              <button class="share-btn copy-details" onclick="copyProductDetails('${encodeURIComponent(enhancedShareText)}', this)">
                <span>📝</span>
                <span>نسخ التفاصيل</span>
              </button>
            </div>
            <div class="share-url-display">
              <label>رابط المنتج:</label>
              <input type="text" value="${shareUrl}" readonly onclick="this.select()">
            </div>
            <div class="share-preview-box">
              <h5>📋 معاينة النص المشارك:</h5>
              <textarea readonly onclick="this.select()">${enhancedShareText}</textarea>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      modal.style.display = 'flex';
    }

    // Global functions for sharing (needed for onclick handlers)
    window.shareToWhatsApp = function(text) {
      window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    window.shareToFacebook = function(url) {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
    };

    window.shareToTwitter = function(text) {
      window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
    };

    window.shareToTelegram = function(text) {
      window.open(`https://t.me/share/url?text=${text}`, '_blank');
    };

    window.copyProductLink = async function(url, button) {
      const success = await copyToClipboard(url);
      if (success) {
        const originalText = button.innerHTML;
        button.innerHTML = '<span>✅</span><span>تم النسخ</span>';
        setTimeout(() => {
          button.innerHTML = originalText;
        }, 2000);
        showShareNotification('تم نسخ رابط المنتج بنجاح! 📋✅');
      } else {
        showShareNotification('فشل في نسخ الرابط. يرجى المحاولة مرة أخرى.', 'error');
      }
    };

    window.copyProductDetails = async function(encodedText, button) {
      const text = decodeURIComponent(encodedText);
      const success = await copyToClipboard(text);
      if (success) {
        const originalText = button.innerHTML;
        button.innerHTML = '<span>✅</span><span>تم النسخ</span>';
        setTimeout(() => {
          button.innerHTML = originalText;
        }, 2000);
        showShareNotification('تم نسخ تفاصيل المنتج بنجاح! 📝✅');
      } else {
        showShareNotification('فشل في نسخ التفاصيل. يرجى المحاولة مرة أخرى.', 'error');
      }
    };

    function showShareNotification(message, type = 'success') {
      // Remove any existing notification
      const existing = document.querySelector('.share-notification');
      if (existing) {
        existing.remove();
      }

      // Create notification element
      const notification = document.createElement('div');
      notification.className = `share-notification ${type}`;
      notification.innerHTML = `
        <div class="notification-content">
          <span>${message}</span>
          <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
      `;

      // Add to page
      document.body.appendChild(notification);

      // Auto-remove after 4 seconds
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 4000);
    }

    function saveCart() {
      try {
        const cartData = [];
        cart.forEach((value, key) => {
          cartData.push({
            id: key,
            product: value.product,
            qty: value.qty
          });
        });
        localStorage.setItem('aquatech_cart', JSON.stringify(cartData));
        console.log('Cart saved to localStorage:', cartData);
      } catch (error) {
        console.error('Error saving cart to localStorage:', error);
      }
    }

    function loadCart() {
      try {
        const savedCart = localStorage.getItem('aquatech_cart');
        if (savedCart) {
          const cartData = JSON.parse(savedCart);
          cart.clear();
          cartData.forEach(item => {
            cart.set(item.id, {
              product: item.product,
              qty: item.qty
            });
          });
          console.log('Cart loaded from localStorage:', cartData);
        }
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
        cart.clear(); // Clear cart if there's an error loading
      }
    }

    // Load saved customer info from localStorage
    function loadCustomerInfo() {
      try {
        const savedInfo = localStorage.getItem('aquatech_customer');
        if (savedInfo) {
          customerInfo = JSON.parse(savedInfo);
          console.log('Customer information loaded from localStorage:', customerInfo);
        }
      } catch (error) {
        console.error('Error loading customer info from localStorage:', error);
        customerInfo = {}; // Reset if there's an error
      }
    }

    // Save customer info to localStorage
    function saveCustomerInfo(info) {
      try {
        localStorage.setItem('aquatech_customer', JSON.stringify(info));
        console.log('Customer information saved to localStorage:', info);
        customerInfo = info;
      } catch (error) {
        console.error('Error saving customer info to localStorage:', error);
      }
    }

    // Fill form fields with saved customer info
    function fillCustomerFormFields() {
      if (Object.keys(customerInfo).length > 0) {
        // Fill sidebar form fields
        if (customerInfo.name) {
          document.getElementById('sidebar-cust-name').value = customerInfo.name;
        }
        if (customerInfo.phone) {
          document.getElementById('sidebar-cust-phone').value = customerInfo.phone;
        }
        if (customerInfo.email) {
          document.getElementById('sidebar-cust-email').value = customerInfo.email;
        }
        if (customerInfo.location) {
          document.getElementById('sidebar-cust-location').value = customerInfo.location;
        }
      }
    }

    function getFilteredProducts() {
      return PRODUCTS.filter(product => {
        const matchesSearch = searchTerm === '' || product.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = currentFilter === 'all' || product.category === currentFilter;
        return matchesSearch && matchesFilter;
      });
    }

    function renderProducts() {
      const list = document.getElementById('products');
      list.innerHTML = '';
      const filteredProducts = getFilteredProducts();
      
      if (filteredProducts.length === 0) {
        list.innerHTML = `
          <div style="grid-column: span 12; text-align: center; padding: 40px; color: var(--muted);">
            <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
            <div>لم يتم العثور على منتجات</div>
            <div style="font-size: 14px; margin-top: 8px;">جرب كلمات بحث أخرى أو غير الفلتر</div>
          </div>
        `;
        return;
      }

      filteredProducts.forEach(p => {
        const el = document.createElement('article');
        el.className = 'product';
        el.innerHTML = `
          <div class="product-image-container">
            <img src="${p.img}" alt="${p.name}" loading="lazy" style="width: 100%; height: 200px; object-fit: cover;">
            <button class="product-share-btn" data-id="${p.id}" title="مشاركة المنتج">
              <i class="fas fa-share-alt"></i>
            </button>
            <button class="product-preview-btn" data-id="${p.id}" title="معاينة المنتج">
              <i class="fas fa-eye"></i>
            </button>
          </div>
          <div class="body">
            <h3>${p.name}</h3>
            <div class="price">${fmt(p.price)}</div>
            <div class="controls">
              <div class="qty" data-id="${p.id}">
                <button type="button" aria-label="تقليل">−</button>
                <input type="number" min="1" value="1" inputmode="numeric" />
                <button type="button" aria-label="زيادة">+</button>
              </div>
              <button class="btn add" data-id="${p.id}">أضف للسلة</button>
            </div>
          </div>
        `;
        list.appendChild(el);
      });

      // Use the shared event handler attachment function
      attachProductEventHandlers();
    }

    function renderCart() {
      // Only render sidebar cart since main cart has been removed
      const sidebarContainer = document.getElementById('sidebar-cart-items');
      const sidebarEmpty = document.getElementById('sidebar-cart-empty');
      const sidebarSummary = document.getElementById('sidebar-cart-summary');
      const sidebarCounter = document.getElementById('sidebar-cart-counter');
      const navCartBadge = document.getElementById('nav-cart-badge');
      
      // Clear cart container
      sidebarContainer.innerHTML = '';
      
      let subtotal = 0;
      let itemsCount = 0;

      if (cart.size === 0) {
        // Sidebar cart
        sidebarEmpty.style.display = 'block';
        sidebarSummary.style.display = 'none';
        navCartBadge.style.display = 'none';
        document.getElementById('sidebar-clear-cart').style.display = 'none';
        document.getElementById('sidebar-checkout-form').style.display = 'none';
        
        // Update floating cart
        updateFloatingCart(0);
        saveCart(); // حفظ السلة حتى لو كانت فارغة
        return;
      }
      
      // Sidebar cart display settings
      sidebarEmpty.style.display = 'none';
      sidebarSummary.style.display = 'block';
      navCartBadge.style.display = 'flex';
      document.getElementById('sidebar-clear-cart').style.display = 'inline-block';

      // Loop through cart items to create display
      cart.forEach(({product, qty}) => {
        const line = product.price * qty;
        subtotal += line;
        itemsCount += qty;
        
        // Create item for sidebar cart
        const sidebarItem = document.createElement('div');
        sidebarItem.className = 'cart-item';
        sidebarItem.innerHTML = `
          <img src="${product.img}" alt="${product.name}" loading="lazy" style="width: 60px; height: 60px; object-fit: cover;">
          <div class="cart-item-info">
            <div class="cart-item-name">${product.name}</div>
            <div class="cart-item-price">${fmt(product.price)} × ${qty} = ${fmt(line)}</div>
          </div>
          <div class="cart-qty-controls">
            <button class="sidebar-minus" data-id="${product.id}">−</button>
            <div class="cart-qty-display">${qty}</div>
            <button class="sidebar-plus" data-id="${product.id}">+</button>
          </div>
          <button class="btn danger sidebar-remove" data-id="${product.id}">حذف</button>
        `;
        sidebarContainer.appendChild(sidebarItem);
      });

      // Update sidebar counters and summaries
      sidebarCounter.textContent = itemsCount;
      navCartBadge.textContent = itemsCount;
      document.getElementById('sidebar-items-count').textContent = itemsCount;
      document.getElementById('sidebar-subtotal').textContent = fmt(subtotal);
      document.getElementById('sidebar-total-amount').textContent = fmt(subtotal);

      // Update floating cart button
      updateFloatingCart(itemsCount);

      // حفظ السلة في localStorage
      saveCart();
      
      // Sidebar cart event listeners
      sidebarContainer.querySelectorAll('.sidebar-minus').forEach(b=>{
        b.addEventListener('click', ()=>{
          const id = b.getAttribute('data-id');
          const entry = cart.get(id);
          if (!entry) return;
          entry.qty = Math.max(1, entry.qty - 1);
          cart.set(id, entry);
          renderCart();
        });
      });
      sidebarContainer.querySelectorAll('.sidebar-plus').forEach(b=>{
        b.addEventListener('click', ()=>{
          const id = b.getAttribute('data-id');
          const entry = cart.get(id);
          if (!entry) return;
          entry.qty += 1;
          cart.set(id, entry);
          renderCart();
        });
      });
      sidebarContainer.querySelectorAll('.sidebar-remove').forEach(b=>{
        b.addEventListener('click', ()=>{
          cart.delete(b.getAttribute('data-id'));
          renderCart();
        });
      });
    }

    function showCheckoutForm(show=true, isSidebar=true){ // Always use sidebar since main cart removed
      const formId = 'sidebar-checkout-form';
      const errorId = 'sidebar-form-error';
      const okId = 'sidebar-form-ok';
      
      document.getElementById(formId).style.display = show ? 'block' : 'none';
      document.getElementById(errorId).style.display = 'none';
      document.getElementById(okId).style.display = 'none';
      
      // If showing the form, fill with saved customer info
      if (show) {
        fillCustomerFormFields();
        
        // Scroll to form
        setTimeout(() => {
          document.getElementById(formId).scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }

    function showProductPreview(product) {
      currentPreviewProduct = product;
      
      // Update modal content
      document.getElementById('preview-img').src = product.img;
      document.getElementById('preview-img').alt = product.name;
      document.getElementById('preview-cat').textContent = product.category;
      document.getElementById('preview-name').textContent = product.name;
      document.getElementById('preview-price').textContent = fmt(product.price);
      document.getElementById('preview-desc').textContent = product.description;
      document.getElementById('preview-quantity').value = 1;
      
      // Show modal
      document.getElementById('preview-modal').style.display = 'flex';
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    function hideProductPreview() {
      document.getElementById('preview-modal').style.display = 'none';
      document.body.style.overflow = 'auto'; // Restore scrolling
      currentPreviewProduct = null;
    }

    function showSharedProductView(product) {
      const list = document.getElementById('products');
      list.innerHTML = `
        <div style="grid-column: span 12; margin-bottom: 20px;">
          <div class="shared-product-header">
            <h2>🔗 منتج مشارك من AquaTech Pro</h2>
            <div class="shared-product-actions">
              <button class="btn secondary" onclick="clearUrlParams(); renderProducts();">عرض جميع المنتجات</button>
              <button class="btn share" onclick="shareProduct(PRODUCTS.find(p => p.id === '${product.id}'))">
                <i class="fas fa-share-alt"></i> مشاركة مرة أخرى
              </button>
            </div>
          </div>
        </div>
        <article class="product featured-product">
          <div class="product-image-container">
            <img src="${product.img}" alt="${product.name}" loading="lazy" style="width: 100%; height: 300px; object-fit: cover;">
            <button class="product-share-btn" data-id="${product.id}" title="مشاركة المنتج">
              <i class="fas fa-share-alt"></i>
            </button>
            <button class="product-preview-btn" data-id="${product.id}" title="معاينة المنتج">
              <i class="fas fa-eye"></i>
            </button>
          </div>
          <div class="body">
            <div class="product-category">${product.category}</div>
            <h3>${product.name}</h3>
            <div class="price">${fmt(product.price)}</div>
            <div class="product-description">${product.description}</div>
            <div class="controls">
              <div class="qty" data-id="${product.id}">
                <button type="button" aria-label="تقليل">−</button>
                <input type="number" min="1" value="1" inputmode="numeric" />
                <button type="button" aria-label="زيادة">+</button>
              </div>
              <button class="btn preview" data-id="${product.id}" title="معاينة المنتج">👁️ معاينة</button>
              <button class="btn add" data-id="${product.id}">أضف للسلة</button>
            </div>
            <div class="share-info">
              <small>💡 شارك هذا المنتج مع أصدقائك واحصل على أفضل العروض من AquaTech Pro</small>
            </div>
          </div>
        </article>
        <div style="grid-column: span 12; margin-top: 30px;">
          <div class="related-products-header">
            <h3>🔥 منتجات ذات صلة</h3>
            <p>اكتشف المزيد من منتجات السباكة عالية الجودة</p>
          </div>
        </div>
      `;

      // Add some related products (same category or random)
      const relatedProducts = PRODUCTS.filter(p => 
        p.id !== product.id && (p.category === product.category || Math.random() > 0.7)
      ).slice(0, 6);

      relatedProducts.forEach(p => {
        const el = document.createElement('article');
        el.className = 'product';
        el.innerHTML = `
          <div class="product-image-container">
            <img src="${p.img}" alt="${p.name}" loading="lazy" style="width: 100%; height: 200px; object-fit: cover;">
            <button class="product-share-btn" data-id="${p.id}" title="مشاركة المنتج">
              <i class="fas fa-share-alt"></i>
            </button>
            <button class="product-preview-btn" data-id="${p.id}" title="معاينة المنتج">
              <i class="fas fa-eye"></i>
            </button>
          </div>
          <div class="body">
            <h3>${p.name}</h3>
            <div class="price">${fmt(p.price)}</div>
            <div class="controls">
              <div class="qty" data-id="${p.id}">
                <button type="button" aria-label="تقليل">−</button>
                <input type="number" min="1" value="1" inputmode="numeric" />
                <button type="button" aria-label="زيادة">+</button>
              </div>
              <button class="btn add" data-id="${p.id}">أضف للسلة</button>
            </div>
          </div>
        `;
        list.appendChild(el);
      });

      // Attach event handlers (same as in renderProducts)
      attachProductEventHandlers();

      // Update page title and meta description for shared product
      updateMetaTagsForProduct(product);
    }

    function updateMetaTagsForProduct(product) {
      const baseUrl = window.location.origin + window.location.pathname;
      const productImageUrl = new URL(product.img, baseUrl).href;
      const shareUrl = generateProductShareUrl(product.id);
      
      // Update page title
      document.title = `${product.name} - AquaTech Pro`;
      
      // Update or create meta description
      updateOrCreateMetaTag('name', 'description', 
        `${product.name} - ${product.description} - السعر: ${fmt(product.price)} من AquaTech Pro للسباكة`
      );

      // Update Open Graph tags for rich sharing
      updateOrCreateMetaTag('property', 'og:title', `${product.name} - AquaTech Pro`);
      updateOrCreateMetaTag('property', 'og:description', 
        `${product.description} - السعر: ${fmt(product.price)} - متجر AquaTech Pro للسباكة`
      );
      updateOrCreateMetaTag('property', 'og:image', productImageUrl);
      updateOrCreateMetaTag('property', 'og:image:width', '1200');
      updateOrCreateMetaTag('property', 'og:image:height', '630');
      updateOrCreateMetaTag('property', 'og:image:alt', product.name);
      updateOrCreateMetaTag('property', 'og:url', shareUrl);
      updateOrCreateMetaTag('property', 'og:type', 'product');
      updateOrCreateMetaTag('property', 'product:price:amount', product.price.toString());
      updateOrCreateMetaTag('property', 'product:price:currency', 'EGP');

      // Update Twitter Card tags
      updateOrCreateMetaTag('name', 'twitter:card', 'summary_large_image');
      updateOrCreateMetaTag('name', 'twitter:title', `${product.name} - AquaTech Pro`);
      updateOrCreateMetaTag('name', 'twitter:description', 
        `${product.description} - السعر: ${fmt(product.price)}`
      );
      updateOrCreateMetaTag('name', 'twitter:image', productImageUrl);
      updateOrCreateMetaTag('name', 'twitter:image:alt', product.name);

      // Add structured data for the product
      addProductStructuredData(product, shareUrl, productImageUrl);
      
      // Generate and set enhanced social media image
      generateSocialMediaImage(product).then(imageDataUrl => {
        if (imageDataUrl) {
          updateOrCreateMetaTag('property', 'og:image', imageDataUrl);
          updateOrCreateMetaTag('name', 'twitter:image', imageDataUrl);
        }
      }).catch(console.error);
    }

    async function generateSocialMediaImage(product) {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size for optimal social media sharing (1200x630)
        canvas.width = 1200;
        canvas.height = 630;
        
        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#0f172a');
        gradient.addColorStop(1, '#1e293b');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Load and draw product image
        const productImg = new Image();
        productImg.crossOrigin = 'anonymous';
        
        return new Promise((resolve) => {
          productImg.onload = () => {
            // Draw product image on the left side
            const imgSize = 300;
            const imgX = 50;
            const imgY = (canvas.height - imgSize) / 2;
            
            // Create rounded rectangle for image
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(imgX, imgY, imgSize, imgSize, 20);
            ctx.clip();
            ctx.drawImage(productImg, imgX, imgY, imgSize, imgSize);
            ctx.restore();
            
            // Add border to image
            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.roundRect(imgX, imgY, imgSize, imgSize, 20);
            ctx.stroke();
            
            // Right side content area
            const contentX = imgX + imgSize + 50;
            const contentWidth = canvas.width - contentX - 50;
            
            // Product name
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'right';
            ctx.direction = 'rtl';
            
            // Wrap text for product name
            const lines = wrapText(ctx, product.name, contentWidth, 54);
            let textY = 180;
            lines.forEach(line => {
              ctx.fillText(line, canvas.width - 50, textY);
              textY += 60;
            });
            
            // Price
            ctx.fillStyle = '#22c55e';
            ctx.font = 'bold 42px Arial';
            ctx.fillText(fmt(product.price), canvas.width - 50, textY + 40);
            
            // Category
            ctx.fillStyle = '#94a3b8';
            ctx.font = '28px Arial';
            ctx.fillText(product.category, canvas.width - 50, textY + 90);
            
            // Store branding
            ctx.fillStyle = '#22c55e';
            ctx.font = 'bold 32px Arial';
            ctx.fillText('AquaTech Pro - سباكة احترافية', canvas.width - 50, canvas.height - 50);
            
            // Logo/Icon (simple circle with text)
            ctx.beginPath();
            ctx.arc(100, 100, 40, 0, 2 * Math.PI);
            ctx.fillStyle = '#22c55e';
            ctx.fill();
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('AT', 100, 110);
            
            resolve(canvas.toDataURL('image/png'));
          };
          
          productImg.onerror = () => {
            console.warn('Could not load product image for social media card');
            resolve(null);
          };
          
          productImg.src = product.img;
        });
        
      } catch (error) {
        console.error('Error generating social media image:', error);
        return null;
      }
    }

    function wrapText(ctx, text, maxWidth, lineHeight) {
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      
      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && i > 0) {
          lines.push(currentLine.trim());
          currentLine = words[i] + ' ';
        } else {
          currentLine = testLine;
        }
      }
      lines.push(currentLine.trim());
      
      return lines;
    }

    function updateOrCreateMetaTag(attribute, name, content) {
      let metaTag = document.querySelector(`meta[${attribute}="${name}"]`);
      if (!metaTag) {
        metaTag = document.createElement('meta');
        metaTag.setAttribute(attribute, name);
        document.head.appendChild(metaTag);
      }
      metaTag.setAttribute('content', content);
    }

    function addProductStructuredData(product, shareUrl, imageUrl) {
      // Remove existing product structured data
      const existingScript = document.querySelector('#product-structured-data');
      if (existingScript) {
        existingScript.remove();
      }

      // Create new structured data
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.name,
        "description": product.description,
        "image": imageUrl,
        "url": shareUrl,
        "category": product.category,
        "offers": {
          "@type": "Offer",
          "price": product.price,
          "priceCurrency": "EGP",
          "availability": "https://schema.org/InStock",
          "seller": {
            "@type": "Organization",
            "name": "AquaTech Pro"
          }
        },
        "brand": {
          "@type": "Brand",
          "name": "AquaTech Pro"
        }
      };

      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = 'product-structured-data';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    function attachProductEventHandlers() {
      const list = document.getElementById('products');
      
      // attach qty controls
      list.querySelectorAll('.qty').forEach(q => {
        const input = q.querySelector('input');
        q.children[0].addEventListener('click', () => { input.value = Math.max(1, (parseInt(input.value||'1',10)-1)); });
        q.children[2].addEventListener('click', () => { input.value = Math.max(1, (parseInt(input.value||'1',10)+1)); });
      });

      // add-to-cart handlers
      list.querySelectorAll('.btn.add').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const p = PRODUCTS.find(x => x.id === id);
          const qtyInput = btn.parentElement.querySelector('input');
          const qty = Math.max(1, parseInt(qtyInput.value || '1', 10));
          const existing = cart.get(id);
          cart.set(id, { product: p, qty: (existing?.qty || 0) + qty });
          
          // Add flying animation
          setTimeout(() => {
            animateProductToCart(btn, p);
          }, 100); // Small delay to let user see the button animation first
          
          renderCart();
          
          // Add animation effect
          btn.classList.add('animate-add');
          btn.textContent = 'تم الإضافة ✓';
          setTimeout(() => {
            btn.textContent = 'أضف للسلة';
            btn.classList.remove('animate-add');
          }, 1000);
        });
      });

      // preview handlers - Updated to work with new preview button
      list.querySelectorAll('.product-preview-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const product = PRODUCTS.find(x => x.id === id);
          if (product) {
            showProductPreview(product);
          }
        });
      });

      // Keep old preview handlers for compatibility (if any exist)
      list.querySelectorAll('.btn.preview').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const product = PRODUCTS.find(x => x.id === id);
          if (product) {
            showProductPreview(product);
          }
        });
      });

      // share handlers - Updated to work with new share button
      list.querySelectorAll('.product-share-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const product = PRODUCTS.find(x => x.id === id);
          if (product) {
            shareProduct(product);
          }
        });
      });

      // Keep old share handlers for compatibility (if any exist)
      list.querySelectorAll('.btn.share').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const product = PRODUCTS.find(x => x.id === id);
          if (product) {
            shareProduct(product);
          }
        });
      });
    }

    // ===============================================
    // ADD TO CART ANIMATION FUNCTION
    // ===============================================
    function animateProductToCart(button, product) {
      // Get the product image
      const productCard = button.closest('.product');
      const productImg = productCard.querySelector('img');
      
      if (!productImg) return;
      
      // Get positions
      const imgRect = productImg.getBoundingClientRect();
      const cartBtn = document.getElementById('floating-cart') || document.getElementById('navbar-cart-btn');
      
      if (!cartBtn) return;
      
      const cartRect = cartBtn.getBoundingClientRect();
      
      // Create suction tube
      createSuctionTube(imgRect, cartRect);
      
      // Create flying product with delay to show tube first
      setTimeout(() => {
        createFlyingProduct(product, imgRect, cartRect);
      }, 200);
      
      // Add cart pulse animation
      setTimeout(() => {
        if (cartBtn) {
          cartBtn.classList.add('cart-pulse');
          setTimeout(() => {
            cartBtn.classList.remove('cart-pulse');
          }, 600);
        }
        
        // Add cart badge bounce animation
        const navCartBadge = document.getElementById('nav-cart-badge');
        const floatingCartBadge = document.getElementById('floating-cart-badge');
        
        if (navCartBadge) {
          navCartBadge.classList.add('bounce');
          setTimeout(() => {
            navCartBadge.classList.remove('bounce');
          }, 600);
        }
        
        if (floatingCartBadge) {
          floatingCartBadge.classList.add('bounce');
          setTimeout(() => {
            floatingCartBadge.classList.remove('bounce');
          }, 600);
        }
      }, 700);
    }

    function createSuctionTube(startRect, endRect) {
      const tube = document.createElement('div');
      tube.className = 'suction-tube';
      
      // Calculate precise connection points
      const startX = startRect.left + startRect.width / 2;
      const startY = startRect.top + startRect.height / 2;
      const endX = endRect.left + endRect.width / 2;
      const endY = endRect.top + endRect.height / 2;
      
      // Calculate vector from start to end
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // Calculate angle in degrees for proper tube direction
      const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
      
      // Position the tube at start point with precise centering
      tube.style.left = startX + 'px';
      tube.style.top = (startY - 6) + 'px'; // Center the tube vertically
      tube.style.width = length + 'px';
      tube.style.setProperty('--tube-angle', angle + 'deg');
      
      // Add flowing particles with enhanced timing
      const particlesContainer = document.createElement('div');
      particlesContainer.className = 'flow-particles';
      
      // Create particles with natural flow pattern
      for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.animationDelay = (i * 0.08) + 's';
        // Add slight vertical variation for more natural flow
        particle.style.top = (45 + Math.random() * 10) + '%';
        particlesContainer.appendChild(particle);
      }
      
      tube.appendChild(particlesContainer);
      document.body.appendChild(tube);
      
      // Remove tube after complete animation cycle
      setTimeout(() => {
        if (tube.parentNode) {
          tube.parentNode.removeChild(tube);
        }
      }, 1400);
    }

    function createFlyingProduct(product, startRect, endRect) {
      // Create a clone of the product image for animation
      const flyingImg = document.createElement('img');
      flyingImg.src = product.img;
      flyingImg.className = 'product-flying-to-cart';
      
      // Calculate positions
      const startX = startRect.left + startRect.width / 2 - 30;
      const startY = startRect.top + startRect.height / 2 - 30;
      const endX = endRect.left + endRect.width / 2 - 30;
      const endY = endRect.top + endRect.height / 2 - 30;
      
      // Set initial position
      flyingImg.style.left = startX + 'px';
      flyingImg.style.top = startY + 'px';
      
      // Calculate curved path points
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      
      // Create control points for bezier curve (simulating water flow)
      const controlOffset = Math.min(Math.abs(deltaX), Math.abs(deltaY)) * 0.5;
      const curve20X = deltaX * 0.2 + (deltaY > 0 ? -controlOffset : controlOffset) * 0.3;
      const curve20Y = deltaY * 0.2 - controlOffset * 0.2;
      const curve40X = deltaX * 0.4 + (deltaY > 0 ? -controlOffset : controlOffset) * 0.6;
      const curve40Y = deltaY * 0.4 - controlOffset * 0.4;
      const curve60X = deltaX * 0.6 + (deltaY > 0 ? -controlOffset : controlOffset) * 0.4;
      const curve60Y = deltaY * 0.6 - controlOffset * 0.2;
      const curve80X = deltaX * 0.8;
      const curve80Y = deltaY * 0.8;
      
      // Set CSS custom properties for curved animation
      flyingImg.style.setProperty('--curve-x-20', curve20X + 'px');
      flyingImg.style.setProperty('--curve-y-20', curve20Y + 'px');
      flyingImg.style.setProperty('--curve-x-40', curve40X + 'px');
      flyingImg.style.setProperty('--curve-y-40', curve40Y + 'px');
      flyingImg.style.setProperty('--curve-x-60', curve60X + 'px');
      flyingImg.style.setProperty('--curve-y-60', curve60Y + 'px');
      flyingImg.style.setProperty('--curve-x-80', curve80X + 'px');
      flyingImg.style.setProperty('--curve-y-80', curve80Y + 'px');
      flyingImg.style.setProperty('--curve-x-100', deltaX + 'px');
      flyingImg.style.setProperty('--curve-y-100', deltaY + 'px');
      
      // Add to document
      document.body.appendChild(flyingImg);
      
      // Start animation
      requestAnimationFrame(() => {
        flyingImg.classList.add('fly-to-cart-curved');
      });
      
      // Enhanced cart entry effect - make product actually enter the cart
      setTimeout(() => {
        // Stage 1: Product reaches cart entrance
        flyingImg.style.transition = 'all 0.2s ease-out';
        flyingImg.style.transform = 'scale(0.3) rotate(360deg)';
        flyingImg.style.opacity = '0.8';
        
        // Stage 2: Product enters cart opening
        setTimeout(() => {
          flyingImg.style.transition = 'all 0.2s ease-in';
          flyingImg.style.transform = 'scale(0.15) rotate(540deg)';
          flyingImg.style.opacity = '0.4';
          flyingImg.style.filter = 'blur(1px)';
          
          // Visual feedback on cart icon - cart opens to receive product
          const cartBtn = document.getElementById('floating-cart') || document.getElementById('navbar-cart-btn');
          const cartIcon = cartBtn?.querySelector('i');
          
          if (cartIcon) {
            // Cart "opens" to receive the product
            cartIcon.style.transform = 'scale(1.3)';
            cartIcon.style.color = '#10b981';
            cartIcon.style.filter = 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))';
          }
          
          // Stage 3: Final disappearance inside cart
          setTimeout(() => {
            flyingImg.style.transition = 'all 0.15s ease-in';
            flyingImg.style.transform = 'scale(0.05) rotate(720deg)';
            flyingImg.style.opacity = '0';
            flyingImg.style.filter = 'blur(3px)';
            
            if (cartIcon) {
              // Cart "closes" after swallowing the product
              cartIcon.style.transform = 'scale(0.85)';
            }
            
            // Final cart satisfaction effect
            setTimeout(() => {
              if (cartIcon) {
                cartIcon.style.transform = 'scale(1.1)';
                cartIcon.style.color = '#059669';
              }
              
              // Add cart shake effect to show the product landed inside
              if (cartBtn) {
                cartBtn.style.animation = 'cartShake 0.4s ease-in-out';
                setTimeout(() => {
                  cartBtn.style.animation = '';
                  
                  // Return cart to normal state
                  if (cartIcon) {
                    cartIcon.style.transform = 'scale(1)';
                    cartIcon.style.color = '';
                    cartIcon.style.filter = '';
                  }
                }, 400);
              }
            }, 100);
          }, 150);
        }, 200);
      }, 700);
      
      // Remove the flying image after complete animation
      setTimeout(() => {
        if (flyingImg.parentNode) {
          flyingImg.parentNode.removeChild(flyingImg);
        }
      }, 1200);
    }

    // Animation function for preview modal
    function animateProductToCartFromPreview(product) {
      // Get the preview image
      const previewImg = document.getElementById('preview-img');
      
      if (!previewImg) return;
      
      // Get positions
      const imgRect = previewImg.getBoundingClientRect();
      const cartBtn = document.getElementById('floating-cart') || document.getElementById('navbar-cart-btn');
      
      if (!cartBtn) return;
      
      const cartRect = cartBtn.getBoundingClientRect();
      
      // Create suction tube from preview
      createSuctionTube(imgRect, cartRect);
      
      // Create flying product with delay
      setTimeout(() => {
        createFlyingProductFromPreview(product, imgRect, cartRect);
      }, 200);
      
      // Add cart effects with delay
      setTimeout(() => {
        if (cartBtn) {
          cartBtn.classList.add('cart-pulse');
          setTimeout(() => {
            cartBtn.classList.remove('cart-pulse');
          }, 600);
        }
        
        // Add cart badge bounce animation
        const navCartBadge = document.getElementById('nav-cart-badge');
        const floatingCartBadge = document.getElementById('floating-cart-badge');
        
        if (navCartBadge) {
          navCartBadge.classList.add('bounce');
          setTimeout(() => {
            navCartBadge.classList.remove('bounce');
          }, 600);
        }
        
        if (floatingCartBadge) {
          floatingCartBadge.classList.add('bounce');
          setTimeout(() => {
            floatingCartBadge.classList.remove('bounce');
          }, 600);
        }
      }, 700);
    }

    function createFlyingProductFromPreview(product, startRect, endRect) {
      // Create a clone of the product image for animation
      const flyingImg = document.createElement('img');
      flyingImg.src = product.img;
      flyingImg.className = 'product-flying-to-cart';
      
      // Calculate positions
      const startX = startRect.left + startRect.width / 2 - 40;
      const startY = startRect.top + startRect.height / 2 - 40;
      const endX = endRect.left + endRect.width / 2 - 40;
      const endY = endRect.top + endRect.height / 2 - 40;
      
      // Set initial position
      flyingImg.style.left = startX + 'px';
      flyingImg.style.top = startY + 'px';
      flyingImg.style.width = '80px';
      flyingImg.style.height = '80px';
      
      // Calculate curved path points
      const deltaX = endX - startX;
      const deltaY = endY - startY;
      
      // Create control points for bezier curve
      const controlOffset = Math.min(Math.abs(deltaX), Math.abs(deltaY)) * 0.5;
      const curve20X = deltaX * 0.2 + (deltaY > 0 ? -controlOffset : controlOffset) * 0.3;
      const curve20Y = deltaY * 0.2 - controlOffset * 0.2;
      const curve40X = deltaX * 0.4 + (deltaY > 0 ? -controlOffset : controlOffset) * 0.6;
      const curve40Y = deltaY * 0.4 - controlOffset * 0.4;
      const curve60X = deltaX * 0.6 + (deltaY > 0 ? -controlOffset : controlOffset) * 0.4;
      const curve60Y = deltaY * 0.6 - controlOffset * 0.2;
      const curve80X = deltaX * 0.8;
      const curve80Y = deltaY * 0.8;
      
      // Set CSS custom properties for curved animation
      flyingImg.style.setProperty('--curve-x-20', curve20X + 'px');
      flyingImg.style.setProperty('--curve-y-20', curve20Y + 'px');
      flyingImg.style.setProperty('--curve-x-40', curve40X + 'px');
      flyingImg.style.setProperty('--curve-y-40', curve40Y + 'px');
      flyingImg.style.setProperty('--curve-x-60', curve60X + 'px');
      flyingImg.style.setProperty('--curve-y-60', curve60Y + 'px');
      flyingImg.style.setProperty('--curve-x-80', curve80X + 'px');
      flyingImg.style.setProperty('--curve-y-80', curve80Y + 'px');
      flyingImg.style.setProperty('--curve-x-100', deltaX + 'px');
      flyingImg.style.setProperty('--curve-y-100', deltaY + 'px');
      
      // Add to document
      document.body.appendChild(flyingImg);
      
      // Start curved animation
      requestAnimationFrame(() => {
        flyingImg.classList.add('fly-to-cart-curved');
      });
      
      // Enhanced cart entry effect from preview - make product actually enter the cart
      setTimeout(() => {
        // Stage 1: Product reaches cart entrance
        flyingImg.style.transition = 'all 0.2s ease-out';
        flyingImg.style.transform = 'scale(0.4) rotate(360deg)';
        flyingImg.style.opacity = '0.8';
        
        // Stage 2: Product enters cart opening
        setTimeout(() => {
          flyingImg.style.transition = 'all 0.2s ease-in';
          flyingImg.style.transform = 'scale(0.2) rotate(540deg)';
          flyingImg.style.opacity = '0.4';
          flyingImg.style.filter = 'blur(1px)';
          
          // Visual feedback on cart icon - cart opens to receive product
          const cartBtn = document.getElementById('floating-cart') || document.getElementById('navbar-cart-btn');
          const cartIcon = cartBtn?.querySelector('i');
          
          if (cartIcon) {
            // Cart "opens" to receive the product
            cartIcon.style.transform = 'scale(1.3)';
            cartIcon.style.color = '#10b981';
            cartIcon.style.filter = 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))';
          }
          
          // Stage 3: Final disappearance inside cart
          setTimeout(() => {
            flyingImg.style.transition = 'all 0.15s ease-in';
            flyingImg.style.transform = 'scale(0.05) rotate(720deg)';
            flyingImg.style.opacity = '0';
            flyingImg.style.filter = 'blur(3px)';
            
            if (cartIcon) {
              // Cart "closes" after swallowing the product
              cartIcon.style.transform = 'scale(0.85)';
            }
            
            // Final cart satisfaction effect
            setTimeout(() => {
              if (cartIcon) {
                cartIcon.style.transform = 'scale(1.1)';
                cartIcon.style.color = '#059669';
              }
              
              // Add cart shake effect to show the product landed inside
              if (cartBtn) {
                cartBtn.style.animation = 'cartShake 0.4s ease-in-out';
                setTimeout(() => {
                  cartBtn.style.animation = '';
                  
                  // Return cart to normal state
                  if (cartIcon) {
                    cartIcon.style.transform = 'scale(1)';
                    cartIcon.style.color = '';
                    cartIcon.style.filter = '';
                  }
                }, 400);
              }
            }, 100);
          }, 150);
        }, 200);
      }, 700);
      
      // Remove the flying image after complete animation
      setTimeout(() => {
        if (flyingImg.parentNode) {
          flyingImg.parentNode.removeChild(flyingImg);
        }
      }, 1200);
    }

    function validateForm(isSidebar=true) { // Always use sidebar validation since main cart removed
      // Get the appropriate element IDs based on whether we're in sidebar
      const nameId = 'sidebar-cust-name';
      const phoneId = 'sidebar-cust-phone';
      const emailId = 'sidebar-cust-email';
      const locationId = 'sidebar-cust-location';
      const termsId = 'sidebar-terms-agree';
      
      const name = document.getElementById(nameId).value.trim();
      const phone = document.getElementById(phoneId).value.trim();
      const email = document.getElementById(emailId).value.trim();
      const location = document.getElementById(locationId).value.trim();
      const termsAgreed = document.getElementById(termsId).checked;
      const errors = [];

      if (name.length < 2) errors.push('الرجاء إدخال اسمك الكامل.');
      
      // More flexible phone validation
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 8 || cleanPhone.length > 15) {
        errors.push('رقم الهاتف يجب أن يكون 8-15 رقم بالصيغة الدولية (مثال: 201001234567).');
      }
      
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('الرجاء إدخال بريد إلكتروني صحيح أو اتركه فارغاً.');
      }

      if (location.length < 5) {
        errors.push('الرجاء إدخال الموقع بالتفصيل (المدينة، الحي، الشارع).');
      }

      if (!termsAgreed) {
        errors.push('⚠️ يجب الموافقة على جميع الشروط والأحكام وسياسة الإرجاع والاستبدال قبل إتمام الطلب. يرجى تحديد مربع الموافقة أولاً.');
      }

      // If form is valid, save customer information
      if (errors.length === 0) {
        saveCustomerInfo({
          name,
          phone: cleanPhone,
          email,
          location
        });
      }

      return { valid: errors.length === 0, errors, name, phone: cleanPhone, email, location, termsAgreed };
    }

    function buildWhatsappMessage(customer, items) {
      const lines = [];
      lines.push(`📦 *طلب جديد من AquaTech Pro*`);
      lines.push('');
      lines.push(`👤 *العميل*: ${customer.name}`);
      lines.push(`📞 *الهاتف*: ${customer.phone}`);
      if (customer.email) lines.push(`✉️ *البريد الإلكتروني*: ${customer.email}`);
      lines.push(`📍 *الموقع*: ${customer.location}`);
      lines.push('');
      lines.push(`🛠️ *المنتجات المطلوبة:*`);
      let total = 0;
      items.forEach(({product, qty})=>{
        const line = product.price * qty;
        total += line;
        lines.push(`• ${product.name} — ${qty} × ${product.price} ${CURRENCY} = ${line} ${CURRENCY}`);
        lines.push(`   الصورة: ${product.img}`);
      });
      lines.push('');
      lines.push(`💰 *إجمالي الطلب*: ${total} ${CURRENCY}`);
      lines.push('');
      lines.push(`🚚 *يرجى تأكيد التوفر ومواعيد التوصيل*`);
      lines.push(`🏠 *خدمة التركيب متوفرة عند الطلب*`);
      return lines.join('\n');
    }

    function completeOrder() {
      // Clear the cart
      cart.clear();
      
      // Update cart display
      renderCart();
      
      // Ensure all cart counters are updated to zero
      document.querySelectorAll('.cart-counter').forEach(element => {
        element.textContent = '0';
      });
      
      // Set the flag to indicate order was completed
      orderSent = true;
      
      // Store a timestamp in localStorage to know an order was just completed
      try {
        localStorage.setItem('aquatech_order_completed', Date.now().toString());
        console.log('Order completed successfully, cart cleared');
      } catch (e) {
        console.error('Failed to save order completion to localStorage', e);
      }
    }
    
    function openWhatsapp(message, toNumber) {
      // Additional validation before opening WhatsApp
      const termsCheckbox = document.getElementById('sidebar-terms-agree');
      if (!termsCheckbox || !termsCheckbox.checked) {
        console.error('Terms not agreed - blocking WhatsApp send');
        alert('⚠️ يجب الموافقة على الشروط والأحكام قبل إرسال الطلب!');
        return false;
      }
      
      // Clean and format the phone number
      const cleanNumber = toNumber.replace(/\D/g, ''); // Remove non-digits
      
      // Create WhatsApp URL
      const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
      
      console.log('Opening WhatsApp with URL:', url); // Debug log
      
      // Clear the cart when opening WhatsApp to complete an order
      completeOrder();
      
      // Always open in a new tab/window regardless of device type
      try {
        // Open in new tab with '_blank' parameter
        window.open(url, '_blank', 'noopener,noreferrer');
        
        // Add message to console for debugging
        console.log('WhatsApp opened in new tab');
        return true;
      } catch (error) {
        console.error('Error opening WhatsApp in new tab:', error);
        
        // If window.open fails, try fallback method
        try {
          // Create a temporary anchor element
          const a = document.createElement('a');
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.click();
          return true;
        } catch (fallbackError) {
          console.error('Fallback method failed:', fallbackError);
          
          // Final fallback: regular navigation but in new tab if possible
          window.open(url, '_blank');
          return true;
        }
      }
    }

    function updateFloatingCart(itemsCount) {
      const floatingCart = document.getElementById('floating-cart');
      const floatingBadge = document.getElementById('floating-cart-badge');
      
      if (itemsCount > 0) {
        floatingCart.classList.add('visible');
        floatingBadge.textContent = itemsCount;
        floatingBadge.style.display = 'flex';
      } else {
        floatingCart.classList.remove('visible');
        floatingBadge.style.display = 'none';
      }
      
      // Update all elements with class cart-counter
      document.querySelectorAll('.cart-counter').forEach(element => {
        element.textContent = itemsCount;
      });
    }
    
    function toggleSidebarCart() {
      const sidebarCart = document.getElementById('sidebar-cart');
      const overlay = document.getElementById('cart-overlay');
      
      sidebarCart.classList.toggle('open');
      overlay.classList.toggle('open');
      
      // Prevent body scrolling when cart is open
      if (sidebarCart.classList.contains('open')) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
    
    function closeSidebarCart() {
      const sidebarCart = document.getElementById('sidebar-cart');
      const overlay = document.getElementById('cart-overlay');
      
      sidebarCart.classList.remove('open');
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      
      // Also reset the sidebar checkout form to hidden
      document.getElementById('sidebar-checkout-form').style.display = 'none';
      document.getElementById('sidebar-form-error').style.display = 'none';
      document.getElementById('sidebar-form-ok').style.display = 'none';
    }

    // ======= Auto-completion & Form Enhancement =======
    function setupFormAutocompletion() {
      // Set up input fields with proper autocomplete attributes
      const custNameInput = document.getElementById('sidebar-cust-name');
      const custPhoneInput = document.getElementById('sidebar-cust-phone');
      const custEmailInput = document.getElementById('sidebar-cust-email');
      const custLocationInput = document.getElementById('sidebar-cust-location');
      const termsCheckbox = document.getElementById('sidebar-terms-agree');
      
      if (custNameInput) {
        custNameInput.setAttribute('autocomplete', 'name');
        // Save name as it's typed
        custNameInput.addEventListener('change', () => {
          if (!customerInfo) customerInfo = {};
          customerInfo.name = custNameInput.value.trim();
          saveCustomerInfo(customerInfo);
        });
      }
      
      if (custPhoneInput) {
        custPhoneInput.setAttribute('autocomplete', 'tel');
        custPhoneInput.setAttribute('inputmode', 'tel');
        // Save phone as it's typed
        custPhoneInput.addEventListener('change', () => {
          if (!customerInfo) customerInfo = {};
          customerInfo.phone = custPhoneInput.value.trim();
          saveCustomerInfo(customerInfo);
        });
      }
      
      if (custEmailInput) {
        custEmailInput.setAttribute('autocomplete', 'email');
        // Save email as it's typed
        custEmailInput.addEventListener('change', () => {
          if (!customerInfo) customerInfo = {};
          customerInfo.email = custEmailInput.value.trim();
          saveCustomerInfo(customerInfo);
        });
      }
      
      if (custLocationInput) {
        custLocationInput.setAttribute('autocomplete', 'address-line1');
        // Save location as it's typed
        custLocationInput.addEventListener('change', () => {
          if (!customerInfo) customerInfo = {};
          customerInfo.location = custLocationInput.value.trim();
          saveCustomerInfo(customerInfo);
        });
      }
      
      // Add event listener for terms checkbox to remove error state when checked
      if (termsCheckbox) {
        termsCheckbox.addEventListener('change', () => {
          if (termsCheckbox.checked) {
            // Remove error classes when terms are agreed
            const termsAgreement = document.querySelector('.terms-agreement');
            const termsCheckboxContainer = document.querySelector('.terms-checkbox');
            const errBox = document.getElementById('sidebar-form-error');
            
            if (termsAgreement) {
              termsAgreement.classList.remove('error');
            }
            if (termsCheckboxContainer) {
              termsCheckboxContainer.classList.remove('error');
            }
            if (errBox && errBox.style.display === 'block') {
              // Hide error message if it's showing terms error
              const errorText = errBox.textContent || errBox.innerHTML;
              if (errorText.includes('الموافقة على الشروط') || errorText.includes('الشروط والأحكام')) {
                errBox.style.display = 'none';
              }
            }
          }
        });
      }
    }

    // ======= EVENTS =======
    // Floating cart button
    document.getElementById('floating-cart').addEventListener('click', toggleSidebarCart);

    // Nav cart button
    document.getElementById('navbar-cart-btn').addEventListener('click', toggleSidebarCart);
    
    // Close cart button
    document.getElementById('close-cart').addEventListener('click', closeSidebarCart);
    
    // Cart overlay click to close
    document.getElementById('cart-overlay').addEventListener('click', closeSidebarCart);
    
    // Sidebar checkout button
    document.getElementById('sidebar-checkout').addEventListener('click', () => {
      if (cart.size === 0) return;
      showCheckoutForm(true, true); // Show the sidebar checkout form
      document.getElementById('sidebar-cust-name').focus();
    });
    
    // Sidebar clear cart button
    document.getElementById('sidebar-clear-cart').addEventListener('click', () => {
      cart.clear(); 
      renderCart(); // This will automatically save the empty cart
    });
    
    // Sidebar cancel checkout button
    document.getElementById('sidebar-cancel-checkout').addEventListener('click', () => {
      showCheckoutForm(false, true);
    });
    
    // Sidebar send WhatsApp button
    document.getElementById('sidebar-send-whatsapp').addEventListener('click', () => {
      const { valid, errors, name, phone, email, location, termsAgreed } = validateForm(true);
      const errBox = document.getElementById('sidebar-form-error');
      const okBox = document.getElementById('sidebar-form-ok');
      const termsCheckbox = document.getElementById('sidebar-terms-agree');

      if (!valid) {
        // Clear any previous success messages
        okBox.style.display = 'none';
        
        // Show error messages with enhanced styling
        errBox.innerHTML = `
          <div style="background: #fee; border: 2px solid #f87171; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
            <div style="color: #dc2626; font-weight: bold; font-size: 16px; margin-bottom: 8px;">
              ❌ لا يمكن إرسال الطلب - يرجى إصلاح الأخطاء التالية:
            </div>
            <ul style="margin: 0; padding-right: 20px; color: #991b1b;">
              ${errors.map(error => `<li style="margin-bottom: 4px;">${error}</li>`).join('')}
            </ul>
          </div>
        `;
        errBox.style.display = 'block';
        
        // Add visual feedback to terms checkbox if it's not checked
        if (!termsAgreed) {
          const termsAgreement = document.querySelector('.terms-agreement');
          const termsCheckboxContainer = document.querySelector('.terms-checkbox');
          
          // Add error classes
          if (termsAgreement) {
            termsAgreement.classList.add('error');
          }
          if (termsCheckboxContainer) {
            termsCheckboxContainer.classList.add('error');
          }
          
          // Scroll to the terms checkbox
          setTimeout(() => {
            termsCheckbox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
          
          // Remove visual feedback after 5 seconds
          setTimeout(() => {
            if (termsAgreement) {
              termsAgreement.classList.remove('error');
            }
            if (termsCheckboxContainer) {
              termsCheckboxContainer.classList.remove('error');
            }
          }, 5000);
        }
        
        return;
      }

      const items = Array.from(cart.values());
      const msg = buildWhatsappMessage({name, phone, email, location}, items);
      
      console.log('Sending WhatsApp message from sidebar:', msg);
      
      // Show success message
      okBox.textContent = 'جاري فتح الواتساب في نافذة جديدة...';
      okBox.style.display = 'block';
      errBox.style.display = 'none';

      // Add small delay to show the message
      setTimeout(() => {
        try {
          openWhatsapp(msg, STORE_WHATSAPP_NUMBER);
          // Close the sidebar cart after successful send
          setTimeout(() => {
            closeSidebarCart();
          }, 1000);
        } catch (error) {
          console.error('Error in openWhatsapp:', error);
          errBox.textContent = 'حدث خطأ في فتح الواتساب: ' + error.message;
          errBox.style.display = 'block';
          okBox.style.display = 'none';
        }
      }, 500);
    });
    
    // Sidebar test WhatsApp button
    
    // Close sidebar cart on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSidebarCart();
        hideProductPreview();
      }
    });

    // Search functionality
    document.getElementById('search-input').addEventListener('input', (e) => {
      searchTerm = e.target.value.trim();
      renderProducts();
    });

    // Filter functionality
    document.querySelectorAll('.filter-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        document.querySelectorAll('.filter-tag').forEach(t => t.classList.remove('active'));
        tag.classList.add('active');
        currentFilter = tag.getAttribute('data-category');
        renderProducts();
      });
    });

    // Preview modal events
    document.getElementById('close-preview').addEventListener('click', hideProductPreview);
    
    // Close modal when clicking overlay
    document.getElementById('preview-modal').addEventListener('click', (e) => {
      if (e.target.id === 'preview-modal') {
        hideProductPreview();
      }
    });

    // Preview quantity controls
    document.getElementById('preview-minus').addEventListener('click', () => {
      const input = document.getElementById('preview-quantity');
      input.value = Math.max(1, parseInt(input.value) - 1);
    });

    document.getElementById('preview-plus').addEventListener('click', () => {
      const input = document.getElementById('preview-quantity');
      input.value = parseInt(input.value) + 1;
    });

    // Add to cart from preview
    document.getElementById('preview-add-to-cart').addEventListener('click', () => {
      if (!currentPreviewProduct) return;
      
      const qty = parseInt(document.getElementById('preview-quantity').value);
      const existing = cart.get(currentPreviewProduct.id);
      cart.set(currentPreviewProduct.id, { 
        product: currentPreviewProduct, 
        qty: (existing?.qty || 0) + qty 
      });
      
      // Add flying animation from preview modal
      setTimeout(() => {
        animateProductToCartFromPreview(currentPreviewProduct);
      }, 150); // Slightly longer delay for modal
      
      renderCart(); // This will automatically save the cart
      hideProductPreview();
      
      // Show success message
      const btn = document.getElementById('preview-add-to-cart');
      const originalText = btn.textContent;
      btn.textContent = 'تمت الإضافة ✓';
      btn.style.background = '#16a34a';
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
      }, 1000);
    });

    // Share from preview
    document.getElementById('preview-share').addEventListener('click', () => {
      if (!currentPreviewProduct) return;
      shareProduct(currentPreviewProduct);
    });

    // ======= LOADING SCREEN =======
    let loadingProgress = 0;
    
    function updateProgress(percentage) {
      loadingProgress = Math.min(100, Math.max(0, percentage));
      const progressBar = document.getElementById('progress-bar');
      const progressText = document.getElementById('progress-text');
      
      if (progressBar) {
        progressBar.style.width = loadingProgress + '%';
      }
      if (progressText) {
        progressText.textContent = Math.round(loadingProgress) + '%';
      }
    }
    
    function simulateProgressLoading() {
      let progress = 0;
      const steps = [
        { target: 20, message: 'اصبر شويه يا صاحبي الدنيا ما طارتش...' },
        { target: 40, message: 'تحضير المنتجات...' },
        { target: 65, message: 'تحميل البيانات...' },
        { target: 85, message: 'تهيئة المتجر...' },
        { target: 100, message: 'تحميل الملفات الأساسية...' }    ];
      
      let currentStep = 0;
      
      const progressInterval = setInterval(() => {
        if (currentStep < steps.length) {
          const step = steps[currentStep];
          progress += 2;
          
          if (progress >= step.target) {
            progress = step.target;
            updateLoadingText(step.message);
            currentStep++;
          }
          
          updateProgress(progress);
          
          if (progress >= 100) {
            clearInterval(progressInterval);
            setTimeout(hideLoadingScreen, 500);
          }
        }
      }, 100);
    }

    function hideLoadingScreen() {
      const loadingScreen = document.getElementById('loading-screen');
      if (loadingScreen) {
        loadingScreen.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
          loadingScreen.style.display = 'none';
          // فرض إعادة تفعيل التمرير بطرق متعددة
          document.body.style.overflow = 'auto';
          document.body.style.overflowX = 'hidden';
          document.body.style.overflowY = 'auto';
          document.body.classList.add('loaded');
          
          // تأكيد إضافي لإعادة تفعيل التمرير
          document.documentElement.style.overflow = 'auto';
          
          console.log('تم إعادة تفعيل التمرير بنجاح');
          
          // إضافة تأثير انطلاق لطيف للمحتوى
          const header = document.querySelector('header');
          const main = document.querySelector('main');
          const nav = document.querySelector('nav');
          
          if (header) {
            header.style.animation = 'slideInFromTop 0.6s ease-out';
          }
          if (nav) {
            nav.style.animation = 'slideInFromLeft 0.6s ease-out 0.2s both';
          }
          if (main) {
            main.style.animation = 'fadeInUp 0.8s ease-out 0.4s both';
          }
        }, 800);
      }
    }

    // تحديث نص التحميل
    function updateLoadingText(message) {
      const loadingTextElement = document.querySelector('#loading-screen p:last-of-type');
      if (loadingTextElement) {
        loadingTextElement.textContent = message || 'جاري تحميل الموقع...';
      }
    }

    // Check if an order was just completed
    function checkOrderCompletion() {
      try {
        const orderCompletionTime = localStorage.getItem('aquatech_order_completed');
        
        if (orderCompletionTime) {
          // Calculate time difference
          const timeDiff = Date.now() - parseInt(orderCompletionTime, 10);
          const minutesElapsed = timeDiff / (1000 * 60);
          
          // If less than 30 minutes since order completion, show a thank you message
          if (minutesElapsed < 30) {
            // Create and show a thank you message
            const thankYouMessage = document.createElement('div');
            thankYouMessage.className = 'thank-you-message';
            thankYouMessage.innerHTML = `
              <div class="thank-you-icon">✅</div>
              <h3>تم إرسال طلبك بنجاح!</h3>
              <p>شكراً لاختيارك AquaTech Pro، سنتواصل معك قريباً.</p>
              <button class="btn" id="close-thank-you" type="button">حسناً</button>
            `;
            
            document.body.appendChild(thankYouMessage);
            
            // Add close button event
            setTimeout(() => {
              document.getElementById('close-thank-you').addEventListener('click', function() {
                thankYouMessage.classList.add('fade-out');
                setTimeout(() => {
                  document.body.removeChild(thankYouMessage);
                }, 500);
                localStorage.removeItem('aquatech_order_completed');
              });
              
              // Auto-hide after 5 seconds
              setTimeout(() => {
                if (document.body.contains(thankYouMessage)) {
                  thankYouMessage.classList.add('fade-out');
                  setTimeout(() => {
                    if (document.body.contains(thankYouMessage)) {
                      document.body.removeChild(thankYouMessage);
                    }
                  }, 500);
                  localStorage.removeItem('aquatech_order_completed');
                }
              }, 5000);
            }, 500);
          } else {
            // Clear old completion data
            localStorage.removeItem('aquatech_order_completed');
          }
        }
      } catch (e) {
        console.error('Error checking order completion:', e);
      }
    }

    // ======= INIT =======
    document.addEventListener('DOMContentLoaded', async function() {
      document.getElementById('year').textContent = new Date().getFullYear();
      
      // تحميل السلة المحفوظة من localStorage
      loadCart();
      
      // Load customer information
      loadCustomerInfo();
      
      // Setup form autocompletion
      setupFormAutocompletion();
      
      // Check if an order was completed recently
      checkOrderCompletion();
      
      // حل إضافي: فرض إعادة تفعيل التمرير بعد 3 ثوانٍ
      setTimeout(() => {
        document.body.style.overflow = 'auto';
        document.body.style.overflowX = 'hidden';
        document.body.style.overflowY = 'auto';
        document.documentElement.style.overflow = 'auto';
        console.log('تم فرض إعادة تفعيل التمرير');
      }, 3000);
      
      // بدء محاكاة شريط التقدم
      setTimeout(() => {
        simulateProgressLoading();
      }, 1000);
      
      // تحميل البيانات والمحتوى
      try {
        // تحميل المنتجات من ملف JSON
        const productsLoaded = await loadProducts();
        
        if (productsLoaded) {
          // Check for URL parameters (shared product)
          const urlParams = getUrlParams();
          if (urlParams.productId && urlParams.shared) {
            const sharedProduct = PRODUCTS.find(p => p.id === urlParams.productId);
            if (sharedProduct) {
              // Show the shared product in a special view
              showSharedProductView(sharedProduct);
            } else {
              // Product not found, clear URL and show all products
              clearUrlParams();
              renderProducts();
            }
          } else {
            // Normal view - show all products
            renderProducts();
          }
          renderCart();
        } else {
          // في حالة فشل التحميل، سيتم عرض رسالة الخطأ من خلال showLoadingError
          setTimeout(hideLoadingScreen, 1000);
          return;
        }
        
      } catch (error) {
        console.error('خطأ في تحميل المحتوى:', error);
        showLoadingError('حدث خطأ في تحميل المحتوى. يرجى المحاولة مرة أخرى.');
        // إخفاء شاشة التحميل حتى في حالة الخطأ
        setTimeout(hideLoadingScreen, 1000);
      }
    });

    // إخفاء شاشة التحميل عند اكتمال تحميل جميع الموارد
    window.addEventListener('load', function() {
      // التأكد من تحميل جميع الصور
      const images = document.querySelectorAll('img');
      let loadedImages = 0;
      const totalImages = images.length;
      
      if (totalImages === 0) {
        return; // دع شريط التقدم يكمل طبيعياً
      }
      
      images.forEach(img => {
        if (img.complete) {
          loadedImages++;
        } else {
          img.addEventListener('load', () => {
            loadedImages++;
            // تحديث التقدم بناءً على تحميل الصور
            const imageProgress = (loadedImages / totalImages) * 20; // 20% للصور
            if (loadingProgress < 80) {
              updateProgress(Math.max(loadingProgress, 60 + imageProgress));
            }
          });
          
          img.addEventListener('error', () => {
            loadedImages++;
            const imageProgress = (loadedImages / totalImages) * 20;
            if (loadingProgress < 80) {
              updateProgress(Math.max(loadingProgress, 60 + imageProgress));
            }
          });
        }
      });
      
      if (loadedImages === totalImages && loadingProgress < 80) {
        updateProgress(80);
      }
    });

    // ======= BACK TO TOP FUNCTIONALITY =======
    document.addEventListener('DOMContentLoaded', function() {
      const backToTopButton = document.getElementById('back-to-top');
      
      // Show/hide back to top button based on scroll position
      function handleScroll() {
        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        const triggerHeight = 300; // Show button after scrolling 300px
        const navbar = document.querySelector('.navbar');
        
        // Handle navbar scroll effect
        if (scrollPosition > 100) {
          if (navbar && !navbar.classList.contains('scrolled')) {
            navbar.classList.add('scrolled');
            console.log('Added scrolled class to navbar');
          }
        } else {
          if (navbar && navbar.classList.contains('scrolled')) {
            navbar.classList.remove('scrolled');
            console.log('Removed scrolled class from navbar');
          }
        }
        
        // Handle back to top button
        if (scrollPosition > triggerHeight) {
          if (!backToTopButton.classList.contains('visible')) {
            backToTopButton.classList.add('visible');
          }
        } else {
          if (backToTopButton.classList.contains('visible')) {
            backToTopButton.classList.remove('visible');
          }
        }
      }
      
      // Smooth scroll to top function
      function scrollToTop() {
        const startPosition = window.pageYOffset || document.documentElement.scrollTop;
        const duration = 800; // Animation duration in milliseconds
        const startTime = performance.now();
        
        function easeInOutCubic(t) {
          return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }
        
        function animateScroll(currentTime) {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeProgress = easeInOutCubic(progress);
          
          window.scrollTo(0, startPosition * (1 - easeProgress));
          
          if (progress < 1) {
            requestAnimationFrame(animateScroll);
          }
        }
        
        requestAnimationFrame(animateScroll);
      }
      
      // Add event listeners
      window.addEventListener('scroll', handleScroll);
      backToTopButton.addEventListener('click', scrollToTop);
      
      // Add keyboard accessibility
      backToTopButton.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          scrollToTop();
        }
      });
      
      // Initial check for scroll position
      handleScroll();
    });

    // Function to show visual confirmation that product entered cart
    function showProductEnteredCart() {
      const cartBtn = document.getElementById('floating-cart') || document.getElementById('navbar-cart-btn');
      if (!cartBtn) return;
      
      // Create success indicator
      const indicator = document.createElement('div');
      indicator.className = 'product-entry-indicator';
      indicator.innerHTML = '✅';
      indicator.style.cssText = `
        position: fixed;
        z-index: 10000;
        font-size: 24px;
        color: #10b981;
        pointer-events: none;
        opacity: 0;
        transform: scale(0.5);
        transition: all 0.3s ease-out;
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;
      
      // Position near cart
      const cartRect = cartBtn.getBoundingClientRect();
      indicator.style.left = (cartRect.right + 10) + 'px';
      indicator.style.top = (cartRect.top - 5) + 'px';
      
      document.body.appendChild(indicator);
      
      // Animate in
      setTimeout(() => {
        indicator.style.opacity = '1';
        indicator.style.transform = 'scale(1)';
      }, 10);
      
      // Animate out and remove
      setTimeout(() => {
        indicator.style.opacity = '0';
        indicator.style.transform = 'scale(0.5) translateY(-20px)';
        setTimeout(() => {
          if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
          }
        }, 300);
      }, 1000);
    }