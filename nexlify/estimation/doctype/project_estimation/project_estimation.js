/*
* ============================================================
* PROJECT ESTIMATION MASTER CONTROLLER
* Client: Nexlify ERP
* Version: 10.6 (Optimized & Clean)
* ============================================================
*/

// --- CONFIGURATION ---
const SCHEMA = {
    estimation_html_field: 'estimation_display_html',
    rfq_dashboard_field: 'opportunity_rfq_html',
    opportunity_link_field: 'est_opportunity',
    parent_factor_field: 'estimation_factor',

    opp_table: 'custom_rfq_table',
    opp_fields: {
        item: 'opportunity_rfq_item',
        desc: 'opportunity_rfq_description',
        uom: 'opportunity_rfq_uom',
        qty: 'opportunity_rfq_quantity'
    },

    est_table: 'estimation',
    est_fields: {
        rfq_link: 'rfq_item',
        task: 'task',
        qty: 'qty',
        hours: 'hours'
    },

    manpower_fields: {
        designation: 'estimation_manpowercost_designation',
        qty: 'estimation_manpowercost_quantity',
        salary: 'estimation_manpowercost_salary',
        factor: 'estimation_manpowercost_factor',
        complete: 'estimation_manpowercost_completesalary',
        per_day: 'estimation_manpowercost_salaryperday'
    }
};

// --- TIMEOUT FOR DEBOUNCING PREVIEW RENDERING ---
let _estimation_preview_timeout = null;
let _cached_hourly_rate = 0; // تخزين سعر الساعة لتجنب إعادة الحساب

// --- PARENT FORM EVENTS ---
frappe.ui.form.on('Project Estimation', {
    onload: function(frm) {
        clear_old_data(frm);
        initialize_logic(frm);
        setup_manpower_add_trigger(frm);
    },
    
    refresh: function(frm) {
        initialize_logic(frm);
        setup_manpower_add_trigger(frm);
        // تحديث التخزين المؤقت لسعر الساعة
        _cached_hourly_rate = calculate_hourly_rate(frm);
    },

    estimation_factor: function(frm) {
        // تحديث كل صفوف القوى العاملة بعامل التقدير الجديد
        let manpower_field = get_manpower_field(frm);
        if (manpower_field && frm.doc[manpower_field.fieldname]) {
            frm.doc[manpower_field.fieldname].forEach(row => {
                frappe.model.set_value(row.doctype, row.name, SCHEMA.manpower_fields.factor, frm.doc.estimation_factor);
            });
        }
    },

    est_opportunity: function(frm) {
        clear_old_data(frm);
        initialize_logic(frm);
    },

    update_tasks_btn: function(frm) {
        frm.save().then(() => {
            refresh_all_previews(frm);
            frm.refresh_field(SCHEMA.est_table);
            frappe.show_alert({ message: __('Document saved and tasks updated'), indicator: 'green' });
        });
    },

    update_manpower_btn: function(frm) {
        frm.save().then(() => {
            _cached_hourly_rate = calculate_hourly_rate(frm); // نعيد الحساب بعد التغيير
            refresh_all_previews(frm);
            frm.refresh_field(SCHEMA.est_table);
            if (frm.doc.project_estimation_tasks_manpower) {
                frm.refresh_field('project_estimation_tasks_manpower');
            }
            frappe.show_alert({ message: __('Document saved and rates updated'), indicator: 'blue' });
        });
    }
});

// --- MANPOWER CHILD TABLE EVENTS ---
frappe.ui.form.on('Estimation Manpower Cost', {
    estimation_manpowercost_quantity: function(frm, cdt, cdn) { calculate_manpower_row(frm, cdt, cdn); },
    estimation_manpowercost_salary: function(frm, cdt, cdn) { calculate_manpower_row(frm, cdt, cdn); },
    estimation_manpowercost_factor: function(frm, cdt, cdn) { calculate_manpower_row(frm, cdt, cdn); },

    form_render: function(frm, cdt, cdn) {
        // ضبط العامل الافتراضي عند فتح صف جديد
        let row = frappe.get_doc(cdt, cdn);
        if (!row.estimation_manpowercost_factor && frm.doc.estimation_factor) {
            frappe.model.set_value(cdt, cdn, SCHEMA.manpower_fields.factor, frm.doc.estimation_factor);
        }
    },
    
    estimation_manpower_cost_remove: function(frm) {
        _cached_hourly_rate = calculate_hourly_rate(frm);
        schedule_preview_refresh(frm);
    }
});

