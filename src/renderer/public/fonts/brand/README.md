# Brand faces served over HTTP

These are the same files as `src/renderer/src/assets/fonts/`, kept here for
one reason: Vite hashes everything under `assets/`, so those copies have no
stable URL, and the Casdoor sign-in pages need one. Casdoor serves its own
front end and cannot bundle anything from this repo, so its stylesheet points
at `https://app.dynadoc.dashmake.com/fonts/brand/...`, which is this folder,
on our own domain. A font CDN on the authentication path would hand a third
party a log of every sign-in, which is not something this product can sell.

CORS: the sign-in page is served from `auth.dynadoc.dashmake.com`, so these
files are cross-origin to it. Our own domain is not the same thing as our own
origin, and that distinction decides whether this works: a font is always
fetched in CORS mode, where the sign-in mark next door is an `<img>` and is
not. Without `Access-Control-Allow-Origin` the browser downloads the file and
then refuses to use it. `deploy/web/nginx.conf` sends that header for font
extensions; if it ever stops, the sign-in page silently falls back to the
system stack, because `font-display: swap` means nothing looks broken.

ORDERING: the same rule as the sign-in logo. These files, and the nginx header
above, must be deployed on the web before the Casdoor stylesheet that
references them, or the sign-in page renders its fallback stack until the next
web deploy.

Only the two faces the sign-in pages use are here. IBM Plex Mono is not: no
sign-in screen shows a figure or a technical label.
