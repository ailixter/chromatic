# (C) 2018, AII (Alexey Ilyin).
FROM    node:8.11.1-slim

RUN     apt-get update && \
        apt-get install -yq apt-utils && \
        apt-get install -yq \
ca-certificates \
gconf-service \
libappindicator1 \
libasound2 \
libatk1.0-0 \
libc6 \
libcairo2 \
libcups2 \
libdbus-1-3 \
libexpat1 \
libfontconfig1 \
libgcc1 \
libgconf-2-4 \
libgdk-pixbuf2.0-0 \
libglib2.0-0 \
libgtk-3-0 \
libnspr4 \
libnss3 \
libpango-1.0-0 \
libpangocairo-1.0-0 \
libstdc++6 \
libx11-6 \
libx11-xcb1 \
libxcb1 \
libxcomposite1 \
libxcursor1 \
libxdamage1 \
libxext6 \
libxfixes3 \
libxi6 \
libxrandr2 \
libxrender1 \
libxss1 \
libxtst6 \
lsb-release \
make \
xdg-utils \
fonts-ipafont-gothic \
fonts-wqy-zenhei \
fonts-thai-tlwg \
fonts-kacst \
ttf-freefont \
fonts-liberation \
wget && \
wget -q https://github.com/Yelp/dumb-init/releases/download/v1.2.1/dumb-init_1.2.1_amd64.deb && \
dpkg -i dumb-init_*.deb && rm -f dumb-init_*.deb && \
apt-get clean && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

run     mkdir -p /opt/chromatic/config
workdir          /opt/chromatic

copy    config/default.json ./config/
copy    main.js             .
copy    index.js            .
copy    package.json        .

run     npm install

ENTRYPOINT ["dumb-init", "--"]
CMD        ["node", "main.js"]

expose  8888