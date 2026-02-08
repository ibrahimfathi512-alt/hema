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



const cleanData = (val) => {

    if (val === undefined || val === null || val === '') return 0;

    let strVal = val.toString().trim();

    if (['NA', '#N/A', 'N/A'].includes(strVal)) return 0;

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



app.get('/dashboard', async (req, res) => {

    if (!req.session.userZone) return res.redirect('/');

    try {

        const doc = await getDoc();

        const sheet = doc.sheetsByIndex[0];

        const rows = await sheet.getRows();

        let myRiders = rows.filter(r => r.get('zone_name') === req.session.userZone);



        const lastSheet = doc.sheetsByTitle['تعيينات الشهر'];

        let newCount = 0;

        if (lastSheet) {

            const newRiderRows = await lastSheet.getRows();

            newCount = newRiderRows.filter(r => r.get('zone_name') === req.session.userZone).length;

        }



        const stats = {

            total: myRiders.length,

            withShifts: myRiders.filter(r => cleanData(r.get('شيفتات الغد')) > 0).length,

            noShifts: myRiders.filter(r => cleanData(r.get('شيفتات الغد')) === 0).length,

            highWallet: myRiders.filter(r => cleanData(r.get('المحفظه')) > 1000).length,

            newCount: newCount

        };

        res.render('dashboard', { riders: myRiders, zone: req.session.userZone, stats, headers: sheet.headerValues, cleanData });

    } catch (e) { res.status(500).send("خطأ في التحميل: " + e.message); }

});



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



// مسار صفحة التصالحات الجديد

app.get('/reconciliations', async (req, res) => {

    if (!req.session.userZone) return res.redirect('/');

    try {

        const doc = await getDoc();

        const sheet = doc.sheetsByTitle['تصالحات']; // التأكد من مطابقة اسم الشيت في جوجل

        if (!sheet) throw new Error("شيت 'تصالحات' غير موجود");

       

        const rows = await sheet.getRows();

       

        // معالجة البيانات لتفادي مشاكل الخلايا المدمجة في عمود التاريخ

        let lastSeenDate = "";

        const processedData = rows.map(row => {

            let rowObj = row.toObject();

            let currentDate = row.get('التاريخ'); // استخدام اسم العمود المناسب من الشيت

           

            if (!currentDate || currentDate === '') {

                rowObj.التاريخ = lastSeenDate;

            } else {

                rowObj.التاريخ = currentDate;

                lastSeenDate = currentDate;

            }

            return rowObj;

        });



        res.render('reconciliations', {

            data: processedData,

            zone: req.session.userZone,

            headers: sheet.headerValues

        });

    } catch (e) { res.status(500).send("خطأ: تأكد من وجود شيت باسم 'تصالحات'"); }

});



app.get('/targets', async (req, res) => {

    if (!req.session.userZone) return res.redirect('/');

    try {

        const doc = await getDoc();

        const sheet = doc.sheetsByTitle['التارجت'];

        const rows = await sheet.getRows();

        const zoneData = rows.find(r => r.get('zone_name') === req.session.userZone);



        const mainSheet = doc.sheetsByIndex[0];

        const mainRows = await mainSheet.getRows();

        const myRiders = mainRows.filter(r => r.get('zone_name') === req.session.userZone);

       

        const stats = {

            total: myRiders.length,

            withShifts: myRiders.filter(r => cleanData(r.get('شيفتات الغد')) > 0).length,

            noShifts: myRiders.filter(r => cleanData(r.get('شيفتات الغد')) === 0).length,

            highWallet: myRiders.filter(r => cleanData(r.get('المحفظه')) > 1000).length

        };



        res.render('targets', { zone: req.session.userZone, zoneData, stats, headers: sheet.headerValues, cleanData });

    } catch (e) { res.send("تأكد من وجود شيت باسم 'التارجت'"); }

});



app.get('/new-riders', async (req, res) => {

    if (!req.session.userZone) return res.redirect('/');

    try {

        const doc = await getDoc();

        const sheet = doc.sheetsByTitle['تعيينات الشهر'];

        const rows = await sheet.getRows();

        const myRiders = rows.filter(r => r.get('zone_name') === req.session.userZone);

       

        const stats = {

            total: myRiders.length,

            received: myRiders.filter(r => r.get('الحاله') === 'استلم').length,

            notReceived: myRiders.filter(r => r.get('الحاله') !== 'استلم').length

        };

        res.render('new_riders', { riders: myRiders, zone: req.session.userZone, stats, headers: sheet.headerValues, cleanData });

    } catch (e) { res.send("تأكد من وجود شيت باسم 'تعيينات الشهر'"); }

});



app.get('/order-responses', async (req, res) => {

    if (!req.session.userZone) return res.redirect('/');

    try {

        const doc = await getDoc();

        const sheet = doc.sheetsByTitle['ردود الأوردات'];

        const rows = await sheet.getRows();

        const myOrders = rows.filter(r => r.get('zone_name') === req.session.userZone);

        res.render('order_responses', { orders: myOrders, zone: req.session.userZone, headers: sheet.headerValues });

    } catch (e) { res.send("تأكد من وجود شيت باسم 'ردود الأوردات'"); }

});



app.get('/new-riders-responses', async (req, res) => {

    if (!req.session.userZone) return res.redirect('/');

    try {

        const doc = await getDoc();

        const sheet = doc.sheetsByTitle['ردود التعيينات'];

        const rows = await sheet.getRows();

        const myResponses = rows.filter(r => r.get('Zone Name') === req.session.userZone);

        res.render('new_riders_responses', { responses: myResponses, zone: req.session.userZone, headers: sheet.headerValues });

    } catch (e) { res.send("خطأ: تأكد من وجود شيت باسم 'ردود التعيينات'."); }

});



app.get('/rejected-inquiry', async (req, res) => {

    if (!req.session.userZone) return res.redirect('/');

    try {

        const doc = await getDoc();

        const sheet = doc.sheetsByTitle['مرفوضين استعلام'];

        const rows = await sheet.getRows();

        const allRejectedData = rows.map(row => {

            return {

                date: row.get('التاريخ'),

                office: row.get('مكتب'),

                prep_office: row.get('مقر التحضير'),

                name: row.get('الاسم'),

                phone: row.get('رقم الهاتف'),

                national_id: row.get('الرقم القومي'),

                supervisor: row.get('اسم المشرف'),

                reason: row.get('سبب الرفض')

            };

        });

        res.render('rejected_inquiry', { data: allRejectedData });

    } catch (e) {

        res.status(500).send("خطأ في شيت 'مرفوضين استعلام'");

    }

});



app.get('/download', async (req, res) => {

    if (!req.session.userZone) return res.redirect('/');

    try {

        const doc = await getDoc();

        const rows = await doc.sheetsByIndex[0].getRows();

        const myData = rows.filter(r => r.get('zone_name') === req.session.userZone).map(r => r.toObject());

        const ws = XLSX.utils.json_to_sheet(myData);

        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, ws, "Data");

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename=${req.session.userZone}_Data.xlsx`);

        res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer);

    } catch (e) { res.status(500).send("خطأ في التصدير"); }

});



app.get('/logout', (req, res) => {

    req.session.destroy();

    res.redirect('/');

});



const PORT = 3000;

app.listen(PORT, () => console.log(`🚀 السيرفر شغال على http://localhost:${PORT}`));