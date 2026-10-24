# TLS certificates

Yahan `fullchain.pem` + `privkey.pem` rakho (host nginx `/etc/nginx/certs` → is folder ka symlink, `ops/nginx/install-host-nginx.sh`).
Ye files **kabhi commit nahi** hoti (`.gitignore`). Let's Encrypt se banana: `docs/DEPLOYMENT.md`.
