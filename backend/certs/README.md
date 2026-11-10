# Optional extra CA certificates (e.g. NetFree)

Networks that inspect HTTPS traffic (such as NetFree) require their root
certificate to be trusted inside Docker images, otherwise `pip install` /
`npm install` fail with certificate errors.

Put PEM certificate files with a `.crt` or `.pem` extension in this folder
(`backend/certs/` for the backend image, `frontend/certs/` for the frontend
image). They are copied into the image at build time and trusted by Debian/
Alpine, pip and Node. Files here are ignored by Git — **never commit them**.

Without NetFree, leave the folder empty; the images build normally.
