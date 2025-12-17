<!-- Dynamic Product Detail Page Template -->
<!-- This will replace portal-exit.html -->
<!-- Copy all the CSS and structure from portal-exit.html, then add this JavaScript -->

<script>
    // Get slug from URL
    function getSlugFromURL() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        return filename.replace('.html', '');
    }

    // Load animation data
    async function loadAnimationData() {
        const slug = getSlugFromURL();
        
        try {
            const animation = await API.getAnimationBySlug(slug);
            
            if (!animation) {
                // Animation not found, redirect to main page
                window.location.href = 'index.html';
                return;
            }

            // Populate page with animation data
            populateAnimationData(animation);
            
            // Load related animations
            const related = await API.getRelatedAnimations(animation.category, slug, 4);
            populateRelatedAnimations(related);
            
        } catch (error) {
            console.error('Error loading animation:', error);
            alert('Error loading animation details');
        }
    }

    // Populate animation data into page
    function populateAnimationData(anim) {
        // Update preview
        const previewImg = document.querySelector('.preview-video');
        if (previewImg) {
            previewImg.src = anim.video || anim.thumbnail;
            previewImg.alt = anim.title;
        }

        // Update title
        const titleEl = document.querySelector('.preview-title');
        if (titleEl) {
            titleEl.textContent = anim.title;
        }

        // Show/hide popular badge
        const badge = document.querySelector('.preview-badge');
        if (badge) {
            badge.style.display = anim.popular ? 'inline-block' : 'none';
        }

        // Update description
        const descEl = document.querySelector('.narrative-placeholder');
        if (descEl && anim.description) {
            descEl.textContent = anim.description;
            descEl.style.fontStyle = 'normal';
            descEl.style.background = 'transparent';
            descEl.style.border = 'none';
            descEl.style.padding = '0';
        }

        // Update metadata
        updateMetadata('Duration', anim.duration || 'TBD');
        updateMetadata('Frame Rate', anim.frameRate || 'TBD');
        updateMetadata('Animations', anim.animationCount ? `${anim.animationCount} animations` : 'TBD');
        updateMetadata('Formats', anim.formats ? anim.formats.join(', ') : 'TBD');
        updateMetadata('Skeleton', anim.skeleton || 'TBD');
        updateMetadata('Mocap Process', anim.mocapProcess || 'TBD');

        // Update price
        const priceEl = document.querySelector('.price-display');
        if (priceEl) {
            priceEl.textContent = `$${anim.price.toFixed(2)}`;
            priceEl.classList.remove('price-placeholder');
        }

        const priceNote = document.querySelector('.pricing-header p');
        if (priceNote) {
            priceNote.style.display = 'none';
        }

        // Update page title
        document.title = `${anim.title} - Premium Motion Capture | MotionVault`;

        // Store animation ID for buy/cart buttons
        window.currentAnimationId = anim.id;
        window.currentAnimationSlug = anim.slug;
    }

    // Helper to update metadata items
    function updateMetadata(label, value) {
        const items = document.querySelectorAll('.metadata-item');
        items.forEach(item => {
            const labelEl = item.querySelector('.metadata-label');
            if (labelEl && labelEl.textContent === label) {
                const valueEl = item.querySelector('.metadata-value');
                if (valueEl) {
                    valueEl.textContent = value;
                    valueEl.classList.remove('metadata-placeholder');
                }
            }
        });
    }

    // Populate related animations
    function populateRelatedAnimations(related) {
        const grid = document.querySelector('.related-grid');
        if (!grid) return;

        grid.innerHTML = '';
        
        related.forEach(anim => {
            const card = document.createElement('a');
            card.href = `${anim.slug}.html`;
            card.className = 'related-card';
            
            card.innerHTML = `
                <div class="related-thumbnail">
                    <img src="${anim.video || anim.thumbnail}" alt="${anim.title}">
                </div>
                <div class="related-content">
                    <div class="related-title">${anim.title}</div>
                    <div class="related-price">$${anim.price.toFixed(2)}</div>
                </div>
            `;
            
            grid.appendChild(card);
        });
    }

    // Buy button handler
    document.querySelector('.btn-primary').addEventListener('click', function() {
        // In production, this would go to checkout
        if (window.currentAnimationSlug) {
            alert('Proceeding to checkout...');
            // window.location.href = `checkout.html?animation=${window.currentAnimationSlug}`;
        }
    });

    // Add to cart handler
    document.querySelector('.btn-secondary').addEventListener('click', async function() {
        if (window.currentAnimationId) {
            try {
                const result = await API.addToCart(window.currentAnimationId);
                if (result.success) {
                    alert('Added to cart!');
                } else {
                    alert('Error adding to cart: ' + result.error);
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error adding to cart');
            }
        }
    });

    // License selection
    const licenseOptions = document.querySelectorAll('.license-option');
    licenseOptions.forEach(option => {
        option.addEventListener('click', function() {
            licenseOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
        });
    });

    // Load data on page load
    loadAnimationData();
</script>
