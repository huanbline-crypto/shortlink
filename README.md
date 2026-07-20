# ShortLink — Линк богиносгогч

Node.js (Express) + SQLite дээр ажилладаг, бодит серверт deploy хийхэд бэлэн линк богиносгогч.

## Бүтэц

```
shortlink/
├── server.js          # Backend: API + redirect
├── public/
│   └── index.html     # Frontend (нэг HTML файл)
├── package.json
└── links.db           # SQLite сан (анхны ажиллуулахад автоматаар үүснэ)
```

## Локал дээр ажиллуулах

```bash
npm install
npm start
# http://localhost:3000 нээнэ
```

## API

| Үйлдэл | Хүсэлт |
|---|---|
| Богиносгох | `POST /api/shorten` — body: `{"url": "...", "alias": "заавал биш"}` |
| Статистик | `GET /api/stats/:code` |
| Redirect | `GET /:code` → анхны линк рүү 301 |

## Бодит серверт deploy хийх (VPS — Ubuntu жишээ)

1. **Сервер бэлдэх** (DigitalOcean, Hetzner, эсвэл дотоодын hosting):

```bash
sudo apt update
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

2. **Кодоо хуулж суулгах:**

```bash
git clone <таны-repo> shortlink && cd shortlink
npm install --production
```

3. **PM2-оор байнга ажиллуулах:**

```bash
sudo npm install -g pm2
BASE_URL=https://link.tanaisite.mn pm2 start server.js --name shortlink
pm2 save && pm2 startup
```

4. **Nginx reverse proxy + домэйн:**

```nginx
server {
    listen 80;
    server_name link.tanaisite.mn;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/shortlink   # дээрх тохиргоог бичнэ
sudo ln -s /etc/nginx/sites-available/shortlink /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

5. **HTTPS (Let's Encrypt):**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d link.tanaisite.mn
```

## Хялбар хувилбар: Render / Railway

VPS удирдахгүйгээр deploy хийхийг хүсвэл:

1. Кодоо GitHub-д push хийнэ
2. [render.com](https://render.com) эсвэл [railway.app](https://railway.app) дээр "New Web Service" → repo-гоо сонгоно
3. Build command: `npm install`, Start command: `npm start`
4. Environment variable: `BASE_URL=https://таны-app.onrender.com`

Анхаар: үнэгүй хостинг дээр SQLite файл сервер дахин асахад устаж болзошгүй тул бодит ашиглалтад disk volume нэмэх эсвэл PostgreSQL руу шилжүүлэхийг зөвлөнө.

## Цаашид нэмж болох зүйлс

- QR код үүсгэх (`qrcode` npm сан)
- Линкний хугацаа дуусгах (`expires_at` багана нэмэх)
- Хэрэглэгчийн бүртгэл, өөрийн линкүүдийн жагсаалт
- Клик бүрийн дэлгэрэнгүй статистик (улс, төхөөрөмж)
