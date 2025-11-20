# Dockerfile
FROM nginx:alpine

# Copia i file statici dentro la root di Nginx
COPY public/ /usr/share/nginx/html

# Sovrascrive la config di default con la nostra (cache + SPA fallback)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Nginx ascolta su 80 dentro il container
EXPOSE 8000

# L'immagine nginx:alpine usa già un utente non-root ("nginx") a runtime
# Entrypoint/CMD default sono già corretti
