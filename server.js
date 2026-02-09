/**
 * =======================================================
 * 🚀 Talabat Zone Management System - PRO EDITION 2026
 * =======================================================
 * Version: 3.0.0 (Production Stable)
 * Author: Ibrahim Fathi & AI Collaborative
 * Description: High-performance Node.js backend for managing
 * delivery courier performance, zone inquiries, and analytics.
 * =======================================================
 */

const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const session = require('express-session');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();

// --- [1] إعدادات المحرك والبيئة (System Configuration) ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// إعدادات الجلسة وتأمين الكوكيز (Session Security)
app.use(session({
    secret: process.env.SESSION_SECRET || 'talabat-hiring-security-2026-pro-edition',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // صلاحية الجلسة 24 ساعة
        secure: false // اجعلها True فقط إذا كنت تستخدم بروتوكول HTTPS
    }
}));

// معرف شيت جوجل الرئيسي
const SPREADSHEET_ID = '1bNhlUVWnt43Pq1hqDALXbfGDVazD7VhaeKM58hBTsN0';

// --- [2] كلمات مرور المناطق (Main Gate Passwords) ---
const zonePasswords = {
    'Ain shams': '754', 'Alexandria': '1234', 'Cairo_city_centre': '909',
    'Giza': '1568', 'Heliopolis': '2161', 'Ismalia city': '1122',
    'Kafr el-sheikh': '3344', 'Maadi': '878', 'Mansoura': '5566',
    'Mohandiseen': '1862', 'Nasr city': '2851', 'New damietta': '7788',
    'October': '2161', 'Portsaid city': '9900', 'Shebin el koom': '4455',
    'Sheikh zayed': '854', 'Suez': '6677', 'Tagammoa south': '1072',
    'Tanta': '8899', 'Zagazig': '2233'
};

// --- [3] كلمات مرور مقرات التحضير (Custom Office Passwords) ---
const officePasswords = {
    'مكتب طلبات المنصوره': '1010',
    'مكتب طلبات الأسكندرية': '2020',
    'مكتب طلبات مدينه نصر': '3030',
    'مكتب طلبات أكتوبر': '4040',
    'مكتب طلبات الهرم': '5050',
    'مكتب طلبات المعادي': '6060',
    'مكتب طلبات المهندسين': '7070',
    'مكتب طلبات التجمع': '8080'
};

// --- [4] وظيفة الربط مع جوجل شيت (Google Auth Engine) ---
async function getDoc() {
    let credsData;
    try {
        if (process.env.GOOGLE_CREDS) {
            credsData = JSON.parse(process.env.GOOGLE_CREDS);
        } else {
            const credsPath = path.join(__dirname, 'credentials.json');
            if (!fs.existsSync(credsPath)) throw new Error("Missing credentials.json file!");
            credsData = require(credsPath);
        }

        const auth = new JWT({
            email: credsData.client_email,
            key: credsData.private_key.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
        await doc.loadInfo();
        return doc;
    } catch (error) {
        console.error("SHEET_AUTH_ERROR:", error.message);
        throw error;
    }
}

// تنظيف البيانات الرقمية والتعامل مع القيم الفارغة
const cleanData = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    let strVal = val.toString().trim();
    if (['NA', '#N/A', 'N/A', '0'].includes(strVal)) return 0;
    let res = parseFloat(strVal.replace(/,/g, '').replace(/[^0-9.-]/g, ''));
    return isNaN(res) ? 0 : res;
};

// ميدل وير حماية المسارات (Authentication Guard)
const checkAuth = (req, res, next) => {
    if (!req.session.userZone) return res.redirect('/');
    next();
};

// ==========================================
// --- المسارات الـ 13 (Route Definitions) ---
// ==========================================

// [1] صفحة تسجيل الدخول الرئيسية
app.get('/', async (req, res) => {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        const allZones = [...new Set(rows.map(r => r.get('zone_name')))].filter(z => z);
        res.render('login', { zones: allZones, error: null });
    } catch (e) {
        res.status(500).send("Sheet Connection Error: " + e.message);
    }
});

// [2] معالجة تسجيل الدخول (Login Process)
app.post('/login', (req, res) => {
    const { zone, password } = req.body;
    if (zonePasswords[zone] && zonePasswords[zone] === password) {
        req.session.userZone = zone;
        res.redirect('/dashboard');
    } else {
        const zones = Object.keys(zonePasswords);
        res.render('login', { zones, error: 'كلمة المرور غير صحيحة' });
    }
});

