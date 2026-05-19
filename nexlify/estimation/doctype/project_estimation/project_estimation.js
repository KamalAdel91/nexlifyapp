/*
* ============================================================
* PROJECT ESTIMATION MASTER CONTROLLER
* Client: Nexlify ERP
* Version: 10.5 (Strict Persistent Grid Renderer Edition)
* ============================================================
*/

// --- SECTION 1: SCHEMA CONFIGURATION ---
const SCHEMA = {
    estimation_html_field: 'estimation_display_html',
    rfq_dashboard_field: 'opportunity_rfq_html',
    opportunity_link_field: 'est_opportunity',
    parent_factor_field: 'estimation_factor', 

    // Database mapping for Opportunity Child Table
    opp_table: 'custom_rfq_table', 
    opp_fields: {
        item: 'opportunity_rfq_item',
        desc: 'opportunity_rfq_description',
        uom: 'opportunity_rfq_uom',
        qty: 'opportunity_rfq_quantity'
    },

    // Mapping for Estimation Tasks Table
    est_table: 'estimation', 
    est_fields: {
        rfq_link: 'rfq_item',
        task: 'task',
        qty: 'qty',
        hours: 'hours'
    },

    // Mapping for Manpower Cost Table Fields
    manpower_fields: {
        designation: 'estimation_manpowercost_designation',
        qty: 'estimation_manpowercost_quantity',
        salary: 'estimation_manpowercost_salary',
        factor: 'estimation_manpowercost_factor',
        complete: 'estimation_manpowercost_completesalary',
        per_day: 'estimation_manpowercost_salaryperday'
    }
};

// --- SECTION 2: PARENT FORM EVENTS ---

frappe.ui.form.on('Project Estimation', {
    onload: function(frm) {
        if (frm.doc.est_opportunity) {
            frappe.model.clear_doc('Opportunity', frm.doc.est_opportunity);
        }
        initialize_logic(frm);
        setup_dynamic_manpower_triggers(frm);
    },
    
    refresh: function(frm) {
        initialize_logic(frm);
        setup_dynamic_manpower_triggers(frm);
    },

    estimation_factor: function(frm) {
        let manpower_field = frm.meta.fields.find(f => f.fieldtype === 'Table' && f.options === 'Estimation Manpower Cost');
        if (manpower_field && frm.doc[manpower_field.fieldname]) {
            frm.doc[manpower_field.fieldname].forEach(row => {
                frappe.model.set_value(row.doctype, row.name, SCHEMA.manpower_fields.factor, frm.doc.estimation_factor);
            });
        }
    },

    est_opportunity: function(frm) {
        if (frm.doc.est_opportunity) {
            frappe.model.clear_doc('Opportunity', frm.doc.est_opportunity);
        }
        initialize_logic(frm);
    },

    update_tasks_btn: function(frm) {
        frm.save().then(() => {
            refresh_previews(frm);
            frm.refresh_field(SCHEMA.est_table);
            
            frappe.show_alert({
                message: __('Document saved and tasks updated successfully'),
                indicator: 'green'
            });
        });
    },

    update_manpower_btn: function(frm) {
        frm.save().then(() => {
            refresh_previews(frm);
            frm.refresh_field(SCHEMA.est_table);
            if (frm.doc.project_estimation_tasks_manpower) {
                frm.refresh_field('project_estimation_tasks_manpower');
            }
            frappe.show_alert({
                message: __('Document saved successfully'),
                indicator: 'blue'
            });
        });
    }
});

// --- SECTION 3: CHILD TABLE LOGIC (Estimation Manpower Cost) ---

frappe.ui.form.on('Estimation Manpower Cost', {
    estimation_manpowercost_quantity: function(frm, cdt, cdn) { calculate_manpower_row(frm, cdt, cdn); },
    estimation_manpowercost_salary: function(frm, cdt, cdn) { calculate_manpower_row(frm, cdt, cdn); },
    estimation_manpowercost_factor: function(frm, cdt, cdn) { calculate_manpower_row(frm, cdt, cdn); },
    
    estimation_manpower_cost_remove: function(frm) {
        render_pro_estimation_preview(frm);
    }
});

function setup_dynamic_manpower_triggers(frm) {
    let manpower_field = frm.meta.fields.find(f => f.fieldtype === 'Table' && f.options === 'Estimation Manpower Cost');
    if (manpower_field) {
        let fieldname = manpower_field.fieldname;
        frm.script_manager.set_trigger(fieldname + '_add', function(frm, cdt, cdn) {
            frappe.model.set_value(cdt, cdn, SCHEMA.manpower_fields.factor, frm.doc.estimation_factor || 1);
        }, 'Project Estimation');
    }
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
    
    render_pro_estimation_preview(frm);
}

// --- SECTION 4: TASK TABLE EVENT LISTENERS ---

