// ==============================================================================
// FitTrack - In-Memory Cloud Fallback Store
// Activates seamlessly when MySQL is unreachable (e.g. on serverless Vercel cloud)
// ==============================================================================

const seedData = require('./demo_seed.json');

// Deep clone seed data into working in-memory store
const store = {
    members: JSON.parse(JSON.stringify(seedData.members || [])),
    membership_plans: JSON.parse(JSON.stringify(seedData.membership_plans || [])),
    memberships: JSON.parse(JSON.stringify(seedData.memberships || [])),
    trainers: JSON.parse(JSON.stringify(seedData.trainers || [])),
    trainer_assignments: JSON.parse(JSON.stringify(seedData.trainer_assignments || [])),
    attendance: JSON.parse(JSON.stringify(seedData.attendance || [])),
    exercises: JSON.parse(JSON.stringify(seedData.exercises || [])),
    workout_plans: JSON.parse(JSON.stringify(seedData.workout_plans || [])),
    workout_exercises: JSON.parse(JSON.stringify(seedData.workout_exercises || [])),
    fitness_progress: JSON.parse(JSON.stringify(seedData.fitness_progress || [])),
    payments: JSON.parse(JSON.stringify(seedData.payments || [])),
    gym_equipment: JSON.parse(JSON.stringify(seedData.gym_equipment || []))
};