// [3] لوحة التحكم الرئيسية (Dashboard Analytics)
app.get('/dashboard', checkAuth, async (req, res) => {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        let myRiders = rows.filter(r => r.get('zone_name') === req.session.userZone);

        const stats = {
            total: myRiders.length,
            withShifts: myRiders.filter(r => cleanData(r.get('شيفتات الغد')) > 0).length,
            noShifts: myRiders.filter(r => cleanData(r.get('شيفتات الغد')) === 0).length,
            highWallet: myRiders.filter(r => cleanData(r.get('المحفظه')) > 1000).length
        };
        res.render('dashboard', { riders: myRiders, zone: req.session.userZone, stats, headers: sheet.headerValues, cleanData });
    } catch (e) { res.status(500).send("Dashboard Loading Failed"); }
});

// [4] بوابة أمان الاستعلام (Inquiry Preparation)
app.get('/uploaded-inquiry', checkAuth, async (req, res) => {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['مرفوعين استعلام'];
        if (!sheet) throw new Error("Inquiry sheet not found");
        const rows = await sheet.getRows();
        const locations = [...new Set(rows.map(r => r.get('مقر التحضير')))].filter(l => l && l.trim() !== "");
        res.render('inquiry_auth', { zone: req.session.userZone, locations, error: null });
    } catch (e) { res.status(500).send("Prep Office List Failed: " + e.message); }
});

// [5] التحقق بباسورد المقر المخصص وعرض البيانات المفلترة
app.post('/uploaded-inquiry-auth', checkAuth, async (req, res) => {
    const { password, location } = req.body;
    if (officePasswords[location] === password) {
        try {
            const doc = await getDoc();
            const sheet = doc.sheetsByTitle['مرفوعين استعلام'];
            const rows = await sheet.getRows();
            const filteredData = rows.filter(r => (r.get('مقر التحضير') || "").trim() === location.trim());
            res.render('uploaded_inquiry', { data: filteredData, zone: req.session.userZone, location, headers: sheet.headerValues });
        } catch (e) { res.status(500).send("Inquiry Processing Error"); }
    } else {
        res.redirect('/uploaded-inquiry?error=true');
    }
});

// [6] جميع المحافظ (Historical Wallets Tracking)
app.get('/office-wallets', checkAuth, async (req, res) => {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['جميع المحافظ'];
        if (!sheet) throw new Error("Wallets sheet missing");
        const rows = await sheet.getRows();
        let lastSeenDate = "";
        const processedWallets = rows.map(row => {
            let rowObj = row.toObject();
            let currentDate = row.get('Date');
            if (!currentDate || currentDate === '' || currentDate === '0') {
                rowObj.Date = lastSeenDate;
            } else { rowObj.Date = currentDate; lastSeenDate = currentDate; }
            return rowObj;
        });
        res.render('office_wallets', { wallets: processedWallets, zone: req.session.userZone, headers: sheet.headerValues });
    } catch (e) { res.status(500).send("Wallets Loading Error"); }
});

// [7] التصالحات (Courier Reconciliations)
app.get('/reconciliations', checkAuth, async (req, res) => {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['تصالحات'];
        const rows = await sheet.getRows();
        let lastSeenDate = "";
        const processedData = rows.map(row => {
            let rowObj = row.toObject();
            let currentDate = row.get('التاريخ');
            if (!currentDate || currentDate === '') { rowObj.التاريخ = lastSeenDate; }
            else { rowObj.التاريخ = currentDate; lastSeenDate = currentDate; }
            return rowObj;
        });
        res.render('reconciliations', { data: processedData, zone: req.session.userZone, headers: sheet.headerValues });
    } catch (e) { res.status(500).send("Reconciliations Loading Error"); }
});

// [8] التارجت (Zone Performance Targets)
app.get('/targets', checkAuth, async (req, res) => {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['التارجت'];
        const rows = await sheet.getRows();
        const zoneData = rows.find(r => r.get('zone_name') === req.session.userZone);
        res.render('targets', { zone: req.session.userZone, zoneData, headers: sheet.headerValues, cleanData });
    } catch (e) { res.status(500).send("Target Data Missing"); }
});