function setup_manpower_add_trigger(frm) {
    // لا حاجة لاستخدام script_manager القديم، الحدث form_render أعلاه يغطي الإضافة
}

function calculate_manpower_row(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    const F = SCHEMA.manpower_fields;

    if (!flt(row[F.factor]) && frm.doc.estimation_factor) {
        frappe.model.set_value(cdt, cdn, F.factor, frm.doc.estimation_factor);
    }

    let complete = flt(row[F.qty]) * flt(row[F.salary]) * flt(row[F.factor]);
    let per_day = complete / 26;

    frappe.model.set_value(cdt, cdn, F.complete, complete);
    frappe.model.set_value(cdt, cdn, F.per_day, per_day);

    _cached_hourly_rate = calculate_hourly_rate(frm);
    schedule_preview_refresh(frm);
}

// --- TASKS TABLE EVENTS (debounced) ---
frappe.ui.form.on('Project Estimation Tasks', {
    qty: function(frm) { schedule_preview_refresh(frm); },
    hours: function(frm) { schedule_preview_refresh(frm); },
    project_estimation_tasks_add: function(frm) { schedule_preview_refresh(frm); },
    project_estimation_tasks_remove: function(frm) { schedule_preview_refresh(frm); }
});

// --- UTILITIES ---

function clear_old_data(frm) {
    if (frm.doc.est_opportunity) {
        frappe.model.clear_doc('Opportunity', frm.doc.est_opportunity);
    }
}

function initialize_logic(frm) {
    // 1. إزالة أي تعديل عالمي قديم (لم نعد نستخدمه)
    
    // 2. إلغاء التحقق من الروابط في الجداول الفرعية
    set_ignore_link_validation(frm);

    // 3. الفلاتر المخصصة
    set_rfq_item_filter(frm);
    set_manpower_task_filter(frm);

    // 4. جلب المعاينات
    _cached_hourly_rate = calculate_hourly_rate(frm);
    refresh_all_previews(frm);
}

function set_ignore_link_validation(frm) {
    // جدول المهام
    let est_grid = frm.fields_dict[SCHEMA.est_table]?.grid;
    if (est_grid) {
        est_grid.docfields.forEach(df => {
            if (df.fieldname === SCHEMA.est_fields.rfq_link) {
                df.ignore_link_validation = 1;
                // استخدام formatter لعرض اسم الـ RFQ Item بدلاً من الرقم المرجعي
                df.formatter = function(value, row, column, classes) {
                    if (!value) return "";
                    let rfq_item = value;
                    // تنظيف معرف الفرصة من النهاية إذا كان موجودًا
                    if (frm.doc.est_opportunity && rfq_item.endsWith('-' + frm.doc.est_opportunity)) {
                        rfq_item = rfq_item.replace('-' + frm.doc.est_opportunity, '');
                    }
                    return rfq_item;
                };
            }
        });
    }

    // جدول القوى العاملة
    let manpower_grid = frm.fields_dict["project_estimation_tasks_manpower"]?.grid;
    if (manpower_grid) {
        manpower_grid.docfields.forEach(df => {
            if (df.fieldname === "estimation_task") {
                df.ignore_link_validation = 1;
                df.formatter = function(value, row, column, classes) {
                    if (!value) return "";
                    let target = frm.doc.estimation?.find(r => r.name === value);
                    return target ? target.task : value;
                };
            }
        });
    }
}

function set_rfq_item_filter(frm) {
    frm.set_query(SCHEMA.est_fields.rfq_link, SCHEMA.est_table, function() {
        return {
            query: "nexlify.nexlify_api.get_rfq_items_bypass",
            filters: { 'parent': frm.doc.est_opportunity }
        };
    });
}