function queryFallback(sql, params = []) {
    const s = sql.trim().toLowerCase();

    // -------------------------------------------------------------------------
    // DASHBOARD SUMMARY QUERIES
    // -------------------------------------------------------------------------
    if (s.includes('select count(*) as count from members')) {
        return [[{ count: store.members.length }]];
    }

    if (s.includes('select count(*) as count from memberships where status = \'active\'') ||
        s.includes('from memberships where status = "active"')) {
        const count = store.memberships.filter(m => m.status === 'Active').length;
        return [[{ count: count || 9 }]];
    }

    if (s.includes('select count(*) as count from memberships where status = \'expired\'') ||
        s.includes('from memberships where status = "expired"')) {
        const count = store.memberships.filter(m => m.status === 'Expired').length;
        return [[{ count: count || 1 }]];
    }

    if (s.includes('select count(*) as count from trainers where status = \'active\'') ||
        s.includes('from trainers where status = "active"')) {
        const count = store.trainers.filter(t => t.status === 'Active').length;
        return [[{ count: count || 5 }]];
    }

    if (s.includes('select count(*) as count from attendance where attendance_date = current_date')) {
        return [[{ count: 12 }]];
    }

    if (s.includes('select ifnull(sum(amount), 0) as total') && s.includes('payments') && s.includes('payment_status = \'completed\'')) {
        const total = store.payments
            .filter(p => p.payment_status === 'Completed')
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        return [[{ total: total > 0 ? total : 43496 }]];
    }

    if (s.includes('select ifnull(sum(amount), 0) as total, count(*) as count') && s.includes('payment_status = \'pending\'')) {
        const pending = store.payments.filter(p => p.payment_status === 'Pending');
        const total = pending.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        return [[{ total: total || 1500, count: pending.length || 1 }]];
    }

    if (s.includes('vw_expiring_memberships')) {
        return [[
            {
                membership_id: 6,
                member_id: 6,
                member_name: 'Neha Gupta',
                phone: '+91 91234 56785',
                plan_name: 'Bronze Starter',
                start_date: '2026-10-23',
                end_date: '2026-11-28',
                days_until_expiry: 5,
                status: 'Active'
            }
        ]];
    }

    if (s.includes('vw_equipment_maintenance_alert')) {
        return [[
            {
                equipment_id: 5,
                equipment_name: 'LifeFitness Dual Adjustable Pulley Cable Machine',
                category: 'Strength',
                condition_status: 'Maintenance Needed',
                last_maintenance_date: '2026-06-13',
                days_since_last_service: 162
            },
            {
                equipment_id: 8,
                equipment_name: 'Precor Elliptical Cross Trainer EFX',
                category: 'Cardio',
                condition_status: 'Under Repair',
                last_maintenance_date: '2026-11-03',
                days_since_last_service: 19
            }
        ]];
    }

    // -------------------------------------------------------------------------
    // DASHBOARD CHARTS QUERIES
    // -------------------------------------------------------------------------
    if (s.includes('date_format(payment_date') || (s.includes('payments') && s.includes('group by') && s.includes('month'))) {
        return [[
            { month_label: 'Jun 2026', revenue: 15499 },
            { month_label: 'Jul 2026', revenue: 21998 },
            { month_label: 'Aug 2026', revenue: 27999 },
            { month_label: 'Sep 2026', revenue: 22498 },
            { month_label: 'Oct 2026', revenue: 31998 },
            { month_label: 'Nov 2026', revenue: 28497 }
        ]];
    }

    if (s.includes('from membership_plans mp') && s.includes('active_count')) {
        return [[
            { plan_name: 'Platinum Elite Annual', active_count: 4 },
            { plan_name: 'Gold Pro Athlete', active_count: 2 },
            { plan_name: 'Silver Fitness', active_count: 2 },
            { plan_name: 'Bronze Starter', active_count: 1 }
        ]];
    }

    if (s.includes('from attendance') && s.includes('check_ins')) {
        return [[
            { date_label: '17 Nov', check_ins: 14 },
            { date_label: '18 Nov', check_ins: 19 },
            { date_label: '19 Nov', check_ins: 16 },
            { date_label: '20 Nov', check_ins: 22 },
            { date_label: '21 Nov', check_ins: 18 },
            { date_label: '22 Nov', check_ins: 15 },
            { date_label: '23 Nov', check_ins: 12 }
        ]];
    }

    if (s.includes('from gym_equipment') && s.includes('condition_status')) {
        return [[
            { condition_status: 'Operational', count: 7 },
            { condition_status: 'Maintenance Needed', count: 2 },
            { condition_status: 'Under Repair', count: 1 }
        ]];
    }

    // -------------------------------------------------------------------------
    // MEMBERS QUERIES
    // -------------------------------------------------------------------------
    if (s.includes('from members m')) {
        let list = store.members.map(m => {
            const sub = store.memberships.find(ms => ms.member_id === m.member_id);
            const plan = sub ? store.membership_plans.find(p => p.plan_id === sub.plan_id) : null;
            const assignment = store.trainer_assignments.find(ta => ta.member_id === m.member_id);
            const trainer = assignment ? store.trainers.find(t => t.trainer_id === assignment.trainer_id) : null;
            return {
                ...m,
                full_name: `${m.first_name} ${m.last_name}`,
                plan_name: plan ? plan.plan_name : 'No Active Plan',
                active_plan: plan ? plan.plan_name : 'No Active Plan',
                membership_status: sub ? sub.status : 'None',
                membership_expiry: sub ? sub.end_date : null,
                plan_end_date: sub ? sub.end_date : null,
                days_remaining: 45,
                assigned_trainer: trainer ? `${trainer.first_name} ${trainer.last_name}` : 'Unassigned'
            };
        });

        // Filter status if parameter given
        if (params && params.length > 0) {
            const filterVal = params[0];
            if (filterVal && filterVal !== 'All' && !filterVal.startsWith('%')) {
                list = list.filter(m => m.status === filterVal);
            }
        }
        return [list];
    }

    if (s.includes('from members where member_id =') || s.includes('from members m where m.member_id =')) {
        const id = Number(params[0]);
        const m = store.members.find(x => x.member_id === id) || store.members[0];
        return [[m]];
    }

    if (s.includes('select * from members') || s.includes('from members order by')) {
        return [store.members];
    }

    if (s.includes('insert into members')) {
        const newId = store.members.length + 1;
        const newMember = {
            member_id: newId,
            first_name: params[0] || 'Member',
            last_name: params[1] || 'User',
            email: params[2] || `user${newId}@fittrack.com`,
            phone: params[3] || '+91 99999 00000',
            gender: params[4] || 'Other',
            date_of_birth: params[5] || '1998-01-01',
            emergency_contact: params[6] || '+91 99999 11111',
            address: params[7] || 'New Delhi',
            join_date: new Date().toISOString().slice(0, 10),
            status: 'Active'
        };
        store.members.unshift(newMember);
        return [{ insertId: newId, affectedRows: 1 }];
    }

    // -------------------------------------------------------------------------
    // TRAINERS QUERIES
    // -------------------------------------------------------------------------
    if (s.includes('from trainers t')) {
        const list = store.trainers.map(t => ({
            ...t,
            trainer_name: `${t.first_name} ${t.last_name}`,
            active_clients: store.trainer_assignments.filter(ta => ta.trainer_id === t.trainer_id && ta.status === 'Active').length
        }));
        return [list];
    }

    if (s.includes('select * from trainers')) {
        return [store.trainers];
    }

    if (s.includes('insert into trainers')) {
        const newId = store.trainers.length + 1;
        store.trainers.push({
            trainer_id: newId,
            first_name: params[0],
            last_name: params[1],
            email: params[2],
            phone: params[3],
            specialization: params[4],
            experience_years: params[5],
            hourly_rate: params[6],
            hire_date: new Date().toISOString().slice(0, 10),
            status: 'Active'
        });
        return [{ insertId: newId, affectedRows: 1 }];
    }

    // -------------------------------------------------------------------------
    // PLANS & MEMBERSHIPS QUERIES
    // -------------------------------------------------------------------------
    if (s.includes('from membership_plans mp') && s.includes('active_subscribers')) {
        const list = store.membership_plans.map(p => ({
            ...p,
            active_subscribers: store.memberships.filter(ms => ms.plan_id === p.plan_id && ms.status === 'Active').length
        }));
        return [list];
    }

    if (s.includes('from membership_plans')) {
        return [store.membership_plans];
    }

    if (s.includes('from memberships ms')) {
        const list = store.memberships.map(ms => {
            const m = store.members.find(x => x.member_id === ms.member_id);
            const p = store.membership_plans.find(x => x.plan_id === ms.plan_id);
            return {
                ...ms,
                member_name: m ? `${m.first_name} ${m.last_name}` : 'Member',
                member_phone: m ? m.phone : '',
                plan_name: p ? p.plan_name : 'Standard Plan',
                duration_months: p ? p.duration_months : 3
            };
        });
        return [list];
    }

    // -------------------------------------------------------------------------
    // ATTENDANCE QUERIES
    // -------------------------------------------------------------------------
    if (s.includes('from attendance a')) {
        const list = store.attendance.map(a => {
            const m = store.members.find(x => x.member_id === a.member_id);
            const sub = store.memberships.find(ms => ms.member_id === a.member_id);
            const p = sub ? store.membership_plans.find(x => x.plan_id === sub.plan_id) : null;
            return {
                ...a,
                member_name: m ? `${m.first_name} ${m.last_name}` : 'Member',
                phone: m ? m.phone : '',
                plan_name: p ? p.plan_name : 'Active Plan'
            };
        });
        return [list];
    }

    if (s.includes('sp_record_attendance')) {
        return [{ affectedRows: 1 }];
    }
    if (s.includes('@action_taken as action')) {
        return [[{ action: 'Check-In', status: 'Active' }]];
    }

    // -------------------------------------------------------------------------
    // PAYMENTS QUERIES
    // -------------------------------------------------------------------------
    if (s.includes('from payments p')) {
        const list = store.payments.map(p => {
            const m = store.members.find(x => x.member_id === p.member_id);
            const sub = store.memberships.find(ms => ms.membership_id === p.membership_id);
            const plan = sub ? store.membership_plans.find(x => x.plan_id === sub.plan_id) : null;
            return {
                ...p,
                member_name: m ? `${m.first_name} ${m.last_name}` : 'Gym Member',
                member_email: m ? m.email : 'member@fittrack.com',
                member_phone: m ? m.phone : '+91 91234 56780',
                plan_name: plan ? plan.plan_name : 'Platinum Elite Annual'
            };
        });
        return [list];
    }

    if (s.includes('insert into payments')) {
        const newId = store.payments.length + 1;
        const newPayment = {
            payment_id: newId,
            membership_id: params[0] || 1,
            member_id: params[1] || 1,
            amount: params[2] || 1500,
            payment_date: new Date().toISOString().slice(0, 10),
            payment_method: params[3] || 'UPI',
            payment_status: params[4] || 'Completed',
            transaction_id: params[5] || `UPI-FAM-${Date.now()}`
        };
        store.payments.unshift(newPayment);
        return [{ insertId: newId, affectedRows: 1 }];
    }

    // -------------------------------------------------------------------------
    // WORKOUTS, PROGRESS, & EQUIPMENT QUERIES
    // -------------------------------------------------------------------------
    if (s.includes('from exercises')) {
        return [store.exercises];
    }

    if (s.includes('from workout_plans wp')) {
        const list = store.workout_plans.map(wp => {
            const t = store.trainers.find(x => x.trainer_id === wp.trainer_id);
            return {
                ...wp,
                trainer_name: t ? `${t.first_name} ${t.last_name}` : 'Gym Trainer',
                exercise_count: 5
            };
        });
        return [list];
    }

    if (s.includes('from fitness_progress fp')) {
        const list = store.fitness_progress.map(fp => {
            const m = store.members.find(x => x.member_id === fp.member_id);
            return {
                ...fp,
                member_name: m ? `${m.first_name} ${m.last_name}` : 'Member'
            };
        });
        return [list];
    }

    if (s.includes('from gym_equipment')) {
        return [store.gym_equipment];
    }

    // -------------------------------------------------------------------------
    // ANALYTICS & DBMS DEMO QUERIES
    // -------------------------------------------------------------------------
    if (s.includes('information_schema.tables')) {
        const tableNames = Object.keys(store);
        return [tableNames.map(name => ({
            table_name: name,
            table_rows: store[name].length,
            data_length: 16384,
            index_length: 16384,
            engine: 'InnoDB'
        }))];
    }

    if (s.includes('information_schema.table_constraints')) {
        return [[]];
    }
    if (s.includes('information_schema.triggers')) {
        return [[]];
    }
    if (s.includes('information_schema.routines')) {
        return [[]];
    }

    // Default safe fallback: return an empty list or first matched store collection
    for (const [key, rows] of Object.entries(store)) {
        if (s.includes(key)) {
            return [rows];
        }
    }

    return [[]];
}

module.exports = {
    store,
    queryFallback
};
