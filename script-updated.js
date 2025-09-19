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
        const response = await fetch('./products-data.json');
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

    // Convert image URL to blob for sharing
    async function imageUrlToBlob(imageUrl) {
      try {
        // Handle relative URLs
        const absoluteUrl = new URL(imageUrl, window.location.origin).href;
        const response = await fetch(absoluteUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        return blob;
      } catch (error) {
        console.error('Error converting image to blob:', error);
        return null;
      }
    }

    // Create a File object from blob for sharing
    function createImageFile(blob, filename) {
      return new File([blob], filename, { type: blob.type });
    }

    // Generate product image filename
    function generateImageFilename(product) {
      const safeName = product.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      return `AquaTech_Pro_${safeName}_${product.id}.jpg`;
    }

    // Create branded share image using Canvas
    async function createBrandedShareImage(product) {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        canvas.width = 800;
        canvas.height = 800;
        
        // Background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Load product image
        const productImg = new Image();
        productImg.crossOrigin = 'anonymous';
        productImg.onload = function() {
          // Draw product image (centered, maintaining aspect ratio)
          const maxSize = 400;
          const ratio = Math.min(maxSize / productImg.width, maxSize / productImg.height);
          const width = productImg.width * ratio;
          const height = productImg.height * ratio;
          const x = (canvas.width - width) / 2;
          const y = 50;
          
          ctx.drawImage(productImg, x, y, width, height);
          
          // Add overlay for text readability
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(0, y + height - 100, canvas.width, 100);
          
          // Product name
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 28px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(product.name.substring(0, 30), canvas.width / 2, y + height - 60);
          
          // Price
          ctx.fillStyle = '#22c55e';
          ctx.font = 'bold 32px Arial';
          ctx.fillText(fmt(product.price), canvas.width / 2, y + height - 20);
          
          // Brand name
          ctx.fillStyle = '#22c55e';
          ctx.font = 'bold 36px Arial';
          ctx.fillText('AquaTech Pro', canvas.width / 2, y + height + 80);
          
          // Subtitle
          ctx.fillStyle = '#e5e7eb';
          ctx.font = '20px Arial';
          ctx.fillText('سباكة احترافية - توصيل سريع', canvas.width / 2, y + height + 110);
          
          // WhatsApp number
          ctx.fillStyle = '#25d366';
          ctx.font = 'bold 24px Arial';
          ctx.fillText('📱 01557609572', canvas.width / 2, y + height + 150);
          
          // Website
          ctx.fillStyle = '#6b7280';
          ctx.font = '18px Arial';
          ctx.fillText('للطلب عبر الواتساب أو زيارة موقعنا', canvas.width / 2, y + height + 180);
          
          // Convert to blob
          canvas.toBlob((blob) => {
            resolve(blob);
          }, 'image/jpeg', 0.9);
        };
        
        productImg.onerror = () => {
          console.error('Failed to load product image for branded share');
          resolve(null);
        };
        
        // Try to load the image
        const absoluteUrl = new URL(product.img, window.location.origin).href;
        productImg.src = absoluteUrl;
      });
    }

    async function shareProduct(product) {
      const shareUrl = generateProductShareUrl(product.id);
      const shareText = `تحقق من هذا المنتج الرائع: ${product.name}\nالسعر: ${fmt(product.price)}\nمن متجر AquaTech Pro للسباكة\n${shareUrl}`;

      // Check if Web Share API is supported and try to share with image
      if (navigator.share && navigator.canShare) {
        try {
          // Try to get the image as blob
          const imageBlob = await imageUrlToBlob(product.img);
          
          if (imageBlob) {
            const imageFile = createImageFile(imageBlob, generateImageFilename(product));
            
            // Check if we can share files
            const shareData = {
              title: `${product.name} - AquaTech Pro`,
              text: shareText,
              files: [imageFile]
            };
            
            if (navigator.canShare(shareData)) {
              await navigator.share(shareData);
              return;
            }
          }
          
          // Fallback to text-only sharing if image sharing fails
          await navigator.share({
            title: `${product.name} - AquaTech Pro`,
            text: shareText,
            url: shareUrl
          });
          return;
        } catch (error) {
          console.error('Web Share API failed:', error);
          // Continue to fallback options
        }
      }

      // Show sharing options modal if Web Share API is not available or failed
      showSharingModal(product, shareUrl, shareText);
    }

    function showSharingModal(product, shareUrl, shareText) {
      // Remove any existing sharing modal
      const existing = document.querySelector('.sharing-modal');
      if (existing) {
        existing.remove();
      }

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
              </div>
            </div>
            <div class="share-options">
              <button class="share-btn whatsapp" onclick="shareToWhatsApp('${encodeURIComponent(shareText)}')">
                <span>📱</span>
                <span>واتساب</span>
              </button>
              <button class="share-btn facebook" onclick="shareToFacebook('${encodeURIComponent(shareUrl)}')">
                <span>📘</span>
                <span>فيسبوك</span>
              </button>
              <button class="share-btn twitter" onclick="shareToTwitter('${encodeURIComponent(shareText)}')">
                <span>🐦</span>
                <span>تويتر</span>
              </button>
              <button class="share-btn copy" onclick="copyProductLink('${shareUrl}', this)">
                <span>📋</span>
                <span>نسخ الرابط</span>
              </button>
              <button class="share-btn download-image" onclick="downloadProductImage('${product.img}', '${generateImageFilename(product)}')">
                <span>💾</span>
                <span>تحميل الصورة</span>
              </button>
              <button class="share-btn copy-text-image" onclick="copyProductTextWithImage('${shareText}', '${product.img}', this)">
                <span>📝📷</span>
                <span>نسخ النص والصورة</span>
              </button>
              <button class="share-btn create-branded" onclick="createAndDownloadBrandedImage('${product.id}', this)">
                <span>🎨</span>
                <span>إنشاء صورة مخصصة</span>
              </button>
            </div>
            <div class="share-url-display">
              <label>رابط المنتج:</label>
              <input type="text" value="${shareUrl}" readonly onclick="this.select()">
            </div>
            <div class="share-instructions">
              <h4>💡 نصائح للمشاركة:</h4>
              <ul>
                <li><strong>📱 واتساب:</strong> مشاركة مباشرة مع النص والرابط</li>
                <li><strong>💾 تحميل الصورة:</strong> احفظ الصورة الأصلية ثم شاركها مع النص</li>
                <li><strong>📝📷 نسخ النص والصورة:</strong> ينسخ النص ويفتح الصورة للحفظ</li>
                <li><strong>🎨 إنشاء صورة مخصصة:</strong> صورة احترافية تحتوي على المنتج والعلامة التجارية</li>
              </ul>
              <div class="share-tip">
                <strong>🌟 نصيحة:</strong> استخدم الصورة المخصصة للحصول على أفضل تأثير في المشاركة!
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      modal.style.display = 'flex';
    }

    // Global functions for sharing (needed for onclick handlers)
    window.shareToWhatsApp = function(text) {
      // Enhanced WhatsApp sharing with better formatting
      const enhancedText = `🔥 *عرض خاص من AquaTech Pro* 🔥\n\n${text}\n\n💡 *نصيحة:* احفظ صورة المنتج من الرابط أعلاه وشاركها مع هذا النص للحصول على أفضل تأثير!\n\n📞 للطلب: 01557609572`;
      window.open(`https://wa.me/?text=${encodeURIComponent(enhancedText)}`, '_blank');
    };

    window.shareToFacebook = function(url) {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
    };

    window.shareToTwitter = function(text) {
      const hashtags = 'AquaTechPro,سباكة,مصر,أدوات_سباكة';
      const tweetText = `${text}\n\n#${hashtags.replace(/,/g, ' #')}`;
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
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

    // Download product image
    window.downloadProductImage = async function(imageUrl, filename) {
      try {
        const blob = await imageUrlToBlob(imageUrl);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showShareNotification('تم تحميل الصورة بنجاح! 💾✅');
        } else {
          throw new Error('Failed to download image');
        }
      } catch (error) {
        console.error('Error downloading image:', error);
        showShareNotification('فشل في تحميل الصورة. يرجى المحاولة مرة أخرى.', 'error');
      }
    };

    // Copy product text and open image for download
    window.copyProductTextWithImage = async function(text, imageUrl, button) {
      try {
        // Copy text to clipboard
        const textSuccess = await copyToClipboard(text);
        
        if (textSuccess) {
          // Open image in new tab for user to save
          const absoluteUrl = new URL(imageUrl, window.location.origin).href;
          window.open(absoluteUrl, '_blank');
          
          const originalText = button.innerHTML;
          button.innerHTML = '<span>✅</span><span>تم النسخ</span>';
          setTimeout(() => {
            button.innerHTML = originalText;
          }, 2000);
          
          showShareNotification('تم نسخ النص وفتح الصورة! انقر بزر الماوس الأيمن على الصورة لحفظها 📝📷✅');
        } else {
          throw new Error('Failed to copy text');
        }
      } catch (error) {
        console.error('Error copying text with image:', error);
        showShareNotification('فشل في نسخ النص. يرجى المحاولة مرة أخرى.', 'error');
      }
    };

    // Create and download branded share image
    window.createAndDownloadBrandedImage = async function(productId, button) {
      try {
        const originalText = button.innerHTML;
        button.innerHTML = '<span>⏳</span><span>جاري الإنشاء...</span>';
        button.disabled = true;
        
        const product = PRODUCTS.find(p => p.id === productId);
        if (!product) {
          throw new Error('Product not found');
        }
        
        const brandedBlob = await createBrandedShareImage(product);
        if (brandedBlob) {
          const url = URL.createObjectURL(brandedBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `AquaTech_Pro_Share_${generateImageFilename(product)}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          button.innerHTML = '<span>✅</span><span>تم الإنشاء</span>';
          showShareNotification('تم إنشاء وتحميل الصورة المخصصة بنجاح! 🎨✅');
        } else {
          throw new Error('Failed to create branded image');
        }
      } catch (error) {
        console.error('Error creating branded image:', error);
        button.innerHTML = '<span>❌</span><span>فشل</span>';
        showShareNotification('فشل في إنشاء الصورة المخصصة. يرجى المحاولة مرة أخرى.', 'error');
      } finally {
        button.disabled = false;
        setTimeout(() => {
          button.innerHTML = '<span>🎨</span><span>إنشاء صورة مخصصة</span>';
        }, 3000);
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
          <img src="${p.img}" alt="${p.name}" loading="lazy" style="width: 100%; height: 200px; object-fit: cover;">
          <div class="body">
            <h3>${p.name}</h3>
            <div class="price">${fmt(p.price)}</div>
            <div class="controls">
              <div class="qty" data-id="${p.id}">
                <button type="button" aria-label="تقليل">−</button>
                <input type="number" min="1" value="1" inputmode="numeric" />
                <button type="button" aria-label="زيادة">+</button>
              </div>
              <button class="btn preview" data-id="${p.id}" title="معاينة المنتج">👁️</button>
              <button class="btn share" data-id="${p.id}" title="مشاركة المنتج">📤</button>
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
              <button class="btn share" onclick="shareProduct(PRODUCTS.find(p => p.id === '${product.id}'))">مشاركة مرة أخرى 📤</button>
            </div>
          </div>
        </div>
        <article class="product featured-product">
          <img src="${product.img}" alt="${product.name}" loading="lazy" style="width: 100%; height: 300px; object-fit: cover;">
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
          <img src="${p.img}" alt="${p.name}" loading="lazy" style="width: 100%; height: 200px; object-fit: cover;">
          <div class="body">
            <h3>${p.name}</h3>
            <div class="price">${fmt(p.price)}</div>
            <div class="controls">
              <div class="qty" data-id="${p.id}">
                <button type="button" aria-label="تقليل">−</button>
                <input type="number" min="1" value="1" inputmode="numeric" />
                <button type="button" aria-label="زيادة">+</button>
              </div>
              <button class="btn preview" data-id="${p.id}" title="معاينة المنتج">👁️</button>
              <button class="btn share" data-id="${p.id}" title="مشاركة المنتج">📤</button>
              <button class="btn add" data-id="${p.id}">أضف للسلة</button>
            </div>
          </div>
        `;
        list.appendChild(el);
      });

      // Attach event handlers (same as in renderProducts)
      attachProductEventHandlers();

      // Update page title and meta description for shared product
      document.title = `${product.name} - AquaTech Pro`;
      
      // Update meta description
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.content = `${product.name} - ${product.description} - السعر: ${fmt(product.price)} من AquaTech Pro`;
      }

      // Update Open Graph tags for better social sharing
      const ogTitle = document.querySelector('meta[property="og:title"]');
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogTitle) ogTitle.content = `${product.name} - AquaTech Pro`;
      if (ogDesc) ogDesc.content = `${product.description} - السعر: ${fmt(product.price)}`;
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

      // preview handlers
      list.querySelectorAll('.btn.preview').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const product = PRODUCTS.find(x => x.id === id);
          if (product) {
            showProductPreview(product);
          }
        });
      });

      // share handlers
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