frappe.ui.form.on('Project Estimation Tasks', {
    qty: function(frm) { render_pro_estimation_preview(frm); },
    hours: function(frm) { render_pro_estimation_preview(frm); },
    project_estimation_tasks_add: function(frm) { render_pro_estimation_preview(frm); },
    project_estimation_tasks_remove: function(frm) { render_pro_estimation_preview(frm); }
});

// --- SECTION 5: UTILITIES & RENDERING ---

function initialize_logic(frm) {
    // اعتراض دالة العرض الأساسية لفرابيه لضمان استقرار الاسم التوضيحي النظيف للتاسك دائماً حتى بعد الريفرش
    if (!frappe.format_patched_estimation) {
        frappe.format_patched_estimation = true;
        const original_format = frappe.format;
        frappe.format = function(value, df, options, doc) {
            if (df && df.fieldname === "estimation_task") {
                if (value && cur_frm && cur_frm.doc && cur_frm.doc.estimation) {
                    let target_row = cur_frm.doc.estimation.find(r => r.name === value);
                    if (target_row && target_row.task) {
                        return target_row.task;
                    }
                }
            }
            return original_format(value, df, options, doc);
        };
    }

    if (frappe.meta && frappe.meta.get_docfield) {
        let df = frappe.meta.get_docfield("Project Estimation Tasks", SCHEMA.est_fields.rfq_link);
        if (df) {
            df.ignore_link_validation = 1;
        }
        let df_manpower = frappe.meta.get_docfield("Project Estimation Tasks Manpower", "estimation_task");
        if (df_manpower) {
            df_manpower.ignore_link_validation = 1;
        }
    }
    
    if (frm.fields_dict[SCHEMA.est_table] && frm.fields_dict[SCHEMA.est_table].grid) {
        frm.fields_dict[SCHEMA.est_table].grid.docfields.forEach(df => {
            if (df.fieldname === SCHEMA.est_fields.rfq_link) {
                df.ignore_link_validation = 1;
            }
        });
    }

    if (frm.fields_dict["project_estimation_tasks_manpower"] && frm.fields_dict["project_estimation_tasks_manpower"].grid) {
        frm.fields_dict["project_estimation_tasks_manpower"].grid.docfields.forEach(df => {
            if (df.fieldname === "estimation_task") {
                df.ignore_link_validation = 1;
                
                df.formatter = function(value, row, column, classes) {
                    if (!value) return "";
                    let target_estimation = (frm && frm.doc ? frm.doc.estimation : []);
                    let target_row = target_estimation.find(r => r.name === value);
                    return target_row && target_row.task ? target_row.task : value;
                };
            }
        });
    }

    set_rfq_item_filter(frm);
    set_manpower_task_filter(frm);
    refresh_previews(frm);
}

function refresh_previews(frm) {
    render_pro_estimation_preview(frm);
    render_opportunity_rfq_preview(frm);
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

// --- SECTION 6: RESPONSIVE DASHBOARDS ---

function render_opportunity_rfq_preview(frm) {
    let opp_id = frm.doc.est_opportunity;
    if (!opp_id) return;

    frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Opportunity', name: opp_id },
        callback: function(r) {
            if (r.message) {
                let doc = r.message;
                let rfq_items = doc[SCHEMA.opp_table] || [];
                const F = SCHEMA.opp_fields;
                
                let html = `
                    <div style="background-color: transparent; border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                        <div style="display: flex; align-items: center; margin-bottom: 15px; border-left: 4px solid var(--blue-500); padding-left: 15px;">
                            <h5 style="margin: 0; color: var(--text-color) !important; font-weight: 700;">Client RFQ</h5>
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
                                <tbody>
                `;

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

    let total_salary_per_day = 0;
    let manpower_field = frm.meta.fields.find(f => f.fieldtype === 'Table' && f.options === 'Estimation Manpower Cost');
    
    if (manpower_field && frm.doc[manpower_field.fieldname]) {
        frm.doc[manpower_field.fieldname].forEach(row => {
            total_salary_per_day += flt(row[SCHEMA.manpower_fields.per_day]);
        });
    }
    
    let hourly_rate = total_salary_per_day / 8;

    let html = `
        <div style="background-color: transparent; border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 30px;">
            <div style="display: flex; align-items: center; margin-bottom: 15px; border-left: 4px solid var(--blue-500); padding-left: 15px;">
                <h5 style="margin: 0; color: var(--text-color) !important; font-weight: 700;">Estimation Calculation</h5>
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
                    <tbody>
    `;

    tasks.forEach((row, index) => {
        let row_total_hours = flt(row[F.qty]) * flt(row[F.hours]);
        let row_total_cost = row_total_hours * hourly_rate;
        
        grand_hours += row_total_hours;
        grand_cost += row_total_cost;
        
        // تنظيف القيمة المجمعة ديناميكياً لعرض اسم الـ Item فقط دون معرف الـ Opportunity التابع له
        let display_rfq_item = row[F.rfq_link] || '-';
        if (frm.doc.est_opportunity && display_rfq_item.endsWith(frm.doc.est_opportunity)) {
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