const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const session = require('express-session');
const XLSX = require('xlsx');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'talabat-final-pro-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000, secure: false }
}));

const SPREADSHEET_ID = '1bNhlUVWnt43Pq1hqDALXbfGDVazD7VhaeKM58hBTsN0';

const zonePasswords = {
    'Ain shams': '754', 'Alexandria': '1234', 'Cairo_city_centre': '909', 
    'Giza': '1568', 'Heliopolis': '2161', 'Ismalia city': '1122', 
    'Kafr el-sheikh': '3344', 'Maadi': '878', 'Mansoura': '5566', 
    'Mohandiseen': '1862', 'Nasr city': '2851', 'New damietta': '7788', 
    'October': '2161', 'Portsaid city': '9900', 'Shebin el koom': '4455', 
    'Sheikh zayed': '854', 'Suez': '6677', 'Tagammoa south': '1072', 
    'Tanta': '8899', 'Zagazig': '2233'
};

// دالة الاتصال بجوجل شيت المحسنة
async function getDoc() {
    let credsData;
    if (process.env.GOOGLE_CREDS) {
        credsData = JSON.parse(process.env.GOOGLE_CREDS);
    } else {
        credsData = require('./credentials.json');
    }
    const auth = new JWT({
        email: credsData.client_email,
        key: credsData.private_key.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
    await doc.loadInfo();
    return doc;
}

// دالة تنظيف البيانات (نفس النسخة المستخدمة في الواجهة لضمان دقة الحسابات)
const cleanData = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    let strVal = val.toString().trim();
    if (['NA', '#N/A', 'N/A', '0'].includes(strVal)) return 0;
    let res = parseFloat(strVal.replace(/,/g, '').replace(/[^0-9.-]/g, ''));
    return isNaN(res) ? 0 : res;
};

// --- المسارات (Routes) ---

app.get('/', async (req, res) => {
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        const allZones = [...new Set(rows.map(r => r.get('zone_name')))].filter(z => z);
        res.render('login', { zones: allZones, error: null });
    } catch (e) { res.status(500).send("خطأ في الاتصال: " + e.message); }
});

app.post('/login', (req, res) => {
    const { zone, password } = req.body;
    if (zonePasswords[zone] === password) {
        req.session.userZone = zone;
        res.redirect('/dashboard');
    } else {
        res.render('login', { zones: Object.keys(zonePasswords), error: 'كلمة المرور غير صحيحة' });
    }
});

// تعديل مسار Dashboard ليتماشى مع ميزة الفرز والبحث
app.get('/dashboard', async (req, res) => {
    if (!req.session.userZone) return res.redirect('/');
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();
        
        // جلب مناديب الزون الحالي فقط
        let myRiders = rows.filter(r => r.get('zone_name') === req.session.userZone);

        // جلب عدد التعيينات الجديدة (اختياري حسب شيت التعيينات)
        const lastSheet = doc.sheetsByTitle['تعيينات الشهر'];
        let newCount = 0;
        if (lastSheet) {
            const newRiderRows = await lastSheet.getRows();
            newCount = newRiderRows.filter(r => r.get('zone_name') === req.session.userZone).length;
        }

        // حساب الإحصائيات التي تظهر في الكروت العلوية
        const stats = {
            total: myRiders.length,
            withShifts: myRiders.filter(r => cleanData(r.get('شيفتات الغد')) > 0).length,
            noShifts: myRiders.filter(r => cleanData(r.get('شيفتات الغد')) === 0).length,
            highWallet: myRiders.filter(r => cleanData(r.get('المحفظه')) > 1000).length,
            newCount: newCount
        };

        // إرسال البيانات للـ EJS مع تمرير دالة cleanData لاستخدامها داخل الجدول
        res.render('dashboard', { 
            riders: myRiders, 
            zone: req.session.userZone, 
            stats, 
            headers: sheet.headerValues, 
            cleanData // تمرير الدالة للواجهة
        });
    } catch (e) { res.status(500).send("خطأ في التحميل: " + e.message); }
});

// المسارات الأخرى تظل كما هي لأن تحديث البحث والترتيب يعتمد بشكل أساسي على ملف الـ EJS
app.get('/office-wallets', async (req, res) => {
    if (!req.session.userZone) return res.redirect('/');
    try {
        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['جميع المحافظ']; 
        if (!sheet) throw new Error("شيت 'جميع المحافظ' غير موجود");
        const rows = await sheet.getRows();
        let lastSeenDate = "";
        const processedWallets = rows.map(row => {
            let rowObj = row.toObject();
            let currentDate = row.get('Date');
            if (!currentDate || currentDate === '0' || currentDate === '') {
                rowObj.Date = lastSeenDate;
            } else {
                rowObj.Date = currentDate;
                lastSeenDate = currentDate;
            }
            return rowObj;
        });
        res.render('office_wallets', { wallets: processedWallets, zone: req.session.userZone, headers: sheet.headerValues });
    } catch (e) { res.status(500).send(e.message); }
});

// مسار تسجيل الخروج
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 السيرفر شغال على http://localhost:${PORT}`));