require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mysql = require('mysql2/promise');

const app = express();
const port = 3000;

// Setup EJS untuk tampilan
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Setup Multer (menyimpan file di memory sementara sebelum dikirim ke S3)
const upload = multer({ storage: multer.memoryStorage() });

// Konfigurasi AWS S3 (Nanti kita isi di AWS, sekarang siapkan kodenya saja)
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY
    }
});

// Route 1: Menampilkan halaman utama
app.get('/', (req, res) => {
    res.render('index');
});

// Route 2: Menerima data booking dan upload ke S3
app.post('/booking', upload.single('dokumen'), async (req, res) => {
    try {
        const { nama, poli } = req.body;
        const file = req.file;

        // Proses Upload ke S3
        const fileName = `dokumen-${Date.now()}-${file.originalname}`;
        const uploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype
        };
        await s3Client.send(new PutObjectCommand(uploadParams));

        // 2. Proses Simpan ke Amazon RDS
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });

        const query = 'INSERT INTO bookings (nama, poli, file_url) VALUES (?, ?, ?)';
        await connection.execute(query, [nama, poli, fileName]);
        await connection.end();

        console.log(`Data booking ${nama} tersimpan di RDS`);
        
        // const connection = await mysql.createConnection({ ... });
        // await connection.execute('INSERT INTO bookings (nama, poli, file_url) VALUES (?, ?, ?)', [nama, poli, fileName]);

        res.send(`<h1>Booking Berhasil!</h1><p>Nama: ${nama}</p><p>Poli: ${poli}</p><p>File KTP telah aman tersimpan di Amazon S3.</p><a href="/">Kembali</a>`);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Terjadi kesalahan saat memproses booking.");
    }
});

app.listen(port, () => {
    console.log(`Aplikasi Halo Sehat berjalan di http://localhost:${port}`);
});