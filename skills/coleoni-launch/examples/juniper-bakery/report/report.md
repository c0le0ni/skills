# Launch check: juniperbakery.com

**Not ready.** 3 blocking, 12 to fix, 5 worth a look. 2 pages and 3 links checked.

## Blocks launch

- [ ] **robots.txt blocks the whole site**: `Disallow: /` for every crawler, usually left over from staging. Nothing will be indexed.
- [ ] **noindex is on** (/cakes/): `noindex, nofollow`. Usually left over from staging; the page will not appear in search.
- [ ] **Page answers 404** (/visit/): “Visit” on / leads here.

## To fix

- [ ] **sitemap.xml missing**: Without it, search engines find pages only through links.
- [ ] **404 page**: returns 404, but with the server's bare error page. Add a page with a way back.
- [ ] **No share image** (/): Links to this page share without a picture. /coleoni-og makes one from the page.
- [ ] **1 console error** (/): initMap is not defined
- [ ] **Old copyright year** (/): Footer says 2024.
- [ ] **1 link to nowhere** (/): “Instagram” points to #.
- [ ] **1 image without alt** (/): Screen readers read the file name. Describe it, or `alt=""` if it is decoration. /coleoni-a11y checks the rest.
- [ ] **No meta description** (/cakes/): Search results and previews make one up from random text.
- [ ] **No share image** (/cakes/): Links to this page share without a picture. /coleoni-og makes one from the page.
- [ ] **Page scrolls sideways on the phone** (/cakes/): 350px wider than the screen, starting at `table`.
- [ ] **Placeholder: Lorem ipsum** (/cakes/): “…kes by order, 48 hours ahead. Lorem ipsum dolor sit amet, consectetur a…”
- [ ] **Same title on several pages**: “Juniper Bakery” on 2 pages; search results look identical.

## Worth a look

- [ ] **robots.txt has no Sitemap line**: Add `Sitemap: https://…/sitemap.xml`.
- [ ] **HTTPS, redirects and headers**: Checked on the live domain only. Run again after deploy.
- [ ] **No canonical** (/): Copies of the page with query strings compete with it.
- [ ] **No canonical** (/cakes/): Copies of the page with query strings compete with it.
- [ ] **No analytics found**: Fine if on purpose. Without it, there is no way to know if the launch worked.
