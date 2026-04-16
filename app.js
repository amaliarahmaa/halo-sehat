require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();
const port = 3000;

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Konfigurasi S3 Client
const s3Client = new S3Client({
    region: "us-east-1",
    credentials: {
        accessKeyId: "AKIA26TTWKUP56XDPY7H",
        secretAccessKey: "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"
    }
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Halaman Utama: Render index.ejs
app.get('/', (req, res) => {
    res.render('index', { message: null, error: null });
});

// Proses Booking
app.post('/booking', upload.single('ktp'), async (req, res) => {
    try {
        const { nama, poli } = req.body;
        const file = req.file;

        if (!file) {
            return res.render('index', { message: null, error: 'File dokumen wajib diunggah!' });
        }

        // 1. Upload S3
        const fileName = `ktp-${Date.now()}${path.extname(file.originalname)}`;
        const uploadParams = {
            Bucket: "halosehat-uts-amalia-2026",
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype
        };
        await s3Client.send(new PutObjectCommand(uploadParams));

        // 2. Simpan RDS
        const connection = await mysql.createConnection({
            host: "halosehat-db.curiayqckun7.us-east-1.rds.amazonaws.com",
            user: "admin",
            password: "admin123",
            database: "halosehat"
        });

        const query = 'INSERT INTO bookings (nama, poli, file_url) VALUES (?, ?, ?)';
        await connection.execute(query, [nama, poli, fileName]);
        await connection.end();
        
        // Kirim pesan sukses ke EJS
        res.render('index', { 
            message: `<strong>Berhasil!</strong> Antrean atas nama <strong>${nama}</strong> telah tercatat di Database dan dokumen tersimpan di AWS S3.`, 
            error: null 
        });

    } catch (error) {
        console.error('Error detail:', error);
        res.render('index', { 
            message: null, 
            error: `Gagal memproses pendaftaran. Periksa koneksi atau log sistem.` 
        });
    }
});

app.listen(port, () => {
    console.log(`Aplikasi berjalan di port ${port}`);
});