function set_manpower_task_filter(frm) {
    frm.set_query("estimation_task", "project_estimation_tasks_manpower", function() {
        return {
            query: "nexlify.nexlify_api.get_estimation_tasks_bypass",
            filters: { "parent": frm.doc.name }
        };
    });
}

function get_manpower_field(frm) {
    return frm.meta.fields.find(f => f.fieldtype === 'Table' && f.options === 'Estimation Manpower Cost');
}

function calculate_hourly_rate(frm) {
    let total_salary_per_day = 0;
    let manpower_field = get_manpower_field(frm);
    if (manpower_field && frm.doc[manpower_field.fieldname]) {
        frm.doc[manpower_field.fieldname].forEach(row => {
            total_salary_per_day += flt(row[SCHEMA.manpower_fields.per_day]);
        });
    }
    return total_salary_per_day / 8;
}

// Debounce لتجنب إعادة الرسم المتكررة
function schedule_preview_refresh(frm) {
    if (_estimation_preview_timeout) clearTimeout(_estimation_preview_timeout);
    _estimation_preview_timeout = setTimeout(() => {
        refresh_all_previews(frm);
    }, 200);
}

function refresh_all_previews(frm) {
    render_pro_estimation_preview(frm);
    render_opportunity_rfq_preview(frm);
}

// --- RESPONSIVE DASHBOARDS (خفيفة) ---

function render_opportunity_rfq_preview(frm) {
    let opp_id = frm.doc.est_opportunity;
    if (!opp_id) return;

    // جلب RFQ Items فقط بدون تحميل المستند بالكامل
    frappe.call({
        method: 'nexlify.nexlify_api.get_opportunity_rfq_items',
        args: { opportunity: opp_id },
        callback: function(r) {
            if (r.message) {
                let rfq_items = r.message;
                const F = SCHEMA.opp_fields;
                
                let html = `
                    <div style="background-color: transparent; border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                        <div style="display: flex; align-items: center; margin-bottom: 15px; border-left: 4px solid var(--blue-500); padding-left: 15px;">
                            <h5 style="margin: 0; color: var(--text-color); font-weight: 700;">Client RFQ</h5>
                        </div>
                        <div style="overflow-x: auto; width: 100%;">
                            <table style="width: 100%; min-width: 650px; border: 1px solid var(--border-color); border-radius: 8px;">
                                <thead>
                                    <tr style="background-color: var(--bg-light-gray);">
                                        <th style="padding: 12px; text-align: center; width: 45px;">#</th>
                                        <th style="padding: 12px; text-align: left;">Item Code</th>
                                        <th style="padding: 12px; text-align: left;">Description</th>
                                        <th style="padding: 12px; text-align: center; width: 100px;">UOM</th>
                                        <th style="padding: 12px; text-align: center; width: 120px;">Qty</th>
                                    </tr>
                                </thead>
                                <tbody>`;
                                
                rfq_items.forEach((item, index) => {
                    html += `
                        <tr>
                            <td style="padding: 10px; text-align: center;">${index + 1}</td>
                            <td style="padding: 10px; font-weight: 700;">${item[F.item] || ''}</td>
                            <td style="padding: 10px;">${item[F.desc] || ''}</td>
                            <td style="padding: 10px; text-align: center;">${item[F.uom] || '-'}</td>
                            <td style="padding: 10px; text-align: center; font-weight: 600;">${item[F.qty] || 0}</td>
                        </tr>`;
                });

                html += `</tbody></table></div></div>`;
                if (frm.get_field(SCHEMA.rfq_dashboard_field)) {
                    frm.get_field(SCHEMA.rfq_dashboard_field).$wrapper.html(html);
                }
            }
        }
    });
}

