// Tiny 301 redirect: mtk.dabrewer.dev/* -> ftk.dabrewer.dev/* (the app moved to ftk).
// Runs on the Cloudflare route mtk.dabrewer.dev/* (see wrangler.toml); preserves path + query.
export default {
  fetch(request) {
    const url = new URL(request.url);
    return Response.redirect("https://ftk.dabrewer.dev" + url.pathname + url.search, 301);
  },
};