// [9] تعيينات الشهر (Monthly Hirings - FIXED STATS ERROR)
app.get('/new-riders', checkAuth, async (req, res) => {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['تعيينات الشهر'];
        if (!sheet) throw new Error("Hiring sheet missing");
        const rows = await sheet.getRows();
        const myRiders = rows.filter(r => r.get('zone_name') === req.session.userZone);
        
        // حساب متغير stats لمنع خطأ stats is not defined في صفحة EJS
        const stats = {
            total: myRiders.length || 1, // منع القسمة على صفر في الواجهة
            received: myRiders.filter(r => ['استلم', 'تم الاستلام', 'Received'].includes(r.get('الحاله'))).length,
            notReceived: myRiders.filter(r => !['استلم', 'تم الاستلام', 'Received'].includes(r.get('الحاله'))).length
        };

        res.render('new_riders', { 
            riders: myRiders, 
            zone: req.session.userZone, 
            stats: stats, // تمرير الإحصائيات المطلوبة للرسم البياني
            headers: sheet.headerValues, 
            cleanData 
        });
    } catch (e) { res.status(500).send("Hiring Sheet Error: " + e.message); }
});

// [10] ردود الأوردات (Order Delivery Feedback)
app.get('/order-responses', checkAuth, async (req, res) => {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['ردود الأوردات'];
        const rows = await sheet.getRows();
        const myOrders = rows.filter(r => r.get('zone_name') === req.session.userZone);
        res.render('order_responses', { orders: myOrders, zone: req.session.userZone, headers: sheet.headerValues });
    } catch (e) { res.status(500).send("Orders Data Error"); }
});

// [11] ردود التعيينات (Hiring Process Feedback)
app.get('/new-riders-responses', checkAuth, async (req, res) => {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['ردود التعيينات'];
        const rows = await sheet.getRows();
        const myResponses = rows.filter(r => r.get('Zone Name') === req.session.userZone);
        res.render('new_riders_responses', { responses: myResponses, zone: req.session.userZone, headers: sheet.headerValues });
    } catch (e) { res.status(500).send("Hiring Feedback Error"); }
});

// [12] مرفوضين استعلام (Security Screening Rejections)
app.get('/rejected-inquiry', checkAuth, async (req, res) => {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['مرفوضين استعلام'];
        const rows = await sheet.getRows();
        const data = rows.map(r => ({
            date: r.get('التاريخ'), office: r.get('مكتب'), prep_office: r.get('مقر التحضير'),
            name: r.get('الاسم'), phone: r.get('رقم الهاتف'), national_id: r.get('الرقم القومي'),
            supervisor: r.get('اسم المشرف'), reason: r.get('سبب الرفض')
        }));
        res.render('rejected_inquiry', { data, zone: req.session.userZone });
    } catch (e) { res.status(500).send("Rejection List Failed"); }
});

// [13] مسار تصدير البيانات والتحميل (Excel Export Service)
app.get('/download', checkAuth, async (req, res) => {
    try {
        const doc = await getDoc();
        const rows = await (doc.sheetsByIndex[0]).getRows();
        const myData = rows.filter(r => r.get('zone_name') === req.session.userZone).map(r => r.toObject());
        const ws = XLSX.utils.json_to_sheet(myData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Courier_Performance");
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename=Performance_${req.session.userZone}.xlsx`);
        res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer);
    } catch (e) { res.status(500).send("Export Failed: " + e.message); }
});

// --- تسجيل الخروج وتدمير الجلسة (Logout) ---
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if(err) console.error("SESSION_DESTROY_ERR:", err);
        res.redirect('/');
    });
});

// --- تشغيل السيرفر بذكاء (Railway Adaptive Listener) ---
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    =======================================================
    🚀 Talabat Pro Online Status: ACTIVE
    📍 Mode: Secure Office-Level Auth & Stats Fixed
    📡 Listening on Port: ${PORT}
    🔗 URL: http://localhost:${PORT}
    =======================================================
    `);
});

// معالجة الأخطاء العالمية غير المتوقعة لضمان استمرارية السيرفر
process.on('uncaughtException', (err) => {
    console.error('CRITICAL_UNCAUGHT_ERR:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED_REJECTION:', reason);
});