function render_pro_estimation_preview(frm) {
    let tasks = frm.doc[SCHEMA.est_table] || [];
    const F = SCHEMA.est_fields;
    let grand_hours = 0;
    let grand_cost = 0;
    let hourly_rate = _cached_hourly_rate || calculate_hourly_rate(frm);

    let html = `
        <div style="background-color: transparent; border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
            <div style="display: flex; align-items: center; margin-bottom: 15px; border-left: 4px solid var(--blue-500); padding-left: 15px;">
                <h5 style="margin: 0; color: var(--text-color); font-weight: 700;">Estimation Calculation</h5>
            </div>
            <div style="overflow-x: auto; width: 100%;">
                <table style="width: 100%; min-width: 750px; border: 1px solid var(--border-color); border-radius: 8px;">
                    <thead>
                        <tr style="background-color: var(--bg-light-gray);">
                            <th style="padding: 12px; text-align: center; width: 45px;">#</th>
                            <th style="padding: 12px; text-align: left;">RFQ Item</th>
                            <th style="padding: 12px; text-align: left;">Task Description</th>
                            <th style="padding: 12px; text-align: center; width: 90px;">QTY</th>
                            <th style="padding: 12px; text-align: center; width: 90px;">Hours</th>
                            <th style="padding: 12px; text-align: center; background-color: var(--bg-light-gray); width: 100px;">Total Hrs</th>
                            <th style="padding: 12px; text-align: right; background-color: var(--bg-light-gray); width: 130px;">Total Cost</th>
                        </tr>
                    </thead>
                    <tbody>`;

    tasks.forEach((row, index) => {
        let row_total_hours = flt(row[F.qty]) * flt(row[F.hours]);
        let row_total_cost = row_total_hours * hourly_rate;
        grand_hours += row_total_hours;
        grand_cost += row_total_cost;

        // عرض اسم الـ RFQ Item بدون معرف الفرصة (الآن يتم بالـ formatter، لكن نحتاجه هنا للجدول HTML)
        let display_rfq_item = row[F.rfq_link] || '-';
        if (frm.doc.est_opportunity && display_rfq_item.endsWith('-' + frm.doc.est_opportunity)) {
            display_rfq_item = display_rfq_item.replace('-' + frm.doc.est_opportunity, '');
        }
        
        html += `
            <tr>
                <td style="padding: 10px; text-align: center;">${index + 1}</td>
                <td style="padding: 10px; font-weight: 700;">${display_rfq_item}</td>
                <td style="padding: 10px;">${row[F.task] || '-'}</td>
                <td style="padding: 10px; text-align: center; font-weight: 600;">${row[F.qty] || 0}</td>
                <td style="padding: 10px; text-align: center;">${row[F.hours] || 0}</td>
                <td style="padding: 10px; text-align: center; font-weight: 700; background-color: var(--bg-light-gray);">${row_total_hours}</td>
                <td style="padding: 10px; text-align: right; font-weight: 700; background-color: var(--bg-light-gray); color: var(--green-600);">${Math.round(row_total_cost).toLocaleString()}</td>
            </tr>`;
    });

    html += `</tbody></table></div>
                <div style="margin-top: 25px; display: flex; justify-content: flex-end; gap: 15px;">
                    <div style="border: 2px solid var(--border-color); border-radius: 8px; padding: 12px 25px;">
                        <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 5px;">Total Hours</div>
                        <div style="font-size: 20px; font-weight: 800; color: var(--text-color); text-align: right;">${grand_hours} <span style="font-size: 12px; font-weight: 400;">HRS</span></div>
                    </div>
                    <div style="border: 2px solid var(--blue-500); border-radius: 8px; padding: 12px 25px; background-color: rgba(var(--blue-500-rgb), 0.03);">
                        <div style="font-size: 10px; font-weight: 600; text-transform: uppercase; color: var(--blue-500); margin-bottom: 5px;">Total Cost</div>
                        <div style="font-size: 20px; font-weight: 800; color: var(--blue-600); text-align: right;">${Math.round(grand_cost).toLocaleString()} <span style="font-size: 12px; font-weight: 400;">SAR</span></div>
                    </div>
                </div>
            </div>`;

    if (frm.get_field(SCHEMA.estimation_html_field)) {
        frm.get_field(SCHEMA.estimation_html_field).$wrapper.html(html);
    }
}
