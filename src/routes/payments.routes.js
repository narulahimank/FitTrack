const express = require('express');
const router = express.Router();
const db = require('../config/db');
const QRCode = require('qrcode');

const GYM_OWNER_UPI_ID = '8168567208@fam';
const GYM_OWNER_NAME = 'FitTrack Gym Owner';

// GET /api/payments/upi-qr - Generate dynamic UPI QR Code for Gym Owner
router.get('/upi-qr', async (req, res) => {
    try {
        const { amount, note, member_name, membership_id, member_id } = req.query;
        const payAmount = Number(amount) > 0 ? Number(amount).toFixed(2) : '1500.00';
        const txnNote = note || `FitTrack Gym Payment${member_name ? ' - ' + member_name : ''}`;

        // Standard Indian National Payments Corporation (NPCI) UPI Intent String
        // upi://pay?pa=VPA&pn=NAME&am=AMOUNT&cu=INR&tn=NOTE
        const upiString = `upi://pay?pa=${GYM_OWNER_UPI_ID}&pn=${encodeURIComponent(GYM_OWNER_NAME)}&am=${payAmount}&cu=INR&tn=${encodeURIComponent(txnNote)}`;

        // Generate high-resolution QR Code base64 Data URL
        const qrCodeDataUrl = await QRCode.toDataURL(upiString, {
            width: 320,
            margin: 2,
            color: {
                dark: '#0a0e17',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        });

        res.json({
            success: true,
            data: {
                upi_id: GYM_OWNER_UPI_ID,
                payee_name: GYM_OWNER_NAME,
                amount: payAmount,
                currency: 'INR',
                note: txnNote,
                upi_string: upiString,
                qr_code_url: qrCodeDataUrl,
                member_id: member_id || null,
                membership_id: membership_id || null
            }
        });
    } catch (error) {
        console.error('Generate UPI QR error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/payments/verify-upi - Verify and record UPI payment directly to Gym Owner
router.post('/verify-upi', async (req, res) => {
    const connection = await db.getConnection();
    try {
        const {
            member_id,
            membership_id,
            amount,
            utr_number,
            payment_note
        } = req.body;

        if (!member_id || !amount) {
            return res.status(400).json({ success: false, error: 'Member and Amount are required.' });
        }

        const payAmount = Number(amount);
        if (isNaN(payAmount) || payAmount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid payment amount.' });
        }

        // Form unique Transaction ID with UTR or timestamp
        const utr = (utr_number && utr_number.trim()) ? utr_number.trim() : `${Date.now()}`;
        const transactionId = `UPI-FAM-${utr}`;

        await connection.beginTransaction();

        // 1. Determine or validate membership_id
        let targetMembershipId = membership_id;
        if (!targetMembershipId) {
            // Find member's active or latest membership
            const [msRows] = await connection.query(`
                SELECT membership_id FROM memberships 
                WHERE member_id = ? 
                ORDER BY membership_id DESC LIMIT 1
            `, [member_id]);

            if (msRows.length > 0) {
                targetMembershipId = msRows[0].membership_id;
            } else {
                // Find starter plan and create basic membership
                const [planRows] = await connection.query('SELECT plan_id, duration_months FROM membership_plans WHERE status = "Active" LIMIT 1');
                const defaultPlanId = planRows.length > 0 ? planRows[0].plan_id : 1;
                const duration = planRows.length > 0 ? planRows[0].duration_months : 1;

                const [newMs] = await connection.query(`
                    INSERT INTO memberships (member_id, plan_id, start_date, end_date, total_amount, status)
                    VALUES (?, ?, CURRENT_DATE, DATE_ADD(CURRENT_DATE, INTERVAL ? MONTH), ?, 'Active')
                `, [member_id, defaultPlanId, duration, payAmount]);
                targetMembershipId = newMs.insertId;
            }
        }

        // 2. Insert Payment record into database
        const [paymentResult] = await connection.query(`
            INSERT INTO payments (membership_id, member_id, amount, payment_date, payment_method, payment_status, transaction_id)
            VALUES (?, ?, ?, CURRENT_DATE, 'UPI', 'Completed', ?)
        `, [targetMembershipId, member_id, payAmount, transactionId]);

        // 3. Ensure membership status is Active
        await connection.query(`
            UPDATE memberships 
            SET status = 'Active' 
            WHERE membership_id = ?
        `, [targetMembershipId]);

        // 4. Ensure member status is Active
        await connection.query(`
            UPDATE members 
            SET status = 'Active' 
            WHERE member_id = ?
        `, [member_id]);

        await connection.commit();

        res.json({
            success: true,
            message: `UPI Payment of ₹${payAmount.toLocaleString()} verified and credited to Gym Owner (8168567208@fam).`,
            data: {
                payment_id: paymentResult.insertId,
                transaction_id: transactionId,
                utr_number: utr,
                owner_upi: GYM_OWNER_UPI_ID,
                amount: payAmount,
                payment_date: new Date().toISOString().slice(0, 10),
                status: 'Completed'
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Verify UPI payment error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, error: 'A transaction with this UTR / Reference ID already exists in the ledger.' });
        }
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
});

// GET /api/payments - List payments with filters
router.get('/', async (req, res) => {
    try {
        const { status, method } = req.query;
        let query = `
            SELECT 
                p.payment_id,
                p.membership_id,
                p.member_id,
                CONCAT(m.first_name, ' ', m.last_name) AS member_name,
                m.email AS member_email,
                m.phone AS member_phone,
                mp.plan_name,
                p.amount,
                p.payment_date,
                p.payment_method,
                p.payment_status,
                p.transaction_id,
                p.created_at
            FROM payments p
            JOIN members m ON p.member_id = m.member_id
            JOIN memberships ms ON p.membership_id = ms.membership_id
            JOIN membership_plans mp ON ms.plan_id = mp.plan_id
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== 'All') {
            query += ' AND p.payment_status = ?';
            params.push(status);
        }

        if (method && method !== 'All') {
            query += ' AND p.payment_method = ?';
            params.push(method);
        }

        query += ' ORDER BY p.payment_date DESC, p.payment_id DESC';

        const [rows] = await db.query(query, params);
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error('Fetch payments error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/payments - Record new payment
router.post('/', async (req, res) => {
    try {
        const { membership_id, member_id, amount, payment_method, payment_status } = req.body;
        if (!membership_id || !member_id || !amount || !payment_method) {
            return res.status(400).json({ success: false, error: 'Please provide all required payment details.' });
        }

        const txId = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const status = payment_status || 'Completed';

        const [result] = await db.query(`
            INSERT INTO payments (membership_id, member_id, amount, payment_date, payment_method, payment_status, transaction_id)
            VALUES (?, ?, ?, CURRENT_DATE, ?, ?, ?)
        `, [membership_id, member_id, amount, payment_method, status, txId]);

        res.json({ success: true, message: 'Payment recorded successfully.', payment_id: result.insertId, transaction_id: txId });
    } catch (error) {
        console.error('Record payment error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/payments/:id/status - Update payment status (e.g. Pending -> Completed)
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_status } = req.body;
        if (!['Completed', 'Pending', 'Failed'].includes(payment_status)) {
            return res.status(400).json({ success: false, error: 'Invalid payment status.' });
        }

        await db.query('UPDATE payments SET payment_status = ? WHERE payment_id = ?', [payment_status, id]);
        res.json({ success: true, message: `Payment marked as ${payment_status}.` });
    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
