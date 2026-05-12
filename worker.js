export default {
  async fetch(request, env, ctx) {
    // Налаштування CORS, щоб фронтенд міг спокійно робити запит
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      
      // Будемо обробляти шлях /menu
      if (url.pathname !== '/menu') {
        return new Response('Not found', { status: 404, headers: corsHeaders });
      }

      // Ці змінні беруться з Cloudflare Secrets
      const supabaseUrl = env.SUPABASE_URL;
      const supabaseKey = env.SUPABASE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase secrets in worker");
      }

      const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      };

      // Отримуємо категорії
      const catRes = await fetch(`${supabaseUrl}/rest/v1/menu_categories?select=*&order=sort_order`, { headers });
      if (!catRes.ok) throw new Error("Failed to fetch categories from Supabase");
      const categories = await catRes.json();

      // Отримуємо страви
      const dishRes = await fetch(`${supabaseUrl}/rest/v1/menu_dishes?select=*&order=sort_order`, { headers });
      if (!dishRes.ok) throw new Error("Failed to fetch dishes from Supabase");
      const dishes = await dishRes.json();

      // Групуємо страви по категоріям (аби віддати готовий JSON)
      const groupedData = categories.map(cat => {
        let catDishes = dishes.filter(d => d.category_id === cat.id);
        return {
          id: cat.id,
          name: cat.name,
          sort_order: cat.sort_order,
          dishes: catDishes.map(d => {
            let parsedExtras = [];
            // Parse extras robustly (depending on how Supabase exports JSONB)
            if (Array.isArray(d.extras)) {
               parsedExtras = d.extras;
            } else if (typeof d.extras === 'string') {
               try { parsedExtras = JSON.parse(d.extras); } catch(e) {}
               if (!Array.isArray(parsedExtras)) parsedExtras = [];
            }
            return { ...d, extras: parsedExtras };
          })
        };
      }).filter(cat => cat.dishes && cat.dishes.length > 0);

      return new Response(JSON.stringify(groupedData), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json;charset=UTF-8'
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json;charset=UTF-8'
        }
      });
    }
  }
};
