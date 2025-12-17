// Supabase API Configuration
const SUPABASE_URL = 'https://ekzablbemeponkrcitco.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVremFibGJlbWVwb25rcmNpdGNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NTkzNDQsImV4cCI6MjA4MTUzNTM0NH0.bhr5lIwDUA3prPuCN7mBj5Bn8lJhalPFu5MMS5I1g2I';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// API Helper Functions
const API = {
    // Get all animations with optional filters
    async getAnimations(filters = {}) {
        let query = supabase
            .from('animations')
            .select(`
                *,
                animation_tags(
                    tag_id,
                    tags(name)
                )
            `);

        // Apply filters
        if (filters.category && filters.category !== 'All') {
            query = query.eq('category', filters.category);
        }
        if (filters.gender && filters.gender !== 'All') {
            query = query.eq('gender', filters.gender);
        }
        if (filters.style && filters.style !== 'All') {
            query = query.eq('style', filters.style);
        }
        if (filters.search) {
            query = query.ilike('title', `%${filters.search}%`);
        }

        // Apply sorting
        if (filters.sort === 'popular') {
            query = query.order('popular', { ascending: false });
        } else if (filters.sort === 'price-low') {
            query = query.order('price', { ascending: true });
        } else if (filters.sort === 'price-high') {
            query = query.order('price', { ascending: false });
        } else if (filters.sort === 'newest') {
            query = query.order('created_at', { ascending: false });
        }

        const { data, error } = await query;
        
        if (error) {
            console.error('Error fetching animations:', error);
            return [];
        }

        // Transform data to match frontend format
        return data.map(anim => ({
            id: anim.id,
            title: anim.title,
            slug: anim.slug,
            description: anim.description,
            price: parseFloat(anim.price),
            duration: anim.duration,
            category: anim.category,
            gender: anim.gender,
            style: anim.style,
            popular: anim.popular,
            onSale: anim.on_sale,
            salePercentage: anim.sale_percentage,
            video: anim.video_url,
            thumbnail: anim.thumbnail_url,
            videoType: anim.video_type,
            tags: anim.animation_tags.map(at => at.tags.name),
            // Technical details
            frameRate: anim.frame_rate,
            animationCount: anim.animation_count,
            formats: anim.formats,
            skeleton: anim.skeleton,
            mocapProcess: anim.mocap_process
        }));
    },

    // Get single animation by slug
    async getAnimationBySlug(slug) {
        const { data, error } = await supabase
            .from('animations')
            .select(`
                *,
                animation_tags(
                    tag_id,
                    tags(name)
                )
            `)
            .eq('slug', slug)
            .single();

        if (error) {
            console.error('Error fetching animation:', error);
            return null;
        }

        // Transform data
        return {
            id: data.id,
            title: data.title,
            slug: data.slug,
            description: data.description,
            price: parseFloat(data.price),
            duration: data.duration,
            category: data.category,
            gender: data.gender,
            style: data.style,
            popular: data.popular,
            onSale: data.on_sale,
            salePercentage: data.sale_percentage,
            video: data.video_url,
            thumbnail: data.thumbnail_url,
            videoType: data.video_type,
            tags: data.animation_tags.map(at => at.tags.name),
            frameRate: data.frame_rate,
            animationCount: data.animation_count,
            formats: data.formats,
            skeleton: data.skeleton,
            mocapProcess: data.mocap_process
        };
    },

    // Get related animations (same category, different animation)
    async getRelatedAnimations(category, currentSlug, limit = 4) {
        const { data, error } = await supabase
            .from('animations')
            .select('*')
            .eq('category', category)
            .neq('slug', currentSlug)
            .limit(limit);

        if (error) {
            console.error('Error fetching related animations:', error);
            return [];
        }

        return data.map(anim => ({
            id: anim.id,
            title: anim.title,
            slug: anim.slug,
            price: parseFloat(anim.price),
            video: anim.video_url,
            thumbnail: anim.thumbnail_url
        }));
    },

    // Submit custom request
    async submitCustomRequest(formData) {
        const { data, error } = await supabase
            .from('custom_requests')
            .insert([
                {
                    name: formData.name,
                    email: formData.email,
                    project_type: formData.projectType,
                    description: formData.description,
                    budget: formData.budget || null
                }
            ]);

        if (error) {
            console.error('Error submitting request:', error);
            return { success: false, error: error.message };
        }

        return { success: true, data };
    },

    // Add to cart (for logged-in users)
    async addToCart(animationId) {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            // Handle guest cart with localStorage
            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
            if (!cart.includes(animationId)) {
                cart.push(animationId);
                localStorage.setItem('cart', JSON.stringify(cart));
            }
            return { success: true };
        }

        const { error } = await supabase
            .from('cart_items')
            .insert([{ user_id: user.id, animation_id: animationId }]);

        if (error) {
            console.error('Error adding to cart:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    },

    // Get cart items
    async getCartItems() {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            // Get from localStorage for guests
            const cartIds = JSON.parse(localStorage.getItem('cart') || '[]');
            const { data, error } = await supabase
                .from('animations')
                .select('id, title, slug, price, thumbnail_url')
                .in('id', cartIds);
            
            return data || [];
        }

        const { data, error } = await supabase
            .from('cart_items')
            .select(`
                animation_id,
                animations(id, title, slug, price, thumbnail_url)
            `)
            .eq('user_id', user.id);

        if (error) {
            console.error('Error fetching cart:', error);
            return [];
        }

        return data.map(item => item.animations);
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}
